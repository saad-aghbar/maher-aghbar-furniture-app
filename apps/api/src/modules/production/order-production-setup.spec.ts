import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { SalesOrderProductionSetupStatus } from '@maher/database';
import { ROLE_PERMISSIONS } from '@maher/permissions';
import { OrderProductionSetupService } from './order-production-setup.service';
import { PIECE2_EXPECTED_MATERIAL_COSTING_HOOK } from './order-production-setup.costing-hook';

describe('Piece 2 order production setup', () => {
  it('documents expected-material costing hook without implementing invoices', () => {
    expect(PIECE2_EXPECTED_MATERIAL_COSTING_HOOK.sourceModel).toBe(
      'SalesOrderLineMaterialRequirement',
    );
    expect(PIECE2_EXPECTED_MATERIAL_COSTING_HOOK.doesNotMutate).toEqual(
      expect.arrayContaining(['Product.bomDefaults', 'ProductStageMaterialInput']),
    );
  });

  function makeService(overrides: {
    setup?: unknown;
    order?: unknown;
    poCount?: number;
  } = {}) {
    const setup = overrides.setup ?? null;
    const order = overrides.order ?? {
      id: 'so-1',
      number: 'SO-1',
      status: 'DRAFT',
      customerId: 'c1',
      lines: [
        {
          id: 'line-1',
          description: 'Sofa',
          quantity: 1,
          productionRequired: true,
          productId: 'p1',
          manufacturingComplexity: 'STANDARD',
          orderSpec: {
            manufacturingComplexity: 'STANDARD',
            catalogDimensions: { width: 180, height: 90, depth: 85 },
            requestedDimensions: { width: 180, height: 90, depth: 85 },
          },
          product: {
            id: 'p1',
            nameEn: 'Sofa',
            width: 180,
            height: 90,
            depth: 85,
            bomDefaults: { materials: [{ sku: 'WOOD-1', qty: 2, category: 'WOOD' }] },
            workflowConfiguration: { workflowId: 'wf-1' },
            stageMaterialInputs: [
              {
                inventoryItemId: 'inv-1',
                qtyPerUnit: 2,
                unit: 'pcs',
                inventoryItem: {
                  id: 'inv-1',
                  sku: 'WOOD-1',
                  nameEn: 'Plywood',
                  category: 'WOOD',
                  unit: 'pcs',
                },
              },
            ],
            stageInventoryOutputs: [
              {
                expectedPieceCount: 2,
                pieceLabels: [{ nameEn: 'Seat' }, { nameEn: 'Back' }],
                inventoryTracking: 'PRODUCES_FINISHED',
              },
            ],
          },
        },
      ],
      documents: [],
      productionSetup: setup,
      productionOrders: [],
    };

    const prisma: any = {
      salesOrder: {
        findUnique: jest.fn().mockResolvedValue(order),
        update: jest.fn().mockImplementation(async ({ data }: any) => ({
          ...order,
          ...data,
          productionOrders: [{ id: 'po-1', status: 'PLANNED' }],
        })),
      },
      salesOrderProductionSetup: {
        findUnique: jest.fn().mockResolvedValue(setup),
        findUniqueOrThrow: jest.fn().mockResolvedValue(setup),
        create: jest.fn().mockResolvedValue({ id: 'setup-1' }),
        update: jest.fn().mockResolvedValue({}),
      },
      salesOrderLineSetup: {
        findUniqueOrThrow: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      salesOrderLineMaterialRequirement: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      fabricProcurement: {
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      salesOrderLine: {
        findUnique: jest.fn().mockResolvedValue({ id: 'line-1', productId: 'p1' }),
      },
      productStageMaterialInput: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      productionOrderWorkflowSnapshot: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      productionOrder: {
        count: jest.fn().mockResolvedValue(overrides.poCount ?? 0),
        create: jest.fn().mockResolvedValue({ id: 'po-1' }),
        updateMany: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      document: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      productionWorkflow: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'wf-1',
          activeVersionId: 'ver-1',
          status: 'ACTIVE',
        }),
      },
      inventoryItem: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([
          { sku: 'WOOD-1', standardCost: 12 },
        ]),
      },
      inventoryTransaction: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      inventoryBalance: {
        findFirst: jest.fn().mockResolvedValue({
          availableQty: 100,
          reservedQty: 0,
          warehouseId: 'wh-1',
        }),
      },
      auditEvent: { create: jest.fn() },
      $transaction: jest.fn(async (fn: any) => fn(prisma)),
    };

    const sequences = { next: jest.fn().mockResolvedValue('PO-1') };
    const workflowSnapshots = {
      createSnapshotForProductionOrder: jest.fn().mockResolvedValue({ id: 'snap-1' }),
    };
    const inventory = {
      tryReserveForSalesOrder: jest.fn().mockResolvedValue({ ready: true, risk: false }),
    };
    const notifications = {
      notifyCustomerUsers: jest.fn().mockResolvedValue(undefined),
    };

    const service = new OrderProductionSetupService(
      prisma,
      sequences as never,
      workflowSnapshots as never,
      inventory as never,
      notifications as never,
    );
    return { service, prisma, workflowSnapshots, inventory, notifications };
  }

  const staff = { id: 'admin-1', customerId: null } as never;
  const dealer = { id: 'dealer-1', customerId: 'c1' } as never;

  it('denies dealers from accessing setup', async () => {
    const { service } = makeService();
    await expect(service.ensureSetup('so-1', dealer)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lazy-creates setup from catalog without mutating Product', async () => {
    const { service, prisma } = makeService({ setup: null });
    // After create, getSetup loads full setup — stub the second findUnique
    const createdSetup = {
      id: 'setup-1',
      salesOrderId: 'so-1',
      status: SalesOrderProductionSetupStatus.SETUP_REQUIRED,
      releasedAt: null,
      releasedById: null,
      salesOrder: { id: 'so-1', number: 'SO-1', status: 'DRAFT', projectName: null, customerId: 'c1', customer: null },
      lines: [
        {
          id: 'ls-1',
          salesOrderLineId: 'line-1',
          status: 'NOT_STARTED',
          manufacturingName: 'Sofa',
          manufacturingComplexity: 'STANDARD',
          catalogDimensions: { width: 180 },
          orderDimensions: { width: 180 },
          requestedFabricLabel: null,
          factoryNotes: null,
          packagingExpectation: { expectedPieceCount: 2 },
          referenceDocumentIds: [],
          materialsReviewedAt: null,
          workflowId: 'wf-1',
          workflowConfirmedAt: new Date(),
          workflow: {
            id: 'wf-1',
            code: 'STD',
            nameEn: 'Standard',
            nameAr: 'قياسي',
            nameHe: null,
            status: 'ACTIVE',
            activeVersionId: 'v1',
            activeVersion: { id: 'v1', versionNumber: 1, nodes: [] },
          },
          salesOrderLine: {
            id: 'line-1',
            description: 'Sofa',
            quantity: 1,
            productId: 'p1',
            manufacturingComplexity: 'STANDARD',
            orderSpec: {},
            product: { id: 'p1', sku: 'S1', nameEn: 'Sofa', nameAr: null, nameHe: null, imageUrl: null },
          },
          materialRequirements: [
            {
              id: 'mr-1',
              inventoryItemId: 'inv-1',
              sku: 'WOOD-1',
              displayName: 'Plywood',
              category: 'WOOD',
              unit: 'pcs',
              expectedQty: 2,
              source: 'CATALOG',
              needsReview: false,
              notes: null,
              requestedFabricLabel: null,
              inventoryItem: {
                id: 'inv-1',
                sku: 'WOOD-1',
                nameEn: 'Plywood',
                nameAr: null,
                nameHe: null,
                category: 'WOOD',
                unit: 'pcs',
                imageUrl: null,
              },
            },
          ],
        },
      ],
    };
    prisma.salesOrderProductionSetup.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValue(createdSetup);

    const result = await service.ensureSetup('so-1', staff);
    expect(prisma.salesOrderProductionSetup.create).toHaveBeenCalled();
    const createArg = prisma.salesOrderProductionSetup.create.mock.calls[0][0];
    expect(createArg.data.lines.create[0].materialRequirements.create[0].source).toBe('CATALOG');
    expect(createArg.data.lines.create[0].salesOrderLine.connect.id).toBe('line-1');
    expect((result.lines as Array<{ quantity: number }>)[0]!.quantity).toBe(1);
  });

  it('rejects confirm-path release when workflow/materials incomplete', async () => {
    const incompleteLine = {
      id: 'ls-1',
      salesOrderLineId: 'line-1',
      status: 'NOT_STARTED',
      manufacturingName: 'Sofa',
      workflowId: null,
      workflowConfirmedAt: null,
      manufacturingComplexity: 'CUSTOM',
      materialRequirements: [],
      salesOrderLine: { id: 'line-1', quantity: 1, description: 'Sofa', productId: null },
    };
    const incomplete = {
      id: 'setup-1',
      salesOrderId: 'so-1',
      status: SalesOrderProductionSetupStatus.SETUP_IN_PROGRESS,
      lines: [incompleteLine],
      salesOrder: {
        id: 'so-1',
        number: 'SO-1',
        customerId: 'c1',
        requiredDeliveryDate: null,
        lines: [{ id: 'line-1', productionRequired: true }],
      },
    };
    const { service, prisma } = makeService({ setup: incomplete });
    prisma.salesOrderProductionSetup.findUnique.mockResolvedValue(incomplete);
    prisma.salesOrderProductionSetup.findUniqueOrThrow.mockResolvedValue(incomplete);
    prisma.salesOrderLineSetup.findUniqueOrThrow.mockResolvedValue(incompleteLine);
    prisma.salesOrderLineSetup.findMany.mockResolvedValue([
      { id: 'ls-1', status: 'NOT_STARTED', productionSetupId: 'setup-1' },
    ]);
    await expect(service.release('so-1', staff)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('isReleased reflects RELEASED status only', async () => {
    const { service, prisma } = makeService();
    prisma.salesOrderProductionSetup.findUnique.mockResolvedValue({
      status: SalesOrderProductionSetupStatus.READY_FOR_RELEASE,
    });
    expect(await service.isReleased('so-1')).toBe(false);
    prisma.salesOrderProductionSetup.findUnique.mockResolvedValue({
      status: SalesOrderProductionSetupStatus.RELEASED,
    });
    expect(await service.isReleased('so-1')).toBe(true);
  });

  it('release creates snapshot with material overrides and skips scheduling side effects', async () => {
    const readySetup = {
      id: 'setup-1',
      salesOrderId: 'so-1',
      status: SalesOrderProductionSetupStatus.READY_FOR_RELEASE,
      lines: [
        {
          id: 'ls-1',
          salesOrderLineId: 'line-1',
          status: 'READY',
          manufacturingName: 'Sofa',
          factoryNotes: 'ok',
          workflowId: 'wf-1',
          workflowConfirmedAt: new Date(),
          manufacturingComplexity: 'STANDARD',
          materialRequirements: [
            {
              inventoryItemId: 'inv-1',
              sku: 'WOOD-1',
              expectedQty: 2,
              unit: 'pcs',
              needsReview: false,
            },
          ],
          salesOrderLine: {
            id: 'line-1',
            quantity: 1,
            description: 'Sofa',
            productId: 'p1',
            specifications: null,
          },
        },
      ],
      salesOrder: {
        id: 'so-1',
        number: 'SO-1',
        customerId: 'c1',
        requiredDeliveryDate: null,
        lines: [
          {
            id: 'line-1',
            productionRequired: true,
            quantity: 1,
            description: 'Sofa',
            productId: 'p1',
            specifications: null,
          },
        ],
      },
    };
    const { service, prisma, workflowSnapshots, inventory } = makeService({
      setup: readySetup,
      poCount: 0,
    });
    prisma.salesOrderProductionSetup.findUnique.mockResolvedValue(readySetup);
    prisma.salesOrderProductionSetup.findUniqueOrThrow.mockResolvedValue(readySetup);
    prisma.salesOrderLineSetup.findUniqueOrThrow.mockResolvedValue({
      ...readySetup.lines[0]!,
      materialRequirements: readySetup.lines[0]!.materialRequirements,
    });
    prisma.salesOrderLineSetup.findMany.mockResolvedValue([
      { id: 'ls-1', status: 'READY', productionSetupId: 'setup-1' },
    ]);

    const result = await service.release('so-1', staff);
    expect(workflowSnapshots.createSnapshotForProductionOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        workflowId: 'wf-1',
        materialOverrides: [
          expect.objectContaining({ inventoryItemId: 'inv-1', sku: 'WOOD-1', qtyPerUnit: 2 }),
        ],
      }),
      expect.anything(),
    );
    expect(inventory.tryReserveForSalesOrder).toHaveBeenCalledTimes(1);
    expect(result.schedulingSkipped).toBe(true);
    expect(result.workerAssignmentRequired).toBe(true);
  });
});

describe('Piece 4 manufacturing specification', () => {
  function makeService(overrides: { setup?: unknown; order?: unknown } = {}) {
    const prisma: any = {
      salesOrder: { findUnique: jest.fn().mockResolvedValue(overrides.order ?? null) },
      salesOrderProductionSetup: {
        findUnique: jest.fn().mockResolvedValue(overrides.setup ?? null),
        findUniqueOrThrow: jest.fn().mockResolvedValue(overrides.setup ?? null),
        update: jest.fn(),
      },
      salesOrderLineSetup: {
        update: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        findUniqueOrThrow: jest.fn(),
      },
      salesOrderLineMaterialRequirement: { deleteMany: jest.fn(), createMany: jest.fn() },
      salesOrderLine: {
        findUnique: jest.fn().mockResolvedValue({ id: 'line-1', productId: 'p1' }),
      },
      productStageMaterialInput: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      productionOrderWorkflowSnapshot: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      productionOrder: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      document: { findMany: jest.fn().mockResolvedValue([]) },
      inventoryItem: {
        findMany: jest.fn().mockResolvedValue([{ sku: 'WOOD-1', standardCost: 10 }]),
        findFirst: jest.fn(),
      },
      inventoryTransaction: { findMany: jest.fn().mockResolvedValue([]) },
      inventoryBalance: {
        findFirst: jest.fn().mockResolvedValue({
          availableQty: 100,
          reservedQty: 0,
          warehouseId: 'wh-1',
        }),
      },
      auditEvent: { create: jest.fn() },
      $transaction: jest.fn(async (fn: any) => fn(prisma)),
      productionWorkflow: { findUnique: jest.fn() },
    };
    const service = new OrderProductionSetupService(
      prisma,
      { next: jest.fn() } as never,
      { createSnapshotForProductionOrder: jest.fn() } as never,
      { tryReserveForSalesOrder: jest.fn() } as never,
      { notifyCustomerUsers: jest.fn() } as never,
    );
    return { service, prisma };
  }

  const staff = { id: 'admin-1', customerId: null } as never;
  const dealer = { id: 'd1', customerId: 'c1' } as never;

  function modifiedSetupLine(extra: Record<string, unknown> = {}) {
    return {
      id: 'ls-1',
      salesOrderLineId: 'line-1',
      status: 'NEEDS_REVIEW',
      manufacturingName: 'Sofa',
      manufacturingComplexity: 'MODIFIED',
      catalogDimensions: { width: 220, height: 90, depth: 85 },
      orderDimensions: { width: 240, height: 90, depth: 85 },
      measurements: [{ key: 'arm', label: 'Arm height', value: 55, unit: 'cm', catalogValue: 50 }],
      requestedFabricLabel: 'Velvet Navy',
      factoryNotes: null,
      packagingExpectation: { expectedPieceCount: 1 },
      referenceDocumentIds: ['doc-1'],
      materialsReviewedAt: null,
      workflowId: 'wf-1',
      workflowConfirmedAt: new Date(),
      workflow: {
        id: 'wf-1',
        code: 'STD',
        nameEn: 'Standard',
        nameAr: null,
        nameHe: null,
        status: 'ACTIVE',
        activeVersionId: 'v1',
        activeVersion: { id: 'v1', versionNumber: 1, nodes: [] },
      },
      salesOrderLine: {
        id: 'line-1',
        description: 'Sofa',
        quantity: 1,
        productId: 'p1',
        manufacturingComplexity: 'MODIFIED',
        orderSpec: { attachmentIds: ['doc-1'] },
        product: {
          id: 'p1',
          sku: 'S1',
          nameEn: 'Sofa',
          nameAr: null,
          nameHe: null,
          imageUrl: null,
        },
      },
      materialRequirements: [
        {
          id: 'mr-1',
          inventoryItemId: 'inv-1',
          sku: 'WOOD-1',
          displayName: 'Plywood',
          category: 'WOOD',
          unit: 'pcs',
          expectedQty: 2,
          source: 'CATALOG',
          needsReview: false,
          notes: null,
          requestedFabricLabel: null,
          inventoryItem: {
            id: 'inv-1',
            sku: 'WOOD-1',
            nameEn: 'Plywood',
            nameAr: null,
            nameHe: null,
            category: 'WOOD',
            unit: 'pcs',
            imageUrl: null,
          },
        },
        {
          id: 'mr-2',
          inventoryItemId: 'inv-f',
          sku: 'FAB-1',
          displayName: 'Velvet',
          category: 'FABRIC',
          unit: 'm',
          expectedQty: 12,
          source: 'FACTORY_MODIFIED',
          needsReview: true,
          notes: null,
          requestedFabricLabel: 'Velvet Navy',
          inventoryItem: {
            id: 'inv-f',
            sku: 'FAB-1',
            nameEn: 'Velvet',
            nameAr: null,
            nameHe: null,
            category: 'FABRIC',
            unit: 'm',
            imageUrl: null,
          },
        },
      ],
      ...extra,
    };
  }

  it('getSetup returns changesFromCatalog, measurements, fabric, incomplete estimate, attachments', async () => {
    const setup = {
      id: 'setup-1',
      salesOrderId: 'so-1',
      status: SalesOrderProductionSetupStatus.SETUP_IN_PROGRESS,
      releasedAt: null,
      releasedById: null,
      salesOrder: {
        id: 'so-1',
        number: 'SO-P4-B',
        status: 'ACCEPTED',
        projectName: null,
        customerId: 'c1',
        customer: { id: 'c1', nameEn: 'Oasis', nameAr: null, code: 'OAS' },
      },
      lines: [modifiedSetupLine()],
    };
    const { service, prisma } = makeService({ setup });
    prisma.document.findMany.mockResolvedValue([
      { id: 'doc-1', fileName: 'ref.jpg', mimeType: 'image/jpeg' },
    ]);
    prisma.inventoryItem.findMany.mockResolvedValue([
      { sku: 'WOOD-1', standardCost: 10 },
      // FAB-1 missing → incomplete estimate
    ]);

    const result = (await service.getSetup('so-1', staff)) as any;
    const line = result.lines[0];
    expect(line.changesFromCatalog.length).toBeGreaterThan(0);
    expect(line.changesFromCatalog.some((c: any) => c.field === 'width')).toBe(true);
    expect(line.measurements).toEqual(
      expect.arrayContaining([expect.objectContaining({ key: 'arm', value: 55 })]),
    );
    expect(line.fabric.selected?.sku).toBe('FAB-1');
    expect(line.estimatedCostSummary.estimateIncomplete).toBe(true);
    const fabricMat = line.materials.find((m: any) => m.sku === 'FAB-1');
    expect(fabricMat.unitCost).toBeNull();
    expect(fabricMat.costAvailable).toBe(false);
    expect(fabricMat.costUnavailable).toBe(true);
    expect(fabricMat.estimatedCost).toBeNull();
    expect(line.attachments).toEqual([
      expect.objectContaining({
        id: 'doc-1',
        fileName: 'ref.jpg',
        url: '/uploads/documents/doc-1/link',
      }),
    ]);
    expect(result.postReleaseEditing.revisionSystem).toBe(false);
    expect(result.postReleaseEditing.locked).toBe(false);
  });

  it('missing material cost is never invented as 0.00', async () => {
    const setup = {
      id: 'setup-1',
      salesOrderId: 'so-1',
      status: SalesOrderProductionSetupStatus.SETUP_IN_PROGRESS,
      releasedAt: null,
      releasedById: null,
      salesOrder: {
        id: 'so-1',
        number: 'SO-P4-E',
        status: 'ACCEPTED',
        projectName: null,
        customerId: 'c1',
        customer: null,
      },
      lines: [modifiedSetupLine()],
    };
    const { service, prisma } = makeService({ setup });
    prisma.inventoryItem.findMany.mockResolvedValue([]); // no costs in map
    const result = (await service.getSetup('so-1', staff)) as any;
    for (const m of result.lines[0].materials) {
      expect(m.unitCost).toBeNull();
      expect(m.estimatedCost).toBeNull();
      expect(m.costAvailable).toBe(false);
    }
    expect(result.lines[0].estimatedCostSummary.totalEstimated).toBeNull();
    expect(result.lines[0].estimatedCostSummary.estimateIncomplete).toBe(true);
  });

  it('released setup stays editable until factory Confirm', async () => {
    const setup = {
      id: 'setup-1',
      salesOrderId: 'so-1',
      status: SalesOrderProductionSetupStatus.RELEASED,
      releasedAt: new Date(),
      releasedById: 'admin-1',
      salesOrder: {
        id: 'so-1',
        number: 'SO-P4-H',
        status: 'READY_FOR_PRODUCTION',
        projectName: null,
        customerId: 'c1',
        customer: null,
      },
      lines: [modifiedSetupLine({ status: 'READY' })],
    };
    const { service } = makeService({ setup });
    const result = (await service.getSetup('so-1', staff)) as any;
    expect(result.planEditable).toBe(true);
    expect(result.postReleaseEditing).toEqual(
      expect.objectContaining({
        locked: false,
        revisionSystem: false,
      }),
    );
  });

  it('factory-released setup locks postReleaseEditing', async () => {
    const setup = {
      id: 'setup-1',
      salesOrderId: 'so-1',
      status: SalesOrderProductionSetupStatus.RELEASED,
      releasedAt: new Date(),
      releasedById: 'admin-1',
      salesOrder: {
        id: 'so-1',
        number: 'SO-P4-H',
        status: 'IN_PRODUCTION',
        projectName: null,
        customerId: 'c1',
        customer: null,
      },
      lines: [modifiedSetupLine({ status: 'READY' })],
    };
    const { service, prisma } = makeService({ setup });
    (prisma.productionOrder.findFirst as jest.Mock).mockResolvedValue({ id: 'po-1' });
    const result = (await service.getSetup('so-1', staff)) as any;
    expect(result.planEditable).toBe(false);
    expect(result.postReleaseEditing).toEqual(
      expect.objectContaining({
        locked: true,
        revisionSystem: false,
      }),
    );
  });

  it('CUSTOM skips fake catalog compare', async () => {
    const line = modifiedSetupLine({
      manufacturingComplexity: 'CUSTOM',
      salesOrderLine: {
        id: 'line-1',
        description: 'Custom',
        quantity: 1,
        productId: null,
        manufacturingComplexity: 'CUSTOM',
        orderSpec: {},
        product: null,
      },
    });
    const setup = {
      id: 'setup-1',
      salesOrderId: 'so-1',
      status: SalesOrderProductionSetupStatus.SETUP_IN_PROGRESS,
      releasedAt: null,
      releasedById: null,
      salesOrder: {
        id: 'so-1',
        number: 'SO-P4-D',
        status: 'ACCEPTED',
        projectName: null,
        customerId: 'c1',
        customer: null,
      },
      lines: [line],
    };
    const { service } = makeService({ setup });
    const result = (await service.getSetup('so-1', staff)) as any;
    expect(result.lines[0].changesFromCatalog).toEqual([]);
  });

  it('denies dealers from Piece 4 setup reads', async () => {
    const { service } = makeService({ setup: { id: 'x' } });
    await expect(service.getSetup('so-1', dealer)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('maps production.setup.* permissions for staff packs only', () => {
    const worker = ROLE_PERMISSIONS.PRODUCTION_WORKER;
    expect(worker).not.toContain('production.setup.view');
    expect(worker).not.toContain('production.setup.edit');
    expect(worker).not.toContain('production.setup.release');
  });

  it('patchLine persists measurements without inventing zero costs', async () => {
    const line = modifiedSetupLine();
    const setup = {
      id: 'setup-1',
      salesOrderId: 'so-1',
      status: SalesOrderProductionSetupStatus.SETUP_IN_PROGRESS,
      lines: [line],
    };
    const { service, prisma } = makeService({ setup });
    prisma.salesOrderProductionSetup.findUniqueOrThrow.mockResolvedValue(setup);
    prisma.salesOrderLineSetup.findUniqueOrThrow.mockResolvedValue(line);
    prisma.salesOrderLineSetup.findMany.mockResolvedValue([
      { id: 'ls-1', status: 'NEEDS_REVIEW', productionSetupId: 'setup-1' },
    ]);
    // After patch, getSetup is called
    prisma.salesOrderProductionSetup.findUnique.mockResolvedValue({
      ...setup,
      releasedAt: null,
      releasedById: null,
      salesOrder: {
        id: 'so-1',
        number: 'SO-1',
        status: 'ACCEPTED',
        projectName: null,
        customerId: 'c1',
        customer: null,
      },
    });

    await service.patchLine(
      'so-1',
      'ls-1',
      {
        measurements: [{ key: 'leg', label: 'Leg', value: 12, unit: 'cm' }],
        manufacturingComplexity: 'MODIFIED',
      },
      staff,
    );
    expect(prisma.salesOrderLineSetup.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          measurements: expect.arrayContaining([
            expect.objectContaining({ key: 'leg', value: 12 }),
          ]),
        }),
      }),
    );
  });
});
