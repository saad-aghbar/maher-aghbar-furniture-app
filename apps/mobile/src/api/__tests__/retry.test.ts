import { shouldRetryQuery, shouldRetryRequest } from '../retry';
import { ApiError } from '../errors';

describe('retry policy', () => {
  it('allows GET retries for 5xx and 429', () => {
    expect(shouldRetryRequest('GET', 500, 0)).toBe(true);
    expect(shouldRetryRequest('GET', 429, 0)).toBe(true);
    expect(shouldRetryRequest('GET', 500, 2)).toBe(false);
  });

  it('never retries destructive mutations', () => {
    expect(shouldRetryRequest('POST', 500, 0)).toBe(false);
    expect(shouldRetryRequest('PUT', 500, 0)).toBe(false);
    expect(shouldRetryRequest('PATCH', 429, 0)).toBe(false);
    expect(shouldRetryRequest('DELETE', undefined, 0)).toBe(false);
  });

  it('does not retry 4xx except via query 429/5xx rules', () => {
    expect(shouldRetryRequest('GET', 404, 0)).toBe(false);
    expect(shouldRetryRequest('GET', 403, 0)).toBe(false);
  });

  it('Query retry predicate respects ApiError flags', () => {
    expect(shouldRetryQuery(0, new ApiError('x', { status: 500, code: 'INTERNAL_ERROR' }))).toBe(
      true,
    );
    expect(shouldRetryQuery(0, new ApiError('x', { status: 0, code: 'OFFLINE' }))).toBe(false);
    expect(shouldRetryQuery(0, new ApiError('x', { status: 404, code: 'NOT_FOUND' }))).toBe(false);
    expect(shouldRetryQuery(0, new ApiError('x', { status: 429, code: 'TOO_MANY_REQUESTS' }))).toBe(
      true,
    );
  });
});
