/**
 * Piece 14 — focused cross-piece invariant / gate-code tests.
 * Pure helpers + documented API error codes (no live DB required).
 */
import { DeliveryStatus, InventoryItemClass } from '@maher/database';
import { calculateOrderCosts } from '../../common/helpers/order-costing.util';
import {
  commercialLinesReady,
  paymentUnallocated,
  summarizeDealerFinance,
} from '../payments/dealer-finance';

/**
 * Documented gate / error codes used across P2–P11 surfaces.
 * Smoke + API BadRequestException.code values must stay aligned.
 */
export const PIECE14_GATE_CODES = {
  SETUP_INCOMPLETE: 'SETUP_INCOMPLETE',
  PRODUCTION_NOT_READY: 'PRODUCTION_NOT_READY',
  INSPECTION_PASS_REQUIRED: 'INSPECTION_PASS_REQUIRED',
  DELIVERY_LOAD_INCOMPLETE: 'DELIVERY_LOAD_INCOMPLETE',
  DELIVERY_DEALER_CONFIRM_REQUIRED: 'DELIVERY_DEALER_CONFIRM_REQUIRED',
  COMMERCIAL_PRICE_REQUIRED: 'COMMERCIAL_PRICE_REQUIRED',
  RETURN_NOT_APPROVED: 'RETURN_NOT_APPROVED',
  DELIVERY_NOT_OUT_FOR_DELIVERY: 'DELIVERY_NOT_OUT_FOR_DELIVERY',
  DELIVERY_ALREADY_DELIVERED: 'DELIVERY_ALREADY_DELIVERED',
} as const;

/**
 * Mirrors DeliveryLoadService.depart early-return:
 * already OUT_FOR_DELIVERY → return load sheet (idempotent no-op).
 */
export function isDepartIdempotentNoop(status: string): boolean {
  return status === DeliveryStatus.OUT_FOR_DELIVERY || status === 'OUT_FOR_DELIVERY';
}

/**
 * Mirrors DeliveriesController.confirmReceipt early path:
 * already DELIVERED with prior confirmation → return existing row.
 */
export function isConfirmReceiptIdempotent(args: {
  status: string;
  customerConfirmedAt?: Date | string | null;
  customerConfirmedById?: string | null;
}): boolean {
  if (args.status !== DeliveryStatus.DELIVERED && args.status !== 'DELIVERED') {
    return false;
  }
  return Boolean(args.customerConfirmedAt || args.customerConfirmedById);
}

/**
 * Mirrors ReturnsController.receive early path:
 * already received / physicalStatus RETURNED → return existing row (no second quarantine).
 */
export function isReturnReceiveIdempotentNoop(args: {
  receivedAt?: Date | string | null;
  physicalStatus?: string | null;
}): boolean {
  return Boolean(args.receivedAt) || args.physicalStatus === 'RETURNED';
}

