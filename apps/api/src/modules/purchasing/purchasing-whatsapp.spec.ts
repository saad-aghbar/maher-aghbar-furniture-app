import { PurchasingService } from './purchasing.service';

/** Pure helpers — no Nest DI. */
describe('PurchasingService WhatsApp helpers', () => {
  const svc = Object.create(PurchasingService.prototype) as PurchasingService;

  it('prefers whatsappPhone over phone', () => {
    expect(svc.supplierWhatsAppTo({ whatsappPhone: '+9627', phone: '+9626' })).toBe('+9627');
    expect(svc.supplierWhatsAppTo({ whatsappPhone: null, phone: '+9626' })).toBe('+9626');
    expect(svc.supplierWhatsAppTo({ whatsappPhone: '  ', phone: null })).toBeNull();
  });

  it('builds a plain order message with lines and qty', () => {
    const body = svc.buildPurchaseOrderWhatsAppBody({
      number: 'PORD-1',
      lines: [
        { description: 'Oak veneer', quantity: 12, unit: 'm' },
        { description: 'Foam', quantity: '2.5', unit: 'pcs' },
      ],
    });
    expect(body).toContain('Purchase order PORD-1');
    expect(body).toContain('• Oak veneer: 12 m');
    expect(body).toContain('• Foam: 2.5 pcs');
  });
});
