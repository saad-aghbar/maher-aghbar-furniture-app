import { describe, expect, it, vi } from 'vitest';
import { ApiClientError } from './api-client';
import { loadCompletedOrderTasks } from './completed-order-tasks';

const task = (id: string, order: string) => ({ id, productionOrder: { salesOrderId: order } });

describe('completed order task history', () => {
  it('loads all scoped pages and keeps only the requested parent', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce({ data: [task('a', 'so-1'), task('other', 'so-2')], meta: { totalPages: 2 } })
      .mockResolvedValueOnce({ data: [task('b', 'so-1')], meta: { totalPages: 2 } });
    expect((await loadCompletedOrderTasks('so-1', fetch)).map((t) => t.id)).toEqual(['a', 'b']);
    expect(fetch).toHaveBeenNthCalledWith(2, expect.stringContaining('page=2'));
    expect(fetch).toHaveBeenNthCalledWith(2, expect.stringContaining('salesOrderId=so-1'));
  });

  it('walks all legacy pages when the running API does not recognize salesOrderId', async () => {
    const fetch = vi.fn()
      .mockRejectedValueOnce(new ApiClientError('property salesOrderId should not exist', 400))
      .mockResolvedValueOnce({ data: [task('other', 'so-2')], meta: { totalPages: 2 } })
      .mockResolvedValueOnce({ data: [task('a', 'so-1')], meta: { totalPages: 2 } });
    expect((await loadCompletedOrderTasks('so-1', fetch)).map((t) => t.id)).toEqual(['a']);
    expect(fetch).toHaveBeenNthCalledWith(3, expect.not.stringContaining('salesOrderId='));
  });

  it('recognizes the API validation envelope with details in fieldErrors', async () => {
    const fetch = vi.fn()
      .mockRejectedValueOnce(new ApiClientError('Validation failed', 400, {
        code: 'VALIDATION_ERROR', message: 'Validation failed',
        fieldErrors: { _: ['property salesOrderId should not exist'] },
      }))
      .mockResolvedValueOnce({ data: [task('a', 'so-1')], meta: { totalPages: 1 } });
    expect((await loadCompletedOrderTasks('so-1', fetch)).map((t) => t.id)).toEqual(['a']);
  });

  it.each([401, 403, 500])('does not hide a %s failure behind an unscoped request', async (status) => {
    const error = new ApiClientError('failed', status);
    const fetch = vi.fn().mockRejectedValue(error);
    await expect(loadCompletedOrderTasks('so-1', fetch)).rejects.toBe(error);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('does not replace a later page failure with partial history', async () => {
    const error = new ApiClientError('unavailable', 500);
    const fetch = vi.fn()
      .mockResolvedValueOnce({ data: [task('a', 'so-1')], meta: { totalPages: 2 } })
      .mockRejectedValueOnce(error);
    await expect(loadCompletedOrderTasks('so-1', fetch)).rejects.toBe(error);
  });

  it('does not treat an unrelated bad request as an old API', async () => {
    const error = new ApiClientError('Invalid date', 400);
    const fetch = vi.fn().mockRejectedValue(error);
    await expect(loadCompletedOrderTasks('so-1', fetch)).rejects.toBe(error);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
