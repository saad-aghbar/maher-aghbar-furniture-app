import {
  invoiceListCustomerScope,
  invoiceRemainingDue,
  selectInvoiceCard,
  selectInvoiceDealerChip,
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

  it('surfaces outstanding first and order refs', () => {
    const card = selectInvoiceCard(baseInv, 'en');
    expect(card.outstanding).toBe(40);
    expect(card.total).toBe(100);
    expect(card.factoryOrderNumber).toBe('SO-9');
    expect(card.dealerOrderNumber).toBe('D-22');
    expect(card.outstandingLabel).toContain('40');
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
    expect(detail.credit).toBe(0);
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
    expect(detail.dealerChip).toEqual({ value: 'D-22', prefixDealer: false });
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
    expect(detail.outstanding).toBe(25);
  });

  it('uses this invoice remaining due when outstandingAmount is a dealer AR figure', () => {
    const detail = selectInvoiceDetail(
      {
        ...baseInv,
        number: 'INV-P11-L',
        total: '127.6',
        paidAmount: '51.04',
        outstandingAmount: '14913.38',
        subtotal: '110',
        taxTotal: '17.6',
        status: 'PARTIALLY_PAID',
      },
      'en',
    );
    expect(detail.paid).toBe(51.04);
    expect(detail.credit).toBe(0);
    expect(detail.outstanding).toBe(76.56);
    expect(detail.status).toBe('PARTIALLY_PAID');
    expect(detail.total).toBe(127.6);
  });

  it('shows 0 remaining on a paid invoice when outstandingAmount is dealer AR', () => {
    const detail = selectInvoiceDetail(
      {
        ...baseInv,
        number: 'INV-2026-00022',
        status: 'PAID',
        total: '127.6',
        paidAmount: '127.6',
        outstandingAmount: '2255.2',
        accountCredit: '7000',
        subtotal: '110',
        taxTotal: '17.6',
      },
      'en',
    );
    expect(detail.paid).toBe(127.6);
    expect(detail.credit).toBe(7000);
    expect(detail.outstanding).toBe(0);
    expect(detail.status).toBe('PAID');
    expect(detail.total).toBe(127.6);
  });

  it('does not invent paid-in-full from dealer-scale account credit', () => {
    const detail = selectInvoiceDetail(
      {
        ...baseInv,
        number: 'INV-2026-00023',
        status: 'ISSUED',
        total: '127.6',
        paidAmount: '0',
        outstandingAmount: '2255.2',
        accountCredit: '7000',
        subtotal: '110',
        taxTotal: '17.6',
      },
      'en',
    );
    expect(detail.paid).toBe(0);
    expect(detail.credit).toBe(7000);
    expect(detail.outstanding).toBe(127.6);
    expect(detail.status).toBe('ISSUED');
    expect(detail.total).toBe(127.6);
  });

  it('subtracts invoice credit from remaining due without inventing paid-in-full', () => {
    const detail = selectInvoiceDetail(
      {
        ...baseInv,
        total: '127.6',
        paidAmount: '51.04',
        outstandingAmount: '14913.38',
        appliedCredit: '10',
        status: 'PARTIALLY_PAID',
      },
      'en',
    );
    expect(detail.paid).toBe(51.04);
    expect(detail.credit).toBe(10);
    expect(detail.outstanding).toBe(66.56);
    expect(detail.status).toBe('PARTIALLY_PAID');
  });
});

describe('invoiceRemainingDue', () => {
  it('does not treat a dealer-scale outstanding as this invoice remainder', () => {
    const due = invoiceRemainingDue({
      ...baseInv,
      total: 127.6,
      paidAmount: 51.04,
      outstandingAmount: 14913.38,
    });
    expect(due.outstanding).toBe(76.56);
    expect(due.paid).toBe(51.04);
  });

  it('zeros remaining on PAID without hiding paid or dealer credit', () => {
    const due = invoiceRemainingDue({
      ...baseInv,
      status: 'PAID',
      total: 127.6,
      paidAmount: 127.6,
      outstandingAmount: 2255.2,
      accountCredit: 7000,
    });
    expect(due.outstanding).toBe(0);
    expect(due.paid).toBe(127.6);
    expect(due.credit).toBe(7000);
  });
});

describe('selectInvoiceDealerChip', () => {
  it('uses the API dealer code with a Dealer prefix, matching Factory SO shape', () => {
    expect(
      selectInvoiceDealerChip({
        ...baseInv,
        customer: { ...baseInv.customer!, code: 'CUS-0101' },
        salesOrder: { id: 'so1', number: 'SO-P11-L', externalOrderNumber: 'P11-L' },
      }),
    ).toEqual({ value: 'CUS-0101', prefixDealer: true });
  });

  it('shows a leftover order code cleanly without a chopped Dealer prefix', () => {
    expect(
      selectInvoiceDealerChip({
        ...baseInv,
        customer: { id: 'c1', nameEn: 'Balqis Hospitality', name: 'Balqis Hospitality' },
        salesOrder: { id: 'so1', number: 'SO-P10-G', externalOrderNumber: 'P10-G' },
      }),
    ).toEqual({ value: 'P10-G', prefixDealer: false });
  });

  it('does not prefix Dealer when the API code is the same leftover order code', () => {
    expect(
      selectInvoiceDealerChip({
        ...baseInv,
        customer: { id: 'c1', nameEn: 'Nile Interiors', name: 'Nile Interiors', code: 'P11-L' },
        salesOrder: { id: 'so1', number: 'SO-P11-L', externalOrderNumber: 'P11-L' },
      }),
    ).toEqual({ value: 'P11-L', prefixDealer: false });
  });
});
