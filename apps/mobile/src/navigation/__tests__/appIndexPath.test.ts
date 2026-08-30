import {
  SEARCH_HREF,
  asAppHref,
  authenticatedLandingHref,
  expoDeepLinkPath,
  isGlobalSearchPath,
  groupedSurfaceFromPath,
  shouldPresentGlobalSearch,
  shouldPresentWrongSurfaceForbidden,
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
    expect(SEARCH_HREF).toBe('/(app)/search');
    expect(isGlobalSearchPath('/notifications')).toBe(false);
    expect(isGlobalSearchPath('/(app)/(admin)/(tabs)')).toBe(false);
  });

  it('opens search when Expo focused / but the launch URL is /(app)/search', () => {
    const exp = 'exp://127.0.0.1:8081/--/(app)/search';
    expect(shouldPresentGlobalSearch('/', ['(app)'], exp)).toBe(true);
    expect(shouldPresentGlobalSearch('/', [], exp)).toBe(true);
    expect(shouldPresentGlobalSearch('/search', [], null)).toBe(true);
    expect(shouldPresentGlobalSearch('/', ['(app)', '(admin)', '(tabs)'], exp)).toBe(false);
    expect(
      shouldPresentGlobalSearch('/', ['(app)', '(employee)', '(tabs)'], exp),
    ).toBe(false);
    expect(shouldPresentGlobalSearch('/', ['(app)'], 'exp://127.0.0.1:8081')).toBe(false);
    expect(asAppHref('/(app)/search')).toBe('/(app)/search');
  });

  it('does not let the app index Redirect steal real destinations', () => {
    expect(shouldRedirectAppIndex('/search')).toBe(false);
    expect(shouldRedirectAppIndex('/(app)/search')).toBe(false);
    expect(shouldRedirectAppIndex('/notifications')).toBe(false);
    expect(shouldRedirectAppIndex('/(app)/_forbidden')).toBe(false);
    expect(shouldRedirectAppIndex('/(app)/(customer)/(tabs)/catalog')).toBe(false);
    expect(shouldRedirectAppIndex('/(app)/(admin)/(tabs)')).toBe(false);
    expect(shouldRedirectAppIndex('/(app)/(admin)/(tabs)/orders')).toBe(false);
    expect(shouldRedirectAppIndex('/(app)/(employee)/(tabs)')).toBe(false);
    expect(shouldRedirectAppIndex('/')).toBe(true);
    expect(shouldRedirectAppIndex('/(app)')).toBe(true);
    expect(shouldRedirectAppIndex('/(app)/index')).toBe(true);
  });

  it('treats group-stripped employee tabs as a real destination, not /', () => {
    expect(shouldRedirectAppIndex('/', ['(app)', '(employee)', '(tabs)'])).toBe(false);
    expect(shouldRedirectAppIndex('/', ['(app)', '(customer)', '(tabs)'])).toBe(false);
    expect(shouldRedirectAppIndex('/', ['(app)', '(admin)', '(tabs)'])).toBe(false);
    expect(shouldRedirectAppIndex('/', ['(app)'])).toBe(true);
    expect(shouldRedirectAppIndex('/', [])).toBe(true);
  });

  it('admin on grouped customer tabs from the Expo launch URL is forbidden, not Home', () => {
    const exp = 'exp://127.0.0.1:8081/--/(app)/(customer)/(tabs)';
    expect(groupedSurfaceFromPath(expoDeepLinkPath(exp))).toBe('customer');
    expect(shouldPresentGlobalSearch('/', ['(app)'], exp)).toBe(false);
    expect(shouldPresentWrongSurfaceForbidden('/', ['(app)'], exp, 'admin')).toBe(true);
    expect(shouldPresentWrongSurfaceForbidden('/', [], exp, 'admin')).toBe(true);
    expect(
      shouldPresentWrongSurfaceForbidden('/', ['(app)'], exp, 'customer'),
    ).toBe(false);
    expect(
      shouldPresentWrongSurfaceForbidden(
        '/',
        ['(app)', '(admin)', '(tabs)'],
        exp,
        'admin',
      ),
    ).toBe(false);
    expect(
      shouldPresentWrongSurfaceForbidden(
        '/',
        ['(app)', '(customer)', '(tabs)'],
        exp,
        'admin',
      ),
    ).toBe(false);
    expect(
      shouldPresentWrongSurfaceForbidden(
        '/',
        ['(app)'],
        'exp://127.0.0.1:8081/--/(app)/(employee)/(tabs)',
        'admin',
      ),
    ).toBe(true);
    expect(
      shouldPresentWrongSurfaceForbidden(
        '/',
        ['(app)'],
        'exp://127.0.0.1:8081/--/(app)/(customer)/(tabs)/catalog',
        'admin',
      ),
    ).toBe(true);
  });

  it('preserves catalog, search, and employee-tab deep links instead of bouncing to Home', () => {
    const home = '/(app)/(admin)/(tabs)';
    expect(
      authenticatedLandingHref('/(app)/(customer)/(tabs)/catalog', home),
    ).toBe('/(app)/(customer)/(tabs)/catalog');
    expect(authenticatedLandingHref('/(app)/(customer)/(tabs)', home)).toBe(
      '/(app)/(customer)/(tabs)',
    );
    expect(
      authenticatedLandingHref(
        expoDeepLinkPath('exp://127.0.0.1:8081/--/(app)/(customer)/(tabs)'),
        home,
      ),
    ).toBe('/(app)/(customer)/(tabs)');
    expect(authenticatedLandingHref('/(app)/(employee)/(tabs)', home)).toBe(
      '/(app)/(employee)/(tabs)',
    );
    expect(authenticatedLandingHref('/search', home)).toBe('/(app)/search');
    expect(authenticatedLandingHref('/(app)/search', home)).toBe('/(app)/search');
    expect(
      authenticatedLandingHref(
        expoDeepLinkPath('exp://127.0.0.1:8081/--/(app)/search'),
        home,
      ),
    ).toBe('/(app)/search');
    expect(authenticatedLandingHref('/', home)).toBe(home);
    expect(asAppHref('/(app)/(customer)/(tabs)/catalog')).toBe(
      '/(app)/(customer)/(tabs)/catalog',
    );
  });
});
