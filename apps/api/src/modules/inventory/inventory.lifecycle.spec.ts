import { BadRequestException } from '@nestjs/common';
import { InventoryTxType } from '@maher/database';
import { InventoryService } from './inventory.service';
import type { PrismaService } from '../../common/prisma.service';
import type { SequenceService } from '../../common/sequence.service';
import type { PurchasingService } from '../purchasing/purchasing.service';
import type { InventoryItemClassValue, WarehouseTypeValue } from '../../common/helpers/inventory-lifecycle.util';

describe('inventory lifecycle engine', () => {
  function makeService(overrides?: {
    itemClass?: string;
    warehouseType?: string;
    existingTx?: { id: string } | null;
    balance?: { id: string; availableQty: number; reservedQty: number } | null;
  }) {
    const created: unknown[] = [];
    const tx = {
      inventoryTransaction: {
        findUnique: jest.fn().mockResolvedValue(overrides?.existingTx ?? null),
        create: jest.fn().mockImplementation(async ({ data }: { data: object }) => {
          created.push(data);
          return { id: 'tx-1', ...data };
        }),
      },
      inventoryItem: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'item-1',
          itemClass: overrides?.itemClass ?? 'RAW_MATERIAL',
        }),
      },
      warehouse: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'wh-1',
          type: overrides?.warehouseType ?? 'RAW_MATERIALS',
        }),
      },
      inventoryBalance: {
        findFirst: jest.fn().mockResolvedValue(overrides?.balance ?? { id: 'bal-1', availableQty: 10, reservedQty: 0 }),
        update: jest.fn().mockResolvedValue({}),
        create: jest.fn().mockResolvedValue({}),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
      warehouseTransfer: {
        findUniqueOrThrow: jest.fn(),
        create: jest.fn(),
      },
    } as unknown as PrismaService;
    const sequences = { next: jest.fn().mockResolvedValue('INV-1') } as unknown as SequenceService;
    const purchasing = {} as PurchasingService;
    const service = new InventoryService(prisma, sequences, purchasing);
    return { service, tx, created, prisma };
  }

  it('rejects receiving a finished good into a raw warehouse', async () => {
    const { service } = makeService({ itemClass: 'FINISHED_GOOD', warehouseType: 'RAW_MATERIALS' });
    await expect(
      service.applyMovement({
        type: InventoryTxType.PURCHASE_RECEIPT,
        inventoryItemId: 'item-1',
        warehouseId: 'wh-1',
        quantity: 1,
        userId: 'u1',
      }),
    ).rejects.toMatchObject({ response: { code: 'WAREHOUSE_TYPE_MISMATCH' } });
  });

  const validReceipts: Array<[InventoryItemClassValue, WarehouseTypeValue]> = [
    ['RAW_MATERIAL', 'RAW_MATERIALS'],
    ['SEMI_FINISHED_GOOD', 'SEMI_FINISHED'],
    ['FINISHED_GOOD', 'FINISHED_GOODS'],
  ];

  it.each(validReceipts)(
    'allows receiving %s into %s',
    async (itemClass, warehouseType) => {
      const { service, tx } = makeService({ itemClass, warehouseType });
      await expect(
        service.applyMovement({
          type: InventoryTxType.PURCHASE_RECEIPT,
          inventoryItemId: 'item-1',
          warehouseId: 'wh-1',
          quantity: 1,
          userId: 'u1',
        }),
      ).resolves.toMatchObject({ id: 'tx-1' });
      expect(tx.inventoryTransaction.create).toHaveBeenCalled();
    },
  );

  const invalidReceipts: Array<[InventoryItemClassValue, WarehouseTypeValue]> = [
    ['RAW_MATERIAL', 'SEMI_FINISHED'],
    ['RAW_MATERIAL', 'FINISHED_GOODS'],
    ['SEMI_FINISHED_GOOD', 'RAW_MATERIALS'],
    ['SEMI_FINISHED_GOOD', 'FINISHED_GOODS'],
    ['FINISHED_GOOD', 'RAW_MATERIALS'],
    ['FINISHED_GOOD', 'SEMI_FINISHED'],
  ];

  it.each(invalidReceipts)(
    'rejects receiving %s into %s with WAREHOUSE_TYPE_MISMATCH',
    async (itemClass, warehouseType) => {
      const { service, tx } = makeService({ itemClass, warehouseType });
      await expect(
        service.applyMovement({
          type: InventoryTxType.PURCHASE_RECEIPT,
          inventoryItemId: 'item-1',
          warehouseId: 'wh-1',
          quantity: 1,
          userId: 'u1',
        }),
      ).rejects.toMatchObject({ response: { code: 'WAREHOUSE_TYPE_MISMATCH' } });
      expect(tx.inventoryTransaction.create).not.toHaveBeenCalled();
    },
  );

  it('returns the existing transaction on idempotent retry without a second create', async () => {
    const existing = { id: 'tx-existing' };
    const { service, tx } = makeService({ existingTx: existing });
    const result = await service.applyMovement({
      type: InventoryTxType.PURCHASE_RECEIPT,
      inventoryItemId: 'item-1',
      warehouseId: 'wh-1',
      quantity: 2,
      userId: 'u1',
      idempotencyKey: 'grn:1:item-1',
    });
    expect(result).toEqual(existing);
    expect(tx.inventoryTransaction.create).not.toHaveBeenCalled();
    expect(tx.inventoryBalance.update).not.toHaveBeenCalled();
  });

  it('creates the ledger row before mutating the balance', async () => {
    const order: string[] = [];
    const { service, tx } = makeService();
    tx.inventoryTransaction.create.mockImplementation(async ({ data }: { data: object }) => {
      order.push('create');
      return { id: 'tx-1', ...data };
    });
    tx.inventoryBalance.update.mockImplementation(async () => {
      order.push('balance');
      return {};
    });
    await service.applyMovement({
      type: InventoryTxType.PURCHASE_RECEIPT,
      inventoryItemId: 'item-1',
      warehouseId: 'wh-1',
      quantity: 2,
      userId: 'u1',
      idempotencyKey: 'grn:2:item-1',
    });
    expect(order).toEqual(['create', 'balance']);
  });

  it('rejects a transfer between different warehouse types', async () => {
    const prisma = {
      warehouse: {
        findUniqueOrThrow: jest
          .fn()
          .mockResolvedValueOnce({ id: 'a', type: 'RAW_MATERIALS' })
          .mockResolvedValueOnce({ id: 'b', type: 'FINISHED_GOODS' }),
      },
    } as unknown as PrismaService;
    const service = new InventoryService(
      prisma,
      { next: jest.fn() } as unknown as SequenceService,
      {} as PurchasingService,
    );
    await expect(
      service.createTransfer(
        { fromWarehouseId: 'a', toWarehouseId: 'b', lines: [{ inventoryItemId: 'i', quantity: 1 }] },
        'u1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  const sameLifecycle: Array<[string, string, string]> = [
    ['RAW_MATERIALS', 'a', 'b'],
    ['SEMI_FINISHED', 'semi-a', 'semi-b'],
    ['FINISHED_GOODS', 'fin-a', 'fin-b'],
  ];

  it.each(sameLifecycle)(
    'allows a same-lifecycle %s transfer',
    async (type, fromId, toId) => {
      const create = jest.fn().mockResolvedValue({
        id: 'trf-1',
        status: 'DRAFT',
        fromWarehouseId: fromId,
        toWarehouseId: toId,
      });
      const prisma = {
        warehouse: {
          findUniqueOrThrow: jest
            .fn()
            .mockResolvedValueOnce({ id: fromId, type })
            .mockResolvedValueOnce({ id: toId, type }),
        },
        warehouseTransfer: { create },
      } as unknown as PrismaService;
      const service = new InventoryService(
        prisma,
        { next: jest.fn().mockResolvedValue('TRF-1') } as unknown as SequenceService,
        {} as PurchasingService,
      );
      await expect(
        service.createTransfer(
          {
            fromWarehouseId: fromId,
            toWarehouseId: toId,
            lines: [{ inventoryItemId: 'i', quantity: 1 }],
          },
          'u1',
        ),
      ).resolves.toMatchObject({ id: 'trf-1', status: 'DRAFT' });
      expect(create).toHaveBeenCalled();
    },
  );

  const crossLifecycle: Array<[string, string]> = [
    ['RAW_MATERIALS', 'SEMI_FINISHED'],
    ['RAW_MATERIALS', 'FINISHED_GOODS'],
    ['SEMI_FINISHED', 'RAW_MATERIALS'],
    ['SEMI_FINISHED', 'FINISHED_GOODS'],
    ['FINISHED_GOODS', 'RAW_MATERIALS'],
    ['FINISHED_GOODS', 'SEMI_FINISHED'],
  ];

  it.each(crossLifecycle)(
    'rejects a %s → %s transfer',
    async (fromType, toType) => {
      const prisma = {
        warehouse: {
          findUniqueOrThrow: jest
            .fn()
            .mockResolvedValueOnce({ id: 'a', type: fromType })
            .mockResolvedValueOnce({ id: 'b', type: toType }),
        },
      } as unknown as PrismaService;
      const service = new InventoryService(
        prisma,
        { next: jest.fn() } as unknown as SequenceService,
        {} as PurchasingService,
      );
      await expect(
        service.createTransfer(
          {
            fromWarehouseId: 'a',
            toWarehouseId: 'b',
            lines: [{ inventoryItemId: 'i', quantity: 1 }],
          },
          'u1',
        ),
      ).rejects.toMatchObject({ response: { code: 'WAREHOUSE_TYPE_MISMATCH' } });
    },
  );

  it('rejects completing a transfer when source stock is insufficient', async () => {
    const { service, tx, prisma } = makeService({
      itemClass: 'RAW_MATERIAL',
      warehouseType: 'RAW_MATERIALS',
      balance: { id: 'bal-1', availableQty: 1, reservedQty: 0 },
    });
    (prisma as unknown as {
      warehouseTransfer: { findUniqueOrThrow: jest.Mock };
    }).warehouseTransfer.findUniqueOrThrow.mockResolvedValue({
      id: 'trf-1',
      status: 'DRAFT',
      number: 'TRF-1',
      fromWarehouseId: 'wh-1',
      toWarehouseId: 'wh-2',
      lines: [{ id: 'line-1', inventoryItemId: 'item-1', quantity: 5 }],
    });
    (tx as { warehouseTransfer?: { update: jest.Mock } }).warehouseTransfer = {
      update: jest.fn(),
    };
    await expect(service.completeTransfer('trf-1', 'u1')).rejects.toMatchObject({
      response: { code: 'INSUFFICIENT_STOCK' },
    });
  });
});
