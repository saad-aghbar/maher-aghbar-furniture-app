import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { RequestSource } from '@maher/database';
import { readInboundEmailConfig } from '@maher/integrations';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { AiIntakeService } from '../ai-intake/ai-intake.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../../common/prisma.service';

class InboundAttachmentDto {
  @IsString()
  filename!: string;

  @IsString()
  mimeType!: string;

  @IsString()
  contentBase64!: string;
}

export class InboundEmailWebhookDto {
  @IsOptional()
  @IsString()
  messageId?: string;

  @IsString()
  from!: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  text?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InboundAttachmentDto)
  attachments?: InboundAttachmentDto[];
}

@Injectable()
export class InboundEmailService {
  private readonly logger = new Logger(InboundEmailService.name);
  private readonly processedIds = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiIntake: AiIntakeService,
    private readonly notifications: NotificationsService,
  ) {}

  assertWebhookSecret(headers: Record<string, string | string[] | undefined>) {
    const config = readInboundEmailConfig();
    if (!config.webhookSecret) {
      throw new BadRequestException({
        code: 'WEBHOOK_DISABLED',
        message: 'EMAIL_INBOUND_WEBHOOK_SECRET is not configured.',
      });
    }
    const provided =
      (typeof headers['x-inbound-email-secret'] === 'string'
        ? headers['x-inbound-email-secret']
        : undefined) ??
      (typeof headers.authorization === 'string'
        ? headers.authorization.replace(/^Bearer\s+/i, '')
        : undefined);
    if (provided !== config.webhookSecret) {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Invalid webhook secret.' });
    }
  }

  private normalizeEmail(value: string): string {
    const match = value.match(/<([^>]+)>/);
    return (match?.[1] ?? value).trim().toLowerCase();
  }

  async findCustomerBySender(from: string) {
    const email = this.normalizeEmail(from);
    const customer = await this.prisma.customer.findFirst({
      where: {
        email: { equals: email, mode: 'insensitive' },
        archivedAt: null,
      },
      include: {
        accountManager: true,
        contacts: { where: { archivedAt: null } },
      },
    });
    if (customer) return customer;

    const contact = await this.prisma.customerContact.findFirst({
      where: {
        email: { equals: email, mode: 'insensitive' },
        archivedAt: null,
      },
      include: {
        customer: {
          include: { accountManager: true, contacts: { where: { archivedAt: null } } },
        },
      },
    });
    return contact?.customer ?? null;
  }

  async processInboundEmail(dto: InboundEmailWebhookDto) {
    const messageId = dto.messageId ?? `${dto.from}:${dto.subject ?? ''}:${dto.text?.slice(0, 64) ?? ''}`;
    if (this.processedIds.has(messageId)) {
      return { ok: true as const, skipped: true as const, reason: 'DUPLICATE' as const };
    }
    this.processedIds.add(messageId);

    const customer = await this.findCustomerBySender(dto.from);
    if (!customer) {
      this.logger.warn(`Inbound email ignored — unknown sender ${dto.from}`);
      return { ok: false as const, reason: 'UNKNOWN_SENDER' as const, from: dto.from };
    }

    const attachmentBuffers =
      dto.attachments?.map((a) => ({
        buffer: Buffer.from(a.contentBase64, 'base64'),
        mimeType: a.mimeType,
        filename: a.filename,
      })) ?? [];

    const ocrParts = attachmentBuffers.filter(
      (a) =>
        a.mimeType.startsWith('image/') ||
        a.mimeType === 'application/pdf' ||
        a.filename.match(/\.(pdf|png|jpe?g|webp|gif)$/i),
    );

    const combinedText = await this.aiIntake.resolveSourceTextFromBuffers(
      ocrParts.map((p) => ({ buffer: p.buffer, mimeType: p.mimeType })),
      [dto.subject, dto.text].filter(Boolean).join('\n\n'),
    );

    const headerNote = `Created from inbound email (${this.normalizeEmail(dto.from)}) — draft for review`;
    const { job, request } = await this.aiIntake.createJobAndDraftRfqFromText({
      sourceType: 'EMAIL',
      text: combinedText,
      customerId: customer.id,
      source: RequestSource.EMAIL,
      headerNote,
      assignedSalesId: customer.accountManagerId,
    });

    await this.notifyAdmins({
      customerName: customer.name,
      customerCode: customer.code,
      requestNumber: request.number,
      requestId: request.id,
      jobNumber: job.number,
      subject: dto.subject ?? '(no subject)',
    });

    return {
      ok: true as const,
      customerId: customer.id,
      requestId: request.id,
      requestNumber: request.number,
      jobId: job.id,
      jobNumber: job.number,
    };
  }

  private async notifyAdmins(payload: {
    customerName: string;
    customerCode: string;
    requestNumber: string;
    requestId: string;
    jobNumber: string;
    subject: string;
  }) {
    const config = readInboundEmailConfig();
    const adminUsers = await this.prisma.user.findMany({
      where: {
        archivedAt: null,
        isActive: true,
        roles: {
          some: {
            role: {
              code: { in: ['SYSTEM_ADMINISTRATOR'] },
            },
          },
        },
      },
      select: { id: true, email: true },
      take: 20,
    });

    const linkUrl = `${process.env.ADMIN_WEB_URL ?? 'http://localhost:3000'}/requests/${payload.requestId}`;

    for (const admin of adminUsers) {
      await this.notifications.sendFromTemplate({
        templateCode: 'INBOUND_EMAIL_RFQ',
        channel: 'IN_APP',
        to: { userId: admin.id },
        vars: {
          customerName: payload.customerName,
          customerCode: payload.customerCode,
          requestNumber: payload.requestNumber,
          jobNumber: payload.jobNumber,
          subject: payload.subject,
        },
        linkUrl,
      });
    }

    if (config.adminNotifyEmail) {
      await this.notifications.sendFromTemplate({
        templateCode: 'INBOUND_EMAIL_RFQ',
        channel: 'EMAIL',
        to: { email: config.adminNotifyEmail },
        vars: {
          customerName: payload.customerName,
          customerCode: payload.customerCode,
          requestNumber: payload.requestNumber,
          jobNumber: payload.jobNumber,
          subject: payload.subject,
        },
        linkUrl,
      });
    }
  }
}
