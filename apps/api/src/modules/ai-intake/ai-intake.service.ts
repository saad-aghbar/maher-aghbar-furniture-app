import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AIJobStatus, Locale, Prisma, RequestSource, RequestStatus } from '@maher/database';
import type { ExtractionProvider, OcrProvider } from '@maher/integrations';
import { existsSync, promises as fs } from 'fs';
import { join } from 'path';
import { PrismaService } from '../../common/prisma.service';
import { SequenceService } from '../../common/sequence.service';
import { pageSkipTake, paginatedMeta } from '../../common/dto/pagination.dto';
import {
  EXTRACTION_PROVIDER,
  OCR_PROVIDER,
} from '../../integrations/integrations.module';

function toLocale(lang: string | undefined): Locale {
  if (lang === 'ar') return Locale.ar;
  if (lang === 'he') return Locale.he;
  return Locale.en;
}

function dimsNote(fieldMap: Record<string, string | undefined>): string | undefined {
  const parts: string[] = [];
  if (fieldMap.width) parts.push(`W=${fieldMap.width}`);
  if (fieldMap.height) parts.push(`H=${fieldMap.height}`);
  if (fieldMap.depth) parts.push(`D=${fieldMap.depth}`);
  return parts.length ? `Dimensions (from AI, review required): ${parts.join(' ')}` : undefined;
}

