/** Weighted progress over active workflow snapshot nodes. */

export type ProgressNodeInput = {
  nodeKey: string;
  status: string;
  estimatedMinutes?: number | null;
  progressPercent?: number | null;
  isSkipped?: boolean;
};

/**
 * completedWeight / totalWeight.
 * - COMPLETED: full weight
 * - IN_PROGRESS: progressPercent of weight (server-authoritative)
 * - SKIPPED: excluded from denominator
 * - others: 0 toward completed
 * Weight = estimatedMinutes if > 0, else 1 (equal weight fallback).
 */
export function calculateWorkflowProgress(nodes: ProgressNodeInput[]): number {
  const active = nodes.filter((n) => !n.isSkipped && n.status !== 'SKIPPED');
  if (!active.length) return 0;

  let total = 0;
  let completed = 0;

  for (const node of active) {
    const weight =
      node.estimatedMinutes != null && node.estimatedMinutes > 0
        ? node.estimatedMinutes
        : 1;
    total += weight;
    if (node.status === 'COMPLETED') {
      completed += weight;
    } else if (node.status === 'IN_PROGRESS') {
      const pct = Math.min(100, Math.max(0, node.progressPercent ?? 0));
      completed += (weight * pct) / 100;
    }
  }

  if (total <= 0) return 0;
  return Math.round((100 * completed) / total);
}
