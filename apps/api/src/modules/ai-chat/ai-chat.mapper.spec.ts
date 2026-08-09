import { mapToolResultsToMessage } from './ai-chat.mapper';

describe('mapToolResultsToMessage', () => {
  it('maps profit tool into metrics + table + chart', () => {
    const msg = mapToolResultsToMessage({
      id: 'm1',
      locale: 'en',
      summaryText: 'Profit summary',
      toolResults: [
        {
          name: 'dealer_profit_summary',
          result: {
            customerName: 'Oasis Living',
            totals: { profit: 2840 },
            orders: [
              { id: 'o1', number: 'SO-1042', profit: 1120, href: '/orders/o1' },
              { id: 'o2', number: 'SO-1038', profit: 980, href: '/orders/o2' },
            ],
            source: 'Sales orders · Oasis Living',
          },
        },
      ],
    });
    expect(msg.blocks.some((b) => b.type === 'metrics')).toBe(true);
    expect(msg.blocks.some((b) => b.type === 'table')).toBe(true);
    expect(msg.blocks.some((b) => b.type === 'chart')).toBe(true);
    expect(msg.suggestions?.length).toBeGreaterThan(0);
  });

  it('maps late orders into list + entities', () => {
    const msg = mapToolResultsToMessage({
      id: 'm2',
      locale: 'ar',
      summaryText: 'متأخر',
      toolResults: [
        {
          name: 'list_late_orders',
          result: {
            delayedCount: 1,
            orders: [
              {
                number: 'PO-1',
                salesOrderNumber: 'SO-1091',
                customerName: 'Jerash',
                daysLate: 3,
                href: '/orders/x',
              },
            ],
          },
        },
      ],
    });
    expect(msg.blocks.some((b) => b.type === 'list')).toBe(true);
    expect(msg.blocks.some((b) => b.type === 'entities')).toBe(true);
  });
});
