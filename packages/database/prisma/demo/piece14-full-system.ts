/**
 * Piece 14 full-system walkthrough seeds (SO/PO/QT/RFQ-P14-GOLDEN + SO/PO/QT-P14-MOD).
 * Not pre-completed: setup RELEASED, PO READY, first task READY — no FIN lots / deliveries.
 * Mirrors piece8/10 wipe+PO build; materials/setup style from piece2/4.
 */
import {
  CommercialPriceStatus,
  InventoryCategory,
  InventoryTracking,
  ManufacturingComplexity,
  PrismaClient,
  ProductionOrderStatus,
  QuotationStatus,
  RequestSource,
  RequestStatus,
  SalesOrderLineSetupStatus,
  SalesOrderMaterialRequirementSource,
  SalesOrderProductionSetupStatus,
  SalesOrderStatus,
  StageInstanceStatus,
  TaskStatus,
} from '@prisma/client';
import { VAT, lineTotals, money } from '../seed/util';
import { addDays, demoAsOf } from './clock';
import {
  loadProductInventoryOutputs,
  resolveDemoSnapshotInventory,
} from './inventory-lifecycle';

type DealerRef = { id: string; code: string; name?: string; nameEn?: string; username?: string };
type ProductRef = {
  id: string;
  sku: string;
  nameEn: string;
  basePrice: unknown;
  width?: unknown;
  height?: unknown;
  depth?: unknown;
};
type WorkerRef = { id: string; username?: string };

function isExecutableStage(code: string, executionKind: string): boolean {
  if (String(executionKind).toUpperCase() === 'LOGISTICS') return false;
  if (String(code).toUpperCase() === 'DELIVERY') return false;
  return true;
}

function inventoryFlagsForStage(stageCode: string): {
  inventoryTracking: InventoryTracking;
  consumesSemiFinished: boolean;
} {
  const code = stageCode.toUpperCase();
  if (code === 'CARPENTRY' || code === 'FOAM') {
    return {
      inventoryTracking: InventoryTracking.PRODUCES_SEMI_FINISHED,
      consumesSemiFinished: false,
    };
  }
  if (code === 'ASSEMBLY' || code === 'UPHOLSTERY' || code === 'PACKAGING') {
    return {
      inventoryTracking:
        code === 'PACKAGING' ? InventoryTracking.PRODUCES_FINISHED : InventoryTracking.NONE,
      consumesSemiFinished: true,
    };
  }
  return { inventoryTracking: InventoryTracking.NONE, consumesSemiFinished: false };
}

