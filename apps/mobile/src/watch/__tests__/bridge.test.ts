import { noopWatchBridge, resolveWatchBridge, type WatchBridge } from '../bridge';

const native: WatchBridge = {
  publishContext: jest.fn(async () => {}),
  publishToken: jest.fn(async () => {}),
  clear: jest.fn(async () => {}),
};

describe('Watch bridge platform fallback', () => {
  it('returns the native module on iOS when present', () => {
    expect(resolveWatchBridge('ios', () => native)).toBe(native);
  });

  it('is a safe no-op on Android', () => {
    expect(resolveWatchBridge('android', () => native)).toBe(noopWatchBridge);
  });

  it('is a safe no-op on web', () => {
    expect(resolveWatchBridge('web', () => native)).toBe(noopWatchBridge);
  });

  it('is a safe no-op on iOS when the native module is missing', () => {
    expect(resolveWatchBridge('ios', () => null)).toBe(noopWatchBridge);
  });

  it('noop methods resolve without throwing', async () => {
    await expect(noopWatchBridge.publishContext({ state: 'unavailable' })).resolves.toBeUndefined();
    await expect(noopWatchBridge.publishToken('x', 1)).resolves.toBeUndefined();
    await expect(noopWatchBridge.clear()).resolves.toBeUndefined();
  });
});
