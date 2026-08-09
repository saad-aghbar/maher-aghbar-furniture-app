import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AIJobStatus, Locale, Prisma, RequestSource, RequestStatus } from '@maher/database';
import type { ExtractionProvider, OcrProvider, SupportedLocale } from '@maher/integrations';
import { existsSync, promises as fs } from 'fs';
import { join } from 'path';
import { PrismaService } from '../../common/prisma.service';
import { SequenceService } from '../../common/sequence.service';
import { pageSkipTake, paginatedMeta } from '../../common/dto/pagination.dto';
import { LocalStorageService } from '../../integrations/storage/local-storage.service';
import {
  EXTRACTION_PROVIDER,
  OCR_PROVIDER,
} from '../../integrations/integrations.module';
import {
  fieldMapFromJobFields,
  itemsFieldFromExtraction,
  lineItemsToRequestCreate,
  resolveLineItems,
} from './ai-intake.mapper';
import { buildReviewFromJob, validateApprovePayload } from './ai-intake.review';
import { NotificationsService } from '../notifications/notifications.service';

function toLocale(lang: string | undefined): Locale {
  if (lang === 'ar') return Locale.ar;
  if (lang === 'he') return Locale.he;
  return Locale.en;
}

function fromLocale(locale: Locale): SupportedLocale {
  if (locale === Locale.ar) return 'ar';
  if (locale === Locale.he) return 'he';
  return 'en';
}

