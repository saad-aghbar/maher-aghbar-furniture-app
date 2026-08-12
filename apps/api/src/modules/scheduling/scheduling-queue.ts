import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import type { Queue as BullQueue } from 'bullmq';

export type SchedulingJobName = 'SCHEDULE_GENERATE' | 'REPLAN' | 'RISK_ANALYSIS' | 'ESTIMATE_STATS';

const QUEUE_NAME = 'scheduling';

/**
 * Thin BullMQ producer. When REDIS_URL is configured, jobs are queued for the
 * background worker (apps/worker) to pick up. Without Redis the API runs
 * scheduling synchronously (v1 default), and this producer becomes a no-op —
 * callers should not depend on queued jobs actually running.
 */
@Injectable()
export class SchedulingQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(SchedulingQueueService.name);
  private queue: BullQueue | null = null;
  private initPromise: Promise<BullQueue | null> | null = null;

  private async getQueue(): Promise<BullQueue | null> {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) return null;
    if (this.queue) return this.queue;
    if (!this.initPromise) {
      this.initPromise = this.createQueue(redisUrl).catch((err) => {
        this.logger.warn(`Failed to initialise scheduling queue: ${String(err)}`);
        return null;
      });
    }
    return this.initPromise;
  }

  private async createQueue(redisUrl: string): Promise<BullQueue | null> {
    const { Queue } = await import('bullmq');
    const ioredisModule = await import('ioredis');
    // ioredis is a CJS `export =` module; its dynamic-import default binding is
    // typed as the namespace itself rather than the constructor — cast through
    // unknown to get the actual constructor without disabling type-checking elsewhere.
    type RedisCtor = new (url: string, opts: { maxRetriesPerRequest: null | undefined }) => unknown;
    const IORedis = ioredisModule.default as unknown as RedisCtor;
    const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
    this.queue = new Queue(QUEUE_NAME, {
      connection: connection as NonNullable<ConstructorParameters<typeof Queue>[1]>['connection'],
    });
    return this.queue;
  }

  /** Enqueue a scheduling job. No-op (resolves immediately) without REDIS_URL. */
  async enqueue(name: SchedulingJobName, data: Record<string, unknown>): Promise<void> {
    const queue = await this.getQueue();
    if (!queue) return;
    await queue.add(name, data, { removeOnComplete: true, removeOnFail: 500 });
  }

  async onModuleDestroy() {
    await this.queue?.close().catch(() => undefined);
  }
}
