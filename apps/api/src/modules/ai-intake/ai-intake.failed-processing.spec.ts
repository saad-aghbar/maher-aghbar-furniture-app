import { BadRequestException } from '@nestjs/common';
import { AIJobStatus } from '@maher/database';
import { AiIntakeService } from './ai-intake.service';
import type { PrismaService } from '../../common/prisma.service';
import type { SequenceService } from '../../common/sequence.service';
import type { LocalStorageService } from '../../integrations/storage/local-storage.service';
import type { ExtractionProvider, OcrProvider } from '@maher/integrations';

describe('AiIntakeService failed / invalid extraction', () => {
  function makeService(opts?: {
    extractImpl?: ExtractionProvider['extractStructured'];
    ocrText?: string;
  }) {
    const jobId = 'job-fail-1';
    const created = {
      id: jobId,
      number: 'AI-9',
      status: AIJobStatus.UPLOADED,
      storageKey: 'file.png',
      sourceType: 'IMAGE',
    };

    const aIExtractionJob = {
      create: jest.fn().mockResolvedValue(created),
      update: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
        ...created,
        ...data,
        fields: [],
        request: null,
      })),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    };

    const prisma: {
      aIExtractionJob: typeof aIExtractionJob;
      aIExtractionField: { updateMany: jest.Mock; create: jest.Mock };
      auditEvent: { create: jest.Mock };
      systemSetting: { findMany: jest.Mock };
      $transaction: jest.Mock;
    } = {
      aIExtractionJob,
      aIExtractionField: { updateMany: jest.fn(), create: jest.fn() },
      auditEvent: { create: jest.fn() },
      systemSetting: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn(async (ops: unknown) => {
        if (Array.isArray(ops)) return Promise.all(ops);
        return (ops as (tx: unknown) => unknown)(prisma);
      }),
    };

    const sequences = { next: jest.fn().mockResolvedValue('AI-9') } as unknown as SequenceService;
    const storage = {
      createAccessToken: jest.fn(() => 'tok'),
    } as unknown as LocalStorageService;

    const ocr = {
      extractText: jest.fn().mockResolvedValue({ text: opts?.ocrText ?? '' }),
    } as unknown as OcrProvider;

    const extract = {
      name: 'mock',
      extractStructured:
        opts?.extractImpl ??
        jest.fn().mockResolvedValue({
          originalText: 'x',
          translatedText: 'x',
          detectedLanguage: 'en',
          provider: 'mock',
          fields: [{ fieldName: 'quantity', fieldValue: '1', confidence: 0.5 }],
          items: [],
        }),
    } as unknown as ExtractionProvider;

    const service = new AiIntakeService(
      prisma as unknown as PrismaService,
      sequences,
      storage,
      ocr,
      extract,
    
      { sendFromTemplate: jest.fn().mockResolvedValue({ ok: true }), notifyAdminUsers: jest.fn().mockResolvedValue({ ok: true }), notifyCustomerUsers: jest.fn().mockResolvedValue({ ok: true }) } as any,
    );

    return { service, aIExtractionJob, extract, ocr };
  }

  it('marks job FAILED when source text cannot be read', async () => {
    const { service, aIExtractionJob, ocr } = makeService({ ocrText: '' });
    // Force OpenAI path off by empty ocr then mock still returns empty from resolveSourceText
    // resolveSourceText with no rawText and empty file falls through to mock ocr Buffer
    ocr.extractText = jest.fn().mockResolvedValue({ text: '' });

    await expect(
      service.createJob({ sourceType: 'IMAGE', rawText: '   ' }, 'admin-1'),
    ).rejects.toBeInstanceOf(BadRequestException);

    const failedUpdate = aIExtractionJob.update.mock.calls.find(
      (c: [{ data: { status?: string } }]) => c[0]?.data?.status === AIJobStatus.FAILED,
    );
    expect(failedUpdate).toBeTruthy();
  });

  it('marks job FAILED for invalid extraction without product', async () => {
    const { service, aIExtractionJob } = makeService({
      ocrText: 'qty 2 only',
      extractImpl: jest.fn().mockResolvedValue({
        originalText: 'qty 2 only',
        translatedText: 'qty 2 only',
        detectedLanguage: 'en',
        provider: 'mock',
        fields: [{ fieldName: 'quantity', fieldValue: '2', confidence: 0.9 }],
        items: [],
      }),
    });

    await expect(
      service.createJob({ sourceType: 'TEXT', rawText: 'qty 2 only' }, 'admin-1'),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'INVALID_EXTRACTION' }),
    });

    expect(
      aIExtractionJob.update.mock.calls.some(
        (c: [{ data: { status?: string } }]) => c[0]?.data?.status === AIJobStatus.FAILED,
      ),
    ).toBe(true);
  });

  it('rejects approve when job is not awaiting human review', async () => {
    const { service, aIExtractionJob } = makeService();
    aIExtractionJob.findUnique.mockResolvedValue({
      id: 'job-1',
      number: 'AI-1',
      status: AIJobStatus.COMPLETED,
      fields: [],
      request: null,
      storageKey: null,
    });

    await expect(
      service.approve('job-1', { customerId: 'c1' }, 'admin-1'),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'INVALID_STATUS' }),
    });
  });

  it('approve validation blocks empty customer (AI never auto-approves)', async () => {
    const { service, aIExtractionJob } = makeService();
    aIExtractionJob.findUnique.mockResolvedValue({
      id: 'job-1',
      number: 'AI-1',
      status: AIJobStatus.NEEDS_REVIEW,
      fields: [{ fieldName: 'product', fieldValue: 'Sofa', confidence: 0.9 }],
      request: null,
      storageKey: null,
    });

    await expect(
      service.approve('job-1', { customerId: '' }, 'admin-1'),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'CUSTOMER_REQUIRED' }),
    });
  });
});
