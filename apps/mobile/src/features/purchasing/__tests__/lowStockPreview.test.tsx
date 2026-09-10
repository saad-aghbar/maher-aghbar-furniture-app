import { readFileSync } from 'fs';
import { join } from 'path';

const src = readFileSync(join(__dirname, '../LowStockReviewScreen.tsx'), 'utf8');

describe('low stock preview', () => {
  it('reuses the multi-supplier WhatsApp sheet after creating a run', () => {
    expect(src).toContain('PurchaseWhatsAppPreviewSheet');
    expect(src).toContain('draftPurchaseRunWhatsApp');
    expect(src).toContain('alreadyOnOrder');
    expect(src).toContain('seedLowStockExcluded');
  });
});
