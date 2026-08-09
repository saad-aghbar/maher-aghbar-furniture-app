import { createSafeAsyncStorage } from '../safeAsyncStorage';

describe('createSafeAsyncStorage', () => {
  it('returns null from getItem when native storage throws', async () => {
    const storage = {
      getItem: jest.fn(async () => {
        throw new Error('Native module is null, cannot access legacy storage');
      }),
      setItem: jest.fn(),
      removeItem: jest.fn(),
    };

    const safe = createSafeAsyncStorage(storage);
    await expect(safe.getItem('k')).resolves.toBeNull();
    expect(storage.getItem).toHaveBeenCalledWith('k');
  });

  it('swallows setItem / removeItem failures', async () => {
    const storage = {
      getItem: jest.fn(),
      setItem: jest.fn(async () => {
        throw new Error('Native module is null');
      }),
      removeItem: jest.fn(async () => {
        throw new Error('Native module is null');
      }),
    };

    const safe = createSafeAsyncStorage(storage);
    await expect(safe.setItem('k', 'v')).resolves.toBeUndefined();
    await expect(safe.removeItem('k')).resolves.toBeUndefined();
  });

  it('passes through successful reads/writes', async () => {
    const storage = {
      getItem: jest.fn(async () => 'cached'),
      setItem: jest.fn(async () => undefined),
      removeItem: jest.fn(async () => undefined),
    };

    const safe = createSafeAsyncStorage(storage);
    await expect(safe.getItem('k')).resolves.toBe('cached');
    await safe.setItem('k', 'v');
    await safe.removeItem('k');
    expect(storage.setItem).toHaveBeenCalledWith('k', 'v');
    expect(storage.removeItem).toHaveBeenCalledWith('k');
  });
});
