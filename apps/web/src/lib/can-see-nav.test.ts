import { describe, expect, it } from 'vitest';
import { canSeeNav, navItems, nestedNavGroups } from '../components/nav-items';

describe('canSeeNav', () => {
  it('shows items without permission gates', () => {
    expect(canSeeNav({}, [])).toBe(true);
  });

  it('follows granted permissions, not a staff-type code', () => {
    const inventory = { anyPermissions: ['inventory.read' as const] };
    expect(canSeeNav(inventory, ['inventory.read', 'inventory.transfer'])).toBe(true);
    expect(canSeeNav(inventory, ['quotation.create'])).toBe(false);
    expect(canSeeNav({ anyPermissions: ['user.manage'] }, ['inventory.read'])).toBe(false);
  });

  it('hides Users and Settings from warehouse permissions', () => {
    const warehouse = [
      'inventory.read',
      'inventory.receive',
      'inventory.transfer',
      'inventory.count',
      'warehouse.read',
      'notification.read',
      'document.read',
    ];
    expect(canSeeNav({ anyPermissions: ['inventory.read'] }, warehouse)).toBe(true);
    expect(canSeeNav({ anyPermissions: ['user.manage'] }, warehouse)).toBe(false);
    expect(canSeeNav({ anyPermissions: ['settings.manage', 'role.manage'] }, warehouse)).toBe(false);
    expect(canSeeNav({ anyPermissions: ['notification.read'] }, warehouse)).toBe(true);
    expect(canSeeNav({}, warehouse)).toBe(true);
  });

  it('aligns products, returns, payments, and fabric with the feature permission', () => {
    const products = navItems.find((i) => i.key === 'products')!;
    const returns = navItems.find((i) => i.key === 'returns')!;
    expect(canSeeNav(products, ['catalog.read'])).toBe(true);
    expect(canSeeNav(products, ['sales-order.read'])).toBe(false);
    expect(canSeeNav(returns, ['return.read'])).toBe(true);
    expect(canSeeNav(returns, ['sales-order.read'])).toBe(false);

    const payments = nestedNavGroups
      .flatMap((g) => g.items)
      .find((i) => i.key === 'payments')!;
    const fabric = nestedNavGroups
      .flatMap((g) => g.items)
      .find((i) => i.key === 'fabricJobs')!;
    const receive = nestedNavGroups
      .flatMap((g) => g.items)
      .find((i) => i.key === 'receive')!;
    expect(canSeeNav(payments, ['payment.read'])).toBe(true);
    expect(canSeeNav(payments, ['invoice.read'])).toBe(false);
    expect(canSeeNav(fabric, ['fabric.procurement.read'])).toBe(true);
    expect(canSeeNav(fabric, ['purchase-order.read'])).toBe(false);
    expect(canSeeNav(receive, ['inventory.receive'])).toBe(true);
    expect(canSeeNav(receive, ['inventory.read'])).toBe(false);
  });

  it('keeps scheduling inside Production, not as its own sidebar door', () => {
    expect(navItems.some((item) => item.key === 'scheduling' || item.href === '/admin/production/scheduling')).toBe(false);
    const production = nestedNavGroups.find((group) => group.key === 'production')!;
    expect(production.items.some((item) => item.href === '/admin/production/scheduling')).toBe(true);
  });

  it('keeps workflow inside Production, not as its own sidebar door', () => {
    expect(navItems.some((item) => item.key === 'workflow' || item.href === '/admin/production/workflow')).toBe(false);
    const production = nestedNavGroups.find((group) => group.key === 'production')!;
    expect(production.items.some((item) => item.href === '/admin/production/workflow')).toBe(true);
  });

  it('does not expose a standalone AI intake nested item', () => {
    const orders = nestedNavGroups.find((g) => g.parentHref === '/admin/orders')!;
    expect(orders.items.some((i) => i.key === 'aiIntake' || i.href === '/admin/ai-intake')).toBe(false);
  });
});
