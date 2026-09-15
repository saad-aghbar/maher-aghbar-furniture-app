import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@maher/database';
import { PrismaService } from '../../common/prisma.service';

export type OutboxPayload = {
  notificationId: string;
  userId: string;
  eventId: string;
  topic: string;
  title: string;
  body: string;
  data: Record<string, string>;
};

type ClaimedRow = {
  id: string;
  notificationId: string;
  userId: string;
  eventId: string;
  topic: string;
  title: string;
  body: string;
  data: Prisma.JsonValue;
  status: string;
  attempts: number;
};

const MAX_ATTEMPTS = 8;
const DEFAULT_LEASE_SECONDS = 30;

@Injectable()
export class NotificationOutboxService {
  private readonly logger = new Logger(NotificationOutboxService.name);

  constructor(private readonly prisma: PrismaService) {}

  async enqueue(payload: OutboxPayload) {
    try {
      await this.prisma.notificationOutbox.create({
        data: {
          notificationId: payload.notificationId,
          userId: payload.userId,
          eventId: payload.eventId,
          topic: payload.topic,
          title: payload.title,
          body: payload.body,
          data: payload.data,
          status: 'PENDING',
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return { duplicate: true as const };
      }
      throw err;
    }
    return { duplicate: false as const };
  }

  async claim(input: {
    limit: number;
    workerId: string;
    leaseSeconds?: number;
  }): Promise<ClaimedRow[]> {
    const leaseSeconds = input.leaseSeconds ?? DEFAULT_LEASE_SECONDS;
    try {
      return await this.prisma.$queryRaw<ClaimedRow[]>(Prisma.sql`
        WITH picked AS (
          SELECT id
          FROM notification_outbox
          WHERE "availableAt" <= NOW()
            AND attempts < ${MAX_ATTEMPTS}
            AND (
              status = 'PENDING'
              OR (
                status IN ('PROCESSING', 'FAILED')
                AND ("leaseUntil" IS NULL OR "leaseUntil" < NOW())
              )
            )
          ORDER BY "createdAt" ASC
          LIMIT ${input.limit}
          FOR UPDATE SKIP LOCKED
        )
        UPDATE notification_outbox o
        SET
          status = 'PROCESSING',
          "leaseUntil" = NOW() + (${leaseSeconds}::text || ' seconds')::interval,
          "leasedBy" = ${input.workerId},
          attempts = o.attempts + 1,
          "updatedAt" = NOW()
        FROM picked
        WHERE o.id = picked.id
        RETURNING
          o.id,
          o."notificationId",
          o."userId",
          o."eventId",
          o.topic,
          o.title,
          o.body,
          o.data,
          o.status,
          o.attempts
      `);
    } catch (err) {
      this.logger.warn(`Outbox claim failed: ${String(err)}`);
      return [];
    }
  }

  async markSent(id: string, expoTickets: unknown) {
    await this.prisma.notificationOutbox.update({
      where: { id },
      data: {
        status: 'SENT',
        expoTickets: expoTickets as Prisma.InputJsonValue,
        lastError: null,
        leaseUntil: null,
      },
    });
  }

  async markSkipped(id: string, reason: string) {
    await this.prisma.notificationOutbox.update({
      where: { id },
      data: {
        status: 'SKIPPED',
        lastError: reason,
        leaseUntil: null,
      },
    });
  }

  async markFailed(id: string, error: string, attempts: number) {
    const backoffMs = Math.min(15 * 60_000, 2 ** Math.max(0, attempts - 1) * 5_000);
    await this.prisma.notificationOutbox.update({
      where: { id },
      data: {
        status: attempts >= MAX_ATTEMPTS ? 'FAILED' : 'FAILED',
        lastError: error.slice(0, 500),
        availableAt: new Date(Date.now() + backoffMs),
        leaseUntil: new Date(Date.now() + backoffMs),
      },
    });
  }
}
