import { peekFabricUnitCost, requireFabricUnitCost } from './fabric-cost';

describe('fabric-cost', () => {
  it('prefers typed, then lot, then PO, then standard', () => {
    expect(
      peekFabricUnitCost({ typed: 9, lotUnitCost: 8, poUnitPrice: 7, standardCost: 6 }),
    ).toBe(9);
    expect(peekFabricUnitCost({ poUnitPrice: 7, standardCost: 6 })).toBe(7);
    expect(peekFabricUnitCost({ standardCost: 6 })).toBe(6);
    expect(peekFabricUnitCost({ standardCost: 0 })).toBeNull();
  });

  it('requireFabricUnitCost throws FABRIC_COST_REQUIRED when nothing is on file', () => {
    try {
      requireFabricUnitCost({ typed: 0, standardCost: 0 });
      throw new Error('expected FABRIC_COST_REQUIRED');
    } catch (err) {
      expect(err).toMatchObject({ response: { code: 'FABRIC_COST_REQUIRED' } });
    }
    expect(requireFabricUnitCost({ standardCost: 24 })).toBe(24);
  });
});
