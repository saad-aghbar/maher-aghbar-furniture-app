import { ApiError } from '@/api/errors';
import { pollReplanRun, selectReplanResultToast } from '../pollReplanRun';
import type { ReplanRun } from '@/api/modules/scheduling';

describe('pollReplanRun', () => {
  it('returns when the run reaches COMPLETED', async () => {
    const runs: ReplanRun[] = [
      { id: 'r1', status: 'QUEUED' },
      { id: 'r1', status: 'RUNNING' },
      { id: 'r1', status: 'COMPLETED', result: { moved: 2 } },
    ];
    const fetchRun = jest.fn(async () => runs.shift()!);
    const run = await pollReplanRun(fetchRun, 'r1', {
      timeoutMs: 10_000,
      intervalMs: 1,
      sleep: async () => undefined,
    });
    expect(run.status).toBe('COMPLETED');
    expect(run.result?.moved).toBe(2);
    expect(fetchRun).toHaveBeenCalledTimes(3);
  });

  it('fails fast on 404 instead of hanging the caller', async () => {
    const fetchRun = jest.fn(async () => {
      throw new ApiError('not found', { status: 404, code: 'NOT_FOUND' });
    });
    const run = await pollReplanRun(fetchRun, 'r1', {
      timeoutMs: 10_000,
      intervalMs: 1,
      sleep: async () => undefined,
    });
    expect(run.status).toBe('FAILED');
    expect(fetchRun).toHaveBeenCalledTimes(1);
  });

  it('retries transient errors until the run completes', async () => {
    const fetchRun = jest
      .fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({ id: 'r1', status: 'COMPLETED', result: { moved: 1 } });
    const run = await pollReplanRun(fetchRun, 'r1', {
      timeoutMs: 10_000,
      intervalMs: 1,
      sleep: async () => undefined,
    });
    expect(run.status).toBe('COMPLETED');
    expect(fetchRun).toHaveBeenCalledTimes(2);
  });

  it('stops after timeout without inventing COMPLETED', async () => {
    let now = 0;
    const run = await pollReplanRun(async () => ({ id: 'r1', status: 'RUNNING' }), 'r1', {
      timeoutMs: 5,
      intervalMs: 1,
      now: () => {
        now += 2;
        return now;
      },
      sleep: async () => undefined,
    });
    expect(run.status).toBe('RUNNING');
  });
});

describe('selectReplanResultToast', () => {
  it('uses nothing-to-move when completed with zero moves', () => {
    expect(
      selectReplanResultToast({ id: 'r', status: 'COMPLETED', result: { moved: 0 } }),
    ).toEqual({
      variant: 'success',
      key: 'mobile.adminScheduling.replan.nothingToMove',
    });
  });

  it('prefers at-risk recovered over generic moved', () => {
    expect(
      selectReplanResultToast({
        id: 'r',
        status: 'COMPLETED',
        result: { moved: 2, recoveredAtRisk: 1 },
      }),
    ).toEqual({
      variant: 'success',
      key: 'mobile.adminScheduling.replan.atRiskRecovered',
      count: 1,
    });
  });

  it('warns when pinned issues remain', () => {
    expect(
      selectReplanResultToast({
        id: 'r',
        status: 'COMPLETED',
        result: { moved: 1, pinnedIssueCount: 3 },
      }),
    ).toMatchObject({
      variant: 'warning',
      key: 'mobile.adminScheduling.replan.needsAttention',
    });
  });

  it('errors on FAILED or unfinished poll', () => {
    expect(selectReplanResultToast({ id: 'r', status: 'FAILED' }).key).toBe(
      'mobile.adminScheduling.replan.failed',
    );
    expect(selectReplanResultToast({ id: 'r', status: 'RUNNING' }).key).toBe(
      'mobile.adminScheduling.replan.failed',
    );
  });
});
