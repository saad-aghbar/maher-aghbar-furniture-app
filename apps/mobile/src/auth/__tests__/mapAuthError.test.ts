import { mapLoginError, mapRestoreFailure } from '../mapAuthError';
import { ApiError } from '@/api/errors';

describe('mapAuthError', () => {
  it('maps login codes', () => {
    expect(mapLoginError(new ApiError('x', { status: 401, code: 'INVALID_CREDENTIALS' }))).toBe(
      'invalid_credentials',
    );
    expect(mapLoginError(new ApiError('x', { status: 429, code: 'TOO_MANY_REQUESTS' }))).toBe(
      'rate_limited',
    );
    expect(mapLoginError(new ApiError('x', { status: 0, code: 'OFFLINE' }))).toBe('network');
    expect(mapLoginError(new ApiError('x', { status: 401, code: 'MFA_REQUIRED' }))).toBe(
      'mfa_required',
    );
    expect(mapLoginError(new ApiError('x', { status: 401, code: 'ACCOUNT_SUSPENDED' }))).toBe(
      'disabled',
    );
    expect(mapLoginError(new ApiError('x', { status: 401, code: 'ACCOUNT_LOCKED' }))).toBe(
      'locked',
    );
  });

  it('maps restore failures', () => {
    expect(mapRestoreFailure(new ApiError('x', { status: 0, code: 'OFFLINE' }))).toBe('offline');
    expect(mapRestoreFailure(new ApiError('x', { status: 401, code: 'ACCOUNT_SUSPENDED' }))).toBe(
      'disabled',
    );
    expect(mapRestoreFailure(new ApiError('x', { status: 401, code: 'UNAUTHORIZED' }))).toBe(
      'session_expired',
    );
  });
});
