import { createLogger } from '@maher/logging';
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { startInboundEmailPoller } from './inbound-email';
import { startLowStockPrPoller } from './low-stock-pr';

const logger = createLogger('worker');

const QUEUE_NAMES = [
  'emails',
  'sms',
  'whatsapp',
  'pdf',
  'ai',
  'ocr',
  'translation',
  'reports',
  'notifications',
  'file-processing',
  'scheduling',
] as const;

async function main() {
  logger.info('Maher ERP worker starting', { queues: QUEUE_NAMES });
  logger.info('Providers', {
    email: process.env.EMAIL_PROVIDER ?? 'console',
    sms: process.env.SMS_PROVIDER ?? 'console',
    whatsapp: process.env.WHATSAPP_PROVIDER ?? 'console',
    ai: process.env.AI_PROVIDER ?? 'mock',
    ocr: process.env.OCR_PROVIDER ?? 'mock',
  });

  startInboundEmailPoller();
  startLowStockPrPoller();

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    logger.warn('REDIS_URL not set — worker idle (mock mode)');
    setInterval(() => logger.debug('worker heartbeat'), 60_000);
    return;
  }

  const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
  logger.info('Redis configured', { redisUrl: redisUrl.replace(/:[^:@]+@/, ':***@') });

  for (const name of QUEUE_NAMES) {
    // Ensure queue exists for producers
    // eslint-disable-next-line no-new
    new Queue(name, { connection });

    const worker = new Worker(
      name,
      async (job) => {
        logger.info(`[${name}] job ${job.id} ${job.name}`, { data: job.data });
        if (name === 'emails' || name === 'sms' || name === 'whatsapp' || name === 'notifications') {
          logger.info(`[${name}:console] delivered`, job.data);
        }
        if (name === 'scheduling') {
          // SCHEDULE_GENERATE / REPLAN / RISK_ANALYSIS / ESTIMATE_STATS — v1 runs
          // scheduling synchronously inside the API request path, so this worker
          // only logs the job for observability/audit; no action is taken here.
          logger.info(`[scheduling:noop] acknowledged ${job.name}`, job.data);
        }
        return { ok: true, queue: name, at: new Date().toISOString() };
      },
      { connection },
    );

    worker.on('failed', (job, err) => {
      logger.error(`[${name}] failed`, { jobId: job?.id, err: String(err) });
    });
  }

  setInterval(() => logger.debug('worker heartbeat'), 60_000);
}

main().catch((err) => {
  logger.error('Worker failed', { err: String(err) });
  process.exit(1);
});
