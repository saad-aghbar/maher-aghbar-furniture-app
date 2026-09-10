import {
  mergePurchasingWhatsAppSettings,
  renderPurchaseWhatsAppTemplate,
} from './purchase-whatsapp-template';

const ctx = {
  supplierName: 'Wood Co',
  orderNumber: 'PORD-1',
  currency: 'ILS',
  total: 120,
  expectedDate: '2026-09-10',
  companyName: 'Maher',
  lines: [
    { description: 'Oak veneer', quantity: 12, unit: 'm', unitPrice: 8, warehouseName: 'Raw A' },
    { description: 'Foam', quantity: 2.5, unit: 'pcs' },
  ],
};

describe('purchase WhatsApp template', () => {
  it('falls back to the current Arabic body when the template is empty', () => {
    const body = renderPurchaseWhatsAppTemplate(mergePurchasingWhatsAppSettings({}), ctx);
    expect(body).toContain('أمر شراء PORD-1');
    expect(body).toContain('يرجى التوريد:');
    expect(body).toContain('• Oak veneer: 12 m');
    expect(body).toContain('شكراً لكم.');
  });

  it('renders every token and drops unknown ones', () => {
    const body = renderPurchaseWhatsAppTemplate(
      mergePurchasingWhatsAppSettings({
        template:
          '{{supplierName}}\n{{orderNumber}}\n{{lines}}\n{{total}} {{currency}}\n{{expectedDate}}\n{{companyName}}\n{{signature}}\n{{missing}}',
        includePrices: true,
        includeWarehouse: true,
        includeExpectedDate: true,
        signature: '— Maher',
      }),
      ctx,
    );
    expect(body).toContain('Wood Co');
    expect(body).toContain('PORD-1');
    expect(body).toContain('• Oak veneer: 12 m @ 8 → Raw A');
    expect(body).toContain('120 ILS');
    expect(body).toContain('2026-09-10');
    expect(body).toContain('Maher');
    expect(body).toContain('— Maher');
    expect(body).not.toContain('{{missing}}');
  });

  it('honours price / warehouse / expected-date toggles', () => {
    const hidden = renderPurchaseWhatsAppTemplate(
      mergePurchasingWhatsAppSettings({
        template: '{{lines}}\n{{expectedDate}}',
        includePrices: false,
        includeWarehouse: false,
        includeExpectedDate: false,
      }),
      ctx,
    );
    expect(hidden).toBe('• Oak veneer: 12 m\n• Foam: 2.5 pcs\n');
  });
});
