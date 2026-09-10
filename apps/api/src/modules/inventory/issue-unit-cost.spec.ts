import { positiveUnitCost, resolveIssueUnitCost } from './issue-unit-cost';

describe('issue-unit-cost', () => {
  it('never treats 0 or junk as a price', () => {
    expect(positiveUnitCost(0)).toBeNull();
    expect(positiveUnitCost(-1)).toBeNull();
    expect(positiveUnitCost('x')).toBeNull();
    expect(positiveUnitCost(null)).toBeNull();
    expect(positiveUnitCost(12.5)).toBe(12.5);
  });

  it('prefers lot cost over the SKU map and standard cost', () => {
    expect(
      resolveIssueUnitCost({
        lotUnitCost: 8,
        mappedUnitCost: 11,
        standardCost: 4,
      }),
    ).toBe(8);
    expect(
      resolveIssueUnitCost({
        lotUnitCost: null,
        mappedUnitCost: 11,
        standardCost: 4,
      }),
    ).toBe(11);
    expect(resolveIssueUnitCost({ standardCost: 4 })).toBe(4);
    expect(resolveIssueUnitCost({})).toBeNull();
  });
});
