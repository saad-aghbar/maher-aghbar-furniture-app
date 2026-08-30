import { abortedError, ApiError, offlineError } from '../errors';
import { isTechnicalQueryError, sanitizeFeedbackCopy, shouldToastApiError } from '../toastErrors';
import { isRawNetworkFailure, isRawNetworkFailureMessage } from '../queryErrorToast';

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

