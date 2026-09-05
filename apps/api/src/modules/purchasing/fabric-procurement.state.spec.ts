import { BadRequestException } from '@nestjs/common';
import { FabricProcurementEventKind, FabricProcurementState } from '@maher/database';
import { FabricProcurementService } from './fabric-procurement.service';

describe('fabric procurement wait / redirect history', () => {
  function service() {
    const events: Array<Record<string, unknown>> = [];
    const row: Record<string, unknown> = {
      id: 'fp-1',
      requirementId: 'req-1',
      salesOrderId: 'so-1',
      salesOrderLineId: 'sol-1',
      supplierId: 'sup-old',
      expectedAvailableAt: null,
      waitingSince: null,
      notes: null,
      state: FabricProcurementState.AWAITING_SUPPLIER,
      fabricHoldOverriddenAt: null,
      purchaseRequestId: null,
      purchaseOrderId: null,
      whatsappSentAt: null,
      whatsappLastBody: null,
      whatsappLastTo: null,
      unit: 'm',
      orderedQty: 24,
      requirement: {
        requestedFabricLabel: 'Velvet 302',
        displayName: 'Velvet 302',
        sku: 'FAB-VEL',
        inventoryItemId: 'inv-vel',
        expectedQty: 24,
        qtyIsEstimate: false,
        unit: 'm',
        fabricRole: 'Main body',
        stageCode: 'UPHOLSTERY',
        inventoryItem: null,
        lineSetup: { manufacturingName: 'Milano Sofa', requestedFabricLabel: 'Velvet 302', salesOrderLineId: 'sol-1' },
      },
      supplier: {
        id: 'sup-old',
        name: 'Abdali Textile',
        nameAr: 'العبدلي',
        nameEn: 'Abdali Textile',
        phone: '+9626',
        whatsappPhone: '+9626',
      },
      salesOrder: {
        id: 'so-1',
        number: 'SO-FB1042',
        projectName: 'Three-fabric sofa',
        customer: { id: 'c1', nameEn: 'Oasis', nameAr: 'واحة', code: 'OAS' },
      },
      salesOrderLine: { id: 'sol-1', description: 'Milano Sofa', quantity: 1 },
      events: [],
      lots: [],
    };
    const prisma = {
      fabricProcurement: {
        findUnique: jest.fn(async () => row),
        findMany: jest.fn(async () => []),
        update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          Object.assign(row, data);
          return row;
        }),
      },
      fabricProcurementEvent: {
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          events.push(data);
          return { id: `ev-${events.length}`, ...data };
        }),
        deleteMany: jest.fn(),
        delete: jest.fn(),
      },
      productionTaskMaterialUsage: {
        findMany: jest.fn(async () => []),
      },
    };
    const svc = new FabricProcurementService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      { send: jest.fn() } as never,
    );
    return { svc, events, row, prisma };
  }

  const user = { id: 'user-1', permissions: ['fabric.procurement.manage'] } as never;

  it('wait appends WAIT and does not delete prior history', async () => {
    const { svc, events, prisma, row } = service();
    events.push({
      procurementId: 'fp-1',
      kind: FabricProcurementEventKind.REQUESTED,
      userId: 'user-0',
    });
    await expect(svc.wait('fp-1', user, 'Supplier asked to wait', '2026-10-01')).resolves.toBeTruthy();
    expect(row.state).toBe(FabricProcurementState.WAITING);
    expect(events.filter((e) => e.kind === FabricProcurementEventKind.REQUESTED)).toHaveLength(1);
    expect(events.some((e) => e.kind === FabricProcurementEventKind.WAIT)).toBe(true);
    expect(prisma.fabricProcurementEvent.deleteMany).not.toHaveBeenCalled();
    expect(prisma.fabricProcurementEvent.delete).not.toHaveBeenCalled();
  });

  it('redirect appends REDIRECTED and returns to NEEDS_ORDERING without wiping events', async () => {
    const { svc, events, row, prisma } = service();
    row.state = FabricProcurementState.UNAVAILABLE;
    events.push({
      procurementId: 'fp-1',
      kind: FabricProcurementEventKind.SUPPLIER_UNAVAILABLE,
      userId: 'user-1',
    });
    await expect(svc.redirect('fp-1', user, 'sup-new', 'Try another mill')).resolves.toBeTruthy();
    expect(row.state).toBe(FabricProcurementState.NEEDS_ORDERING);
    expect(row.supplierId).toBe('sup-new');
    expect(events.some((e) => e.kind === FabricProcurementEventKind.SUPPLIER_UNAVAILABLE)).toBe(true);
    expect(events.some((e) => e.kind === FabricProcurementEventKind.REDIRECTED)).toBe(true);
    expect(prisma.fabricProcurementEvent.deleteMany).not.toHaveBeenCalled();
  });

  it('override appends OVERRIDE without marking fabric ready', async () => {
    const { svc, events, row } = service();
    await expect(svc.overrideHold('fp-1', user, 'Upholstery cannot wait')).resolves.toBeTruthy();
    expect(row.fabricHoldOverriddenAt).toBeInstanceOf(Date);
    expect(row.state).toBe(FabricProcurementState.AWAITING_SUPPLIER);
    expect(events.some((e) => e.kind === FabricProcurementEventKind.OVERRIDE)).toBe(true);
  });

  it('override requires a reason', async () => {
    const { svc } = service();
    await expect(svc.overrideHold('fp-1', user, '  ')).rejects.toBeInstanceOf(BadRequestException);
  });
});
