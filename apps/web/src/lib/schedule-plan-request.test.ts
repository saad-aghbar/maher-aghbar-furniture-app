import { describe, expect, it } from 'vitest';
import { schedulePlanRequest } from './schedule-plan-request';

describe('schedulePlanRequest', () => {
  it('previews without sending a new planned start', () => {
    expect(schedulePlanRequest('preview', 'po-1', '2026-10-20')).toEqual({
      path: '/api/v1/scheduling/orders/po-1/generate',
      method: 'POST',
      body: undefined,
    });
  });

  it('applies the drafted start only on the apply action', () => {
    expect(schedulePlanRequest('apply', 'po-1', '2026-10-20')).toEqual({
      path: '/api/v1/production-orders/po-1/suggest-plan-schedule',
      method: 'POST',
      body: { plannedStartDate: '2026-10-20T12:00:00.000Z' },
    });
  });
});
