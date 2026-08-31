import { abortedError, ApiError, offlineError } from '../errors';
import { isTechnicalQueryError, sanitizeFeedbackCopy, shouldToastApiError } from '../toastErrors';
import {
  isRawNetworkFailure,
  isRawNetworkFailureMessage,
  isWorkerQueueQueryKey,
  shouldSkipGlobalQueryErrorToast,
} from '../queryErrorToast';

describe('raw network failure copy', () => {
  it('detects RN / fetch debug strings', () => {
    expect(isRawNetworkFailureMessage('Network request failed')).toBe(true);
    expect(isRawNetworkFailureMessage('Failed to fetch')).toBe(true);
    expect(isRawNetworkFailureMessage('TypeError: NetworkError when attempting to fetch resource.')).toBe(
      true,
    );
    expect(isRawNetworkFailureMessage('Couldn’t reach the warehouse')).toBe(false);
  });

  it('reads the message from an Error', () => {
    expect(isRawNetworkFailure(new Error('Network request failed'))).toBe(true);
    expect(isRawNetworkFailure(new Error('Forbidden'))).toBe(false);
  });
});

describe('shouldToastApiError', () => {
  it('never toasts persist / dehydrate internals', () => {
    const persist = new Error(
      'A query that was dehydrated as pending ended up rejecting. [["catalog","list"]]: Network request failed',
    );
    expect(isTechnicalQueryError(persist)).toBe(true);
    expect(shouldToastApiError(persist)).toBe(false);
    expect(shouldToastApiError('A query that was dehydrated as pending en…')).toBe(false);
    expect(sanitizeFeedbackCopy(persist.message, 'Couldn’t load dealers')).toBe(
      'Couldn’t load dealers',
    );
  });

  it('does not toast unauthorized or aborted', () => {
    expect(shouldToastApiError(new ApiError('no', { status: 401, code: 'UNAUTHORIZED' }))).toBe(
      false,
    );
    expect(shouldToastApiError(abortedError())).toBe(false);
  });

  it('toasts mutation-facing api errors', () => {
    expect(shouldToastApiError(offlineError())).toBe(true);
    expect(shouldToastApiError(new ApiError('boom', { status: 500, code: 'INTERNAL_ERROR' }))).toBe(
      true,
    );
  });
});

describe('global query error toasts', () => {
  it('identifies worker-home and tasks keys as the floor queue', () => {
    expect(isWorkerQueueQueryKey(['reports', 'worker-home'])).toBe(true);
    expect(isWorkerQueueQueryKey(['tasks', 'list', {}])).toBe(true);
    expect(isWorkerQueueQueryKey(['tasks', 'detail', 't1'])).toBe(true);
    expect(isWorkerQueueQueryKey(['reports', 'admin-home'])).toBe(false);
    expect(isWorkerQueueQueryKey(['inventory', 'detail', 'i1'])).toBe(false);
    expect(isWorkerQueueQueryKey(undefined)).toBe(false);
  });

  it('skips the global toast for worker-queue queries even when the API error would toast', () => {
    const forbidden = new ApiError('No access', { status: 403, code: 'FORBIDDEN' });
    expect(shouldToastApiError(forbidden)).toBe(true);
    expect(shouldSkipGlobalQueryErrorToast(['reports', 'worker-home'])).toBe(true);
    expect(shouldSkipGlobalQueryErrorToast(['tasks', 'list', { mine: true }])).toBe(true);
    expect(shouldSkipGlobalQueryErrorToast(['inventory', 'detail', 'i1'])).toBe(false);
  });

  it('skips the global toast when a query opts out via meta', () => {
    expect(
      shouldSkipGlobalQueryErrorToast(['purchasing', 'detail', 'p1'], {
        skipGlobalErrorToast: true,
      }),
    ).toBe(true);
    expect(shouldSkipGlobalQueryErrorToast(['purchasing', 'detail', 'p1'])).toBe(false);
    expect(
      shouldSkipGlobalQueryErrorToast(
        ['purchasing', 'invoice-detail', 'SINV-2026-00014'],
        { skipGlobalErrorToast: true },
      ),
    ).toBe(true);
    expect(
      shouldSkipGlobalQueryErrorToast(['purchasing', 'invoice-detail', 'SINV-2026-00014']),
    ).toBe(false);
  });

  it('still toasts real screen failures that are not the worker queue', () => {
    const server = new ApiError('boom', { status: 500, code: 'INTERNAL_ERROR' });
    expect(shouldToastApiError(server)).toBe(true);
    expect(shouldSkipGlobalQueryErrorToast(['purchasing', 'detail', 'p1'])).toBe(false);
    expect(shouldSkipGlobalQueryErrorToast(['inventory', 'detail', 'i1'])).toBe(false);
    expect(shouldSkipGlobalQueryErrorToast(['production', 'detail', 'o1'])).toBe(false);
  });
});
