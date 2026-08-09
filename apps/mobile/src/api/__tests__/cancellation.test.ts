import { apiRequest } from '../client';
import { ApiError } from '../errors';

describe('request cancellation', () => {
  it('maps aborted signal to ABORTED', async () => {
    const controller = new AbortController();
    controller.abort();

    const fetchFn = jest.fn(async (_url: string, init?: RequestInit) => {
      if (init?.signal?.aborted) {
        const err = new Error('Aborted');
        err.name = 'AbortError';
        throw err;
      }
      return new Response('{}', { status: 200 });
    });

    await expect(
      apiRequest('/tasks', {
        fetchFn: fetchFn as unknown as typeof fetch,
        getIsConnectedFn: async () => true,
        getAccessTokenFn: async () => 't',
        skipRefresh: true,
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ code: 'ABORTED' } satisfies Partial<ApiError>);
  });
});
