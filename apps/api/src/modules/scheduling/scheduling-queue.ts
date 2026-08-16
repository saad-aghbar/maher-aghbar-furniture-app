import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { Queue as BullQueue, Worker as BullWorker, Job } from 'bullmq';

export type SchedulingJobName =
  | 'SCHEDULE_GENERATE'
  | 'REPLAN'
  | 'REPLAN_EMPLOYEE'
  | 'REPLAN_FACTORY'
  | 'RISK_ANALYSIS'
  | 'ESTIMATE_STATS';

export type SchedulingJobProcessor = (
  name: SchedulingJobName,
  data: Record<string, unknown>,
) => Promise<void>;

const QUEUE_NAME = 'scheduling';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type RedisClient = {
  status: string;
  ping: () => Promise<string>;
  quit: () => Promise<unknown>;
  disconnect: () => void;
};

/**
 * Producer + in-process consumer. Redis jobs retry via BullMQ.
 * Without Redis, jobs run asynchronously in-process with bounded retries.
 * Queue and Worker MUST use separate Redis connections — a shared connection
 * lets the Worker block BRPOP and silently drop Queue.add writes (runs stay QUEUED).
 * Callers must not await planning as a precondition of domain writes (e.g. task complete).
 */
@Injectable()
export class SchedulingQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SchedulingQueueService.name);
  private queue: BullQueue | null = null;
  private worker: BullWorker | null = null;
  private queueConnection: RedisClient | null = null;
  private workerConnection: RedisClient | null = null;
  private initPromise: Promise<BullQueue | null> | null = null;
  private processor: SchedulingJobProcessor | null = null;
  private inProcessTail: Promise<void> = Promise.resolve();

  setProcessor(processor: SchedulingJobProcessor) {
    this.processor = processor;
  }

  async onModuleInit() {
    await this.getQueue();
  }

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
    const { Queue, Worker } = await import('bullmq');
    const ioredisModule = await import('ioredis');
    type RedisCtor = new (url: string, opts: { maxRetriesPerRequest: null | undefined }) => RedisClient;
    const IORedis = ioredisModule.default as unknown as RedisCtor;
    const redisOpts = { maxRetriesPerRequest: null as null };
    this.queueConnection = new IORedis(redisUrl, redisOpts);
    this.workerConnection = new IORedis(redisUrl, redisOpts);
    await this.queueConnection.ping();
    await this.workerConnection.ping();
    this.queue = new Queue(QUEUE_NAME, { connection: this.queueConnection as never });
    this.worker = new Worker(
      QUEUE_NAME,
      async (job: Job) => {
        await this.ensureProcessor();
        if (!this.processor) {
          throw new Error('Scheduling job processor is not registered');
        }
        await this.processor(job.name as SchedulingJobName, job.data as Record<string, unknown>);
      },
      { connection: this.workerConnection as never, concurrency: 1 },
    );
    this.worker.on('failed', (job, err) => {
      this.logger.warn(`Scheduling job failed ${job?.name} ${job?.id}: ${String(err)}`);
    });
    this.logger.log('Scheduling BullMQ worker listening on queue "scheduling"');
    return this.queue;
  }

  private async ensureProcessor(timeoutMs = 5_000) {
    const started = Date.now();
    while (!this.processor && Date.now() - started < timeoutMs) {
      await sleep(50);
    }
  }

  async enqueue(name: SchedulingJobName, data: Record<string, unknown>): Promise<void> {
    await this.ensureProcessor();
    try {
      const queue = await this.getQueue();
      if (queue && this.worker) {
        const jobId = this.jobId(name, data);
        await queue.add(name, data, {
          jobId,
          attempts: 5,
          backoff: { type: 'exponential', delay: 2_000 },
          removeOnComplete: true,
          removeOnFail: 500,
        });
        return;
      }
    } catch (err) {
      this.logger.warn(`Redis enqueue failed for ${name}, falling back in-process: ${String(err)}`);
    }
    setImmediate(() => {
      this.inProcessTail = this.inProcessTail
        .then(() => this.runInProcess(name, data))
        .catch((err) => {
          this.logger.warn(`In-process chain error for ${name}: ${String(err)}`);
        });
    });
  }

  private jobId(name: SchedulingJobName, data: Record<string, unknown>): string | undefined {
    const runId = typeof data.runId === 'string' ? data.runId : '';
    const poId = typeof data.productionOrderId === 'string' ? data.productionOrderId : '';
    const taskId = typeof data.taskId === 'string' ? data.taskId : '';
    const employeeId = typeof data.employeeId === 'string' ? data.employeeId : '';
    const event = typeof data.event === 'string' ? data.event : '';
    // BullMQ custom jobId cannot contain ':' (used as an internal separator).
    const key = [name, runId, poId, taskId, employeeId, event].filter(Boolean).join('-');
    return key.length > 0 ? key.slice(0, 120) : undefined;
  }

  private async runInProcess(name: SchedulingJobName, data: Record<string, unknown>) {
    let lastErr: unknown;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        await this.ensureProcessor();
        if (!this.processor) throw new Error('Scheduling job processor is not registered');
        await this.processor(name, data);
        return;
      } catch (err) {
        lastErr = err;
        await sleep(Math.min(8_000, 200 * 2 ** attempt));
      }
    }
    this.logger.error(`In-process scheduling job ${name} failed after retries: ${String(lastErr)}`);
  }

  async onModuleDestroy() {
    await this.worker?.close().catch(() => undefined);
    await this.queue?.close().catch(() => undefined);
    await this.workerConnection?.quit().catch(() => undefined);
    await this.queueConnection?.quit().catch(() => undefined);
  }
}
