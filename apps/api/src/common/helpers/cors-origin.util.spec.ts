import { corsAllowlistFromEnv, isAllowedCorsOrigin } from './cors-origin.util';

describe('isAllowedCorsOrigin', () => {
  const allowlist = ['http://localhost:3000', 'http://localhost:3001'];

  it('allows missing origin (native mobile)', () => {
    expect(isAllowedCorsOrigin(undefined, { allowlist, allowPrivateLan: false })).toBe(true);
  });

  it('allows configured origins', () => {
    expect(
      isAllowedCorsOrigin('http://localhost:3001', { allowlist, allowPrivateLan: false }),
    ).toBe(true);
  });

  it('rejects unknown origins in production', () => {
    expect(
      isAllowedCorsOrigin('http://192.168.1.16:8081', { allowlist, allowPrivateLan: false }),
    ).toBe(false);
  });

  it('allows LAN and Expo origins in development', () => {
    expect(
      isAllowedCorsOrigin('http://192.168.1.16:8081', { allowlist, allowPrivateLan: true }),
    ).toBe(true);
    expect(isAllowedCorsOrigin('exp://192.168.1.16:8081', { allowlist, allowPrivateLan: true })).toBe(
      true,
    );
    expect(
      isAllowedCorsOrigin('http://Saads-MacBook-Air.local:8081', {
        allowlist,
        allowPrivateLan: true,
      }),
    ).toBe(true);
  });
});

describe('corsAllowlistFromEnv', () => {
  it('splits and trims', () => {
    expect(corsAllowlistFromEnv('http://localhost:3000, http://localhost:3001')).toEqual([
      'http://localhost:3000',
      'http://localhost:3001',
    ]);
  });
});
