import { issueWarehousesFromBalances, pickSuggestedIssueWarehouseId } from './material-issue-warehouse';

describe('pickSuggestedIssueWarehouseId', () => {
  it('prefers the warehouse that still has stock', () => {
    expect(
      pickSuggestedIssueWarehouseId([
        { id: 'empty', availableQty: 0, isDefault: true },
        { id: 'stocked', availableQty: 12, isDefault: false },
      ]),
    ).toBe('stocked');
  });

  it('falls back to the default RAW warehouse when nothing is on hand', () => {
    expect(
      pickSuggestedIssueWarehouseId([
        { id: 'a', availableQty: 0, isDefault: false },
        { id: 'b', availableQty: 0, isDefault: true },
      ]),
    ).toBe('b');
  });

  it('returns null when there are no warehouses', () => {
    expect(pickSuggestedIssueWarehouseId([])).toBeNull();
  });
});

describe('issueWarehousesFromBalances', () => {
  it('dedupes bins of the same warehouse and sums qty', () => {
    expect(
      issueWarehousesFromBalances([
        {
          availableQty: 3,
          warehouse: {
            id: 'raw',
            code: 'RAW',
            nameEn: 'Raw',
            nameAr: 'خ',
            nameHe: null,
            isDefault: true,
          },
        },
        {
          availableQty: 5,
          warehouse: {
            id: 'raw',
            code: 'RAW',
            nameEn: 'Raw',
            nameAr: 'خ',
            nameHe: null,
            isDefault: true,
          },
        },
      ]),
    ).toEqual([
      {
        id: 'raw',
        code: 'RAW',
        nameEn: 'Raw',
        nameAr: 'خ',
        nameHe: null,
        availableQty: 8,
        isDefault: true,
      },
    ]);
  });
});
