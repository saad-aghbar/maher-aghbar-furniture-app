import { mapLoginError } from '../mapAuthError';
import { ApiError } from '@/api/errors';

/**
 * Login flow mapping coverage (provider uses apiLogin + mapLoginError).
 * Token persistence is covered by auth module + SecureStore helpers.
 */
describe('loginFlow errors', () => {
  it('failed login maps to invalid_credentials', () => {
    expect(
      mapLoginError(new ApiError('nope', { status: 401, code: 'INVALID_CREDENTIALS' })),
    ).toBe('invalid_credentials');
  });

  it('rate limit maps correctly', () => {
    expect(mapLoginError(new ApiError('slow', { status: 429, code: 'TOO_MANY_REQUESTS' }))).toBe(
      'rate_limited',
    );
  });

  it('successful path is not an error code', () => {
    expect(mapLoginError(null)).toBe('unknown');
  });
});
