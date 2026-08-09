import { networkStatusLabel, shouldShowOfflineBanner } from '../networkState';

describe('networkState', () => {
  it('shows offline banner only when disconnected', () => {
    expect(shouldShowOfflineBanner(false)).toBe(true);
    expect(shouldShowOfflineBanner(true)).toBe(false);
    expect(shouldShowOfflineBanner(null)).toBe(false);
  });

  it('labels connection status', () => {
    expect(networkStatusLabel(true)).toBe('online');
    expect(networkStatusLabel(false)).toBe('offline');
    expect(networkStatusLabel(null)).toBe('unknown');
  });
});
