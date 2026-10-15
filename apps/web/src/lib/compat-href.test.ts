import { describe, expect, it } from 'vitest';
import { compatHref, localeCompatHref } from './compat-href';

describe('compatHref', () => {
  it('keeps existing filters and sets the requested key', () => {
    expect(compatHref('/admin/inventory', 'page=2', { group: 'foam' })).toBe('/admin/inventory?page=2&group=foam');
  });

  it('drops a key when the override is empty', () => {
    expect(compatHref('/dealer/deliveries', { view: 'calendar', date: '2026-10-12' }, { view: null })).toBe(
      '/dealer/deliveries?date=2026-10-12',
    );
  });

  it('prefixes the locale for a server redirect', () => {
    expect(localeCompatHref('ar', '/admin/reports/orders/ord-1', { from: '2026-10-01' })).toBe(
      '/ar/admin/reports/orders/ord-1?from=2026-10-01',
    );
  });
});
