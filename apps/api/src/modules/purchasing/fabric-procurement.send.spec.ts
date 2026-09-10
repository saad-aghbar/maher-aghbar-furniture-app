import { FabricProcurementState } from '@maher/database';
import { FabricProcurementService } from './fabric-procurement.service';

describe('sendWhatsApp does not create a PO on failure', () => {
  it('returns without PR/PO when the provider fails', async () => {
    const prCreates: unknown[] = [];
    const poUpdates: unknown[] = [];
    const fpUpdates: unknown[] = [];
    const row = {
      id: 'fp-1',
      requirementId: 'req-1',
      salesOrderId: 'so-1',
      salesOrderLineId: 'sol-1',
      supplierId: null,
      purchaseRequestId: null,
      purchaseOrderId: null,
      orderedQty: 12,
      unit: 'm',
      requirement: {
        requestedFabricLabel: 'Velvet',
        displayName: 'Velvet',
        sku: 'FAB-VEL',
        inventoryItemId: 'inv-vel',
        expectedQty: 12,
        unit: 'm',
        fabricRole: 'Main',
        inventoryItem: { nameAr: 'مخمل', nameEn: 'Velvet', sku: 'FAB-VEL', imageUrl: null },
        lineSetup: { manufacturingName: 'Sofa', requestedFabricLabel: 'Velvet', salesOrderLineId: 'sol-1' },
      },
      supplier: null,
      salesOrder: {
        number: 'SO-1',
        customer: { nameEn: 'Oasis', nameAr: 'واحة' },
      },
      salesOrderLine: { description: 'Sofa', product: { nameAr: 'كنبة', nameEn: 'Sofa' } },
      events: [],
      lots: [],
      purchaseOrder: null,
    };
    const prisma = {
      fabricProcurement: {
        findMany: jest.fn(async () => [row]),
        findUnique: jest.fn(async () => row),
        update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          fpUpdates.push(data);
          return { ...row, ...data };
        }),
      },
      supplier: { findUniqueOrThrow: jest.fn(async () => ({ id: 'sup-1', name: 'Mill', whatsappPhone: '+9627', phone: null })) },
      purchaseRequest: { create: jest.fn(async (args: unknown) => { prCreates.push(args); return { id: 'pr-1' }; }) },
      purchaseOrder: { update: jest.fn(async (args: unknown) => { poUpdates.push(args); }) },
      fabricProcurementEvent: { create: jest.fn() },
      productionTaskMaterialUsage: { findMany: jest.fn(async () => []) },
    };
    const purchasing = {
      supplierWhatsAppTo: () => '+9627',
      convertRequestToPo: jest.fn(async () => ({ id: 'po-1' })),
    };
    const sequences = { next: jest.fn(async () => 'PREQ-1') };
    const whatsapp = { send: jest.fn(async () => { throw new Error('provider down'); }) };
    const svc = new FabricProcurementService(
      prisma as never,
      sequences as never,
      purchasing as never,
      {} as never,
      whatsapp as never,
    );

    const result = await svc.sendWhatsApp(['fp-1'], 'sup-1', { id: 'user-1' } as never);

    expect(result.whatsapp.ok).toBe(false);
    expect(result.purchaseOrderId).toBeNull();
    expect(result.purchaseRequestId).toBeNull();
    expect(prCreates).toHaveLength(0);
    expect(purchasing.convertRequestToPo).not.toHaveBeenCalled();
    expect(fpUpdates).toHaveLength(0);
    expect(poUpdates).toHaveLength(0);
  });

  it('returns the PO number after a successful send', async () => {
    const row = {
      id: 'fp-1',
      requirementId: 'req-1',
      salesOrderId: 'so-1',
      salesOrderLineId: 'sol-1',
      supplierId: null,
      purchaseRequestId: null,
      purchaseOrderId: null,
      orderedQty: 12,
      unit: 'm',
      requirement: {
        requestedFabricLabel: 'Velvet',
        displayName: 'Velvet',
        sku: 'FAB-VEL',
        inventoryItemId: 'inv-vel',
        expectedQty: 12,
        unit: 'm',
        fabricRole: 'Main',
        inventoryItem: { nameAr: 'مخمل', nameEn: 'Velvet', sku: 'FAB-VEL', imageUrl: null },
        lineSetup: { manufacturingName: 'Sofa', requestedFabricLabel: 'Velvet', salesOrderLineId: 'sol-1' },
      },
      supplier: null,
      salesOrder: {
        number: 'SO-1',
        customer: { nameEn: 'Oasis', nameAr: 'واحة' },
      },
      salesOrderLine: { description: 'Sofa', product: { nameAr: 'كنبة', nameEn: 'Sofa' } },
      events: [],
      lots: [],
      purchaseOrder: null,
    };
    const prisma = {
      fabricProcurement: {
        findMany: jest.fn(async () => [row]),
        findUnique: jest.fn(async () => row),
        update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          Object.assign(row, data);
          return row;
        }),
      },
      supplier: { findUniqueOrThrow: jest.fn(async () => ({ id: 'sup-1', name: 'Mill', whatsappPhone: '+9627', phone: null })) },
      purchaseRequest: {
        create: jest.fn(async () => ({ id: 'pr-1' })),
      },
      purchaseOrder: {
        update: jest.fn(),
        findUnique: jest.fn(async () => ({ number: 'PORD-88' })),
      },
      fabricProcurementEvent: { create: jest.fn() },
      productionTaskMaterialUsage: { findMany: jest.fn(async () => []) },
    };
    const purchasing = {
      supplierWhatsAppTo: () => '+9627',
      convertRequestToPo: jest.fn(async () => ({ id: 'po-1' })),
    };
    const svc = new FabricProcurementService(
      prisma as never,
      { next: jest.fn(async () => 'PREQ-1') } as never,
      purchasing as never,
      {} as never,
      { send: jest.fn(async () => ({ ok: true })) } as never,
    );

    const result = await svc.sendWhatsApp(['fp-1'], 'sup-1', { id: 'user-1' } as never);
    expect(result.whatsapp.ok).toBe(true);
    expect(result.purchaseOrderId).toBe('po-1');
    expect(result.purchaseOrderNumber).toBe('PORD-88');
    expect(row.state).toBe(FabricProcurementState.AWAITING_SUPPLIER);
    expect(result.body).toContain('طلب قماش لأمر SO-1');
    expect(result.body).toContain('مخمل');
    expect(result.body).toContain('كنبة');
    expect(result.body).toContain('واحة');
    expect(result.body).not.toContain('Fabric request');
  });
});
