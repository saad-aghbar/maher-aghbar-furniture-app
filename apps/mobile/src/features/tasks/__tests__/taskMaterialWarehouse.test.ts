import { pickDefaultWarehouseId } from '../task-material-warehouse';

describe('pickDefaultWarehouseId', () => {
  it('prefers the warehouse that still has stock after a scan', () => {
    expect(
      pickDefaultWarehouseId([
        { id: 'empty', code: 'A', nameEn: 'A', nameAr: 'A', availableQty: 0, isDefault: true },
        { id: 'stocked', code: 'B', nameEn: 'B', nameAr: 'B', availableQty: 8, isDefault: false },
      ]),
    ).toBe('stocked');
  });

  it('falls back to the default RAW warehouse when nothing is on hand', () => {
    expect(
      pickDefaultWarehouseId([
        { id: 'a', code: 'A', nameEn: 'A', nameAr: 'A', isDefault: false },
        { id: 'b', code: 'B', nameEn: 'B', nameAr: 'B', isDefault: true },
      ]),
    ).toBe('b');
  });
});
