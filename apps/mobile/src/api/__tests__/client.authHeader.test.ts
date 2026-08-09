import { apiRequest } from '../client';

describe('token injection', () => {
  it('sets Authorization Bearer when auth enabled', async () => {
    const fetchFn = jest.fn(async () =>
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await apiRequest('/auth/me', {
      fetchFn: fetchFn as unknown as typeof fetch,
      getAccessTokenFn: async () => 'access-123',
      getIsConnectedFn: async () => true,
      skipRefresh: true,
    });

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const init = fetchFn.mock.calls[0]![1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer access-123');
    expect(headers['x-request-id']).toBeTruthy();
  });

  it('omits Authorization when auth: false', async () => {
    const fetchFn = jest.fn(async () =>
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await apiRequest('/auth/login', {
      method: 'POST',
      body: { username: 'a', password: 'password1', client: 'mobile' },
      auth: false,
      fetchFn: fetchFn as unknown as typeof fetch,
      getIsConnectedFn: async () => true,
    });

    const init = fetchFn.mock.calls[0]![1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });
});
