import { WarehousesController } from './warehouses.controller';

describe('warehouse holding locations', () => {
  const user = { id: 'user-1' } as never;

  function makeCtrl(opts?: { stock?: number; lots?: number; kits?: number }) {
    const created: Array<Record<string, unknown>> = [];
    const updated: Array<Record<string, unknown>> = [];
    const prisma = {
      warehouse: {
        findUnique: jest.fn(async () => ({ id: 'wh-1', type: 'RAW_MATERIALS', code: 'RAW' })),
      },
      warehouseLocation: {
        findFirst: jest.fn(async () => ({ id: 'loc-1', warehouseId: 'wh-1', code: 'A-3', name: 'Aisle 3', isDefault: false })),
        findMany: jest.fn(async () => []),
        findUnique: jest.fn(async () => null),
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          const row = { id: 'loc-new', ...data };
          created.push(row);
          return row;
        }),
        update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          const row = { id: 'loc-1', warehouseId: 'wh-1', ...data };
          updated.push(row);
          return row;
        }),
        delete: jest.fn(async () => ({ id: 'loc-1' })),
      },
      inventoryBalance: { count: jest.fn(async () => opts?.stock ?? 0) },
      inventoryLot: { count: jest.fn(async () => opts?.lots ?? 0) },
      wipKit: { count: jest.fn(async () => opts?.kits ?? 0) },
      auditEvent: { create: jest.fn() },
    };
    const ctrl = new WarehousesController(prisma as never);
    return { ctrl, created, updated, prisma };
  }

  it('creates a location on the warehouse', async () => {
    const { ctrl, created } = makeCtrl();
    await ctrl.addLocation('wh-1', { code: 'HOLD-1', name: 'Holding 1' }, user);
    expect(created[0]).toMatchObject({ warehouseId: 'wh-1', code: 'HOLD-1', name: 'Holding 1' });
  });

  it('creates a location with an auto code from the name', async () => {
    const { ctrl, created } = makeCtrl();
    await ctrl.addLocation('wh-1', { name: 'Aisle 3' }, user);
    expect(created[0]).toMatchObject({ warehouseId: 'wh-1', code: 'AISLE-3', name: 'Aisle 3' });
  });

  it('updates a location name and code', async () => {
    const { ctrl, updated } = makeCtrl();
    await ctrl.updateLocation('wh-1', 'loc-1', { name: 'Table A', code: 'TBL-A' }, user);
    expect(updated[0]).toMatchObject({ name: 'Table A', code: 'TBL-A' });
  });

  it('leaves the code untouched when only the name changes', async () => {
    const { ctrl, updated } = makeCtrl();
    await ctrl.updateLocation('wh-1', 'loc-1', { name: 'Table A' }, user);
    expect(updated[0]).toMatchObject({ name: 'Table A' });
    expect(updated[0]).not.toHaveProperty('code');
  });

  it('refuses delete when fabric lots still sit there', async () => {
    const { ctrl, prisma } = makeCtrl({ lots: 2 });
    await expect(ctrl.removeLocation('wh-1', 'loc-1', user)).rejects.toMatchObject({
      response: { code: 'LOCATION_HAS_STOCK' },
    });
    expect(prisma.warehouseLocation.delete).not.toHaveBeenCalled();
  });

  it('returns nested stocked bin contents on the warehouse desk', async () => {
    const { ctrl, prisma } = makeCtrl();
    prisma.warehouse.findUnique.mockImplementation(async () => ({
      id: 'wh-1',
      code: 'RAW',
      nameEn: 'Raw',
      nameAr: 'خام',
      type: 'RAW_MATERIALS',
      locations: [
        {
          id: 'loc-main',
          code: 'RAW-MAIN',
          name: 'Main floor',
          isDefault: true,
          qrCode: 'BIN-RAW-RAW-MAIN',
          balances: [
            {
              inventoryItemId: 'item-1',
              availableQty: 4,
              reservedQty: 1,
              inventoryItem: {
                sku: 'BEECH',
                nameEn: 'Beech',
                nameAr: 'زان',
                nameHe: null,
                unit: 'm',
                imageUrl: null,
              },
            },
          ],
        },
      ],
    }));
    const row = await ctrl.get('wh-1');
    expect(row.locations[0]).toMatchObject({
      code: 'RAW-MAIN',
      scanCode: 'BIN-RAW-RAW-MAIN',
      contents: [{ sku: 'BEECH', availableQty: 4, reservedQty: 1 }],
    });
    expect(row.locations[0]).not.toHaveProperty('balances');
  });

  it('resolves a printed BIN-RAW-MAIN scan to the RAW-MAIN bin', async () => {
    const { ctrl, prisma } = makeCtrl();
    prisma.warehouseLocation.findFirst.mockImplementation(async (args: { where?: { OR?: unknown } }) => {
      const or = args?.where?.OR as Array<Record<string, string>> | undefined;
      expect(or).toEqual(
        expect.arrayContaining([{ qrCode: 'BIN-RAW-MAIN' }, { code: 'RAW-MAIN' }]),
      );
      return {
        id: 'loc-main',
        warehouseId: 'wh-1',
        code: 'RAW-MAIN',
        name: 'Main floor',
        qrCode: 'BIN-RAW-RAW-MAIN',
        warehouse: { id: 'wh-1', code: 'RAW', nameEn: 'Raw', nameAr: 'خام' },
        balances: [],
      };
    });
    const row = await ctrl.findLocationByCode('BIN-RAW-MAIN');
    expect(row).toMatchObject({ code: 'RAW-MAIN', scanCode: 'BIN-RAW-RAW-MAIN' });
  });
});
