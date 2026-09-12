import { readFileSync } from 'fs';
import { join } from 'path';

describe('admin verification + promotion floor', () => {
  it('keeps promotion board on parchment', () => {
    const source = readFileSync(
      join(__dirname, '../components/CatalogPromotionBoard.tsx'),
      'utf8',
    );
    expect(source).toContain('DealerBoard');
    expect(source).toContain('promoteVariantFromOrderLine');
    expect(source).not.toContain('DeskCard');
    expect(source).not.toContain('SurfaceCard');
    expect(source).not.toContain("fontWeight: '700'");
  });
});
