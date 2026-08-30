import {
  filterRegistry,
  getAuditStats,
  getLabEntry,
  getLabRegistry,
} from '../index';

describe('Dev component lab registry', () => {
  it('has unique entry ids', () => {
    const all = getLabRegistry();
    const ids = all.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('audit stats have zero unclassified', () => {
    const stats = getAuditStats();
    expect(stats.unclassified).toBe(0);
    expect(stats.totalFiles).toBeGreaterThan(100);
  });

  it('finds PrimaryButton and FloatingActionDock', () => {
    expect(getLabEntry('shared.primary-button')?.componentName).toBe('PrimaryButton');
    expect(getLabEntry('shared.floating-action-dock')?.componentName).toBe(
      'FloatingActionDock',
    );
  });

  it('search filters by component name', () => {
    const all = getLabRegistry();
    const hits = filterRegistry(all, { query: 'FloatingActionDock' });
    expect(hits.some((e) => e.id === 'shared.floating-action-dock')).toBe(true);
  });

  it('role filter Admin excludes Worker-only when role set', () => {
    const all = getLabRegistry();
    const admin = filterRegistry(all, { role: 'Admin' });
    expect(admin.every((e) => e.role === 'Admin')).toBe(true);
  });

  it('important entries expose sourceFile and usedIn', () => {
    const entry = getLabEntry('shared.product-thumb');
    expect(entry?.sourceFile).toContain('ProductThumb');
    expect(entry?.usedIn?.length).toBeGreaterThan(0);
  });
});
