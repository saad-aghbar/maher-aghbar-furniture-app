import { readFileSync } from 'fs';
import { join } from 'path';

const src = readFileSync(join(__dirname, '../PurchaseDetailScreen.tsx'), 'utf8');

describe('purchase detail floor', () => {
  it('keeps RTL, ltr numbers, and a floating dock', () => {
    expect(src).toContain('PurchasingFloorBoard');
    expect(src).toContain('FloatingActionDock');
    expect(src).toContain("dir=\"ltr\"");
    expect(src).toContain("isRTL ? 'row-reverse' : 'row'");
    expect(src).toContain('PurchaseWhatsAppPreviewSheet');
    expect(src).not.toContain('DeskCard');
    expect(src).not.toContain('SurfaceCard');
    expect(src).not.toContain('colors.info');
  });
});
