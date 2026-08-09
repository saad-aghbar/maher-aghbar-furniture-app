import { assertOnline, offlineError } from '../errors';

describe('offline errors', () => {
  it('produces OFFLINE ApiError', () => {
    const err = offlineError();
    expect(err.status).toBe(0);
    expect(err.code).toBe('OFFLINE');
    expect(err.isOffline).toBe(true);
  });

  it('assertOnline blocks when isConnected is false', () => {
    expect(() => assertOnline(false)).toThrow(/network/i);
  });
});