export async function seedPiece14FullSystemExamples(
  prisma: PrismaClient,
  opts: {
    dealers: DealerRef[];
    products: ProductRef[];
    adminUserId: string;
    workerIds?: string[];
    workers?: WorkerRef[];
  },
) {
  const oasis =
    opts.dealers.find((d) => d.username === 'oasis' || /oasis/i.test(d.nameEn ?? d.name ?? '')) ??
    opts.dealers[1] ??
    opts.dealers[0];
  if (!oasis || !opts.products[0]) {
    console.log('  Piece 14 skipped — missing oasis dealer or products.');
    return;
  }

  async function workflowIdForProduct(productId: string): Promise<string | null> {
    const cfg = await prisma.productWorkflowConfiguration.findUnique({
      where: { productId },
      select: { workflowId: true },
    });
    return cfg?.workflowId ?? null;
  }

  async function loadWorkflowNodes(workflowId: string) {
    const wf = await prisma.productionWorkflow.findUnique({
      where: { id: workflowId },
      select: {
        activeVersion: {
          select: {
            id: true,
            versionNumber: true,
            nodes: {
              orderBy: { sortOrder: 'asc' as const },
              select: {
                id: true,
                nodeKey: true,
                sortOrder: true,
                stageDefinitionId: true,
                stageDefinition: {
                  select: {
                    code: true,
                    nameEn: true,
                    nameAr: true,
                    nameHe: true,
                    executionKind: true,
                  },
                },
              },
            },
            edges: { select: { fromNodeId: true, toNodeId: true } },
          },
        },
      },
    });
    const version = wf?.activeVersion;
    if (!version) return null;
    return {
      versionId: version.id,
      versionNumber: version.versionNumber,
      nodes: version.nodes.map((n) => ({
        id: n.id,
        nodeKey: n.nodeKey,
        sortOrder: n.sortOrder,
        stageDefinitionId: n.stageDefinitionId,
        stageCode: n.stageDefinition.code,
        nameEn: n.stageDefinition.nameEn || n.stageDefinition.code,
        nameAr: n.stageDefinition.nameAr || n.stageDefinition.code,
        nameHe: n.stageDefinition.nameHe ?? null,
        executionKind: n.stageDefinition.executionKind,
      })),
      edges: version.edges,
    };
  }

  let product =
    opts.products.find((p) => /sofa|milano|loveseat|sectional/i.test(`${p.nameEn} ${p.sku}`)) ??
    opts.products[0]!;
  let defaultWorkflowId = await workflowIdForProduct(product.id);
  for (const p of opts.products) {
    const wfId = await workflowIdForProduct(p.id);
    if (!wfId) continue;
    if (/sofa|milano|loveseat|sectional/i.test(`${p.nameEn} ${p.sku}`)) {
      product = p;
      defaultWorkflowId = wfId;
      break;
    }
    if (!defaultWorkflowId) {
      product = p;
      defaultWorkflowId = wfId;
    }
  }
  if (!defaultWorkflowId) {
    console.log('  Piece 14 skipped — no product with active workflow.');
    return;
  }

  const catalogW = product.width != null ? Number(product.width) : 180;
  const catalogH = product.height != null ? Number(product.height) : 90;
  const catalogD = product.depth != null ? Number(product.depth) : 85;
  const unitPriceNum = Number(product.basePrice) || 2500;
  const asOf = demoAsOf();
  const sentAt = new Date();
  const acceptedAt = new Date();
  const byUsername = new Map(
    (opts.workers ?? [])
      .filter((w): w is WorkerRef & { username: string } => Boolean(w.username))
      .map((w) => [w.username.toLowerCase(), w.id]),
  );
  const carpenterId = byUsername.get('carpenter') ?? opts.workerIds?.[0] ?? opts.adminUserId;

  const inventoryItems = await prisma.inventoryItem.findMany({
    where: { archivedAt: null, isActive: true, itemClass: 'RAW_MATERIAL' },
    take: 40,
    orderBy: { sku: 'asc' },
  });
  const pick = (cat: string, re?: RegExp) =>
    inventoryItems.find((i) => i.category === cat) ??
    (re ? inventoryItems.find((i) => re.test(i.sku + i.nameEn)) : undefined) ??
    null;
  const fabricItem = pick('FABRIC') ?? inventoryItems[0] ?? null;
  const woodItem = pick('WOOD') ?? inventoryItems[1] ?? null;
  const foamItem = pick('FOAM', /foam|sponge/i);
  const hardwareItem = pick('METAL_ACCESSORY', /hw|hardware|spring|mech/i);

  const stageMaterials = await prisma.productStageMaterialInput.findMany({
    where: { productId: product.id },
    include: {
      inventoryItem: {
        select: { id: true, sku: true, nameEn: true, category: true, unit: true },
      },
    },
    take: 20,
  });
  const packagingOutputs = await prisma.productStageInventoryOutput.findMany({
    where: { productId: product.id },
    select: { expectedPieceCount: true, pieceLabels: true, inventoryTracking: true },
  });
  const finished =
    packagingOutputs.find((o) => o.inventoryTracking === 'PRODUCES_FINISHED') ??
    packagingOutputs[0];
  const packagingExpectation = {
    pieceLabels: Array.isArray(finished?.pieceLabels) ? finished!.pieceLabels : [],
    expectedPieceCount: finished?.expectedPieceCount ?? 1,
  };
  const finWh = await prisma.warehouse.findFirst({
    where: { type: 'FINISHED_GOODS', isActive: true },
    orderBy: [{ isDefault: 'desc' }, { code: 'asc' }],
  });
  const semiWh = await prisma.warehouse.findFirst({
    where: { type: 'SEMI_FINISHED', isActive: true },
    orderBy: [{ isDefault: 'desc' }, { code: 'asc' }],
  });

  function catalogMaterialCreates() {
    if (stageMaterials.length) {
      const byItem = new Map<string, (typeof stageMaterials)[number]>();
      for (const row of stageMaterials) {
        if (!byItem.has(row.inventoryItemId)) byItem.set(row.inventoryItemId, row);
      }
      return [...byItem.values()].map((row, idx) => ({
        inventoryItemId: row.inventoryItemId,
        sku: row.inventoryItem.sku,
        displayName: row.inventoryItem.nameEn,
        category: row.inventoryItem.category,
        unit: row.unit || row.inventoryItem.unit || 'pcs',
        expectedQty: Number(row.qtyPerUnit) || 1,
        source: SalesOrderMaterialRequirementSource.CATALOG,
        needsReview: false,
        sortOrder: idx,
      }));
    }
    return [fabricItem, woodItem, foamItem, hardwareItem].filter(Boolean).map((item, idx) => ({
      inventoryItemId: item!.id,
      sku: item!.sku,
      displayName: item!.nameEn,
      category: item!.category,
      unit: item!.unit || 'pcs',
      expectedQty: item!.category === 'FABRIC' ? 14 : item!.category === 'WOOD' ? 12 : 2,
      source: SalesOrderMaterialRequirementSource.CATALOG,
      needsReview: false,
      sortOrder: idx,
    }));
  }

  function modifiedMaterialCreates() {
    return [
      woodItem && {
        inventoryItemId: woodItem.id,
        sku: woodItem.sku,
        displayName: woodItem.nameEn,
        category: woodItem.category,
        unit: woodItem.unit || 'pcs',
        expectedQty: 10,
        source: SalesOrderMaterialRequirementSource.FACTORY_MODIFIED,
        needsReview: false,
        notes: 'P14-MOD order-specific wood (BOM untouched)',
        sortOrder: 0,
      },
      fabricItem && {
        inventoryItemId: fabricItem.id,
        sku: fabricItem.sku,
        displayName: fabricItem.nameEn,
        category: fabricItem.category,
        unit: fabricItem.unit || 'm',
        expectedQty: 18,
        source: SalesOrderMaterialRequirementSource.FACTORY_MODIFIED,
        needsReview: true,
        requestedFabricLabel: 'Bouclé Ivory — P14-MOD',
        notes: 'P14-MOD order fabric override',
        sortOrder: 1,
      },
      foamItem && {
        inventoryItemId: foamItem.id,
        sku: foamItem.sku,
        displayName: foamItem.nameEn,
        category: foamItem.category,
        unit: foamItem.unit || 'pcs',
        expectedQty: 3,
        source: SalesOrderMaterialRequirementSource.CUSTOM,
        needsReview: false,
        notes: 'P14-MOD sponge/foam for wider frame',
        sortOrder: 2,
      },
      {
        sku: 'P14-MOD-HW',
        displayName: 'P14-MOD custom hardware kit',
        category: InventoryCategory.METAL_ACCESSORY,
        unit: 'pcs',
        expectedQty: 1,
        source: SalesOrderMaterialRequirementSource.CUSTOM,
        needsReview: false,
        notes: 'Manual hardware — order-only',
        sortOrder: 3,
      },
    ].filter(Boolean) as Array<Record<string, unknown>>;
  }

  /** Wipe SO/PO/QT/RFQ/DLV for GOLDEN|MOD — same cascade style as piece10 wipeBundle. */
  async function wipeBundle(tag: string) {
    const poNumber = `PO-P14-${tag}`;
    const soNumber = `SO-P14-${tag}`;
    const dlvNumber = `DLV-P14-${tag}`;

    const delivery = await prisma.delivery.findUnique({
      where: { number: dlvNumber },
      select: { id: true },
    });
    if (delivery) {
      await prisma.deliveryLoadPiece.deleteMany({ where: { deliveryId: delivery.id } });
      await prisma.inventoryTransaction.deleteMany({
        where: { referenceType: 'Delivery', referenceId: delivery.id },
      });
      await prisma.deliveryItem.deleteMany({ where: { deliveryId: delivery.id } });
      await prisma.delivery.delete({ where: { id: delivery.id } });
    }

    const po = await prisma.productionOrder.findUnique({
      where: { number: poNumber },
      select: { id: true },
    });
    if (po) {
      const kits = await prisma.wipKit.findMany({
        where: { productionOrderId: po.id },
        select: { id: true },
      });
      const kitIds = kits.map((k) => k.id);
      if (kitIds.length) {
        await prisma.wipHandoff.deleteMany({ where: { kitId: { in: kitIds } } });
        await prisma.wipPiece.deleteMany({ where: { kitId: { in: kitIds } } });
        await prisma.wipKit.deleteMany({ where: { id: { in: kitIds } } });
      }
      await prisma.wipHandoff.deleteMany({ where: { productionOrderId: po.id } });
      await prisma.productionTaskMaterialUsage.deleteMany({ where: { productionOrderId: po.id } });
      const taskIds = (
        await prisma.productionTask.findMany({
          where: { productionOrderId: po.id },
          select: { id: true },
        })
      ).map((t) => t.id);
      if (taskIds.length) {
        await prisma.taskBlocker.deleteMany({ where: { taskId: { in: taskIds } } });
        await prisma.taskTimeEntry.deleteMany({ where: { taskId: { in: taskIds } } });
        await prisma.scheduleAllocation
          .deleteMany({ where: { productionTaskId: { in: taskIds } } })
          .catch(() => undefined);
      }
      await prisma.productionTask.deleteMany({ where: { productionOrderId: po.id } });
      await prisma.reworkRequest.deleteMany({ where: { productionOrderId: po.id } }).catch(() => undefined);
      await prisma.qualityInspectionItem
        .deleteMany({ where: { inspection: { productionOrderId: po.id } } })
        .catch(() => undefined);
      await prisma.qualityDefect
        .deleteMany({ where: { inspection: { productionOrderId: po.id } } })
        .catch(() => undefined);
      await prisma.qualityInspection.deleteMany({ where: { productionOrderId: po.id } }).catch(() => undefined);
      await prisma.inventoryTransaction.deleteMany({
        where: { referenceType: 'ProductionOrder', referenceId: po.id },
      });
      await prisma.inventoryLot.deleteMany({ where: { productionOrderId: po.id } });
      const snap = await prisma.productionOrderWorkflowSnapshot.findUnique({
        where: { productionOrderId: po.id },
        select: { id: true },
      });
      if (snap) {
        await prisma.productionOrderWorkflowSnapshotEdge.deleteMany({ where: { snapshotId: snap.id } });
        await prisma.productionOrderWorkflowSnapshotMaterialInput.deleteMany({
          where: { snapshotNode: { snapshotId: snap.id } },
        });
        await prisma.productionOrderWorkflowSnapshotNode.deleteMany({ where: { snapshotId: snap.id } });
        await prisma.productionOrderWorkflowSnapshot.delete({ where: { id: snap.id } });
      }
      await prisma.productionStageInstance.deleteMany({ where: { productionOrderId: po.id } });
      await prisma.productionOrder.delete({ where: { id: po.id } });
    }

    const so = await prisma.salesOrder.findUnique({
      where: { number: soNumber },
      select: { id: true },
    });
    if (so) {
      for (const d of await prisma.delivery.findMany({
        where: { salesOrderId: so.id },
        select: { id: true },
      })) {
        await prisma.deliveryLoadPiece.deleteMany({ where: { deliveryId: d.id } });
        await prisma.inventoryTransaction.deleteMany({
          where: { referenceType: 'Delivery', referenceId: d.id },
        });
        await prisma.deliveryItem.deleteMany({ where: { deliveryId: d.id } });
        await prisma.delivery.delete({ where: { id: d.id } });
      }
      await prisma.salesOrderLineMaterialRequirement.deleteMany({
        where: { lineSetup: { productionSetup: { salesOrderId: so.id } } },
      });
      await prisma.salesOrderLineSetup.deleteMany({
        where: { productionSetup: { salesOrderId: so.id } },
      });
      await prisma.salesOrderProductionSetup.deleteMany({ where: { salesOrderId: so.id } });
      await prisma.salesOrderLine.deleteMany({ where: { salesOrderId: so.id } });
      await prisma.salesOrder.delete({ where: { id: so.id } });
    }
    await prisma.quotation.deleteMany({ where: { number: `QT-P14-${tag}` } }).catch(() => undefined);
    await prisma.requestForQuotation
      .deleteMany({ where: { number: `RFQ-P14-${tag}` } })
      .catch(() => undefined);
  }

  async function buildWalkthrough(input: {
    tag: string;
    withRfq: boolean;
    complexity: ManufacturingComplexity;
    orderWidth: number;
    unitPrice: number;
    materials: Array<Record<string, unknown>>;
    commercialStatus: CommercialPriceStatus;
    commercialNote: string;
    projectName: string;
    notes: string;
    factoryNotes: string;
  }) {
    await wipeBundle(input.tag);
    const qty = 1;
    const totals = lineTotals(qty, input.unitPrice, VAT);
    const unitPriceM = money(input.unitPrice);
    const soNumber = `SO-P14-${input.tag}`;
    const qtNumber = `QT-P14-${input.tag}`;
    const poNumber = `PO-P14-${input.tag}`;
    const catalogDims = { width: catalogW, height: catalogH, depth: catalogD };
    const orderDims = { width: input.orderWidth, height: catalogH, depth: catalogD };
    const orderSpec = {
      productId: product.id,
      productName: product.nameEn,
      quantity: qty,
      manufacturingComplexity: input.complexity,
      catalogDimensions: catalogDims,
      requestedDimensions: orderDims,
    };

    let requestId: string | undefined;
    if (input.withRfq) {
      const rfq = await prisma.requestForQuotation.create({
        data: {
          number: `RFQ-P14-${input.tag}`,
          customerId: oasis.id,
          source: RequestSource.PORTAL,
          status: RequestStatus.QUOTED,
          submittedAt: sentAt,
          projectName: input.projectName,
          externalOrderNumber: `P14-${input.tag}`,
          notes: input.notes,
          createdById: opts.adminUserId,
          items: {
            create: [
              {
                productId: product.id,
                productName: product.nameEn,
                quantity: qty,
                width: input.orderWidth,
                height: catalogH,
                depth: catalogD,
                manufacturingComplexity: input.complexity,
                sortOrder: 0,
              },
            ],
          },
        },
      });
      requestId = rfq.id;
    }

    const quote = await prisma.quotation.create({
      data: {
        number: qtNumber,
        version: 1,
        customerId: oasis.id,
        requestId,
        status: QuotationStatus.ACCEPTED,
        sentAt,
        acceptedAt,
        acceptedById: opts.adminUserId,
        customerNotes: input.notes,
        subtotal: totals.subtotalM,
        taxTotal: totals.taxAmountM,
        total: totals.lineTotalM,
        lines: {
          create: [
            {
              productId: product.id,
              description: product.nameEn,
              quantity: qty,
              unitPrice: unitPriceM,
              taxRate: VAT,
              subtotal: totals.subtotalM,
              taxAmount: totals.taxAmountM,
              lineTotal: totals.lineTotalM,
              manufacturingComplexity: input.complexity,
              width: input.orderWidth,
              height: catalogH,
              depth: catalogD,
              sortOrder: 0,
            },
          ],
        },
      },
    });

    const so = await prisma.salesOrder.create({
      data: {
        number: soNumber,
        customerId: oasis.id,
        quotationId: quote.id,
        status: SalesOrderStatus.READY_FOR_PRODUCTION,
        externalOrderNumber: `P14-${input.tag}`,
        projectName: input.projectName,
        notes: input.notes,
        subtotal: totals.subtotalM,
        taxTotal: totals.taxAmountM,
        total: totals.lineTotalM,
        createdById: opts.adminUserId,
        lines: {
          create: [
            {
              productId: product.id,
              description: product.nameEn,
              quantity: qty,
              unitPrice: unitPriceM,
              taxRate: VAT,
              lineTotal: totals.lineTotalM,
              manufacturingComplexity: input.complexity,
              commercialPriceStatus: input.commercialStatus,
              commercialPriceSource:
                input.commercialStatus === CommercialPriceStatus.CATALOG
                  ? 'CATALOG_LIST'
                  : 'STAFF_CONFIRMED',
              commercialPriceNote: input.commercialNote,
              orderSpec,
              sortOrder: 0,
            },
          ],
        },
      },
      include: { lines: true },
    });
    const line = so.lines[0]!;

    await prisma.salesOrderProductionSetup.create({
      data: {
        salesOrderId: so.id,
        status: SalesOrderProductionSetupStatus.RELEASED,
        releasedAt: new Date(),
        releasedById: opts.adminUserId,
        lines: {
          create: {
            salesOrderLineId: line.id,
            status: SalesOrderLineSetupStatus.READY,
            manufacturingName: product.nameEn,
            manufacturingComplexity: input.complexity,
            catalogDimensions: catalogDims,
            orderDimensions: orderDims,
            workflowId: defaultWorkflowId!,
            workflowConfirmedAt: new Date(),
            packagingExpectation,
            factoryNotes: input.factoryNotes,
            materialsReviewedAt: new Date(),
            materialRequirements: input.materials.length
              ? { create: input.materials as never }
              : undefined,
          },
        },
      },
    });

    const po = await prisma.productionOrder.create({
      data: {
        number: poNumber,
        salesOrderId: so.id,
        salesOrderLineId: line.id,
        customerId: oasis.id,
        productId: product.id,
        productDescription: product.nameEn,
        quantity: qty,
        status: ProductionOrderStatus.READY,
        createdById: opts.adminUserId,
        notes: input.factoryNotes,
        plannedStartDate: asOf,
        currentStageCode: 'CARPENTRY',
        progressPercent: 0,
      },
    });

    const compiled = await loadWorkflowNodes(defaultWorkflowId!);
    if (!compiled) {
      console.log(`  Piece 14 ${input.tag}: PO without workflow snapshot.`);
      return { soNumber, poNumber, firstTask: null as string | null };
    }

    const productOutputs = await loadProductInventoryOutputs(prisma, product.id);
    const snapshot = await prisma.productionOrderWorkflowSnapshot.create({
      data: {
        productionOrderId: po.id,
        sourceWorkflowId: defaultWorkflowId!,
        sourceWorkflowVersionId: compiled.versionId,
        sourceVersionNumber: compiled.versionNumber,
      },
    });
    const snapNodeIdBySource = new Map<string, string>();
    const tasksByCode = new Map<string, string>();
    const stageInstanceByCode = new Map<string, string>();
    let taskIdx = 0;
    let firstExecutableCode: string | null = null;

    for (const n of compiled.nodes) {
      const flags = inventoryFlagsForStage(n.stageCode);
      const resolved = resolveDemoSnapshotInventory(
        {
          sourceWorkflowNodeId: n.id,
          stageDefinitionId: n.stageDefinitionId,
          stageCode: n.stageCode,
          nodeKey: n.nodeKey,
          inventoryTracking: flags.inventoryTracking,
          consumesSemiFinished: flags.consumesSemiFinished,
        },
        productOutputs,
      );
      const tracking =
        flags.inventoryTracking !== InventoryTracking.NONE
          ? flags.inventoryTracking
          : (resolved.tracking as InventoryTracking);
      const consumesSemi =
        flags.consumesSemiFinished || Boolean(resolved.consumesSemiFinished);

      const stageInstance = await prisma.productionStageInstance.create({
        data: {
          productionOrderId: po.id,
          stageDefinitionId: n.stageDefinitionId,
          status: StageInstanceStatus.PENDING,
          progressPercent: 0,
        },
      });
      stageInstanceByCode.set(n.stageCode, stageInstance.id);

      const snapNode = await prisma.productionOrderWorkflowSnapshotNode.create({
        data: {
          snapshotId: snapshot.id,
          sourceWorkflowNodeId: n.id,
          stageDefinitionId: n.stageDefinitionId,
          stageInstanceId: stageInstance.id,
          nodeKey: n.nodeKey,
          stageCode: n.stageCode,
          nameEnSnapshot: n.nameEn,
          nameArSnapshot: n.nameAr,
          nameHeSnapshot: n.nameHe,
          executionKind: n.executionKind as 'PRODUCTION' | 'QUALITY' | 'LOGISTICS',
          inventoryTracking: tracking,
          consumesRawMaterials: Boolean(resolved.consumesRawMaterials),
          consumesSemiFinished: consumesSemi,
          outputQtyPerUnit:
            resolved.qtyPerUnit ?? (tracking !== InventoryTracking.NONE ? 1 : undefined),
          expectedPieceCount: resolved.expectedPieceCount || 1,
          outputNameEn: resolved.nameEn ?? undefined,
          outputNameAr: resolved.nameAr ?? undefined,
          outputNameHe: resolved.nameHe ?? undefined,
          outputUnit: resolved.unit ?? undefined,
          outputDefinitionId: resolved.outputDefinitionId ?? undefined,
          outputInventoryItemId: resolved.inventoryItemId ?? undefined,
          defaultWarehouseId:
            resolved.warehouseId ??
            (tracking === InventoryTracking.PRODUCES_FINISHED
              ? finWh?.id
              : tracking === InventoryTracking.PRODUCES_SEMI_FINISHED
                ? semiWh?.id
                : undefined),
          sortOrder: n.sortOrder,
        },
      });
      snapNodeIdBySource.set(n.id, snapNode.id);

      if (isExecutableStage(n.stageCode, n.executionKind)) {
        taskIdx += 1;
        if (!firstExecutableCode) firstExecutableCode = n.stageCode;
        const task = await prisma.productionTask.create({
          data: {
            number: `TSK-P14-${input.tag}-${String(taskIdx).padStart(2, '0')}`,
            productionOrderId: po.id,
            stageDefinitionId: n.stageDefinitionId,
            stageInstanceId: stageInstance.id,
            name: n.nameEn,
            description: `${n.nameEn} for ${product.nameEn} (P14-${input.tag})`,
            status: TaskStatus.NOT_STARTED,
            progressPercent: 0,
            estimatedMinutes: 120,
            targetQty: qty,
            completedQty: 0,
          },
        });
        tasksByCode.set(n.stageCode, task.id);
      }
    }

    for (const e of compiled.edges) {
      const fromId = snapNodeIdBySource.get(e.fromNodeId);
      const toId = snapNodeIdBySource.get(e.toNodeId);
      if (!fromId || !toId) continue;
      await prisma.productionOrderWorkflowSnapshotEdge.create({
        data: { snapshotId: snapshot.id, fromSnapshotNodeId: fromId, toSnapshotNodeId: toId },
      });
    }

    const openCode = firstExecutableCode ?? 'CARPENTRY';
    const openTaskId = tasksByCode.get(openCode);
    const openStageId = stageInstanceByCode.get(openCode);
    if (openTaskId) {
      await prisma.productionTask.update({
        where: { id: openTaskId },
        data: {
          status: TaskStatus.READY,
          assignedEmployeeId: carpenterId,
          plannedStart: addDays(asOf, 0),
          plannedCompletion: addDays(asOf, 1),
        },
      });
    }
    if (openStageId) {
      await prisma.productionStageInstance.update({
        where: { id: openStageId },
        data: { status: StageInstanceStatus.READY, progressPercent: 0 },
      });
    }
    await prisma.productionOrder.update({
      where: { id: po.id },
      data: { currentStageCode: openCode },
    });

    return { soNumber, poNumber, firstTask: openCode };
  }

  const golden = await buildWalkthrough({
    tag: 'GOLDEN',
    withRfq: true,
    complexity: ManufacturingComplexity.STANDARD,
    orderWidth: catalogW,
    unitPrice: unitPriceNum,
    materials: catalogMaterialCreates(),
    commercialStatus: CommercialPriceStatus.CONFIRMED,
    commercialNote: 'Piece 14 golden — commercial catalog price confirmed',
    projectName: 'P14 Golden Walkthrough',
    notes: 'Piece 14 golden walkthrough — full-system start (not pre-completed)',
    factoryNotes: 'P14-GOLDEN: setup RELEASED; PO READY; first task READY — start factory floor',
  });

  const modWidth = catalogW + 25;
  const mod = await buildWalkthrough({
    tag: 'MOD',
    withRfq: false,
    complexity: ManufacturingComplexity.MODIFIED,
    orderWidth: modWidth,
    unitPrice: Math.round(unitPriceNum * 1.12),
    materials: modifiedMaterialCreates(),
    commercialStatus: CommercialPriceStatus.CONFIRMED,
    commercialNote: 'Piece 14 MOD — staff-confirmed commercial unit price',
    projectName: 'P14 Modified Width Walkthrough',
    notes: 'Piece 14 MOD — width differs from catalog; order-specific materials (BOM untouched)',
    factoryNotes: `P14-MOD: order width ${modWidth} vs catalog ${catalogW}; FACTORY_MODIFIED/CUSTOM mats`,
  });

  console.log(
    `  Piece 14: ${golden.soNumber} (start: ${golden.poNumber} / task ${golden.firstTask} READY)` +
      ` + ${mod.soNumber} (MODIFIED w=${modWidth})`,
  );
}
