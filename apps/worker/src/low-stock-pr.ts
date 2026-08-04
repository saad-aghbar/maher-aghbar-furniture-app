import { createLogger } from '@maher/logging';

const logger = createLogger('low-stock-pr');

export function startLowStockPrPoller() {
  const intervalMs = Number(process.env.LOW_STOCK_PR_INTERVAL_MS ?? 900_000);
  const apiUrl = (process.env.API_URL ?? 'http://localhost:4000').replace(/\/$/, '');
  const secret =
    process.env.WORKER_SECRET ?? process.env.EMAIL_INBOUND_WEBHOOK_SECRET ?? '';

  if (!secret) {
    logger.info(
      '[low-stock-pr] WORKER_SECRET unset — auto-reorder poller disabled',
    );
    return;
  }

  logger.info('[low-stock-pr] poller enabled', { intervalMs, apiUrl });

  const tick = async () => {
    try {
      const res = await fetch(`${apiUrl}/api/v1/webhooks/low-stock-pr`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-worker-secret': secret,
        },
        body: '{}',
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`API failed (${res.status}): ${body}`);
      }
      const json = (await res.json()) as { created?: { number?: string } | null };
      if (json.created?.number) {
        logger.info('[low-stock-pr] created PR', { number: json.created.number });
      } else {
        logger.debug('[low-stock-pr] no new PR needed');
      }
    } catch (err) {
      logger.warn('[low-stock-pr] tick failed', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  };

  void tick();
  setInterval(() => void tick(), intervalMs);
}
