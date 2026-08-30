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