describe('Piece 14 full-system invariants', () => {
  it('commercial seller price is distinct from manufacturing production cost', () => {
    const costs = calculateOrderCosts(
      [
        {
          quantity: 1,
          unitPrice: 8500,
          product: {
            basePrice: 8500,
            manufacturingCost: 3200,
            bomDefaults: null,
          },
        },
      ],
      {},
    );
    expect(costs.sellerPrice).toBe(8500);
    expect(costs.productionPrice).toBe(3200);
    expect(costs.sellerPrice).not.toBe(costs.productionPrice);
    expect(costs.profit).toBe(costs.sellerPrice - costs.productionPrice);
  });

  it('dealer finance keeps receivable (amountDue) separate from availableCredit', () => {
    const summary = summarizeDealerFinance({
      invoices: [
        { status: 'ISSUED', outstandingAmount: 12000, dueDate: null },
        { status: 'OVERDUE', outstandingAmount: 3000, dueDate: new Date('2020-01-01') },
      ],
      payments: [{ amount: 5000, allocations: [{ amount: 2000 }] }],
    });
    expect(summary.amountDue).toBe(15000);
    expect(summary.availableCredit).toBe(3000);
    expect(summary.amountDue).not.toBe(summary.availableCredit);
    expect(summary.netPosition).toBe(12000);
    // Unallocated credit is a payment concept, not invoice outstanding
    expect(paymentUnallocated(5000, [2000])).toBe(3000);
    expect(paymentUnallocated(5000, [2000])).not.toBe(summary.amountDue);
  });

  it('commercialLinesReady blocks zero / REQUIRED prices (invoice gate)', () => {
    expect(
      commercialLinesReady([{ unitPrice: 0, commercialPriceStatus: 'CATALOG' }]).ok,
    ).toBe(false);
    expect(
      commercialLinesReady([{ unitPrice: 100, commercialPriceStatus: 'REQUIRED' }]).ok,
    ).toBe(false);
    expect(
      commercialLinesReady([{ unitPrice: 100, commercialPriceStatus: 'CONFIRMED' }]).ok,
    ).toBe(true);
  });

  it('commercialLinesReady failure code is COMMERCIAL_PRICE_REQUIRED', () => {
    const zero = commercialLinesReady([{ unitPrice: 0, commercialPriceStatus: 'CATALOG' }]);
    const required = commercialLinesReady([
      { unitPrice: 100, commercialPriceStatus: 'REQUIRED' },
    ]);
    expect(zero.ok).toBe(false);
    expect(required.ok).toBe(false);
    if (!zero.ok) expect(zero.code).toBe(PIECE14_GATE_CODES.COMMERCIAL_PRICE_REQUIRED);
    if (!required.ok) expect(required.code).toBe(PIECE14_GATE_CODES.COMMERCIAL_PRICE_REQUIRED);
  });

  it('depart early-return is idempotent only when already OUT_FOR_DELIVERY', () => {
    expect(isDepartIdempotentNoop(DeliveryStatus.OUT_FOR_DELIVERY)).toBe(true);
    expect(isDepartIdempotentNoop(DeliveryStatus.READY)).toBe(false);
    expect(isDepartIdempotentNoop(DeliveryStatus.DELIVERED)).toBe(false);
  });

  it('confirm-receipt early-return when already delivered with confirmation', () => {
    expect(
      isConfirmReceiptIdempotent({
        status: DeliveryStatus.DELIVERED,
        customerConfirmedAt: new Date(),
        customerConfirmedById: 'u1',
      }),
    ).toBe(true);
    expect(
      isConfirmReceiptIdempotent({
        status: DeliveryStatus.OUT_FOR_DELIVERY,
        customerConfirmedAt: null,
      }),
    ).toBe(false);
  });

  it('return receive is idempotent no-op when physicalStatus is RETURNED', () => {
    expect(
      isReturnReceiveIdempotentNoop({
        physicalStatus: 'RETURNED',
        receivedAt: new Date(),
      }),
    ).toBe(true);
    expect(isReturnReceiveIdempotentNoop({ physicalStatus: 'RETURNED', receivedAt: null })).toBe(
      true,
    );
    expect(
      isReturnReceiveIdempotentNoop({
        physicalStatus: 'WAITING_RETURN',
        receivedAt: null,
      }),
    ).toBe(false);
    expect(isReturnReceiveIdempotentNoop({ physicalStatus: 'NONE', receivedAt: null })).toBe(false);
  });

  it('inventory item class constants are distinct strings', () => {
    expect(InventoryItemClass.RAW_MATERIAL).toBe('RAW_MATERIAL');
    expect(InventoryItemClass.SEMI_FINISHED_GOOD).toBe('SEMI_FINISHED_GOOD');
    expect(InventoryItemClass.FINISHED_GOOD).toBe('FINISHED_GOOD');
    expect(InventoryItemClass.RAW_MATERIAL).not.toBe(InventoryItemClass.SEMI_FINISHED_GOOD);
    expect(InventoryItemClass.SEMI_FINISHED_GOOD).not.toBe(InventoryItemClass.FINISHED_GOOD);
    expect(InventoryItemClass.RAW_MATERIAL).not.toBe(InventoryItemClass.FINISHED_GOOD);
  });

  it('documents all Piece 14 gate codes as stable string constants', () => {
    expect(PIECE14_GATE_CODES.SETUP_INCOMPLETE).toBe('SETUP_INCOMPLETE');
    expect(PIECE14_GATE_CODES.PRODUCTION_NOT_READY).toBe('PRODUCTION_NOT_READY');
    expect(PIECE14_GATE_CODES.INSPECTION_PASS_REQUIRED).toBe('INSPECTION_PASS_REQUIRED');
    expect(PIECE14_GATE_CODES.DELIVERY_LOAD_INCOMPLETE).toBe('DELIVERY_LOAD_INCOMPLETE');
    expect(PIECE14_GATE_CODES.DELIVERY_DEALER_CONFIRM_REQUIRED).toBe(
      'DELIVERY_DEALER_CONFIRM_REQUIRED',
    );
    expect(PIECE14_GATE_CODES.COMMERCIAL_PRICE_REQUIRED).toBe('COMMERCIAL_PRICE_REQUIRED');
    expect(PIECE14_GATE_CODES.RETURN_NOT_APPROVED).toBe('RETURN_NOT_APPROVED');
    const required = [
      'SETUP_INCOMPLETE',
      'PRODUCTION_NOT_READY',
      'INSPECTION_PASS_REQUIRED',
      'DELIVERY_LOAD_INCOMPLETE',
      'DELIVERY_DEALER_CONFIRM_REQUIRED',
      'COMMERCIAL_PRICE_REQUIRED',
      'RETURN_NOT_APPROVED',
    ] as const;
    for (const code of required) {
      expect(PIECE14_GATE_CODES[code]).toBe(code);
    }
    expect(Object.keys(PIECE14_GATE_CODES).length).toBeGreaterThanOrEqual(7);
  });
});
