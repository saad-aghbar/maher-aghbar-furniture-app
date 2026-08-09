import { mapToolResultsToMessage } from './ai-chat.mapper';
import { filterToolsForUser } from './ai-chat.tools';
import type { AuthUser } from '@maher/types';

describe('ai-chat dealer isolation helpers', () => {
  const dealerA: AuthUser = {
    id: 'd-a',
    username: 'dealer-a',
    email: 'a@x.com',
    name: 'A',
    roles: ['CUSTOMER'],
    permissions: ['sales-order.read', 'ai-chat.read'],
    preferredLanguage: 'ar',
    customerId: 'customer-a',
  };

  it('does not expose admin-only tools on customer surface', () => {
    const names = filterToolsForUser(
      [
        {
          name: 'dealer_profit_summary',
          requiredPermissions: ['report.financial.read'],
          surfaces: ['admin'],
        },
        {
          name: 'my_orders',
          requiredPermissions: ['sales-order.read'],
          surfaces: ['customer'],
        },
      ],
      dealerA,
      'customer',
    ).map((t) => t.name);
    expect(names).toEqual(['my_orders']);
  });

  it('maps clarification needs without inventing numbers', () => {
    const msg = mapToolResultsToMessage({
      id: 'x',
      locale: 'en',
      summaryText: '',
      toolResults: [
        {
          name: 'dealer_profit_summary',
          result: {
            needsClarification: true,
            question: 'Which dealer?',
          },
        },
      ],
    });
    expect(msg.blocks.some((b) => b.type === 'clarification')).toBe(true);
    expect(msg.blocks.some((b) => b.type === 'table')).toBe(false);
  });
});
