import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { getTopic, isDevicePushDeliverable, isSystemAdministrator } from '@maher/notifications';
import { DeviceTokensService } from './device-tokens.service';
import { ExpoPushClient } from './expo-push.client';
import { NotificationOutboxService } from './notification-outbox.service';
import { PrismaService } from '../../common/prisma.service';

const POLL_MS = 2_000;
const BATCH = 25;

@Injectable()
export class PushDispatchWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PushDispatchWorker.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private readonly workerId = `api-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;

  constructor(
    private readonly outbox: NotificationOutboxService,
    private readonly devices: DeviceTokensService,
    private readonly expo: ExpoPushClient,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    if (process.env.NOTIFICATION_OUTBOX_POLL === '0') return;
    this.timer = setInterval(() => {
      void this.tick();
    }, POLL_MS);
    void this.tick();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      await this.drain();
    } catch (err) {
      this.logger.warn(`Outbox drain failed: ${String(err)}`);
    } finally {
      this.running = false;
    }
  }

  private async drain() {
    const claimed = await this.outbox.claim({ limit: BATCH, workerId: this.workerId });
    for (const row of claimed) {
      try {
        await this.deliver(row);
      } catch (err) {
        await this.outbox.markFailed(row.id, String(err), row.attempts);
      }
    }
  }

  private async deliver(row: {
    id: string;
    userId: string;
    topic: string;
    title: string;
    body: string;
    data: unknown;
    attempts: number;
  }) {
    const account = await this.prisma.user.findUnique({
      where: { id: row.userId },
      select: {
        roles: { select: { role: { select: { code: true } } } },
        pushSettings: { select: { masterEnabled: true } },
      },
    });
    const pauseAll = isSystemAdministrator({
      id: row.userId,
      roles: account?.roles.map((r) => r.role.code) ?? [],
      permissions: [],
    });
    const masterEnabled = pauseAll ? (account?.pushSettings?.masterEnabled ?? true) : true;
    const tokens = await this.devices.listDeliverable(row.userId);
    const live = tokens.filter((token) =>
      isDevicePushDeliverable({
        userId: token.userId,
        intendedUserId: row.userId,
        pushEnabled: token.pushEnabled,
        osPermission: token.osPermission,
        disabledAt: token.disabledAt,
        userMasterEnabled: masterEnabled,
      }),
    );
    if (live.length === 0) {
      await this.outbox.markSkipped(row.id, 'no_deliverable_device');
      return;
    }

    const topic = getTopic(row.topic);
    const urgency = topic?.urgency ?? 'normal';
    const data = asStringRecord(row.data);
    const tickets = await this.expo.send(
      live.map((token) => ({
        to: token.token,
        title: row.title,
        body: row.body,
        data,
        sound: urgency === 'normal' ? null : 'default',
        channelId: urgency === 'critical' ? 'maher-critical' : urgency === 'high' ? 'maher-high' : 'maher-default',
        priority: urgency === 'normal' ? 'normal' : 'high',
      })),
    );

    for (const ticket of tickets) {
      if (ticket.error === 'DeviceNotRegistered' || ticket.error === 'InvalidCredentials') {
        await this.devices.disableToken(ticket.token, ticket.error);
      }
    }

    const hardFail = tickets.length > 0 && tickets.every((t) => t.status === 'error');
    if (hardFail) {
      await this.outbox.markFailed(row.id, tickets[0]?.message ?? 'expo_error', row.attempts);
      return;
    }
    await this.outbox.markSent(row.id, tickets);
  }
}

function asStringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (v == null) continue;
    out[k] = String(v);
  }
  return out;
}
