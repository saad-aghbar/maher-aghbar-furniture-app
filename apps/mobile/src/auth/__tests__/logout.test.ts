import { clearTokens, setTokens, getTokenPair } from '@/storage/tokens';

jest.mock('expo-secure-store', () => {
  const mem = new Map<string, string>();
  return {
    getItemAsync: jest.fn(async (k: string) => mem.get(k) ?? null),
    setItemAsync: jest.fn(async (k: string, v: string) => {
      mem.set(k, v);
    }),
    deleteItemAsync: jest.fn(async (k: string) => {
      mem.delete(k);
    }),
  };
});

describe('logout / token clear', () => {
  it('clears SecureStore tokens', async () => {
    await setTokens({ accessToken: 'a', refreshToken: 'r' });
    expect(await getTokenPair()).toEqual({ accessToken: 'a', refreshToken: 'r' });
    await clearTokens();
    expect(await getTokenPair()).toBeNull();
  });
});
