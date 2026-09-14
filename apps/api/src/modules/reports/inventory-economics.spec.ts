import {
  addFlowMoney,
  classifyInventoryFlow,
  consumptionFromFlow,
  currentInventoryValue,
  emptyFlowMoney,
  isInventoryConsumption,
  rawGroupFromCategory,
} from './inventory-economics';

describe('inventory-economics', () => {
  it('classifies transfers separately from consumption', () => {
    expect(classifyInventoryFlow('WAREHOUSE_TRANSFER')).toBe('transfer');
    expect(isInventoryConsumption('WAREHOUSE_TRANSFER')).toBe(false);
    expect(classifyInventoryFlow('PRODUCTION_ISSUE')).toBe('productionIssue');
    expect(classifyInventoryFlow('SEMI_FINISHED_RECEIPT')).toBe('wipOutput');
    expect(classifyInventoryFlow('FINISHED_GOODS_RECEIPT')).toBe('finishedOutput');
  });

  it('does not treat WIP/FIN output as factory consumption', () => {
    const flow = emptyFlowMoney();
    addFlowMoney(flow, 'PRODUCTION_ISSUE', -10, 8);
    addFlowMoney(flow, 'FINISHED_GOODS_RECEIPT', 1, 80);
    expect(consumptionFromFlow(flow)).toBe(80);
    expect(flow.finishedOutput).toBe(80);
    expect(flow.productionIssue).toBe(80);
  });

  it('values current stock only from canonical unit cost, never silent zero', () => {
    const valued = currentInventoryValue([
      { qty: 4, unitCost: 10 },
      { qty: 2, unitCost: null },
    ]);
    expect(valued.value).toBe(40);
    expect(valued.pricedQty).toBe(4);
    expect(valued.totalQty).toBe(6);
    expect(valued.coveragePct).toBe(66.667);
  });

  it('maps raw groups without inventing a fifth bucket', () => {
    expect(rawGroupFromCategory('FABRIC')).toBe('FABRIC');
    expect(rawGroupFromCategory('WOOD')).toBe('WOOD');
    expect(rawGroupFromCategory('FOAM')).toBe('FOAM');
    expect(rawGroupFromCategory('METAL_ACCESSORY')).toBe('ACCESSORIES');
  });
});
