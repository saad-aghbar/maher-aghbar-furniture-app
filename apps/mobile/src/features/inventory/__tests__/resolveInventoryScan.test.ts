import { isApiError } from '@/api/errors';
import {
  isInventoryItemSelectable,
  resolveInventoryScan,
  type InventoryScanResolve,
} from '../resolveInventoryScan';
import type { InventoryItem } from '../api';

jest.mock('@/api/errors', () => ({
  isApiError: jest.fn(),
}));

jest.mock('@/api/modules/inventory', () => ({
  getInventoryItemByCode: jest.fn(),
}));

const { getInventoryItemByCode } = jest.requireMock('@/api/modules/inventory') as {
  getInventoryItemByCode: jest.Mock;
};

function item(partial: Partial<InventoryItem> & { id: string; sku: string }): InventoryItem {
  return {
    nameEn: partial.nameEn ?? partial.sku,
    nameAr: partial.nameAr ?? partial.sku,
    unit: 'm',
    category: 'FABRIC',
    minStock: 0,
    isActive: true,
    archivedAt: null,
    ...partial,
  };
}

describe('resolveInventoryScan', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('FOUND when by-code returns item', async () => {
    const beech = item({ id: '1', sku: 'MAT-BEECH' });
    getInventoryItemByCode.mockResolvedValue(beech);
    await expect(resolveInventoryScan('MAT-BEECH')).resolves.toEqual({
      status: 'FOUND',
      item: beech,
    } satisfies InventoryScanResolve);
  });

  it('NOT_FOUND on empty code', async () => {
    await expect(resolveInventoryScan('  ')).resolves.toEqual({ status: 'NOT_FOUND' });
    expect(getInventoryItemByCode).not.toHaveBeenCalled();
  });

  it('NOT_FOUND on 404 ApiError', async () => {
    (isApiError as unknown as jest.Mock).mockReturnValue(true);
    getInventoryItemByCode.mockRejectedValue({ status: 404, code: 'NOT_FOUND' });
    await expect(resolveInventoryScan('NOPE')).resolves.toEqual({ status: 'NOT_FOUND' });
  });

  it('ERROR on other failures', async () => {
    (isApiError as unknown as jest.Mock).mockReturnValue(false);
    getInventoryItemByCode.mockRejectedValue(new Error('network'));
    await expect(resolveInventoryScan('X')).resolves.toEqual({ status: 'ERROR' });
  });
});

describe('isInventoryItemSelectable', () => {
  it('gates archived and allowItem', () => {
    expect(isInventoryItemSelectable(item({ id: '1', sku: 'A', isActive: false }))).toBe(
      'archived',
    );
    expect(
      isInventoryItemSelectable(item({ id: '1', sku: 'A' }), () => false),
    ).toBe('disallowed');
    expect(isInventoryItemSelectable(item({ id: '1', sku: 'A' }))).toBe('ok');
  });
});
