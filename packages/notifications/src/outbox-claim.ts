export type OutboxClaimStatus = 'PENDING' | 'PROCESSING' | 'FAILED' | 'SENT' | 'SKIPPED';

export type OutboxClaimRow = {
  id: string;
  status: OutboxClaimStatus;
  availableAt: number;
  leaseUntil: number | null;
  attempts: number;
  maxAttempts?: number;
};

export const OUTBOX_CLAIM_SQL = `
WITH picked AS (
  SELECT id
  FROM notification_outbox
  WHERE "availableAt" <= NOW()
    AND attempts < $maxAttempts
    AND (
      status = 'PENDING'
      OR (
        status IN ('PROCESSING', 'FAILED')
        AND ("leaseUntil" IS NULL OR "leaseUntil" < NOW())
      )
    )
  ORDER BY "createdAt" ASC
  LIMIT $limit
  FOR UPDATE SKIP LOCKED
)
UPDATE notification_outbox o
SET
  status = 'PROCESSING',
  "leaseUntil" = NOW() + ($leaseSeconds::text || ' seconds')::interval,
  "leasedBy" = $workerId,
  attempts = o.attempts + 1,
  "updatedAt" = NOW()
FROM picked
WHERE o.id = picked.id
RETURNING o.*
`.trim();

export function isOutboxClaimable(row: OutboxClaimRow, now: number): boolean {
  const maxAttempts = row.maxAttempts ?? 8;
  if (row.attempts >= maxAttempts) return false;
  if (row.availableAt > now) return false;
  if (row.status === 'SENT' || row.status === 'SKIPPED') return false;
  if (row.status === 'PENDING') return true;
  if (row.status === 'PROCESSING' || row.status === 'FAILED') {
    return row.leaseUntil == null || row.leaseUntil < now;
  }
  return false;
}

/**
 * SKIP LOCKED semantics: rows in `lockedIds` are invisible to this worker.
 * Two concurrent claims of the same snapshot cannot both win a row.
 */
export function pickClaimableOutboxIds(
  rows: readonly OutboxClaimRow[],
  now: number,
  limit: number,
  lockedIds: ReadonlySet<string> = new Set(),
): string[] {
  return rows
    .filter((row) => !lockedIds.has(row.id) && isOutboxClaimable(row, now))
    .sort((a, b) => a.availableAt - b.availableAt || a.id.localeCompare(b.id))
    .slice(0, Math.max(0, limit))
    .map((row) => row.id);
}

export class InMemoryOutboxLock {
  private locked = new Set<string>();

  claim(rows: readonly OutboxClaimRow[], now: number, limit: number, workerId: string) {
    const ids = pickClaimableOutboxIds(rows, now, limit, this.locked);
    for (const id of ids) this.locked.add(id);
    return ids.map((id) => ({ id, workerId }));
  }

  release(id: string) {
    this.locked.delete(id);
  }
}
