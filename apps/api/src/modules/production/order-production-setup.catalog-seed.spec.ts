import { BadRequestException } from '@nestjs/common';
import { ManufacturingComplexity, SalesOrderLineSetupStatus, SalesOrderProductionSetupStatus } from '@maher/database';
import { CATALOG_TEMPLATE_AUDIT_ACTION } from './catalog-seed-preview';
import { OrderProductionSetupService } from './order-production-setup.service';

describe('Phase C catalog seedFromCatalog', () => {
  const staff = { id: 'admin-1', customerId: null } as never;

  const catalogProduct = {
    id: 'p-milano',
    sku: 'SF-MIL-03',
    nameEn: 'Milano Sofa',
    nameAr: null,
    nameHe: null,
    width: 180,
    height: 90,
    depth: 85,
    seatHeight: null,
    bomDefaults: { materials: [] },
    workflowConfiguration: {
      workflowId: 'wf-standard',
      workflow: {
        id: 'wf-standard',
        code: 'STANDARD_FURNITURE',
        nameEn: 'Standard furniture',
        nameAr: null,
        nameHe: null,
        status: 'ACTIVE',
        activeVersion: {
          id: 'ver-4',
          versionNumber: 4,
          status: 'PUBLISHED',
          nodes: [
            { defaultEstimatedMinutes: 150, stageDefinition: { executionKind: 'PRODUCTION' } },
            { defaultEstimatedMinutes: 60, stageDefinition: { executionKind: 'PRODUCTION' } },
            { defaultEstimatedMinutes: 0, stageDefinition: { executionKind: 'LOGISTICS' } },
          ],
        },
      },
    },
    stageMaterialInputs: [
      {
        inventoryItemId: 'inv-wood',
        qtyPerUnit: 4,
        unit: 'pcs',
        quantityMode: 'LINEAR',
        inventoryItem: {
          id: 'inv-wood',
          sku: 'WOOD-1',
          nameEn: 'Wood',
          category: 'WOOD',
          unit: 'pcs',
        },
      },
      {
        inventoryItemId: 'inv-foam',
        qtyPerUnit: 2,
        unit: 'pcs',
        quantityMode: 'FIXED',
        inventoryItem: {
          id: 'inv-foam',
          sku: 'FOAM-1',
          nameEn: 'Foam',
          category: 'FOAM',
          unit: 'pcs',
        },
      },
      {
        inventoryItemId: 'inv-fabric',
        qtyPerUnit: 6,
        unit: 'm',
        quantityMode: 'LINEAR',
        inventoryItem: {
          id: 'inv-fabric',
          sku: 'FAB-CAT',
          nameEn: 'Catalog fabric',
          category: 'FABRIC',
          unit: 'm',
        },
      },
    ],
    stageInventoryOutputs: [
      {
        expectedPieceCount: 1,
        pieceLabels: [],
        inventoryTracking: 'PRODUCES_SEMI_FINISHED',
      },
      {
        expectedPieceCount: 2,
        pieceLabels: [{ nameEn: 'Seat' }, { nameEn: 'Back' }],
        inventoryTracking: 'PRODUCES_SEMI_FINISHED',
      },
      {
        expectedPieceCount: 1,
        pieceLabels: [{ nameEn: 'Sofa' }],
        inventoryTracking: 'PRODUCES_FINISHED',
      },
    ],
  };

  function soLine(overrides: Record<string, unknown> = {}) {
    return {
      id: 'line-milano',
      description: 'Milano Sofa',
      quantity: 3,
      productId: 'p-milano',
      manufacturingComplexity: ManufacturingComplexity.STANDARD,
      orderSpec: { fabric: { type: 'Velvet', color: 'Beige' } },
      product: catalogProduct,
      ...overrides,
    };
  }

  function lineSetup(overrides: Record<string, unknown> = {}) {
    return {
      id: 'ls-milano',
      salesOrderLineId: 'line-milano',
      manufacturingName: 'Milano Sofa',
      manufacturingComplexity: ManufacturingComplexity.STANDARD,
      workflowId: 'wf-standard',
      workflowConfirmedAt: new Date(),
      requestedFabricLabel: 'Velvet · Beige',
      referenceDocumentIds: [],
      orderDimensions: { width: 180 },
      measurements: null,
      materialRequirements: [],
      workflow: {
        id: 'wf-standard',
        code: 'STANDARD_FURNITURE',
        nameEn: 'Standard furniture',
        nameAr: null,
        nameHe: null,
      },
      ...overrides,
    };
  }

  function makeService(opts: {
    setupLines?: unknown[];
    soLine?: unknown;
    pos?: unknown[];
    lockedPo?: unknown;
    snapshot?: unknown;
    siblingLine?: unknown;
  } = {}) {
    const line = lineSetup();
    const sibling =
      opts.siblingLine ??
      lineSetup({
        id: 'ls-luna',
        salesOrderLineId: 'line-luna',
        manufacturingName: 'Luna Chair',
        materialRequirements: [{ id: 'mr-luna' }],
      });
    const setup = {
      id: 'setup-1',
      salesOrderId: 'so-1',
      status: SalesOrderProductionSetupStatus.SETUP_IN_PROGRESS,
      lines: opts.setupLines ?? [line, sibling],
    };
    const productLine = opts.soLine ?? soLine();
    const pos = opts.pos ?? [
      {
        id: 'po-milano',
        status: 'PLANNED',
        releasedToFactoryAt: null,
        actualStartDate: null,
        workflowSnapshot: {
          sourceWorkflowId: 'wf-standard',
          sourceVersionNumber: 4,
          sourceWorkflow: {
            id: 'wf-standard',
            code: 'STANDARD_FURNITURE',
            nameEn: 'Standard furniture',
            nameAr: null,
            nameHe: null,
          },
        },
        tasks: [
          {
            id: 'task-1',
            assignedEmployeeId: null,
            plannedStart: null,
            plannedCompletion: null,
          },
        ],
      },
    ];

    const prisma: any = {
      salesOrderProductionSetup: {
        findUnique: jest.fn().mockResolvedValue(setup),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          ...setup,
          lines: (opts.setupLines ?? [line, sibling]).map((row: any) => ({
            ...row,
            salesOrderLine: {
              id: row.salesOrderLineId,
              description: row.manufacturingName,
              manufacturingComplexity: row.manufacturingComplexity,
              product: {
                id: catalogProduct.id,
                nameEn: catalogProduct.nameEn,
                workflowConfiguration: { workflowId: 'wf-standard' },
              },
            },
          })),
        }),
        update: jest.fn(),
      },
      salesOrderLine: {
        findUnique: jest.fn().mockImplementation(async ({ where }: { where: { id: string } }) => {
          if (where.id === 'line-luna') {
            return {
              id: 'line-luna',
              description: 'Luna Chair',
              quantity: 4,
              productId: 'p-luna',
              manufacturingComplexity: ManufacturingComplexity.STANDARD,
              orderSpec: {},
              product: { ...catalogProduct, id: 'p-luna', sku: 'CH-LUN-01', nameEn: 'Luna Chair' },
            };
          }
          return productLine;
        }),
      },
      salesOrderLineSetup: {
        findUnique: jest.fn().mockResolvedValue(line),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          ...line,
          materialRequirements: [],
        }),
        findMany: jest.fn().mockImplementation(async () =>
          (opts.setupLines ?? [line, sibling]).map((row: any) => ({
            workflowId: row.workflowId ?? null,
          })),
        ),
        update: jest.fn(),
        updateMany: jest.fn(),
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
      productStageMaterialInput: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      productionOrder: {
        findMany: jest.fn().mockResolvedValue(pos),
        findFirst: jest.fn().mockResolvedValue(opts.lockedPo ?? null),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      productionOrderWorkflowSnapshot: {
        findUnique: jest.fn().mockResolvedValue(opts.snapshot ?? null),
      },
      productionOrderWorkflowSnapshotNode: {
        count: jest.fn().mockResolvedValue(7),
      },
      productionOrderWorkflowSnapshotMaterialInput: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      productionTask: {
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      salesOrder: { update: jest.fn() },
      inventoryTransaction: { findMany: jest.fn().mockResolvedValue([]) },
      inventoryBalance: { findFirst: jest.fn() },
      auditEvent: { create: jest.fn() },
      $transaction: jest.fn(async (fn: any) => fn(prisma)),
    };

    const workflowSnapshots = {
      createSnapshotForProductionOrder: jest.fn(),
      assignWorkflowToProductionOrder: jest.fn(),
    };
    const inventory = {
      tryReserveForSalesOrder: jest.fn(),
    };
    const notifications = { notifyCustomerUsers: jest.fn() };
    const sequences = { next: jest.fn() };

    const service = new OrderProductionSetupService(
      prisma,
      sequences as never,
      workflowSnapshots as never,
      inventory as never,
      notifications as never,
    );
    jest.spyOn(service, 'getSetup').mockResolvedValue({ id: 'setup-1' } as never);
    return { service, prisma, workflowSnapshots, inventory, setup, line };
  }

  function responseOf(err: unknown) {
    return (err as BadRequestException).getResponse() as { code?: string };
  }

  it('preview is available for Standard + productId + usable template', async () => {
    const { service } = makeService();
    const preview = await service.previewSeedFromCatalog('so-1', 'line-milano', staff);
    expect(preview.actionAvailable).toBe(true);
    expect(preview.hasUsableDefinition).toBe(true);
    expect(preview.manufacturingComplexity).toBe('STANDARD');
    expect(preview.productPlan.materials).toBe(3);
    expect(preview.productPlan.stages).toBe(3);
    expect(preview.productPlan.tasks).toBe(2);
    expect(preview.productPlan.semiWip).toBe(2);
    expect(preview.materials.find((m) => m.sku === 'WOOD-1')?.expectedQty).toBe(4);
    expect(preview.materials.find((m) => m.sku === 'WOOD-1')?.quantityMode).toBe('LINEAR');
    expect(preview.materials.find((m) => m.sku === 'FOAM-1')?.quantityMode).toBe('FIXED');
  });

  it('preview hides the action when there is no usable catalog definition', async () => {
    const { service } = makeService({
      soLine: soLine({
        product: {
          ...catalogProduct,
          workflowConfiguration: { workflowId: null, workflow: null },
          stageMaterialInputs: [],
          stageInventoryOutputs: [],
          bomDefaults: { materials: [] },
        },
      }),
    });
    const preview = await service.previewSeedFromCatalog('so-1', 'line-milano', staff);
    expect(preview.actionAvailable).toBe(false);
    expect(preview.hasUsableDefinition).toBe(false);
    expect(preview.unavailableReason).toBe('no_definition');
  });

  it('fabric/color does not change action availability', async () => {
    const { service } = makeService();
    const preview = await service.previewSeedFromCatalog('so-1', 'line-milano', staff);
    expect(preview.requestedFabricLabel).toContain('Velvet');
    expect(preview.actionAvailable).toBe(true);
  });

  it('preview performs zero writes and writes no audit', async () => {
    const { service, prisma } = makeService();
    await service.previewSeedFromCatalog('so-1', 'line-milano', staff);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.auditEvent.create).not.toHaveBeenCalled();
    expect(prisma.salesOrderLineSetup.update).not.toHaveBeenCalled();
    expect(prisma.salesOrderLineMaterialRequirement.deleteMany).not.toHaveBeenCalled();
  });

  it('apply uses canonical seed writes and copies catalog qty without naive order-qty multiply', async () => {
    const { service, prisma, inventory, workflowSnapshots } = makeService();
    await service.seedFromCatalog('so-1', 'line-milano', staff);
    expect(prisma.$transaction).toHaveBeenCalled();
    const update = prisma.salesOrderLineSetup.update.mock.calls.find((c: any[]) =>
      c[0]?.data?.materialRequirements,
    );
    const created = update[0].data.materialRequirements.create as Array<{
      sku?: string;
      expectedQty: { toNumber?: () => number } | number;
    }>;
    const wood = created.find((m) => m.sku === 'WOOD-1');
    expect(Number(wood?.expectedQty)).toBe(4);
    expect(Number(wood?.expectedQty)).not.toBe(12);
    const foam = created.find((m) => m.sku === 'FOAM-1');
    expect(Number(foam?.expectedQty)).toBe(2);
    expect(update[0].data.manufacturingComplexity).toBe(ManufacturingComplexity.STANDARD);
    expect(inventory.tryReserveForSalesOrder).not.toHaveBeenCalled();
    expect(workflowSnapshots.assignWorkflowToProductionOrder).not.toHaveBeenCalled();
    expect(prisma.productionTask.update).not.toHaveBeenCalled();
    expect(prisma.productionTask.updateMany).not.toHaveBeenCalled();
    expect(prisma.salesOrder.update).not.toHaveBeenCalled();
    expect(prisma.productionOrder.update).not.toHaveBeenCalled();
    expect(prisma.auditEvent.create).toHaveBeenCalledTimes(1);
    expect(prisma.auditEvent.create.mock.calls[0][0].data.action).toBe(
      CATALOG_TEMPLATE_AUDIT_ACTION,
    );
    expect(prisma.auditEvent.create.mock.calls[0][0].data.newValues.workflowChanged).toBe(false);
  });

  it('same-workflow apply does not rebuild assignments or dates', async () => {
    const { service, workflowSnapshots, prisma } = makeService();
    await service.seedFromCatalog('so-1', 'line-milano', staff);
    expect(workflowSnapshots.assignWorkflowToProductionOrder).not.toHaveBeenCalled();
    expect(prisma.productionTask.update).not.toHaveBeenCalled();
  });

  it('workflow change without second confirmation performs zero writes', async () => {
    const { service, prisma, workflowSnapshots } = makeService({
      pos: [
        {
          id: 'po-milano',
          status: 'PLANNED',
          releasedToFactoryAt: null,
          actualStartDate: null,
          workflowSnapshot: {
            sourceWorkflowId: 'wf-custom',
            sourceVersionNumber: 2,
            sourceWorkflow: {
              id: 'wf-custom',
              code: 'CUSTOM_SOFA',
              nameEn: 'Custom sofa',
              nameAr: null,
              nameHe: null,
            },
          },
          tasks: [{ id: 'task-1', assignedEmployeeId: 'emp-1' }],
        },
      ],
    });
    await expect(service.seedFromCatalog('so-1', 'line-milano', staff)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    try {
      await service.seedFromCatalog('so-1', 'line-milano', staff);
    } catch (err) {
      expect(responseOf(err).code).toBe('WORKFLOW_CHANGE_REQUIRED');
    }
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.auditEvent.create).not.toHaveBeenCalled();
    expect(workflowSnapshots.assignWorkflowToProductionOrder).not.toHaveBeenCalled();
  });

  it('workflow change with confirmation assigns the catalog workflow on that line only', async () => {
    const { service, workflowSnapshots } = makeService({
      pos: [
        {
          id: 'po-milano',
          status: 'PLANNED',
          releasedToFactoryAt: null,
          actualStartDate: null,
          workflowSnapshot: {
            sourceWorkflowId: 'wf-custom',
            sourceVersionNumber: 2,
            sourceWorkflow: {
              id: 'wf-custom',
              code: 'CUSTOM_SOFA',
              nameEn: 'Custom sofa',
              nameAr: null,
              nameHe: null,
            },
          },
          tasks: [{ id: 'task-1' }],
        },
      ],
    });
    await service.seedFromCatalog('so-1', 'line-milano', staff, {
      confirmWorkflowChange: true,
    });
    expect(workflowSnapshots.assignWorkflowToProductionOrder).toHaveBeenCalledWith(
      'po-milano',
      'wf-standard',
      'admin-1',
    );
  });

  it('released production order blocks apply with SETUP_LOCKED', async () => {
    const { service, prisma } = makeService({
      pos: [
        {
          id: 'po-milano',
          status: 'PLANNED',
          releasedToFactoryAt: new Date(),
          actualStartDate: null,
          workflowSnapshot: null,
          tasks: [],
        },
      ],
    });
    try {
      await service.seedFromCatalog('so-1', 'line-milano', staff);
      throw new Error('expected lock');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect(responseOf(err).code).toBe('SETUP_LOCKED');
    }
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.auditEvent.create).not.toHaveBeenCalled();
  });

  it('started production order blocks apply with SETUP_LOCKED', async () => {
    const { service, prisma } = makeService({
      pos: [
        {
          id: 'po-milano',
          status: 'IN_PROGRESS',
          releasedToFactoryAt: null,
          actualStartDate: new Date(),
          workflowSnapshot: null,
          tasks: [],
        },
      ],
    });
    try {
      await service.seedFromCatalog('so-1', 'line-milano', staff);
      throw new Error('expected lock');
    } catch (err) {
      expect(responseOf(err).code).toBe('SETUP_LOCKED');
    }
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('applies only the selected sales-order line', async () => {
    const { service, prisma } = makeService();
    await service.seedFromCatalog('so-1', 'line-milano', staff);
    const ids = prisma.salesOrderLineSetup.update.mock.calls.map((c: any[]) => c[0]?.where?.id);
    expect(ids).toContain('ls-milano');
    expect(ids).not.toContain('ls-luna');
    const deleted = prisma.salesOrderLineMaterialRequirement.deleteMany.mock.calls.map(
      (c: any[]) => c[0]?.where?.lineSetupId,
    );
    expect(deleted).toContain('ls-milano');
    expect(deleted).not.toContain('ls-luna');
  });

  it('does not auto-seed STANDARD lines when opening the production plan', async () => {
    const { service, prisma } = makeService({
      setupLines: [lineSetup({ materialRequirements: [] })],
    });
    const seedSpy = jest.spyOn(service, 'seedFromCatalog');
    prisma.salesOrderLineSetup.findUniqueOrThrow.mockResolvedValue({
      manufacturingName: 'Milano Sofa',
      workflowId: 'wf-standard',
      workflowConfirmedAt: new Date(),
    });
    await (service as any).softPrepareLinesForPlan('so-1', staff);
    expect(seedSpy).not.toHaveBeenCalled();
  });

  it('preview is available for Modified + productId + usable template', async () => {
    const { service } = makeService({
      soLine: soLine({ manufacturingComplexity: ManufacturingComplexity.MODIFIED }),
      setupLines: [
        lineSetup({ manufacturingComplexity: ManufacturingComplexity.MODIFIED }),
      ],
    });
    const preview = await service.previewSeedFromCatalog('so-1', 'line-milano', staff);
    expect(preview.actionAvailable).toBe(true);
    expect(preview.manufacturingComplexity).toBe('MODIFIED');
  });

  it('rejects CUSTOM lines even when a productId is attached', async () => {
    const { service, prisma } = makeService({
      soLine: soLine({ manufacturingComplexity: ManufacturingComplexity.CUSTOM }),
      setupLines: [
        lineSetup({ manufacturingComplexity: ManufacturingComplexity.CUSTOM }),
      ],
    });
    try {
      await service.seedFromCatalog('so-1', 'line-milano', staff);
      throw new Error('expected reject');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect(responseOf(err).code).toBe('CUSTOM_NO_TEMPLATE');
    }
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.auditEvent.create).not.toHaveBeenCalled();
  });

  it('rejects seed when productId is null', async () => {
    const { service, prisma } = makeService({
      soLine: soLine({
        productId: null,
        product: null,
        manufacturingComplexity: ManufacturingComplexity.CUSTOM,
      }),
    });
    try {
      await service.seedFromCatalog('so-1', 'line-milano', staff);
      throw new Error('expected reject');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect(responseOf(err).code).toBe('CUSTOM_NO_TEMPLATE');
    }
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('Modified apply keeps complexity and order dimensions as a baseline', async () => {
    const { service, prisma } = makeService({
      soLine: soLine({ manufacturingComplexity: ManufacturingComplexity.MODIFIED }),
      setupLines: [
        lineSetup({
          manufacturingComplexity: ManufacturingComplexity.MODIFIED,
          orderDimensions: { width: 240, height: 90 },
          measurements: [{ key: 'arm', label: 'Arm', value: 70, catalogValue: 60 }],
        }),
      ],
    });
    await service.seedFromCatalog('so-1', 'line-milano', staff);
    const update = prisma.salesOrderLineSetup.update.mock.calls.find((c: any[]) =>
      c[0]?.data?.materialRequirements,
    );
    expect(update[0].data.manufacturingComplexity).toBe(ManufacturingComplexity.MODIFIED);
    expect(update[0].data.orderDimensions).toEqual({ width: 240, height: 90 });
    expect(update[0].data.materialsReviewedAt).toBeNull();
    expect(update[0].data.status).toBe(SalesOrderLineSetupStatus.NEEDS_REVIEW);
  });

  it('preview product select uses defaultEstimatedMinutes, never estimatedMinutes', async () => {
    const { service, prisma } = makeService();
    await service.previewSeedFromCatalog('so-1', 'line-milano', staff);
    const call = prisma.salesOrderLine.findUnique.mock.calls[0]?.[0];
    const nodeSelect =
      call?.include?.product?.select?.workflowConfiguration?.select?.workflow?.select
        ?.activeVersion?.select?.nodes?.select;
    expect(nodeSelect.defaultEstimatedMinutes).toBe(true);
    expect(nodeSelect.estimatedMinutes).toBeUndefined();
  });

  it('opens Custom plan prep without a product workflow', async () => {
    const { service, prisma } = makeService({
      soLine: soLine({
        productId: null,
        product: null,
        manufacturingComplexity: ManufacturingComplexity.CUSTOM,
      }),
      setupLines: [
        lineSetup({
          manufacturingComplexity: ManufacturingComplexity.CUSTOM,
          workflowId: null,
          workflow: null,
          materialRequirements: [],
        }),
      ],
    });
    prisma.salesOrderProductionSetup.findUniqueOrThrow.mockResolvedValue({
      id: 'setup-1',
      salesOrderId: 'so-1',
      status: SalesOrderProductionSetupStatus.SETUP_IN_PROGRESS,
      lines: [
        {
          id: 'ls-milano',
          salesOrderLineId: 'line-milano',
          manufacturingComplexity: ManufacturingComplexity.CUSTOM,
          manufacturingName: null,
          workflowId: null,
          materialRequirements: [],
          salesOrderLine: {
            id: 'line-milano',
            description: 'Custom sofa',
            manufacturingComplexity: ManufacturingComplexity.CUSTOM,
            product: null,
          },
        },
      ],
    });
    prisma.salesOrderLineSetup.findUniqueOrThrow.mockResolvedValue({
      manufacturingName: null,
      workflowId: null,
      workflowConfirmedAt: null,
    });
    const seedSpy = jest.spyOn(service, 'seedFromCatalog');
    await expect((service as any).softPrepareLinesForPlan('so-1', staff)).resolves.toBeUndefined();
    expect(seedSpy).not.toHaveBeenCalled();
    const update = prisma.salesOrderLineSetup.update.mock.calls[0][0];
    expect(update.data.manufacturingName).toBe('Custom sofa');
    expect(update.data.workflowId).toBeUndefined();
    expect(update.data.status).toBe(SalesOrderLineSetupStatus.NEEDS_REVIEW);
    expect(prisma.salesOrderProductionSetup.update).not.toHaveBeenCalled();
  });

  it('plan-open validation allows Custom without workflow or materials', () => {
    const { service } = makeService();
    const result = (service as any).validateSetup(
      {
        status: SalesOrderProductionSetupStatus.SETUP_IN_PROGRESS,
        lines: [
          {
            salesOrderLineId: 'line-custom',
            status: SalesOrderLineSetupStatus.NEEDS_REVIEW,
            manufacturingName: 'Custom sofa',
            workflowId: null,
            workflowConfirmedAt: null,
            manufacturingComplexity: ManufacturingComplexity.CUSTOM,
            materialRequirements: [],
          },
        ],
      },
      {
        requireMaterials: false,
        requireWorkflow: false,
        requireLinesReady: false,
      },
    );
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
  });
});
