import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { RequestSource } from '@maher/database';
import { IsOptional, IsString } from 'class-validator';
import { AiIntakeService } from '../ai-intake/ai-intake.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../../common/prisma.service';

export class InboundWhatsAppWebhookDto {
  @IsOptional()
  @IsString()
  messageId?: string;

  /** E.164 or digits-only phone of the dealer sender */
  @IsString()
  from!: string;

  @IsOptional()
  @IsString()
  text?: string;

  @IsOptional()
  @IsString()
  mediaUrl?: string;

  @IsOptional()
  @IsString()
  mediaMimeType?: string;
}

function readWhatsAppInboundConfig(env: NodeJS.ProcessEnv = process.env) {
  return {
    webhookSecret: env.WHATSAPP_INBOUND_WEBHOOK_SECRET?.trim() || '',
    verifyToken: env.WHATSAPP_WEBHOOK_VERIFY_TOKEN?.trim() || '',
    adminNotifyEmail: env.EMAIL_INBOUND_ADMIN_NOTIFY_EMAIL?.trim() || '',
  };
}

@Injectable()
export class InboundWhatsAppService {
  private readonly logger = new Logger(InboundWhatsAppService.name);
  private readonly processedIds = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiIntake: AiIntakeService,
    private readonly notifications: NotificationsService,
  ) {}

  assertWebhookSecret(headers: Record<string, string | string[] | undefined>) {
    const config = readWhatsAppInboundConfig();
    if (!config.webhookSecret) {
      throw new BadRequestException({
        code: 'WEBHOOK_DISABLED',
        message: 'WHATSAPP_INBOUND_WEBHOOK_SECRET is not configured.',
      });
    }
    const provided =
      (typeof headers['x-inbound-whatsapp-secret'] === 'string'
        ? headers['x-inbound-whatsapp-secret']
        : undefined) ??
      (typeof headers.authorization === 'string'
        ? headers.authorization.replace(/^Bearer\s+/i, '')
        : undefined);
    if (provided !== config.webhookSecret) {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Invalid webhook secret.' });
    }
  }

  verifyMetaSubscription(query: {
    'hub.mode'?: string;
    'hub.verify_token'?: string;
    'hub.challenge'?: string;
  }) {
    const config = readWhatsAppInboundConfig();
    if (!config.verifyToken) {
      throw new BadRequestException({
        code: 'WEBHOOK_DISABLED',
        message: 'WHATSAPP_WEBHOOK_VERIFY_TOKEN is not configured.',
      });
    }
    if (query['hub.mode'] === 'subscribe' && query['hub.verify_token'] === config.verifyToken) {
      return query['hub.challenge'] ?? '';
    }
    throw new UnauthorizedException({
      code: 'UNAUTHORIZED',
      message: 'WhatsApp webhook verification failed.',
    });
  }

  private normalizePhone(value: string): string {
    return value.replace(/[^\d]/g, '').replace(/^0+/, '');
  }

  async findCustomerByPhone(from: string) {
    const digits = this.normalizePhone(from);
    if (!digits) return null;

    const customers = await this.prisma.customer.findMany({
      where: { archivedAt: null, phone: { not: null } },
      include: {
        accountManager: true,
        contacts: { where: { archivedAt: null } },
      },
      take: 500,
    });
    const match = customers.find((c) => {
      const phone = this.normalizePhone(c.phone ?? '');
      return phone === digits || phone.endsWith(digits) || digits.endsWith(phone);
    });
    if (match) return match;

    const contacts = await this.prisma.customerContact.findMany({
      where: { archivedAt: null, phone: { not: null } },
      include: {
        customer: {
          include: { accountManager: true, contacts: { where: { archivedAt: null } } },
        },
      },
      take: 500,
    });
    const contact = contacts.find((c) => {
      const phone = this.normalizePhone(c.phone ?? '');
      return phone === digits || phone.endsWith(digits) || digits.endsWith(phone);
    });
    return contact?.customer ?? null;
  }

  /** Normalize Meta Cloud API payload into our DTO shape when possible. */
  extractFromMetaPayload(body: Record<string, unknown>): InboundWhatsAppWebhookDto | null {
    const entry = Array.isArray(body.entry) ? body.entry[0] : null;
    const changes = entry && typeof entry === 'object' ? (entry as { changes?: unknown[] }).changes : null;
    const change = Array.isArray(changes) ? changes[0] : null;
    const value =
      change && typeof change === 'object'
        ? (change as { value?: Record<string, unknown> }).value
        : null;
    if (!value) return null;
    const messages = Array.isArray(value.messages) ? value.messages : [];
    const message = messages[0] as
      | {
          id?: string;
          from?: string;
          text?: { body?: string };
          image?: { id?: string; mime_type?: string };
          document?: { id?: string; mime_type?: string };
        }
      | undefined;
    if (!message?.from) return null;
    return {
      messageId: message.id,
      from: message.from,
      text: message.text?.body,
      mediaMimeType: message.image?.mime_type ?? message.document?.mime_type,
    };
  }

  async processInboundWhatsApp(dto: InboundWhatsAppWebhookDto) {
    const messageId = dto.messageId ?? `${dto.from}:${dto.text?.slice(0, 64) ?? ''}`;
    if (this.processedIds.has(messageId)) {
      return { ok: true as const, skipped: true as const, reason: 'DUPLICATE' as const };
    }
    this.processedIds.add(messageId);

    const customer = await this.findCustomerByPhone(dto.from);
    if (!customer) {
      this.logger.warn(`Inbound WhatsApp ignored — unknown sender ${dto.from}`);
      return { ok: false as const, reason: 'UNKNOWN_SENDER' as const, from: dto.from };
    }

    const text =
      dto.text?.trim() ||
      (dto.mediaUrl
        ? `WhatsApp media attachment (${dto.mediaMimeType ?? 'unknown'})`
        : '');
    if (!text) {
      return { ok: false as const, reason: 'EMPTY_MESSAGE' as const, from: dto.from };
    }

    const headerNote = `Created from inbound WhatsApp (${dto.from}) — draft for review`;
    const { job, request } = await this.aiIntake.createJobAndDraftRfqFromText({
      sourceType: 'WHATSAPP',
      text,
      customerId: customer.id,
      source: RequestSource.WHATSAPP,
      headerNote,
      assignedSalesId: customer.accountManagerId,
    });

    await this.notifyAdmins({
      customerName: customer.name,
      customerCode: customer.code,
      requestNumber: request.number,
      requestId: request.id,
      jobNumber: job.number,
      from: dto.from,
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
    from: string;
  }) {
    const config = readWhatsAppInboundConfig();
    const adminUsers = await this.prisma.user.findMany({
      where: {
        archivedAt: null,
        isActive: true,
        roles: {
          some: {
            role: { code: { in: ['SYSTEM_ADMINISTRATOR'] } },
          },
        },
      },
      select: { id: true },
      take: 20,
    });

    const linkUrl = `${process.env.ADMIN_WEB_URL ?? 'http://localhost:3000'}/requests/${payload.requestId}`;

    for (const admin of adminUsers) {
      await this.notifications.sendFromTemplate({
        templateCode: 'INBOUND_WHATSAPP_RFQ',
        channel: 'IN_APP',
        to: { userId: admin.id },
        vars: {
          customerName: payload.customerName,
          customerCode: payload.customerCode,
          requestNumber: payload.requestNumber,
          jobNumber: payload.jobNumber,
          from: payload.from,
        },
        linkUrl,
      });
    }

    if (config.adminNotifyEmail) {
      await this.notifications.sendFromTemplate({
        templateCode: 'INBOUND_WHATSAPP_RFQ',
        channel: 'EMAIL',
        to: { email: config.adminNotifyEmail },
        vars: {
          customerName: payload.customerName,
          customerCode: payload.customerCode,
          requestNumber: payload.requestNumber,
          jobNumber: payload.jobNumber,
          from: payload.from,
        },
        linkUrl,
      });
    }
  }
}
