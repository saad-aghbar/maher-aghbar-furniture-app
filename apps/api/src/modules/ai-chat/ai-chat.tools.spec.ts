import { filterToolsForUser } from './ai-chat.tools';
import type { AuthUser } from '@maher/types';

describe('AiChatToolsService permission filter', () => {
  const catalog = [
    {
      name: 'dealer_profit_summary',
      requiredPermissions: ['report.financial.read' as const],
      surfaces: ['admin' as const],
    },
    {
      name: 'list_low_stock',
      requiredPermissions: ['inventory.read' as const],
      surfaces: ['admin' as const],
    },
    {
      name: 'my_orders',
      requiredPermissions: ['sales-order.read' as const],
      surfaces: ['customer' as const],
    },
    {
      name: 'list_late_orders',
      requiredPermissions: ['report.production.read' as const],
      surfaces: ['admin' as const],
    },
  ];

  const admin: AuthUser = {
    id: 'a1',
    username: 'admin',
    email: 'a@x.com',
    name: 'Admin',
    roles: ['SYSTEM_ADMINISTRATOR'],
    permissions: [
      'report.financial.read',
      'inventory.read',
      'report.production.read',
      'sales-order.read',
      'ai-chat.read',
    ],
    preferredLanguage: 'ar',
  };

  const dealer: AuthUser = {
    id: 'd1',
    username: 'dealer',
    email: 'd@x.com',
    name: 'Dealer',
    roles: ['CUSTOMER'],
    permissions: ['sales-order.read', 'invoice.read', 'ai-chat.read'],
    preferredLanguage: 'ar',
    customerId: 'customer-a',
  };

  it('gives admin financial and inventory tools', () => {
    const names = filterToolsForUser(catalog, admin, 'admin').map((t) => t.name);
    expect(names).toContain('dealer_profit_summary');
    expect(names).toContain('list_low_stock');
    expect(names).toContain('list_late_orders');
    expect(names).not.toContain('my_orders');
  });

  it('strips financial/inventory tools for dealers and keeps my_orders', () => {
    const names = filterToolsForUser(catalog, dealer, 'customer').map((t) => t.name);
    expect(names).toEqual(['my_orders']);
    expect(names).not.toContain('dealer_profit_summary');
    expect(names).not.toContain('list_low_stock');
  });

  it('hides profit tool when admin lacks report.financial.read', () => {
    const limited: AuthUser = {
      ...admin,
      permissions: ['inventory.read', 'ai-chat.read'],
    };
    const names = filterToolsForUser(catalog, limited, 'admin').map((t) => t.name);
    expect(names).toContain('list_low_stock');
    expect(names).not.toContain('dealer_profit_summary');
  });
});