function usesOpenAi(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

@Injectable()
export class AiIntakeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequences: SequenceService,
    private readonly storage: LocalStorageService,
    @Inject(OCR_PROVIDER) private readonly ocr: OcrProvider,
    @Inject(EXTRACTION_PROVIDER) private readonly extract: ExtractionProvider,
    private readonly notifications: NotificationsService,
  ) {}

  private withReviewPayload<T extends {
    id: string;
    number: string;
    status: AIJobStatus;
    storageKey?: string | null;
    originalText?: string | null;
    translatedText?: string | null;
    errorMessage?: string | null;
    provider?: string | null;
    request?: { id: string; number: string } | null;
    fields?: Array<{
      fieldName: string;
      fieldValue?: string | null;
      reviewedValue?: string | null;
      confidence?: unknown;
      isMissing?: boolean;
    }>;
  }>(job: T) {
    const originalDownloadPath = job.storageKey
      ? `/api/v1/uploads/download?token=${this.storage.createAccessToken(job.storageKey, 3600)}`
      : null;
    const review = buildReviewFromJob({ ...job, originalDownloadPath });
    return { ...job, originalDownloadPath, review };
  }
  async list(query: { page?: number | string; pageSize?: number | string }) {
    const { page, pageSize, skip, take } = pageSkipTake(query);
    const [totalItems, data] = await this.prisma.$transaction([
      this.prisma.aIExtractionJob.count(),
      this.prisma.aIExtractionJob.findMany({
        include: { fields: true, request: { select: { id: true, number: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
    ]);
    return {
      data: data.map((job) => this.withReviewPayload(job)),
      meta: paginatedMeta(page, pageSize, totalItems),
    };
  }

  private async resolveTargetLanguage(): Promise<Locale> {
    const rows = await this.prisma.systemSetting.findMany({
      where: { key: { in: ['app', 'defaultLanguage', 'company'] } },
    });
    for (const row of rows) {
      if (row.key === 'defaultLanguage') {
        const direct = row.value;
        if (typeof direct === 'string' && (direct === 'ar' || direct === 'he' || direct === 'en')) {
          return toLocale(direct);
        }
        if (direct && typeof direct === 'object' && !Array.isArray(direct)) {
          const lang = (direct as Record<string, unknown>).defaultLanguage;
          if (typeof lang === 'string') return toLocale(lang);
        }
      }
      if (row.key === 'app' || row.key === 'company') {
        const val = row.value as Record<string, unknown> | null;
        const lang = val?.defaultLanguage;
        if (typeof lang === 'string') return toLocale(lang);
      }
    }
    const env = process.env.DEFAULT_LOCALE;
    if (env === 'ar' || env === 'he' || env === 'en') return toLocale(env);
    return Locale.ar;
  }

  private async resolveSourceText(dto: {
    storageKey?: string;
    rawText?: string;
    mimeHint?: string;
  }): Promise<string> {
    if (dto.rawText?.trim()) return dto.rawText.trim();

    if (dto.storageKey) {
      const root = process.env.LOCAL_UPLOAD_DIR
        ? process.env.LOCAL_UPLOAD_DIR
        : join(process.cwd(), '../../uploads');
      const fullPath = join(root, dto.storageKey);
      if (existsSync(fullPath)) {
        const buf = await fs.readFile(fullPath);
        const mime =
          dto.mimeHint ??
          (dto.storageKey.endsWith('.pdf')
            ? 'application/pdf'
            : dto.storageKey.match(/\.(png|jpe?g|webp|gif)$/i)
              ? `image/${dto.storageKey.split('.').pop()!.toLowerCase().replace('jpg', 'jpeg')}`
              : 'application/octet-stream');
        const ocr = await this.ocr.extractText(buf, mime);
        if (ocr.text?.trim()) return ocr.text.trim();
      }
    }

    if (usesOpenAi()) {
      throw new BadRequestException({
        code: 'NO_SOURCE',
        message: 'Provide rawText or a readable storageKey for OpenAI extraction.',
      });
    }

    const ocr = await this.ocr.extractText(Buffer.from(''), 'text/plain');
    return ocr.text;
  }

  async resolveSourceTextFromBuffers(parts: Array<{ buffer: Buffer; mimeType: string }>, fallbackText = '') {
    const chunks: string[] = [];
    if (fallbackText.trim()) chunks.push(fallbackText.trim());

    for (const part of parts) {
      if (!part.buffer.length) continue;
      const ocr = await this.ocr.extractText(part.buffer, part.mimeType);
      if (ocr.text?.trim()) chunks.push(ocr.text.trim());
    }

    const combined = chunks.join('\n\n').trim();
    if (combined) return combined;
    if (usesOpenAi()) {
      throw new BadRequestException({
        code: 'NO_SOURCE',
        message: 'No readable text found in email body or attachments.',
      });
    }
    const ocr = await this.ocr.extractText(Buffer.from(''), 'text/plain');
    return ocr.text;
  }

  private buildFieldRows(extracted: Awaited<ReturnType<ExtractionProvider['extractStructured']>>) {
    const itemsField = itemsFieldFromExtraction(extracted.items);
    return [
      ...extracted.fields.map((f) => ({
        fieldName: f.fieldName,
        fieldValue: f.fieldValue,
        confidence: f.confidence,
        isMissing: f.isMissing ?? false,
      })),
      ...(itemsField ? [itemsField] : []),
    ];
  }

  async createJob(
    dto: { sourceType: string; storageKey?: string; rawText?: string; customerId?: string },
    userId: string,
  ) {
    const number = await this.sequences.next('AI', 'AI');
    // Preserve original upload key; progress through explicit phases (no fake %).
    const job = await this.prisma.aIExtractionJob.create({
      data: {
        number,
        status: AIJobStatus.UPLOADED,
        sourceType: dto.sourceType,
        storageKey: dto.storageKey,
        provider: this.extract.name,
      },
    });

    try {
      await this.prisma.aIExtractionJob.update({
        where: { id: job.id },
        data: { status: AIJobStatus.QUEUED },
      });

      await this.prisma.aIExtractionJob.update({
        where: { id: job.id },
        data: { status: AIJobStatus.PROCESSING },
      });

      const originalText = await this.resolveSourceText(dto);
      if (!originalText?.trim()) {
        throw new BadRequestException({
          code: 'INVALID_EXTRACTION',
          message: 'Could not read any text from the upload.',
        });
      }

      const targetLanguage = await this.resolveTargetLanguage();
      const extracted = await this.extract.extractStructured(originalText, {
        customerId: dto.customerId,
        targetLanguage: fromLocale(targetLanguage),
      });

      const fieldRows = this.buildFieldRows(extracted);
      const hasProduct = fieldRows.some(
        (f) => f.fieldName === 'product' && Boolean(String(f.fieldValue ?? '').trim()),
      );
      if (!hasProduct) {
        throw new BadRequestException({
          code: 'INVALID_EXTRACTION',
          message: 'Extraction did not identify a product/model.',
        });
      }

      const updated = await this.prisma.aIExtractionJob.update({
        where: { id: job.id },
        data: {
          status: AIJobStatus.NEEDS_REVIEW,
          originalText: extracted.originalText,
          translatedText: extracted.translatedText,
          detectedLanguage: toLocale(extracted.detectedLanguage),
          targetLanguage,
          provider: extracted.provider,
          fields: { create: fieldRows },
        },
        include: { fields: true, request: { select: { id: true, number: true } } },
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

      await this.notifications
        .notifyAdminUsers({
          templateCode: 'AI_DRAFT_READY',
          vars: { jobNumber: updated.id.slice(0, 8) },
          linkUrl: `/ai-intake/${updated.id}`,
        })
        .catch(() => undefined);

      return this.withReviewPayload(updated);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'AI intake failed';
      await this.prisma.aIExtractionJob.update({
        where: { id: job.id },
        data: { status: AIJobStatus.FAILED, errorMessage: message },
      });
      throw err instanceof BadRequestException
        ? err
        : new BadRequestException({ code: 'AI_INTAKE_FAILED', message });
    }
  }

  async get(id: string) {
    const job = await this.prisma.aIExtractionJob.findUnique({
      where: { id },
      include: { fields: true, request: { select: { id: true, number: true } } },
    });
    if (!job) throw new NotFoundException({ code: 'NOT_FOUND', message: 'AI job not found.' });
    return this.withReviewPayload(job);
  }

  async correctFields(
    id: string,
    fieldOverrides: Record<string, string>,
    userId: string,
  ) {
    const job = await this.get(id);
    if (job.status !== AIJobStatus.NEEDS_REVIEW) {
      throw new BadRequestException({
        code: 'INVALID_STATUS',
        message: 'Only jobs awaiting review can be corrected.',
      });
    }

    for (const [fieldName, value] of Object.entries(fieldOverrides)) {
      if (fieldName === '__items') continue;
      const existing = job.fields?.find((f) => f.fieldName === fieldName);
      if (existing) {
        await this.prisma.aIExtractionField.updateMany({
          where: { jobId: id, fieldName },
          data: {
            reviewedValue: value,
            isMissing: !String(value ?? '').trim(),
          },
        });
      } else {
        await this.prisma.aIExtractionField.create({
          data: {
            jobId: id,
            fieldName,
            fieldValue: value,
            reviewedValue: value,
            isMissing: !String(value ?? '').trim(),
            confidence: 1,
          },
        });
      }
    }

    await this.prisma.auditEvent.create({
      data: {
        userId,
        action: 'ai-intake.correct',
        entityType: 'AIExtractionJob',
        entityId: id,
        newValues: { fields: Object.keys(fieldOverrides) } as Prisma.InputJsonValue,
      },
    });

    return this.get(id);
  }

  async requestManualHandling(id: string, userId: string, notes?: string) {
    const job = await this.get(id);
    if (job.status !== AIJobStatus.NEEDS_REVIEW) {
      throw new BadRequestException({
        code: 'INVALID_STATUS',
        message: 'Only jobs awaiting review can be sent to manual handling.',
      });
    }

    const updated = await this.prisma.aIExtractionJob.update({
      where: { id },
      data: {
        status: AIJobStatus.FAILED,
        errorMessage: `MANUAL: ${notes?.trim() || 'Manual handling requested'}`,
        reviewedById: userId,
        reviewedAt: new Date(),
      },
      include: { fields: true, request: { select: { id: true, number: true } } },
    });

    await this.prisma.auditEvent.create({
      data: {
        userId,
        action: 'ai-intake.manual',
        entityType: 'AIExtractionJob',
        entityId: id,
        newValues: { reason: notes ?? null } as Prisma.InputJsonValue,
      },
    });

    return this.withReviewPayload(updated);
  }

  async reject(id: string, userId: string, reason?: string) {
    const job = await this.get(id);
    if (job.status === AIJobStatus.COMPLETED) {
      throw new BadRequestException({
        code: 'INVALID_STATUS',
        message: 'Completed jobs cannot be rejected.',
      });
    }
    const updated = await this.prisma.aIExtractionJob.update({
      where: { id },
      data: {
        status: AIJobStatus.FAILED,
        errorMessage: reason ?? 'Rejected by reviewer',
        reviewedById: userId,
        reviewedAt: new Date(),
      },
      include: { fields: true, request: { select: { id: true, number: true } } },
    });
    await this.prisma.auditEvent.create({
      data: {
        userId,
        action: 'ai-intake.reject',
        entityType: 'AIExtractionJob',
        entityId: id,
        newValues: { reason: reason ?? null } as Prisma.InputJsonValue,
      },
    });
    return this.withReviewPayload(updated);
  }

  /**
   * Human review gate: approve creates a DRAFT RFQ only.
   * AI never auto-approves, never creates invoices, never touches inventory.
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

    const validation = validateApprovePayload({
      customerId: dto.customerId,
      fieldOverrides: dto.fieldOverrides,
      fields: job.fields ?? [],
    });
    if (!validation.ok) {
      throw new BadRequestException({
        code: validation.code,
        message: validation.message,
      });
    }

    if (dto.fieldOverrides && Object.keys(dto.fieldOverrides).length) {
      await this.correctFields(id, dto.fieldOverrides, userId);
    }

    const fresh = await this.prisma.aIExtractionJob.findUniqueOrThrow({
      where: { id },
      include: { fields: true },
    });

    const request = await this.createDraftRfqFromJob(fresh, dto.customerId, userId, {
      fieldOverrides: dto.fieldOverrides,
      markJobCompleted: true,
      reviewerId: userId,
    });

    // Explicit contract: draft RFQ only — no invoice, inventory, or order confirm here.
    return {
      jobId: id,
      request: {
        id: request.id,
        number: request.number,
        status: request.status,
      },
      created: {
        draftRfq: true,
        invoice: false,
        inventoryMovement: false,
        salesOrder: false,
      },
    };
  }

  async createDraftRfqFromJob(
    job: {
      id: string;
      fields: Array<{ fieldName: string; fieldValue?: string | null; reviewedValue?: string | null }>;
      translatedText?: string | null;
      originalText?: string | null;
      sourceType?: string;
    },
    customerId: string,
    createdById: string | null,
    opts?: {
      fieldOverrides?: Record<string, string>;
      markJobCompleted?: boolean;
      reviewerId?: string | null;
      source?: RequestSource;
      headerNote?: string;
      projectName?: string | null;
      requiredDeliveryDate?: Date | null;
      assignedSalesId?: string | null;
      status?: RequestStatus;
    },
  ) {
    const fieldMap = fieldMapFromJobFields(job.fields, opts?.fieldOverrides);
    const lineItems = resolveLineItems(job.fields, opts?.fieldOverrides);
    const itemRows = lineItemsToRequestCreate(
      lineItems,
      opts?.headerNote ?? 'Created from AI intake — human approved (draft only)',
    );

    const deliveryRaw = fieldMap.deliveryDate;
    const requiredDeliveryDate =
      opts?.requiredDeliveryDate ??
      (deliveryRaw ? new Date(deliveryRaw) : null);
    const projectName = opts?.projectName ?? fieldMap.projectName ?? null;

    const number = await this.sequences.next('RFQ', 'RFQ');
    const source =
      opts?.source ??
      (job.sourceType === 'EMAIL'
        ? RequestSource.EMAIL
        : job.sourceType === 'IMAGE'
          ? RequestSource.IMAGE
          : RequestSource.PDF);

    return this.prisma.$transaction(async (tx) => {
      const rfq = await tx.requestForQuotation.create({
        data: {
          number,
          customerId,
          source,
          status: opts?.status ?? RequestStatus.DRAFT,
          notes: job.translatedText ?? job.originalText,
          projectName,
          requiredDeliveryDate:
            requiredDeliveryDate && !Number.isNaN(requiredDeliveryDate.getTime())
              ? requiredDeliveryDate
              : undefined,
          createdById: createdById ?? undefined,
          assignedSalesId: opts?.assignedSalesId ?? undefined,
          aiProcessingStatus: AIJobStatus.COMPLETED,
          items: { create: itemRows },
        },
        include: { items: true, customer: true },
      });

      if (opts?.markJobCompleted) {
        await tx.aIExtractionJob.update({
          where: { id: job.id },
          data: {
            status: AIJobStatus.COMPLETED,
            requestId: rfq.id,
            reviewedById: opts.reviewerId ?? createdById ?? undefined,
            reviewedAt: new Date(),
          },
        });

        await tx.auditEvent.create({
          data: {
            userId: createdById ?? undefined,
            action: 'ai-intake.approve',
            entityType: 'AIExtractionJob',
            entityId: job.id,
            newValues: {
              requestId: rfq.id,
              status: opts?.status ?? RequestStatus.DRAFT,
            } as Prisma.InputJsonValue,
          },
        });
      }

      return rfq;
    });
  }

  async createJobAndDraftRfqFromText(
    input: {
      sourceType: string;
      text: string;
      customerId: string;
      createdById?: string | null;
      source?: RequestSource;
      headerNote?: string;
      assignedSalesId?: string | null;
    },
  ) {
    const number = await this.sequences.next('AI', 'AI');
    const targetLanguage = await this.resolveTargetLanguage();
    const extracted = await this.extract.extractStructured(input.text, {
      customerId: input.customerId,
      targetLanguage: fromLocale(targetLanguage),
    });

    const job = await this.prisma.aIExtractionJob.create({
      data: {
        number,
        status: AIJobStatus.PROCESSING,
        sourceType: input.sourceType,
        provider: extracted.provider,
        originalText: extracted.originalText,
        translatedText: extracted.translatedText,
        detectedLanguage: toLocale(extracted.detectedLanguage),
        targetLanguage,
        fields: { create: this.buildFieldRows(extracted) },
      },
      include: { fields: true },
    });

    try {
      const request = await this.createDraftRfqFromJob(job, input.customerId, input.createdById ?? null, {
        source: input.source,
        headerNote: input.headerNote,
        assignedSalesId: input.assignedSalesId,
        markJobCompleted: true,
      });

      return { job: { ...job, status: AIJobStatus.COMPLETED, requestId: request.id }, request };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Inbound intake failed';
      await this.prisma.aIExtractionJob.update({
        where: { id: job.id },
        data: { status: AIJobStatus.FAILED, errorMessage: message },
      });
      throw err;
    }
  }

  /**
   * OCR an uploaded file, extract structured order fields, and create an RFQ linked to the AI job.
   * Always creates a DRAFT so dealers/admins can review before submit.
   */
  async processUploadIntoDraftOrder(input: {
    storageKey: string;
    customerId: string;
    userId: string;
    mimeHint?: string;
    sourceType?: string;
    dealerOriginated?: boolean;
  }) {
    const targetLanguage = await this.resolveTargetLanguage();
    const number = await this.sequences.next('AI', 'AI');
    const sourceType = input.sourceType ?? 'IMAGE';

    const job = await this.prisma.aIExtractionJob.create({
      data: {
        number,
        status: AIJobStatus.PROCESSING,
        sourceType,
        storageKey: input.storageKey,
        provider: this.extract.name,
        targetLanguage,
      },
    });

    try {
      const originalText = await this.resolveSourceText({
        storageKey: input.storageKey,
        mimeHint: input.mimeHint,
      });
      const extracted = await this.extract.extractStructured(originalText, {
        customerId: input.customerId,
        targetLanguage: fromLocale(targetLanguage),
      });

      const jobWithFields = await this.prisma.aIExtractionJob.update({
        where: { id: job.id },
        data: {
          originalText: extracted.originalText,
          translatedText: extracted.translatedText,
          detectedLanguage: toLocale(extracted.detectedLanguage),
          targetLanguage,
          provider: extracted.provider,
          fields: { create: this.buildFieldRows(extracted) },
        },
        include: { fields: true },
      });

      const dealerOriginated = input.dealerOriginated ?? false;
      const request = await this.createDraftRfqFromJob(
        jobWithFields,
        input.customerId,
        input.userId,
        {
          markJobCompleted: true,
          reviewerId: input.userId,
          source: dealerOriginated ? RequestSource.PORTAL : RequestSource.IMAGE,
          headerNote: dealerOriginated
            ? 'Created from handwriting upload — AI extracted and translated to system language'
            : 'Created from uploaded order image — AI extracted',
          status: RequestStatus.DRAFT,
        },
      );

      await this.prisma.auditEvent.create({
        data: {
          userId: input.userId,
          action: 'ai-intake.from-upload',
          entityType: 'AIExtractionJob',
          entityId: job.id,
          newValues: {
            requestId: request.id,
            storageKey: input.storageKey,
            status: request.status,
          } as Prisma.InputJsonValue,
        },
      });

      return { job: { ...jobWithFields, status: AIJobStatus.COMPLETED, requestId: request.id }, request };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload intake failed';
      await this.prisma.aIExtractionJob.update({
        where: { id: job.id },
        data: { status: AIJobStatus.FAILED, errorMessage: message },
      });
      throw err instanceof BadRequestException
        ? err
        : new BadRequestException({ code: 'AI_INTAKE_FAILED', message });
    }
  }

  /**
   * Extract order fields from an upload for the dealer create-order form.
   * Does not create an RFQ — returns a preview payload the UI can merge into the form.
   */
  async extractPreview(input: {
    storageKey: string;
    customerId?: string;
    userId: string;
    mimeHint?: string;
    sourceType?: string;
  }) {
    const targetLanguage = await this.resolveTargetLanguage();
    const number = await this.sequences.next('AI', 'AI');
    const sourceType = input.sourceType ?? 'IMAGE';

    const job = await this.prisma.aIExtractionJob.create({
      data: {
        number,
        status: AIJobStatus.PROCESSING,
        sourceType,
        storageKey: input.storageKey,
        provider: this.extract.name,
        targetLanguage,
      },
    });

    try {
      const originalText = await this.resolveSourceText({
        storageKey: input.storageKey,
        mimeHint: input.mimeHint,
      });
      const extracted = await this.extract.extractStructured(originalText, {
        customerId: input.customerId,
        targetLanguage: fromLocale(targetLanguage),
      });

      const jobWithFields = await this.prisma.aIExtractionJob.update({
        where: { id: job.id },
        data: {
          status: AIJobStatus.COMPLETED,
          originalText: extracted.originalText,
          translatedText: extracted.translatedText,
          detectedLanguage: toLocale(extracted.detectedLanguage),
          targetLanguage,
          provider: extracted.provider,
          fields: { create: this.buildFieldRows(extracted) },
        },
        include: { fields: true },
      });

      const fieldMap = fieldMapFromJobFields(jobWithFields.fields);
      const lineItems = resolveLineItems(jobWithFields.fields);
      const primary = lineItems[0];

      const preview = {
        productName: primary?.productName || fieldMap.product || undefined,
        quantity: primary?.quantity || fieldMap.quantity || undefined,
        fabric: primary?.fabricType || fieldMap.fabric || undefined,
        fabricDescription: undefined as string | undefined,
        notes:
          [
            extracted.translatedText?.trim() || extracted.originalText?.trim() || undefined,
            primary?.notes || undefined,
          ]
            .filter(Boolean)
            .join('\n\n') || undefined,
        width: primary?.width || fieldMap.width || undefined,
        height: primary?.height || fieldMap.height || undefined,
        depth: primary?.depth || fieldMap.depth || undefined,
        material: primary?.material || fieldMap.material || undefined,
        endCustomerName: fieldMap.customer || undefined,
        deliveryAddress: fieldMap.deliveryAddress || fieldMap.address || undefined,
        projectName: fieldMap.projectName || undefined,
        items: lineItems.map((item) => ({
          productName: item.productName,
          quantity: item.quantity ?? '1',
          fabric: item.fabricType ?? undefined,
          material: item.material ?? undefined,
          width: item.width ?? undefined,
          height: item.height ?? undefined,
          depth: item.depth ?? undefined,
          notes: item.notes ?? undefined,
        })),
      };

      // Prefer first line-item notes as fabric description when it looks like fabric detail
      if (primary?.notes && /fabric/i.test(primary.notes) && !preview.fabricDescription) {
        preview.fabricDescription = primary.notes;
      }

      await this.prisma.auditEvent.create({
        data: {
          userId: input.userId,
          action: 'ai-intake.extract-preview',
          entityType: 'AIExtractionJob',
          entityId: job.id,
          newValues: {
            storageKey: input.storageKey,
            productName: preview.productName ?? null,
          } as Prisma.InputJsonValue,
        },
      });

      return { jobId: jobWithFields.id, preview };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Extract preview failed';
      await this.prisma.aIExtractionJob.update({
        where: { id: job.id },
        data: { status: AIJobStatus.FAILED, errorMessage: message },
      });
      throw err instanceof BadRequestException
        ? err
        : new BadRequestException({ code: 'AI_INTAKE_FAILED', message });
    }
  }

  async linkJobToRequest(jobId: string, requestId: string, userId: string) {
    const job = await this.get(jobId);
    if (job.requestId && job.requestId !== requestId) {
      throw new BadRequestException({
        code: 'ALREADY_LINKED',
        message: 'AI job is already linked to another request.',
      });
    }
    const updated = await this.prisma.aIExtractionJob.update({
      where: { id: jobId },
      data: { requestId },
    });
    await this.prisma.auditEvent.create({
      data: {
        userId,
        action: 'ai-intake.link-request',
        entityType: 'AIExtractionJob',
        entityId: jobId,
        newValues: { requestId } as Prisma.InputJsonValue,
      },
    });
    return updated;
  }
}