@Injectable()
export class AiIntakeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequences: SequenceService,
    @Inject(OCR_PROVIDER) private readonly ocr: OcrProvider,
    @Inject(EXTRACTION_PROVIDER) private readonly extract: ExtractionProvider,
  ) {}

  async list(query: { page?: number | string; pageSize?: number | string }) {
    const { page, pageSize, skip, take } = pageSkipTake(query);
    const [totalItems, data] = await this.prisma.$transaction([
      this.prisma.aIExtractionJob.count(),
      this.prisma.aIExtractionJob.findMany({
        include: { fields: true, request: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
    ]);
    return { data, meta: paginatedMeta(page, pageSize, totalItems) };
  }

  private async resolveSourceText(dto: {
    storageKey?: string;
    rawText?: string;
  }): Promise<string> {
    if (dto.rawText?.trim()) return dto.rawText.trim();

    if (dto.storageKey) {
      const root = process.env.LOCAL_UPLOAD_DIR
        ? process.env.LOCAL_UPLOAD_DIR
        : join(process.cwd(), '../../uploads');
      const fullPath = join(root, dto.storageKey);
      if (existsSync(fullPath)) {
        const buf = await fs.readFile(fullPath);
        const mime = dto.storageKey.endsWith('.pdf')
          ? 'application/pdf'
          : dto.storageKey.match(/\.(png|jpe?g|webp|gif)$/i)
            ? `image/${dto.storageKey.split('.').pop()!.toLowerCase().replace('jpg', 'jpeg')}`
            : 'application/octet-stream';
        const ocr = await this.ocr.extractText(buf, mime);
        if (ocr.text?.trim()) return ocr.text.trim();
      }
    }

    // Mock OCR fixture when no text/file — keeps local/CI reviewable
    const ocr = await this.ocr.extractText(Buffer.from(''), 'text/plain');
    return ocr.text;
  }

  async createJob(
    dto: { sourceType: string; storageKey?: string; rawText?: string; customerId?: string },
    userId: string,
  ) {
    const number = await this.sequences.next('AI', 'AI');

    const job = await this.prisma.aIExtractionJob.create({
      data: {
        number,
        status: AIJobStatus.PROCESSING,
        sourceType: dto.sourceType,
        storageKey: dto.storageKey,
        provider: this.extract.name,
      },
    });

    try {
      const originalText = await this.resolveSourceText(dto);
      const extracted = await this.extract.extractStructured(originalText, {
        customerId: dto.customerId,
      });

      const updated = await this.prisma.aIExtractionJob.update({
        where: { id: job.id },
        data: {
          status: AIJobStatus.NEEDS_REVIEW,
          originalText: extracted.originalText,
          translatedText: extracted.translatedText,
          detectedLanguage: toLocale(extracted.detectedLanguage),
          targetLanguage: Locale.ar,
          provider: extracted.provider,
          fields: {
            create: extracted.fields.map((f) => ({
              fieldName: f.fieldName,
              fieldValue: f.fieldValue,
              confidence: f.confidence,
              isMissing: f.isMissing ?? false,
            })),
          },
        },
        include: { fields: true },
      });

      await this.prisma.auditEvent.create({
        data: {
          userId,
          action: 'ai-intake.create',
          entityType: 'AIExtractionJob',
          entityId: updated.id,
          newValues: {
            status: AIJobStatus.NEEDS_REVIEW,
            provider: extracted.provider,
          } as Prisma.InputJsonValue,
        },
      });

      return updated;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'AI intake failed';
      await this.prisma.aIExtractionJob.update({
        where: { id: job.id },
        data: { status: AIJobStatus.FAILED, errorMessage: message },
      });
      throw new BadRequestException({ code: 'AI_INTAKE_FAILED', message });
    }
  }

  async get(id: string) {
    const job = await this.prisma.aIExtractionJob.findUnique({
      where: { id },
      include: { fields: true, request: true },
    });
    if (!job) throw new NotFoundException({ code: 'NOT_FOUND', message: 'AI job not found.' });
    return job;
  }

  async reject(id: string, userId: string, reason?: string) {
    const job = await this.get(id);
    if (job.status === AIJobStatus.COMPLETED) {
      throw new BadRequestException({
        code: 'INVALID_STATUS',
        message: 'Completed jobs cannot be rejected.',
      });
    }
    return this.prisma.aIExtractionJob.update({
      where: { id },
      data: {
        status: AIJobStatus.FAILED,
        errorMessage: reason ?? 'Rejected by reviewer',
        reviewedById: userId,
        reviewedAt: new Date(),
      },
      include: { fields: true },
    });
  }

  /**
   * Human review gate: approve creates a DRAFT RFQ only.
   * Dimensions are optional — stored in item notes when present (never required).
   */
  async approve(
    id: string,
    dto: { customerId: string; fieldOverrides?: Record<string, string> },
    userId: string,
  ) {
    const job = await this.get(id);
    if (job.status !== AIJobStatus.NEEDS_REVIEW) {
      throw new BadRequestException({
        code: 'INVALID_STATUS',
        message: 'Job must be NEEDS_REVIEW (human review required) before approval.',
      });
    }

    const fieldMap: Record<string, string | undefined> = Object.fromEntries(
      job.fields.map((f) => [f.fieldName, f.reviewedValue ?? f.fieldValue ?? undefined]),
    );
    Object.assign(fieldMap, dto.fieldOverrides ?? {});

    const dimNote = dimsNote(fieldMap);
    const itemNotes = [
      'Created from AI intake — human approved (draft only)',
      dimNote,
      fieldMap.fabric ? `Fabric: ${fieldMap.fabric}` : undefined,
      fieldMap.deliveryDate ? `Delivery: ${fieldMap.deliveryDate}` : undefined,
    ]
      .filter(Boolean)
      .join('\n');

    const number = await this.sequences.next('RFQ', 'RFQ');
    const request = await this.prisma.$transaction(async (tx) => {
      const rfq = await tx.requestForQuotation.create({
        data: {
          number,
          customerId: dto.customerId,
          source: RequestSource.PDF,
          status: RequestStatus.DRAFT,
          notes: job.translatedText ?? job.originalText,
          createdById: userId,
          aiProcessingStatus: AIJobStatus.COMPLETED,
          items: {
            create: [
              {
                productName: fieldMap.product ?? 'Custom furniture',
                quantity: Number(fieldMap.quantity ?? 1),
                // Dimensions intentionally omitted from structured columns —
                // put extracted dims in notes for human confirmation later.
                fabricType: fieldMap.fabric,
                notes: itemNotes,
              },
            ],
          },
        },
        include: { items: true },
      });

      await tx.aIExtractionJob.update({
        where: { id },
        data: {
          status: AIJobStatus.COMPLETED,
          requestId: rfq.id,
          reviewedById: userId,
          reviewedAt: new Date(),
        },
      });

      await tx.auditEvent.create({
        data: {
          userId,
          action: 'ai-intake.approve',
          entityType: 'AIExtractionJob',
          entityId: id,
          newValues: {
            requestId: rfq.id,
            status: RequestStatus.DRAFT,
          } as Prisma.InputJsonValue,
        },
      });

      return rfq;
    });

    return { jobId: id, request };
  }
}
