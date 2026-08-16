import { isApiError } from '@/api/errors';
import type { ReplanRun, ReplanRunStatus } from '@/api/modules/scheduling';
import type { ToastVariant } from '@/components/feedback/toastQueue';

export type ReplanResultToast = {
  variant: ToastVariant;
  key: string;
  count?: number;
};

const TERMINAL: ReadonlySet<ReplanRunStatus> = new Set(['COMPLETED', 'FAILED']);

function statusOf(err: unknown): number | null {
  if (isApiError(err)) return err.status;
  if (err && typeof err === 'object' && 'status' in err) {
    const status = (err as { status: unknown }).status;
    return typeof status === 'number' ? status : null;
  }
  return null;
}

function isFatalPollError(err: unknown): boolean {
  const status = statusOf(err);
  return status === 404 || status === 403 || status === 401;
}

export async function pollReplanRun(
  fetchRun: (id: string) => Promise<ReplanRun>,
  runId: string,
  opts?: {
    timeoutMs?: number;
    intervalMs?: number;
    now?: () => number;
    sleep?: (ms: number) => Promise<void>;
  },
): Promise<ReplanRun> {
  const timeoutMs = opts?.timeoutMs ?? 90_000;
  const intervalMs = opts?.intervalMs ?? 1_500;
  const now = opts?.now ?? Date.now;
  const sleep = opts?.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const started = now();
  let last: ReplanRun | null = null;
  while (now() - started < timeoutMs) {
    try {
      last = await fetchRun(runId);
      if (TERMINAL.has(last.status)) return last;
    } catch (err) {
      if (isFatalPollError(err)) {
        return { id: runId, status: 'FAILED' };
      }
    }
    await sleep(intervalMs);
  }
  return last ?? { id: runId, status: 'RUNNING' };
}

export function selectReplanResultToast(run: ReplanRun): ReplanResultToast {
  if (run.status === 'FAILED' || run.status === 'QUEUED' || run.status === 'RUNNING') {
    return { variant: 'error', key: 'mobile.adminScheduling.replan.failed' };
  }
  const result = run.result ?? {};
  const failures = Array.isArray(result.failures) ? result.failures.length : 0;
  const pinned = result.pinnedIssueCount ?? 0;
  const moved = result.moved ?? result.replannedOrders ?? 0;
  const recovered = result.recoveredAtRisk ?? result.atRiskResolved ?? 0;
  if (failures > 0 || pinned > 0) {
    return { variant: 'warning', key: 'mobile.adminScheduling.replan.needsAttention' };
  }
  if (recovered > 0) {
    return {
      variant: 'success',
      key: 'mobile.adminScheduling.replan.atRiskRecovered',
      count: recovered,
    };
  }
  if (moved > 0) {
    return {
      variant: 'success',
      key: 'mobile.adminScheduling.replan.ordersMoved',
      count: moved,
    };
  }
  return { variant: 'success', key: 'mobile.adminScheduling.replan.nothingToMove' };
}
