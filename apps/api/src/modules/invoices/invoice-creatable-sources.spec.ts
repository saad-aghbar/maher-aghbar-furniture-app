import { ReturnChargeStatus } from '@maher/database';
import {
  orderSourceFromRow,
  purchaseSourceFromRow,
  returnSourceFromRow,
} from './invoice-creatable-sources';

describe('invoice creatable sources', () => {
  it('blocks orders that already have an invoice or unready lines', () => {
    expect(
      orderSourceFromRow({
        id: 'so-1',
        number: 'SO-1',
        status: 'CONFIRMED',
        total: 100,
        invoices: [{ id: 'inv-1' }],
        lines: [{ unitPrice: 100, commercialPriceStatus: 'CATALOG' }],
      }).blockedReason,
    ).toBe('INVOICE_EXISTS');

    expect(
      orderSourceFromRow({
        id: 'so-2',
        number: 'SO-2',
        status: 'CONFIRMED',
        total: 0,
        invoices: [],
        lines: [{ unitPrice: 0, commercialPriceStatus: 'REQUIRED' }],
      }).blockedReason,
    ).toBe('INVOICE_LINES_NOT_READY');

    expect(
      orderSourceFromRow({
        id: 'so-3',
        number: 'SO-3',
        projectName: 'Sofa',
        status: 'CONFIRMED',
        total: 250,
        invoices: [],
        lines: [{ unitPrice: 250, commercialPriceStatus: 'CATALOG' }],
      }).blockedReason,
    ).toBeNull();
  });

  it('blocks returns until the charge is confirmed with an amount', () => {
    expect(
      returnSourceFromRow({
        id: 'ret-1',
        number: 'RET-1',
        chargeStatus: ReturnChargeStatus.AWAITING_DEALER,
        chargeAmount: 80,
        chargeInvoices: [],
      }).blockedReason,
    ).toBe('RETURN_CHARGE_NOT_CONFIRMED');

    expect(
      returnSourceFromRow({
        id: 'ret-2',
        number: 'RET-2',
        chargeStatus: ReturnChargeStatus.CONFIRMED,
        chargeAmount: 0,
        chargeInvoices: [],
      }).blockedReason,
    ).toBe('RETURN_CHARGE_NO_AMOUNT');

    expect(
      returnSourceFromRow({
        id: 'ret-3',
        number: 'RET-3',
        productDesc: 'Chair',
        chargeStatus: ReturnChargeStatus.CONFIRMED,
        chargeAmount: 80,
        chargeInvoices: [],
      }).blockedReason,
    ).toBeNull();
  });

  it('blocks purchasing rows until goods are received', () => {
    expect(
      purchaseSourceFromRow({
        id: 'po-1',
        number: 'PO-1',
        status: 'SENT',
        total: 40,
        supplierInvoices: [],
      }).blockedReason,
    ).toBe('SUPPLIER_INVOICE_NOT_READY');

    expect(
      purchaseSourceFromRow({
        id: 'po-2',
        number: 'PO-2',
        status: 'RECEIVED',
        total: 40,
        supplierInvoices: [],
      }).blockedReason,
    ).toBeNull();
  });
});
