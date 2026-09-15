import { Inject, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@maher/database';
import type { EmailProvider, SmsProvider, WhatsAppProvider } from '@maher/integrations';
import {
  genericLockScreenCopy,
  getTopic,
  lockScreenCopy,
  topicFromTemplateCode,
  uniqueNotificationEventId,
  type TopicDefinition,
} from '@maher/notifications';
import { PrismaService } from '../../common/prisma.service';
import {
  EMAIL_PROVIDER,
  SMS_PROVIDER,
  WHATSAPP_PROVIDER,
} from '../../integrations/integrations.module';
import { NotificationOutboxService } from './notification-outbox.service';
import { RecipientResolverService } from './recipient-resolver.service';

export type NotifyChannel = 'EMAIL' | 'SMS' | 'WHATSAPP' | 'IN_APP';

export interface NotifyPayload {
  templateCode: string;
  channel?: NotifyChannel;
  locale?: 'ar' | 'en' | 'he';
  to?: { email?: string | null; phone?: string | null; userId?: string | null };
  vars?: Record<string, string | number | null | undefined>;
  linkUrl?: string;
  eventId?: string;
  topic?: string;
  entityType?: string;
  entityId?: string;
  actorUserId?: string | null;
}

export type NotifyEmitInput = {
  topic: string;
  eventId: string;
  actorUserId?: string | null;
  excludeActor?: boolean;
  entity: { type: string; id: string; number?: string };
  vars?: Record<string, string | number | null | undefined>;
  linkUrl: string;
  customerId?: string | null;
  recipientUserIds?: string[];
};

function render(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? '');
}

function isUniqueViolation(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return true;
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === 'P2002';
}

