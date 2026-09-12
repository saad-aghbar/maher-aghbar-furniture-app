import { readFileSync } from 'fs';
import { join } from 'path';

const dir = join(__dirname, '..');

function read(rel: string) {
  return readFileSync(join(dir, rel), 'utf8');
}

describe('order production flow navigation', () => {
  it('does not pick the highest-progress production order as a navigation rule', () => {
    const screen = read('ProductionFlowScreen.tsx');
    const host = read('OrderProductionFlowScreen.tsx');
    const graph = read('selectProductionFlowFromWorkflowGraph.ts');
    const adminRoute = readFileSync(
      join(__dirname, '../../../../app/(app)/(admin)/orders/[id]/flow.tsx'),
      'utf8',
    );
    const dealerRoute = readFileSync(
      join(__dirname, '../../../../app/(app)/(customer)/orders/[id]/flow.tsx'),
      'utf8',
    );
    expect(screen).not.toContain('pickProductionOrderIdFromSalesOrder');
    expect(graph).not.toContain('pickProductionOrderIdFromSalesOrder');
    expect(host).toContain('source="production-order"');
    expect(host).toContain('selectOrderFlowItems');
    expect(host).toContain('shouldSkipOrderFlowList');
    expect(adminRoute).toContain('OrderProductionFlowScreen');
    expect(adminRoute).not.toContain('source="sales-order"');
    expect(dealerRoute).toContain('OrderProductionFlowScreen');
    expect(dealerRoute).not.toContain('source="sales-order"');
  });
});
