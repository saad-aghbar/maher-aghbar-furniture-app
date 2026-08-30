import { classifyLabelScan } from '../components/InventoryScanMatchResult';
import type { InventoryItem } from '../api';

function item(partial: Partial<InventoryItem> & { id: string; sku: string }): InventoryItem {
  return {
    nameEn: partial.nameEn ?? partial.sku,
    nameAr: partial.nameAr ?? partial.sku,
    unit: 'm',
    category: 'FABRIC',
    minStock: 0,
    isActive: true,
    archivedAt: null,
    ...partial,
  };
}

describe('classifyLabelScan', () => {
  const currentId = 'beech-1';

  it('MATCH when ids equal', () => {
    expect(
      classifyLabelScan({
        currentId,
        scanned: item({ id: currentId, sku: 'MAT-BEECH' }),
      }),
    ).toBe('MATCH');
  });

  it('MISMATCH when different active item', () => {
    expect(
      classifyLabelScan({
        currentId,
        scanned: item({ id: 'vel-1', sku: 'MAT-ITAL-VEL' }),
      }),
    ).toBe('MISMATCH');
  });

  it('UNKNOWN when no scanned item', () => {
    expect(classifyLabelScan({ currentId, scanned: null })).toBe('UNKNOWN');
  });

  it('ARCHIVED when inactive or archived', () => {
    expect(
      classifyLabelScan({
        currentId,
        scanned: item({ id: 'x', sku: 'X', isActive: false }),
      }),
    ).toBe('ARCHIVED');
    expect(
      classifyLabelScan({
        currentId,
        scanned: item({ id: 'y', sku: 'Y', archivedAt: '2026-01-01' }),
      }),
    ).toBe('ARCHIVED');
  });

  it('DISALLOWED when allowItem rejects', () => {
    expect(
      classifyLabelScan({
        currentId,
        scanned: item({ id: 'z', sku: 'Z' }),
        allowItem: () => false,
      }),
    ).toBe('DISALLOWED');
  });
});
