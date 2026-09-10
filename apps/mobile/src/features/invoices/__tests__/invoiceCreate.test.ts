import { readFileSync } from 'fs';
import { join } from 'path';
import {
  invoiceCreateAction,
  invoiceCreateBlockedKey,
  invoiceCreateEmptyKey,
} from '../invoiceCreate';

describe('create invoice dispatch', () => {
  it('routes each source kind to the matching mutation', () => {
    expect(invoiceCreateAction('ORDER')).toBe('order');
    expect(invoiceCreateAction('RETURN')).toBe('return');
    expect(invoiceCreateAction('PURCHASING')).toBe('purchasing');
  });

  it('maps blocked reasons for the create sheet', () => {
    expect(invoiceCreateBlockedKey('INVOICE_LINES_NOT_READY')).toBe(
      'mobile.invoices.blockedLinesNotReady',
    );
    expect(invoiceCreateBlockedKey('RETURN_CHARGE_NOT_CONFIRMED')).toBe(
      'mobile.invoices.blockedReturnNotConfirmed',
    );
    expect(invoiceCreateEmptyKey('RETURN')).toBe('mobile.invoices.createEmptyReturns');
  });

  it('wires the create sheet to the source mutation', () => {
    const sheet = readFileSync(
      join(__dirname, '../components/CreateInvoiceSheet.tsx'),
      'utf8',
    );
    expect(sheet).toContain('useCreateInvoiceFromSourceMutation');
    expect(sheet).toContain('selectable.kind');
    expect(sheet).not.toContain('useInvoiceSalesOrdersQuery');
  });
});