function asVars(raw?: Record<string, string | number | null | undefined>): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw ?? {})) {
    vars[k] = v == null ? '' : String(v);
  }
  return vars;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly recipients: RecipientResolverService,
    private readonly outbox: NotificationOutboxService,
    @Inject(EMAIL_PROVIDER) private readonly email: EmailProvider,
    @Inject(SMS_PROVIDER) private readonly sms: SmsProvider,
    @Inject(WHATSAPP_PROVIDER) private readonly whatsapp: WhatsAppProvider,
  ) {}

  async emit(input: NotifyEmitInput) {
    const topic = getTopic(input.topic);
    if (!topic) {
      this.logger.warn(`Unknown notification topic ${input.topic}`);
      return { ok: false as const, reason: 'UNKNOWN_TOPIC' as const, count: 0 };
    }
    const users = await this.recipients.resolve({
      topic,
      customerId: input.customerId,
      recipientUserIds: input.recipientUserIds,
      actorUserId: input.actorUserId,
      excludeActor: input.excludeActor,
    });
    let count = 0;
    for (const user of users) {
      const delivered = await this.deliverToUser({
        userId: user.id,
        locale: user.preferredLanguage,
        topic,
        eventId: input.eventId,
        entityType: input.entity.type,
        entityId: input.entity.id,
        vars: {
          ...asVars(input.vars),
          number: String(input.entity.number ?? asVars(input.vars).number ?? ''),
        },
        linkUrl: input.linkUrl,
      });
      if (delivered) count += 1;
    }
    return { ok: true as const, count };
  }

  /** In-app inbox for portal users linked to a customer. */
  async notifyCustomerUsers(
    customerId: string,
    payload: Omit<NotifyPayload, 'to'> & { to?: NotifyPayload['to'] },
  ) {
    const topic = this.topicForPayload(payload);
    if (topic) {
      const entityId = payload.entityId ?? payload.linkUrl?.split('/').filter(Boolean).pop() ?? payload.templateCode;
      return this.emit({
        topic: topic.code,
        eventId:
          payload.eventId ??
          uniqueNotificationEventId(topic.code, payload.entityType ?? topic.entity, entityId),
        entity: { type: payload.entityType ?? topic.entity, id: entityId },
        vars: payload.vars,
        linkUrl: payload.linkUrl ?? '',
        customerId,
        actorUserId: payload.actorUserId,
        excludeActor: false,
      });
    }
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

  /** Permission-aware staff fan-out (replaces SYSTEM_ADMINISTRATOR-only blast). */
  async notifyAdminUsers(payload: Omit<NotifyPayload, 'to'>) {
    const topic = this.topicForPayload(payload);
    if (topic) {
      const entityId = payload.entityId ?? payload.linkUrl?.split('/').filter(Boolean).pop() ?? payload.templateCode;
      return this.emit({
        topic: topic.code,
        eventId:
          payload.eventId ??
          uniqueNotificationEventId(topic.code, payload.entityType ?? topic.entity, entityId),
        entity: { type: payload.entityType ?? topic.entity, id: entityId },
        vars: payload.vars,
        linkUrl: payload.linkUrl ?? '',
        actorUserId: payload.actorUserId,
        excludeActor: payload.actorUserId ? true : false,
      });
    }
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
    const vars = asVars(payload.vars);
    const subject =
      locale === 'en' ? template.subjectEn : locale === 'he' ? template.subjectHe : template.subjectAr;
    const body =
      locale === 'en' ? template.bodyEn : locale === 'he' ? (template.bodyHe ?? template.bodyEn) : template.bodyAr;
    const renderedSubject = render(subject ?? payload.templateCode, vars);
    const renderedBody = render(body, vars);
    const channel = (payload.channel ?? template.channel.toUpperCase()) as NotifyChannel;
    const topic = this.topicForPayload(payload);

    if (payload.to?.userId) {
      if (topic) {
        const allowed = await this.recipients.isTopicOn(payload.to.userId, topic);
        if (!allowed) {
          await this.dispatchChannel(channel, {
            toEmail: payload.to?.email,
            toPhone: payload.to?.phone,
            subject: renderedSubject,
            body: renderedBody,
            templateCode: payload.templateCode,
          });
          return { ok: true as const, channel, subject: renderedSubject, skipped: 'preference_off' as const };
        }
      }
      const entityId = payload.entityId ?? payload.linkUrl?.split('/').filter(Boolean).pop() ?? payload.templateCode;
      const eventId =
        payload.eventId ??
        uniqueNotificationEventId(
          topic?.code ?? payload.templateCode,
          payload.entityType ?? topic?.entity ?? 'legacy',
          entityId,
        );
      await this.deliverToUser({
        userId: payload.to.userId,
        locale,
        topic,
        eventId,
        entityType: payload.entityType ?? topic?.entity ?? null,
        entityId,
        vars,
        linkUrl: payload.linkUrl,
        inbox: {
          type: payload.templateCode,
          titleAr: render(template.subjectAr ?? payload.templateCode, vars),
          titleEn: render(template.subjectEn ?? payload.templateCode, vars),
          titleHe: template.subjectHe ? render(template.subjectHe, vars) : null,
          bodyAr: render(template.bodyAr, vars),
          bodyEn: render(template.bodyEn, vars),
          bodyHe: template.bodyHe ? render(template.bodyHe, vars) : null,
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

  private topicForPayload(payload: Pick<NotifyPayload, 'topic' | 'templateCode'>): TopicDefinition | undefined {
    return (payload.topic ? getTopic(payload.topic) : undefined) ?? topicFromTemplateCode(payload.templateCode);
  }

  private async deliverToUser(input: {
    userId: string;
    locale: 'ar' | 'en' | 'he';
    topic: TopicDefinition | undefined;
    eventId: string;
    entityType: string | null;
    entityId: string;
    vars: Record<string, string>;
    linkUrl?: string | null;
    inbox?: {
      type: string;
      titleAr: string;
      titleEn: string;
      titleHe: string | null;
      bodyAr: string;
      bodyEn: string;
      bodyHe: string | null;
    };
  }): Promise<boolean> {
    const push = input.topic
      ? lockScreenCopy(input.topic, input.locale, input.vars)
      : genericLockScreenCopy(input.locale);
    const inbox = input.inbox ?? {
      type: input.topic?.templateCode ?? input.topic?.code ?? 'NOTICE',
      titleAr: input.topic ? lockScreenCopy(input.topic, 'ar', input.vars).title : push.title,
      titleEn: input.topic ? lockScreenCopy(input.topic, 'en', input.vars).title : push.title,
      titleHe: input.topic ? lockScreenCopy(input.topic, 'he', input.vars).title : push.title,
      bodyAr: input.topic ? lockScreenCopy(input.topic, 'ar', input.vars).body : push.body,
      bodyEn: input.topic ? lockScreenCopy(input.topic, 'en', input.vars).body : push.body,
      bodyHe: input.topic ? lockScreenCopy(input.topic, 'he', input.vars).body : push.body,
    };

    let notificationId: string | null = null;
    try {
      const row = await this.prisma.notification.create({
        data: {
          userId: input.userId,
          type: inbox.type,
          topic: input.topic?.code,
          eventId: input.eventId,
          entityType: input.entityType,
          entityId: input.entityId,
          titleAr: inbox.titleAr,
          titleEn: inbox.titleEn,
          titleHe: inbox.titleHe,
          bodyAr: inbox.bodyAr,
          bodyEn: inbox.bodyEn,
          bodyHe: inbox.bodyHe,
          linkUrl: input.linkUrl,
        },
        select: { id: true },
      });
      notificationId = row.id;
    } catch (err) {
      if (isUniqueViolation(err)) {
        return false;
      }
      throw err;
    }
    if (!notificationId) return false;

    await this.outbox.enqueue({
      notificationId,
      userId: input.userId,
      eventId: input.eventId,
      topic: input.topic?.code ?? inbox.type,
      title: push.title,
      body: push.body,
      data: {
        notificationId,
        userId: input.userId,
        linkUrl: input.linkUrl ?? '',
        topic: input.topic?.code ?? '',
        entityType: input.entityType ?? '',
        entityId: input.entityId,
      },
    });
    return true;
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
