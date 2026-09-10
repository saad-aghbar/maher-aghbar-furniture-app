import { readFileSync } from 'fs';
import { join } from 'path';

const src = readFileSync(join(__dirname, '../PurchaseDetailScreen.tsx'), 'utf8');

describe('purchase detail actions', () => {
  it('wires approve, preview send, resend, receive, and pdf', () => {
    expect(src).toContain("setConfirm('approve')");
    expect(src).toContain('previewSend');
    expect(src).toContain('resendWhatsapp');
    expect(src).toContain('/inventory/receive/');
    expect(src).toContain('openPurchaseOrderPdf');
    expect(src).toContain("po.status === 'DRAFT'");
    expect(src).toContain("po.status === 'APPROVED'");
    expect(src).toContain('PurchaseWhatsAppPreviewSheet');
    expect(src).toContain('receiveAfterSend');
  });
});
