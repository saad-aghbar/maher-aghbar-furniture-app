import { readFileSync } from 'fs';
import { join } from 'path';

const src = readFileSync(join(__dirname, '../PurchaseRunDetailScreen.tsx'), 'utf8');

describe('purchase run detail', () => {
  it('approves, previews send, and locks receive until sent', () => {
    expect(src).toContain('PurchaseWhatsAppPreviewSheet');
    expect(src).toContain('receiveAfterSend');
    expect(src).toContain('approveRunConfirm');
    expect(src).toContain('RECEIPTS_TAB_CLEARANCE_EXTRA');
    expect(src).toContain('destinationName');
    expect(src).not.toContain('DeskCard');
  });
});
