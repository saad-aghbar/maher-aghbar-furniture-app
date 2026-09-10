import { readFileSync } from 'fs';
import { join } from 'path';

const src = readFileSync(join(__dirname, '../SupplierDetailScreen.tsx'), 'utf8');

describe('supplier detail floor', () => {
  it('puts money rows in ltr and uses floor boards', () => {
    expect(src).toContain('PurchasingFloorBoard');
    expect(src).toContain("dir=\"ltr\"");
    expect(src).toContain('DealerEmptyPanel');
    expect(src).not.toContain('DeskCard');
    expect(src).not.toContain('SurfaceCard');
  });
});
