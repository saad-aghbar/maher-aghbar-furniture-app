import {
  ApiError,
  abortedError,
  apiErrorFromResponse,
  assertOnline,
  normalizeStatusCode,
  offlineError,
  timeoutError,
} from '../errors';

describe('api errors', () => {
  it('normalizes HTTP statuses', () => {
    expect(normalizeStatusCode(401)).toBe('UNAUTHORIZED');
    expect(normalizeStatusCode(401, 'MFA_REQUIRED')).toBe('MFA_REQUIRED');
    expect(normalizeStatusCode(403)).toBe('FORBIDDEN');
    expect(normalizeStatusCode(404)).toBe('NOT_FOUND');
    expect(normalizeStatusCode(409, 'USERNAME_IN_USE')).toBe('USERNAME_IN_USE');
    expect(normalizeStatusCode(400)).toBe('VALIDATION_ERROR');
    expect(normalizeStatusCode(422)).toBe('VALIDATION_ERROR');
    expect(normalizeStatusCode(429)).toBe('TOO_MANY_REQUESTS');
    expect(normalizeStatusCode(500)).toBe('INTERNAL_ERROR');
  });

  it('parses Nest error body', () => {
    const err = apiErrorFromResponse(
      403,
      {
        error: {
          code: 'FORBIDDEN',
          message: 'No access',
          fieldErrors: {},
          requestId: 'abc',
        },
      },
      'fallback',
    );
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe('FORBIDDEN');
    expect(err.message).toBe('No access');
    expect(err.requestId).toBe('abc');
    expect(err.status).toBe(403);
  });

  it('keeps conflict runId so the UI can poll an in-flight factory run', () => {
    const err = apiErrorFromResponse(409, {
      error: {
        code: 'SYNC_ALREADY_IN_PROGRESS',
        message: 'A factory schedule update is already in progress.',
        runId: 'run-cal',
      },
    });
    expect(err.code).toBe('SYNC_ALREADY_IN_PROGRESS');
    expect(err.runId).toBe('run-cal');
  });

  it('maps offline / timeout / abort helpers', () => {
    expect(offlineError().code).toBe('OFFLINE');
    expect(offlineError().isOffline).toBe(true);
    expect(timeoutError('r1').code).toBe('TIMEOUT');
    expect(abortedError().code).toBe('ABORTED');
    expect(abortedError().isAborted).toBe(true);
  });

  it('assertOnline throws when disconnected', () => {
    expect(() => assertOnline(false)).toThrow(ApiError);
    expect(() => assertOnline(true)).not.toThrow();
    expect(() => assertOnline(null)).not.toThrow();
  });
});
