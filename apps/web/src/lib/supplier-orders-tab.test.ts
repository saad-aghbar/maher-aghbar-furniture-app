import { describe, expect, it } from 'vitest';
import { supplierOrdersTab } from './supplier-orders-tab';

describe('supplierOrdersTab', () => {
  it('opens purchase orders for the orders alias', () => {
    expect(supplierOrdersTab('orders')).toBe('open');
    expect(supplierOrdersTab('history')).toBe('history');
    expect(supplierOrdersTab('nope')).toBe('open');
  });
});
