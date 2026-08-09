import { restoreSession } from '../sessionRestore';
import { ApiError } from '@/api/errors';

describe('restoreSession', () => {
  it('returns unauthenticated when no refresh token', async () => {
    const result = await restoreSession({
      getRefreshTokenFn: async () => null,
    });
    expect(result.status).toBe('unauthenticated');
  });

  it('returns offline when disconnected with tokens', async () => {
    const result = await restoreSession({
      getRefreshTokenFn: async () => 'refresh',
      getIsConnectedFn: async () => false,
    });
    expect(result.status).toBe('offline');
  });

  it('returns authenticated after refresh + me', async () => {
    const user = {
      id: '1',
      username: 'admin',
      email: 'a@b.c',
      name: 'Admin',
      roles: ['ADMIN'],
      permissions: ['user.manage'],
      preferredLanguage: 'en' as const,
      mfaEnabled: false,
      mfaPending: false,
    };
    const result = await restoreSession({
      getRefreshTokenFn: async () => 'refresh',
      getIsConnectedFn: async () => true,
      refreshFn: async () => ({ accessToken: 'a', refreshToken: 'b' }),
      getMeFn: async () => user,
    });
    expect(result.status).toBe('authenticated');
    if (result.status === 'authenticated') {
      expect(result.user.username).toBe('admin');
    }
  });

  it('returns disabled when suspended', async () => {
    const result = await restoreSession({
      getRefreshTokenFn: async () => 'refresh',
      getIsConnectedFn: async () => true,
      refreshFn: async () => {
        throw new ApiError('suspended', { status: 401, code: 'ACCOUNT_SUSPENDED' });
      },
    });
    expect(result.status).toBe('disabled');
  });

  it('returns session_expired on refresh failure', async () => {
    const result = await restoreSession({
      getRefreshTokenFn: async () => 'refresh',
      getIsConnectedFn: async () => true,
      refreshFn: async () => {
        throw new ApiError('bad', { status: 401, code: 'UNAUTHORIZED' });
      },
    });
    expect(result.status).toBe('session_expired');
  });
});
