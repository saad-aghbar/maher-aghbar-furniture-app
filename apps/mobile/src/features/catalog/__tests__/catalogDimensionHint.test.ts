import { formatCatalogDimensionHint } from '../catalogDimensionHint';

describe('formatCatalogDimensionHint', () => {
  it('shows the catalog number when present', () => {
    expect(formatCatalogDimensionHint('Catalog', 220, '—')).toBe('Catalog: 220');
    expect(formatCatalogDimensionHint('Catalog', '85', '—')).toBe('Catalog: 85');
    expect(formatCatalogDimensionHint('Catalog', 0, '—')).toBe('Catalog: 0');
  });

  it('keeps the same hint pattern when the catalog has no value', () => {
    expect(formatCatalogDimensionHint('Catalog', null, '—')).toBe('Catalog: —');
    expect(formatCatalogDimensionHint('Catalog', undefined, '—')).toBe('Catalog: —');
    expect(formatCatalogDimensionHint('Catalog', '', '—')).toBe('Catalog: —');
    expect(formatCatalogDimensionHint('Catalog', 'n/a', '—')).toBe('Catalog: —');
  });

  it('does not invent a seat-height number', () => {
    expect(formatCatalogDimensionHint('Catalog', null, '—')).not.toMatch(/\d/);
  });
});
