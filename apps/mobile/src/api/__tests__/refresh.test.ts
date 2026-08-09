import { refreshSession, resetRefreshFlight } from '../refresh';
import type { TokenPair } from '@/storage/tokens';

describe('refresh coordination', () => {
  beforeEach(() => {
    resetRefreshFlight();
  });

  it('single-flights concurrent refresh calls', async () => {
    let refreshPosts = 0;
    const store = {
      getRefreshToken: jest.fn(async () => 'refresh-old'),
      setTokens: jest.fn(async (_pair: TokenPair) => undefined),
      clearTokens: jest.fn(async () => undefined),
    };

    const fetchFn = jest.fn(async () => {
      refreshPosts += 1;
      await new Promise((r) => setTimeout(r, 20));
      return new Response(
        JSON.stringify({
          user: { id: '1', username: 'u', email: 'e', name: 'n', roles: [], permissions: [], preferredLanguage: 'en' },
          accessToken: 'access-new',
          refreshToken: 'refresh-new',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });

    const [a, b] = await Promise.all([
      refreshSession({
        fetchFn: fetchFn as unknown as typeof fetch,
        store,
        baseUrl: 'http://test/api/v1',
        onRefreshFailed: async () => undefined,
      }),
      refreshSession({
        fetchFn: fetchFn as unknown as typeof fetch,
        store,
        baseUrl: 'http://test/api/v1',
        onRefreshFailed: async () => undefined,
      }),
    ]);

    expect(refreshPosts).toBe(1);
    expect(fetchFn.mock.calls[0]![0]).toContain('/auth/mobile/refresh');
    expect(a.accessToken).toBe('access-new');
    expect(b.refreshToken).toBe('refresh-new');
    expect(store.setTokens).toHaveBeenCalledWith({
      accessToken: 'access-new',
      refreshToken: 'refresh-new',
    });
  });

  it('clears session when refresh fails', async () => {
    const onRefreshFailed = jest.fn(async () => undefined);
    const store = {
      getRefreshToken: jest.fn(async () => 'refresh-old'),
      setTokens: jest.fn(async () => undefined),
      clearTokens: jest.fn(async () => undefined),
    };

    const fetchFn = jest.fn(async () =>
      new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'bad' } }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(
      refreshSession({
        fetchFn: fetchFn as unknown as typeof fetch,
        store,
        baseUrl: 'http://test/api/v1',
        onRefreshFailed,
      }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });

    expect(onRefreshFailed).toHaveBeenCalled();
  });
});
