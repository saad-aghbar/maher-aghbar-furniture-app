import { isFactoryWorkStarted } from '@maher/types';
import { plannedRequirementLineId } from './manufacturing-cost.service';

describe('golden-path PO and workflow hops', () => {
  it('does not unique-constrain a line to one PO — return POs may share a line', () => {
    const pos = [
      { id: 'po-sales', originType: 'SALES_ORDER', salesOrderLineId: 'line-1' },
      { id: 'po-return', originType: 'RETURN_WORK', salesOrderLineId: 'line-1' },
    ];
    expect(pos.filter((po) => po.salesOrderLineId === 'line-1')).toHaveLength(2);
  });

  it('locks workflow after releasedToFactoryAt', () => {
    expect(
      isFactoryWorkStarted({
        releasedToFactoryAt: new Date('2026-09-01'),
        status: 'PLANNED',
      }),
    ).toBe(true);
  });

  it('tags planned material rows with the sales-order line, not the production order id', () => {
    expect(
      plannedRequirementLineId(
        { lineSetup: { salesOrderLineId: 'line-9' } },
        'po-1',
      ),
    ).toBe('line-9');
    expect(plannedRequirementLineId({}, 'po-1')).toBeNull();
  });
});
