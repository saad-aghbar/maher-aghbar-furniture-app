import { isApiError } from '@/api/errors';
import {
  isFinishedScanLot,
  isInventoryItemSelectable,
  resolveInventoryScan,
  type InventoryScanResolve,
} from '../resolveInventoryScan';
import type { InventoryItem, SemiFinishedLot, WipKitCard } from '../api';

jest.mock('@/api/errors', () => ({
  isApiError: jest.fn(),
}));

jest.mock('@/api/modules/inventory', () => ({
  getInventoryItemByCode: jest.fn(),
  getInventoryLotByCode: jest.fn(),
  getWipKitByCode: jest.fn(),
}));

const {
  getInventoryItemByCode,
  getInventoryLotByCode,
  getWipKitByCode,
} = jest.requireMock('@/api/modules/inventory') as {
  getInventoryItemByCode: jest.Mock;
  getInventoryLotByCode: jest.Mock;
  getWipKitByCode: jest.Mock;
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

function kit(qrCode: string): WipKitCard {
  return {
    id: 'kit-1',
    status: 'READY',
    qrCode,
    expectedPieceCount: 1,
    productionOrder: {
      id: 'po-1',
      number: 'PO-1',
      productDescription: 'Sofa',
      product: { nameEn: 'Sofa', nameAr: 'كنبة', sku: 'SOFA' },
    },
    stageInstance: {
      stageDefinition: { code: 'CARP', nameEn: 'Carpentry', nameAr: 'نجارة' },
    },
    pieces: [],
  };
}

describe('resolveInventoryScan', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (isApiError as unknown as jest.Mock).mockImplementation(
      (err: unknown) => Boolean(err && typeof err === 'object' && 'status' in (err as object)),
    );
  });

  it('FOUND when by-code returns item and kit/lot miss', async () => {
    const beech = item({ id: '1', sku: 'MAT-BEECH' });
    getWipKitByCode.mockRejectedValue({ status: 404, code: 'WIP_SCAN_NOT_FOUND' });
    getInventoryLotByCode.mockRejectedValue({ status: 404, code: 'NOT_FOUND' });
    getInventoryItemByCode.mockResolvedValue(beech);
    await expect(resolveInventoryScan('MAT-BEECH')).resolves.toEqual({
      status: 'FOUND',
      item: beech,
    } satisfies InventoryScanResolve);
  });

  it('FOUND_KIT when WIP by-code matches', async () => {
    const card = kit('WIP-PO-1-CARP');
    getWipKitByCode.mockResolvedValue(card);
    await expect(resolveInventoryScan('WIP-PO-1-CARP')).resolves.toEqual({
      status: 'FOUND_KIT',
      kit: card,
    });
    expect(getInventoryItemByCode).not.toHaveBeenCalled();
  });

  it('FOUND_LOT when lot QR matches after kit miss', async () => {
    const lot = {
      id: 'lot-1',
      quantity: 1,
      producedAt: '2026-01-01',
      status: 'AVAILABLE',
      qrCode: 'FIN-PO-1-PACK',
      inventoryItem: {
        id: 'fg-1',
        sku: 'FG-1',
        nameEn: 'Sofa',
        nameAr: 'كنبة',
        itemClass: 'FINISHED_GOOD',
      },
      warehouse: { id: 'w', code: 'FIN', nameEn: 'Fin', nameAr: 'Fin' },
    } as SemiFinishedLot;
    getWipKitByCode.mockRejectedValue({ status: 404, code: 'WIP_SCAN_NOT_FOUND' });
    getInventoryLotByCode.mockResolvedValue(lot);
    await expect(resolveInventoryScan('FIN-PO-1-PACK')).resolves.toEqual({
      status: 'FOUND_LOT',
      lot,
    });
    expect(getInventoryItemByCode).not.toHaveBeenCalled();
  });

  it('NOT_FOUND on empty code', async () => {
    await expect(resolveInventoryScan('  ')).resolves.toEqual({ status: 'NOT_FOUND' });
    expect(getWipKitByCode).not.toHaveBeenCalled();
  });

  it('NOT_FOUND on 404 ApiError for all resolvers', async () => {
    getWipKitByCode.mockRejectedValue({ status: 404, code: 'NOT_FOUND' });
    getInventoryLotByCode.mockRejectedValue({ status: 404, code: 'NOT_FOUND' });
    getInventoryItemByCode.mockRejectedValue({ status: 404, code: 'NOT_FOUND' });
    await expect(resolveInventoryScan('NOPE')).resolves.toEqual({ status: 'NOT_FOUND' });
  });

  it('ERROR on other failures', async () => {
    (isApiError as unknown as jest.Mock).mockReturnValue(false);
    getWipKitByCode.mockRejectedValue(new Error('network'));
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

describe('isFinishedScanLot', () => {
  it('detects finished vs semi by itemClass', () => {
    expect(
      isFinishedScanLot({
        inventoryItem: { itemClass: 'FINISHED_GOOD' },
      } as SemiFinishedLot),
    ).toBe(true);
    expect(
      isFinishedScanLot({
        inventoryItem: { itemClass: 'SEMI_FINISHED_GOOD' },
      } as SemiFinishedLot),
    ).toBe(false);
  });
});
