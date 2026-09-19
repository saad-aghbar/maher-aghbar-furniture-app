import { afterEach, describe, expect, it, vi } from 'vitest';
import { refreshWebSession, resetRefreshFlight } from './refresh-session';

afterEach(() => {
  resetRefreshFlight();
  vi.unstubAllGlobals();
});

describe('refreshWebSession', () => {
  it('single-flights concurrent refresh calls', async () => {
    let calls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        calls += 1;
        await new Promise((r) => setTimeout(r, 20));
        return new Response('{}', { status: 200 });
      }),
    );
    const [a, b] = await Promise.all([refreshWebSession(), refreshWebSession()]);
    expect(a).toBe(true);
    expect(b).toBe(true);
    expect(calls).toBe(1);
  });
});
