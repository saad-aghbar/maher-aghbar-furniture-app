import {
  asAppHref,
  authenticatedLandingHref,
  expoDeepLinkPath,
  isGlobalSearchPath,
  shouldRedirectAppIndex,
} from '../appIndexPath';

describe('appIndexPath', () => {
  it('extracts the Expo Go --/ path', () => {
    expect(expoDeepLinkPath('exp://127.0.0.1:8081/--/(app)/search')).toBe('/(app)/search');
    expect(expoDeepLinkPath('exp://127.0.0.1:8081/--/search')).toBe('/search');
    expect(expoDeepLinkPath(null)).toBe('');
  });

  it('recognizes the global search route', () => {
    expect(isGlobalSearchPath('/search')).toBe(true);
    expect(isGlobalSearchPath('/(app)/search')).toBe(true);
    expect(isGlobalSearchPath(expoDeepLinkPath('exp://127.0.0.1:8081/--/(app)/search'))).toBe(
      true,
    );
    expect(isGlobalSearchPath('/notifications')).toBe(false);
    expect(isGlobalSearchPath('/(app)/(admin)/(tabs)')).toBe(false);
  });

  it('does not let the app index Redirect steal real destinations', () => {
    expect(shouldRedirectAppIndex('/search')).toBe(false);
    expect(shouldRedirectAppIndex('/(app)/search')).toBe(false);
    expect(shouldRedirectAppIndex('/notifications')).toBe(false);
    expect(shouldRedirectAppIndex('/(app)/_forbidden')).toBe(false);
    expect(shouldRedirectAppIndex('/(app)/(customer)/(tabs)/catalog')).toBe(false);
    expect(shouldRedirectAppIndex('/(app)/(admin)/(tabs)')).toBe(false);
    expect(shouldRedirectAppIndex('/(app)/(admin)/(tabs)/orders')).toBe(false);
    expect(shouldRedirectAppIndex('/')).toBe(true);
    expect(shouldRedirectAppIndex('/(app)')).toBe(true);
    expect(shouldRedirectAppIndex('/(app)/index')).toBe(true);
  });

  it('preserves catalog and search deep links instead of bouncing to Home', () => {
    const home = '/(app)/(admin)/(tabs)';
    expect(
      authenticatedLandingHref('/(app)/(customer)/(tabs)/catalog', home),
    ).toBe('/(app)/(customer)/(tabs)/catalog');
    expect(authenticatedLandingHref('/search', home)).toBe('/(app)/search');
    expect(authenticatedLandingHref('/', home)).toBe(home);
    expect(asAppHref('/(app)/(customer)/(tabs)/catalog')).toBe(
      '/(app)/(customer)/(tabs)/catalog',
    );
  });
});
