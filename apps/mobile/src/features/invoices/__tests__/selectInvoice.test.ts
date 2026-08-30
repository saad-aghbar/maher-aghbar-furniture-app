import {
  invoiceListCustomerScope,
  selectInvoiceCard,
  selectInvoiceDetail,
} from '../selectInvoice';
import type { Invoice } from '../api';

describe('invoiceListCustomerScope', () => {
  it('forces dealer ownership when user has customerId', () => {
    expect(invoiceListCustomerScope('cust-a', 'cust-b')).toBe('cust-a');
  });

  it('allows admin filter when user has no customerId', () => {
    expect(invoiceListCustomerScope(null, 'cust-b')).toBe('cust-b');
    expect(invoiceListCustomerScope(undefined, undefined)).toBeUndefined();
  });
});

const baseInv: Invoice = {
  id: '1',
  number: 'INV-1',
  status: 'ISSUED',
  invoiceDate: '2026-05-01T00:00:00.000Z',
  dueDate: '2026-05-15T00:00:00.000Z',
  total: '100.000',
  outstandingAmount: '40.000',
  paidAmount: '60.000',
  subtotal: '90.000',
  taxTotal: '10.000',
  customerId: 'c1',
  customer: { id: 'c1', nameEn: 'Ahmed Traders', nameAr: 'تجار أحمد', name: 'Ahmed' },
  salesOrder: {
    id: 'so1',
    number: 'SO-9',
    externalOrderNumber: 'D-22',
  },
  lines: [
    {
      id: 'l1',
      description: 'Sofa',
      quantity: 2,
      unitPrice: '45',
      lineTotal: '90',
    },
  ],
  payments: [
    {
      id: 'p1',
      number: 'PAY-1',
      amount: '60',
      method: 'BANK_TRANSFER',
      paymentDate: '2026-05-10T00:00:00.000Z',
      referenceNumber: 'REF-9',
    },
  ],
  jofotaraUuid: 'uuid-1',
  jofotaraStatus: 'CLEARED',
  jofotaraQr: 'data:image/png;base64,abc',
  jofotaraClearedAt: '2026-05-02T12:00:00.000Z',
};

describe('selectInvoiceCard', () => {
  it('maps dealer name by locale', () => {
    expect(selectInvoiceCard(baseInv, 'en').dealerName).toBe('Ahmed Traders');
    expect(selectInvoiceCard(baseInv, 'ar').dealerName).toBe('تجار أحمد');
  });

  it('surfaces amount due first and order refs', () => {
    const card = selectInvoiceCard(baseInv, 'en');
    expect(card.outstanding).toBe(40);
    expect(card.amountDue).toBe(40);
    expect(card.total).toBe(100);
    expect(card.factoryOrderNumber).toBe('SO-9');
    expect(card.dealerOrderNumber).toBe('D-22');
    expect(card.amountDueLabel).toContain('40');
  });

  it('marks overdue when past due with balance', () => {
    const overdue = selectInvoiceCard(
      {
        ...baseInv,
        dueDate: '2020-01-01T00:00:00.000Z',
        outstandingAmount: '10',
      },
      'en',
    );
    expect(overdue.isOverdue).toBe(true);
  });

  it('does not mark overdue when fully paid', () => {
    const settled = selectInvoiceCard(
      {
        ...baseInv,
        status: 'PAID',
        dueDate: '2020-01-01T00:00:00.000Z',
        outstandingAmount: '0',
      },
      'en',
    );
    expect(settled.isOverdue).toBe(false);
  });
});

describe('selectInvoiceDetail', () => {
  it('maps totals, lines, payments, and JoFotara', () => {
    const detail = selectInvoiceDetail(baseInv, 'en');
    expect(detail.outstanding).toBe(40);
    expect(detail.paid).toBe(60);
    expect(detail.subtotal).toBe(90);
    expect(detail.tax).toBe(10);
    expect(detail.lines).toHaveLength(1);
    expect(detail.lines[0]?.description).toBe('Sofa');
    expect(detail.payments).toHaveLength(1);
    expect(detail.payments[0]?.method).toBe('BANK_TRANSFER');
    expect(detail.payments[0]?.reference).toBe('REF-9');
    expect(detail.jofotara.submitted).toBe(true);
    expect(detail.jofotara.uuid).toBe('uuid-1');
    expect(detail.jofotara.qr).toBe('data:image/png;base64,abc');
    expect(detail.factoryOrderNumber).toBe('SO-9');
  });

  it('treats missing JoFotara as not submitted', () => {
    const detail = selectInvoiceDetail(
      {
        ...baseInv,
        jofotaraUuid: null,
        jofotaraQr: null,
        jofotaraStatus: null,
        jofotaraClearedAt: null,
      },
      'en',
    );
    expect(detail.jofotara.submitted).toBe(false);
  });

  it('derives paid from total - outstanding when paidAmount missing', () => {
    const detail = selectInvoiceDetail(
      {
        ...baseInv,
        paidAmount: null,
        outstandingAmount: '25',
        total: '100',
      },
      'en',
    );
    expect(detail.paid).toBe(75);
  });
});
