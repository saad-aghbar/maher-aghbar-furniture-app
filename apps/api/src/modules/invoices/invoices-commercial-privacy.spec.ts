import { ROLE_PERMISSIONS, hasPermission } from '@maher/permissions';
import { assertCustomerOwns, customerScopeFilter } from '../../common/helpers/customer-scope';
import {
  commercialLinesReady,
  initialCommercialPriceStatus,
} from '../payments/dealer-finance';

/**
 * Piece 7 — commercial gate + dealer/worker privacy (unit).
 * Cross-dealer 403 / list isolation also covered by smoke:piece7-dealer-finance-uat.
 */
describe('Piece 7 commercial gate + finance privacy', () => {
  describe('commercial price gate', () => {
    it('REQUIRED blocks invoice (COMMERCIAL_PRICE_REQUIRED)', () => {
      const gate = commercialLinesReady([
        { unitPrice: 2500, commercialPriceStatus: 'REQUIRED' },
      ]);
      expect(gate.ok).toBe(false);
      if (!gate.ok) expect(gate.code).toBe('COMMERCIAL_PRICE_REQUIRED');
    });

    it('CONFIRMED with positive price allows invoice', () => {
      expect(
        commercialLinesReady([
          { unitPrice: 3200, commercialPriceStatus: 'CONFIRMED' },
        ]).ok,
      ).toBe(true);
    });

    it('CATALOG STANDARD allows; zero price still blocks', () => {
      expect(
        commercialLinesReady([{ unitPrice: 100, commercialPriceStatus: 'CATALOG' }]).ok,
      ).toBe(true);
      expect(
        commercialLinesReady([{ unitPrice: 0, commercialPriceStatus: 'CATALOG' }]).ok,
      ).toBe(false);
      expect(initialCommercialPriceStatus('MODIFIED')).toBe('REQUIRED');
      expect(initialCommercialPriceStatus('CUSTOM')).toBe('REQUIRED');
      expect(initialCommercialPriceStatus('STANDARD')).toBe('CATALOG');
    });

    it('mixed lines: any REQUIRED fails whole order', () => {
      const gate = commercialLinesReady([
        { unitPrice: 2000, commercialPriceStatus: 'CATALOG' },
        { unitPrice: 3200, commercialPriceStatus: 'REQUIRED' },
      ]);
      expect(gate.ok).toBe(false);
    });
  });

  describe('dealer privacy', () => {
    it('cross-dealer assertCustomerOwns is false', () => {
      const oasis = { customerId: 'cust-oasis' } as never;
      expect(assertCustomerOwns(oasis, 'cust-nile')).toBe(false);
      expect(assertCustomerOwns(oasis, 'cust-oasis')).toBe(true);
      expect(assertCustomerOwns({} as never, 'cust-nile')).toBe(true); // staff
    });

    it('customerScopeFilter forces own customerId (list → 0 foreign rows)', () => {
      expect(customerScopeFilter({ customerId: 'cust-oasis' } as never)).toEqual({
        customerId: 'cust-oasis',
      });
      expect(customerScopeFilter({} as never)).toEqual({});
    });
  });

  describe('worker deny on invoice / payment / statement', () => {
    const worker = ROLE_PERMISSIONS.PRODUCTION_WORKER;
    it('denies invoice.read, payment.read, statement.read, payment.record', () => {
      expect(hasPermission(worker, 'invoice.read')).toBe(false);
      expect(hasPermission(worker, 'invoice.create')).toBe(false);
      expect(hasPermission(worker, 'payment.read')).toBe(false);
      expect(hasPermission(worker, 'payment.record')).toBe(false);
      expect(hasPermission(worker, 'statement.read')).toBe(false);
    });

    it('dealer CUSTOMER may read own commercial docs (not record payment)', () => {
      const dealer = ROLE_PERMISSIONS.CUSTOMER;
      expect(hasPermission(dealer, 'invoice.read')).toBe(true);
      expect(hasPermission(dealer, 'payment.read')).toBe(true);
      expect(hasPermission(dealer, 'statement.read')).toBe(true);
      expect(hasPermission(dealer, 'payment.record')).toBe(false);
      expect(hasPermission(dealer, 'invoice.create')).toBe(false);
    });
  });

  describe('invoice PDF commercial-only (no mfg / supplier cost)', () => {
    /** Mirrors PdfController.invoicePdf column + footer shape (sale-only). */
    const columns = ['description', 'qty', 'unitPrice', 'lineTotal'] as const;
    const footerKeys = ['total', 'outstanding'] as const;
    const metaKeys = ['customer', 'status'] as const;
    const forbidden = [
      'manufacturingCost',
      'standardCost',
      'unitCost',
      'supplierCost',
      'costSummary',
      'costBreakdown',
      'actualTotal',
      'estimatedTotal',
    ] as const;

    it('sale columns/footers only — no cost field keys', () => {
      const exposed = [...columns, ...footerKeys, ...metaKeys].map((k) => k.toLowerCase());
      for (const bad of forbidden) {
        expect(exposed).not.toContain(bad.toLowerCase());
      }
      expect([...columns]).toEqual(['description', 'qty', 'unitPrice', 'lineTotal']);
    });
  });
});
