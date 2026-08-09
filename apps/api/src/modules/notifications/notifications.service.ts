import { Inject, Injectable, Logger } from '@nestjs/common';
import type { EmailProvider, SmsProvider, WhatsAppProvider } from '@maher/integrations';
import { PrismaService } from '../../common/prisma.service';
import {
  EMAIL_PROVIDER,
  SMS_PROVIDER,
  WHATSAPP_PROVIDER,
} from '../../integrations/integrations.module';

export type NotifyChannel = 'EMAIL' | 'SMS' | 'WHATSAPP' | 'IN_APP';

export interface NotifyPayload {
  templateCode: string;
  channel?: NotifyChannel;
  locale?: 'ar' | 'en' | 'he';
  to?: { email?: string | null; phone?: string | null; userId?: string | null };
  vars?: Record<string, string | number | null | undefined>;
  linkUrl?: string;
}

function render(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? '');
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(EMAIL_PROVIDER) private readonly email: EmailProvider,
    @Inject(SMS_PROVIDER) private readonly sms: SmsProvider,
    @Inject(WHATSAPP_PROVIDER) private readonly whatsapp: WhatsAppProvider,
  ) {}

  /** In-app inbox for portal users linked to a customer. */
  async notifyCustomerUsers(
    customerId: string,
    payload: Omit<NotifyPayload, 'to'> & { to?: NotifyPayload['to'] },
  ) {
    const users = await this.prisma.user.findMany({
      where: { customerId, isActive: true, archivedAt: null },
      select: { id: true },
      take: 50,
    });
    for (const u of users) {
      await this.sendFromTemplate({
        ...payload,
        channel: 'IN_APP',
        to: { ...payload.to, userId: u.id },
      });
    }
    return { ok: true as const, count: users.length };
  }

  /** In-app inbox for system admins (new order / AI draft alerts). */
  async notifyAdminUsers(payload: Omit<NotifyPayload, 'to'>) {
    const admins = await this.prisma.user.findMany({
      where: {
        isActive: true,
        archivedAt: null,
        roles: { some: { role: { code: { in: ['SYSTEM_ADMINISTRATOR'] } } } },
      },
      select: { id: true },
      take: 20,
    });
    for (const admin of admins) {
      await this.sendFromTemplate({
        ...payload,
        channel: 'IN_APP',
        to: { userId: admin.id },
      });
    }
    return { ok: true as const, count: admins.length };
  }

  async sendFromTemplate(payload: NotifyPayload) {
    const template = await this.prisma.notificationTemplate.findUnique({
      where: { code: payload.templateCode },
    });
    if (!template) {
      this.logger.warn(`Template ${payload.templateCode} not found`);
      return { ok: false, reason: 'TEMPLATE_NOT_FOUND' as const };
    }

    const locale = payload.locale ?? 'ar';
    const vars: Record<string, string> = {};
    for (const [k, v] of Object.entries(payload.vars ?? {})) {
      vars[k] = v == null ? '' : String(v);
    }

    const subject =
      locale === 'en'
        ? template.subjectEn
        : locale === 'he'
          ? template.subjectHe
          : template.subjectAr;
    const body =
      locale === 'en' ? template.bodyEn : locale === 'he' ? (template.bodyHe ?? template.bodyEn) : template.bodyAr;

    const renderedSubject = render(subject ?? payload.templateCode, vars);
    const renderedBody = render(body, vars);
    const channel = (payload.channel ?? template.channel.toUpperCase()) as NotifyChannel;

    if (payload.to?.userId) {
      await this.prisma.notification.create({
        data: {
          userId: payload.to.userId,
          type: payload.templateCode,
          titleAr: render(template.subjectAr ?? payload.templateCode, vars),
          titleEn: render(template.subjectEn ?? payload.templateCode, vars),
          bodyAr: render(template.bodyAr, vars),
          bodyEn: render(template.bodyEn, vars),
          linkUrl: payload.linkUrl,
        },
      });
    }

    await this.dispatchChannel(channel, {
      toEmail: payload.to?.email,
      toPhone: payload.to?.phone,
      subject: renderedSubject,
      body: renderedBody,
      templateCode: payload.templateCode,
    });

    return { ok: true as const, channel, subject: renderedSubject };
  }

  private async dispatchChannel(
    channel: NotifyChannel,
    msg: {
      toEmail?: string | null;
      toPhone?: string | null;
      subject: string;
      body: string;
      templateCode: string;
    },
  ) {
    if (channel === 'IN_APP') return;

    if (channel === 'EMAIL') {
      if (!msg.toEmail) {
        this.logger.log(`[email] skip — no recipient for ${msg.templateCode}`);
        return;
      }
      await this.email.send({
        to: msg.toEmail,
        subject: msg.subject,
        body: msg.body,
      });
      return;
    }

    if (channel === 'SMS') {
      if (!msg.toPhone) {
        this.logger.log(`[sms] skip — no recipient for ${msg.templateCode}`);
        return;
      }
      await this.sms.send({
        to: msg.toPhone,
        body: msg.body,
      });
      return;
    }

    if (channel === 'WHATSAPP') {
      if (!msg.toPhone) {
        this.logger.log(`[whatsapp] skip — no recipient for ${msg.templateCode}`);
        return;
      }
      await this.whatsapp.send({
        to: msg.toPhone,
        body: msg.body,
      });
    }
  }
}
