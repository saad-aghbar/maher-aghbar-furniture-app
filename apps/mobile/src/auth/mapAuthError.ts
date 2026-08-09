import { isApiError } from '@/api/errors';

export type AuthStatus =
  | 'bootstrapping'
  | 'unauthenticated'
  | 'authenticating'
  | 'authenticated'
  | 'needs_biometric'
  | 'disabled'
  | 'session_expired'
  | 'offline';

export type LoginUiError =
  | 'invalid_credentials'
  | 'rate_limited'
  | 'network'
  | 'mfa_required'
  | 'mfa_invalid'
  | 'disabled'
  | 'locked'
  | 'unknown';

export function mapLoginError(error: unknown): LoginUiError {
  if (!isApiError(error)) {
    if (error instanceof TypeError) return 'network';
    return 'unknown';
  }
  if (error.isOffline || error.code === 'OFFLINE') return 'network';
  switch (error.code) {
    case 'TOO_MANY_REQUESTS':
      return 'rate_limited';
    case 'MFA_REQUIRED':
      return 'mfa_required';
    case 'MFA_INVALID':
      return 'mfa_invalid';
    case 'ACCOUNT_SUSPENDED':
      return 'disabled';
    case 'ACCOUNT_LOCKED':
      return 'locked';
    case 'INVALID_CREDENTIALS':
    case 'UNAUTHORIZED':
      return 'invalid_credentials';
    default:
      if (error.status === 429) return 'rate_limited';
      return 'unknown';
  }
}

export function mapRestoreFailure(error: unknown): 'offline' | 'disabled' | 'session_expired' {
  if (!isApiError(error)) {
    return 'session_expired';
  }
  if (error.isOffline || error.code === 'OFFLINE') return 'offline';
  if (error.code === 'ACCOUNT_SUSPENDED') return 'disabled';
  return 'session_expired';
}
