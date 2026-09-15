import { Injectable, Logger } from '@nestjs/common';
import { notificationEventId } from '@maher/notifications';
import { NotificationsService } from './notifications.service';

function roleCodesFingerprint(codes: readonly string[]): string {
  return [...codes].map((c) => c.trim()).filter(Boolean).sort().join(',');
}

@Injectable()
export class IamNotifyService {
  private readonly logger = new Logger(IamNotifyService.name);

  constructor(private readonly notifications: NotificationsService) {}

  async onInvited(input: { userId: string; actorUserId?: string | null }) {
    await this.emit({
      topic: 'user.invited',
      eventId: notificationEventId({
        topic: 'user.invited',
        entityType: 'user',
        entityId: input.userId,
        transition: 'CREATED',
      }),
      actorUserId: input.actorUserId,
      userId: input.userId,
    });
  }

  async onDeactivated(input: {
    userId: string;
    actorUserId?: string | null;
    transition?: string;
  }) {
    await this.emit({
      topic: 'user.deactivated',
      eventId: notificationEventId({
        topic: 'user.deactivated',
        entityType: 'user',
        entityId: input.userId,
        transition: input.transition ?? 'DEACTIVATED',
      }),
      actorUserId: input.actorUserId,
      userId: input.userId,
    });
  }

  async onRoleChanged(input: {
    userId: string;
    actorUserId?: string | null;
    fromCodes: readonly string[];
    toCodes: readonly string[];
  }) {
    await this.emit({
      topic: 'user.roleChanged',
      eventId: notificationEventId({
        topic: 'user.roleChanged',
        entityType: 'user',
        entityId: input.userId,
        transition: `ROLE:${roleCodesFingerprint(input.fromCodes)}->${roleCodesFingerprint(input.toCodes)}`,
      }),
      actorUserId: input.actorUserId,
      userId: input.userId,
    });
  }

  private async emit(input: {
    topic: 'user.invited' | 'user.deactivated' | 'user.roleChanged';
    eventId: string;
    actorUserId?: string | null;
    userId: string;
  }) {
    try {
      await this.notifications.emit({
        topic: input.topic,
        eventId: input.eventId,
        actorUserId: input.actorUserId,
        excludeActor: true,
        entity: { type: 'user', id: input.userId },
        vars: {},
        linkUrl: `/users/${input.userId}`,
        recipientUserIds: [input.userId],
      });
    } catch (err) {
      this.logger.warn(
        `IAM notify emit failed for ${input.topic} ${input.eventId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}
