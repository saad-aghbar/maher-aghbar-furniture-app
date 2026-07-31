import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AIJobStatus, Locale, RequestSource, RequestStatus } from '@maher/database';
import { PrismaService } from '../../common/prisma.service';
import { SequenceService } from '../../common/sequence.service';

@Injectable()
export class AiIntakeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequences: SequenceService,
  ) {}

  async createJob(
    dto: { sourceType: string; storageKey?: string; rawText?: string; customerId?: string },
    userId: string,
  ) {
    const number = await this.sequences.next('AI', 'AI');
    const originalText =
      dto.rawText ??
      'Sofa 3 seats grey velvet W220 H90 D95 qty 4 delivery 2026-09-15 hotel lobby';

    const job = await this.prisma.aIExtractionJob.create({
      data: {
        number,
        status: AIJobStatus.NEEDS_REVIEW,
        sourceType: dto.sourceType,
        storageKey: dto.storageKey,
        originalText,
        translatedText: 'كنبة 3 مقاعد قطيفة رمادي عرض 220 ارتفاع 90 عمق 95 كمية 4 تسليم 2026-09-15 لوبي الفندق',
        detectedLanguage: Locale.en,
        targetLanguage: Locale.ar,
        provider: process.env.AI_PROVIDER ?? 'mock',
        fields: {
          create: [
            { fieldName: 'product', fieldValue: '3-Seater Sofa', confidence: 0.92 },
            { fieldName: 'quantity', fieldValue: '4', confidence: 0.95 },
            { fieldName: 'width', fieldValue: '220', confidence: 0.88 },
            { fieldName: 'height', fieldValue: '90', confidence: 0.88 },
            { fieldName: 'depth', fieldValue: '95', confidence: 0.88 },
            { fieldName: 'fabric', fieldValue: 'Grey Velvet', confidence: 0.84 },
            { fieldName: 'deliveryDate', fieldValue: '2026-09-15', confidence: 0.9 },
            { fieldName: 'customer', fieldValue: dto.customerId ?? null, confidence: 0.4, isMissing: !dto.customerId },
          ],
        },
      },
      include: { fields: true },
    });

    await this.prisma.auditEvent.create({
      data: {
        userId,
        action: 'ai-intake.create',
        entityType: 'AIExtractionJob',
        entityId: job.id,
      },
    });

    return job;
  }

  async get(id: string) {
    const job = await this.prisma.aIExtractionJob.findUnique({
      where: { id },
      include: { fields: true, request: true },
    });
    if (!job) throw new NotFoundException({ code: 'NOT_FOUND', message: 'AI job not found.' });
    return job;
  }

  async approve(
    id: string,
    dto: { customerId: string; fieldOverrides?: Record<string, string> },
    userId: string,
  ) {
    const job = await this.get(id);
    if (job.status !== AIJobStatus.NEEDS_REVIEW && job.status !== AIJobStatus.COMPLETED) {
      throw new BadRequestException({
        code: 'INVALID_STATUS',
        message: 'Job is not ready for approval.',
      });
    }

    const fieldMap = Object.fromEntries(job.fields.map((f) => [f.fieldName, f.reviewedValue ?? f.fieldValue]));
    Object.assign(fieldMap, dto.fieldOverrides ?? {});

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
                width: fieldMap.width ? Number(fieldMap.width) : undefined,
                height: fieldMap.height ? Number(fieldMap.height) : undefined,
                depth: fieldMap.depth ? Number(fieldMap.depth) : undefined,
                fabricType: fieldMap.fabric,
                notes: 'Created from AI intake — human approved',
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

      return rfq;
    });

    return { jobId: id, request };
  }
}
