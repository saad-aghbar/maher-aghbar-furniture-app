/**
 * Piece 2 deterministic production-setup examples (P2-A–F).
 * Preserves Piece 1 rows; does not auto-schedule released orders.
 */
import {
  ManufacturingComplexity,
  PrismaClient,
  QuotationStatus,
  SalesOrderProductionSetupStatus,
  SalesOrderLineSetupStatus,
  SalesOrderMaterialRequirementSource,
  SalesOrderStatus,
} from '@prisma/client';
import { VAT, lineTotals, money } from '../seed/util';

type DealerRef = { id: string; code: string; name?: string; nameEn?: string; username?: string };
type ProductRef = {
  id: string;
  sku: string;
  nameEn: string;
  basePrice: unknown;
  width?: unknown;
  height?: unknown;
  depth?: unknown;
  bomDefaults?: unknown;
};

export async function seedPiece2ProductionSetupExamples(
  prisma: PrismaClient,
  opts: {
    dealers: DealerRef[];
    products: ProductRef[];
    adminUserId: string;
  },
) {
  const oasis =
    opts.dealers.find((d) => d.username === 'oasis' || /oasis/i.test(d.nameEn ?? d.name ?? '')) ??
    opts.dealers[1] ??
    opts.dealers[0];
  const nile =
    opts.dealers.find((d) => d.username === 'nile' || /nile/i.test(d.nameEn ?? d.name ?? '')) ??
    opts.dealers[0];
  const product = opts.products[0];
  if (!oasis || !nile || !product) return;

  const catalogW = product.width != null ? Number(product.width) : 180;
  const catalogH = product.height != null ? Number(product.height) : 90;
  const catalogD = product.depth != null ? Number(product.depth) : 85;
  const unitPriceNum = Number(product.basePrice) || 2500;
  const unitPrice = money(unitPriceNum);
  const sentAt = new Date();
  const acceptedAt = new Date();

  const workflowConfig = await prisma.productWorkflowConfiguration.findUnique({
    where: { productId: product.id },
    select: { workflowId: true },
  });
  const workflowId = workflowConfig?.workflowId ?? null;

  const stageMaterials = await prisma.productStageMaterialInput.findMany({
    where: { productId: product.id },
    include: {
      inventoryItem: {
        select: { id: true, sku: true, nameEn: true, category: true, unit: true },
      },
    },
    take: 20,
  });

  const inventoryItems = await prisma.inventoryItem.findMany({
    where: { archivedAt: null, isActive: true, itemClass: 'RAW_MATERIAL' },
    take: 10,
    orderBy: { sku: 'asc' },
  });
  const fabricItem =
    inventoryItems.find((i) => i.category === 'FABRIC') ?? inventoryItems[0] ?? null;
  const woodItem =
    inventoryItems.find((i) => i.category === 'WOOD') ?? inventoryItems[1] ?? inventoryItems[0] ?? null;

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

  async function upsertAcceptedSo(input: {
    soNumber: string;
    qtNumber: string;
    customerId: string;
    projectName: string;
    externalOrderNumber: string;
    complexity: ManufacturingComplexity;
    productId: string | null;
    description: string;
    quantity: number;
    orderSpec: Record<string, unknown>;
    specifications?: string;
  }) {
    const totals = lineTotals(input.quantity, unitPriceNum, VAT);
    const quote = await prisma.quotation.upsert({
      where: { number_version: { number: input.qtNumber, version: 1 } },
      update: { status: QuotationStatus.ACCEPTED, sentAt, acceptedAt },
      create: {
        number: input.qtNumber,
        version: 1,
        customerId: input.customerId,
        status: QuotationStatus.ACCEPTED,
        sentAt,
        acceptedAt,
        acceptedById: opts.adminUserId,
        subtotal: totals.subtotalM,
        taxTotal: totals.taxAmountM,
        total: totals.lineTotalM,
        lines: {
          create: [
            {
              productId: input.productId ?? undefined,
              description: input.description,
              quantity: input.quantity,
              unitPrice,
              taxRate: VAT,
              subtotal: totals.subtotalM,
              taxAmount: totals.taxAmountM,
              lineTotal: totals.lineTotalM,
              manufacturingComplexity: input.complexity,
              sortOrder: 0,
            },
          ],
        },
      },
    });

    const existing = await prisma.salesOrder.findUnique({
      where: { number: input.soNumber },
      include: { lines: true, productionSetup: true, productionOrders: { select: { id: true } } },
    });
    if (existing?.productionOrders.length) {
      return existing;
    }
    if (existing) {
      await prisma.salesOrderLineMaterialRequirement.deleteMany({
        where: { lineSetup: { productionSetup: { salesOrderId: existing.id } } },
      });
      await prisma.salesOrderLineSetup.deleteMany({
        where: { productionSetup: { salesOrderId: existing.id } },
      });
      await prisma.salesOrderProductionSetup.deleteMany({ where: { salesOrderId: existing.id } });
      await prisma.salesOrderLine.deleteMany({ where: { salesOrderId: existing.id } });
      await prisma.salesOrder.update({
        where: { id: existing.id },
        data: {
          status: SalesOrderStatus.DRAFT,
          archivedAt: null,
          projectName: input.projectName,
          externalOrderNumber: input.externalOrderNumber,
          quotationId: quote.id,
        },
      });
      await prisma.salesOrderLine.create({
        data: {
          salesOrderId: existing.id,
          productId: input.productId ?? undefined,
          description: input.description,
          specifications: input.specifications,
          quantity: input.quantity,
          unitPrice,
          taxRate: VAT,
          lineTotal: totals.lineTotalM,
          manufacturingComplexity: input.complexity,
          orderSpec: input.orderSpec,
          sortOrder: 0,
        },
      });
      return prisma.salesOrder.findUniqueOrThrow({
        where: { id: existing.id },
        include: { lines: true },
      });
    }

    return prisma.salesOrder.create({
      data: {
        number: input.soNumber,
        customerId: input.customerId,
        quotationId: quote.id,
        status: SalesOrderStatus.DRAFT,
        externalOrderNumber: input.externalOrderNumber,
        projectName: input.projectName,
        subtotal: totals.subtotalM,
        taxTotal: totals.taxAmountM,
        total: totals.lineTotalM,
        createdById: opts.adminUserId,
        lines: {
          create: [
            {
              productId: input.productId ?? undefined,
              description: input.description,
              specifications: input.specifications,
              quantity: input.quantity,
              unitPrice,
              taxRate: VAT,
              lineTotal: totals.lineTotalM,
              manufacturingComplexity: input.complexity,
              orderSpec: input.orderSpec,
              sortOrder: 0,
            },
          ],
        },
      },
      include: { lines: true },
    });
  }

  function catalogMaterialCreates(needsReview: boolean, fabricLabel?: string | null) {
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
        needsReview: needsReview && row.inventoryItem.category === 'FABRIC',
        requestedFabricLabel:
          row.inventoryItem.category === 'FABRIC' ? fabricLabel ?? undefined : undefined,
        sortOrder: idx,
      }));
    }
    const rows = [
      woodItem && {
        inventoryItemId: woodItem.id,
        sku: woodItem.sku,
        displayName: woodItem.nameEn,
        category: woodItem.category,
        unit: woodItem.unit,
        expectedQty: 4,
        source: SalesOrderMaterialRequirementSource.CATALOG,
        needsReview: false,
        sortOrder: 0,
      },
      fabricItem && {
        inventoryItemId: fabricItem.id,
        sku: fabricItem.sku,
        displayName: fabricItem.nameEn,
        category: fabricItem.category,
        unit: fabricItem.unit,
        expectedQty: 12,
        source: SalesOrderMaterialRequirementSource.CATALOG,
        needsReview,
        requestedFabricLabel: fabricLabel ?? undefined,
        sortOrder: 1,
      },
    ].filter(Boolean) as Array<{
      inventoryItemId: string;
      sku: string;
      displayName: string;
      category: typeof fabricItem extends null ? never : NonNullable<typeof fabricItem>['category'];
      unit: string;
      expectedQty: number;
      source: SalesOrderMaterialRequirementSource;
      needsReview: boolean;
      requestedFabricLabel?: string;
      sortOrder: number;
    }>;
    return rows;
  }

  async function createSetup(input: {
    salesOrderId: string;
    lineId: string;
    status: SalesOrderProductionSetupStatus;
    lineStatus: SalesOrderLineSetupStatus;
    complexity: ManufacturingComplexity;
    manufacturingName: string;
    catalogDimensions: Record<string, number>;
    orderDimensions: Record<string, number>;
    requestedFabricLabel?: string | null;
    materials: ReturnType<typeof catalogMaterialCreates>;
    workflowId?: string | null;
    confirmWorkflow?: boolean;
    factoryNotes?: string;
  }) {
    await prisma.salesOrderProductionSetup.create({
      data: {
        salesOrderId: input.salesOrderId,
        status: input.status,
        releasedAt:
          input.status === SalesOrderProductionSetupStatus.RELEASED ? new Date() : undefined,
        releasedById:
          input.status === SalesOrderProductionSetupStatus.RELEASED ? opts.adminUserId : undefined,
        lines: {
          create: {
            salesOrderLineId: input.lineId,
            status: input.lineStatus,
            manufacturingName: input.manufacturingName,
            manufacturingComplexity: input.complexity,
            catalogDimensions: input.catalogDimensions,
            orderDimensions: input.orderDimensions,
            requestedFabricLabel: input.requestedFabricLabel ?? undefined,
            workflowId: input.workflowId ?? undefined,
            workflowConfirmedAt: input.confirmWorkflow ? new Date() : undefined,
            packagingExpectation,
            factoryNotes: input.factoryNotes,
            materialsReviewedAt:
              input.lineStatus === SalesOrderLineSetupStatus.READY ? new Date() : undefined,
            materialRequirements: input.materials.length
              ? { create: input.materials }
              : undefined,
          },
        },
      },
    });
  }

  // P2-A — STANDARD prefilled, setup in progress
  {
    const so = await upsertAcceptedSo({
      soNumber: 'SO-P2-A',
      qtNumber: 'QT-P2-A',
      customerId: oasis.id,
      projectName: 'Piece2 Standard Prefill',
      externalOrderNumber: 'P2-A',
      complexity: ManufacturingComplexity.STANDARD,
      productId: product.id,
      description: product.nameEn,
      quantity: 1,
      orderSpec: {
        productId: product.id,
        productName: product.nameEn,
        quantity: 1,
        manufacturingComplexity: 'STANDARD',
        catalogDimensions: { width: catalogW, height: catalogH, depth: catalogD },
        requestedDimensions: { width: catalogW, height: catalogH, depth: catalogD },
      },
    });
    const line = so.lines[0]!;
    await createSetup({
      salesOrderId: so.id,
      lineId: line.id,
      status: SalesOrderProductionSetupStatus.SETUP_IN_PROGRESS,
      lineStatus: SalesOrderLineSetupStatus.NOT_STARTED,
      complexity: ManufacturingComplexity.STANDARD,
      manufacturingName: product.nameEn,
      catalogDimensions: { width: catalogW, height: catalogH, depth: catalogD },
      orderDimensions: { width: catalogW, height: catalogH, depth: catalogD },
      materials: catalogMaterialCreates(false),
      workflowId,
      confirmWorkflow: Boolean(workflowId),
    });
  }

  // P2-B — MODIFIED width+fabric, materials need review
  {
    const customW = catalogW + 40;
    const fabricLabel = 'Velvet Navy';
    const so = await upsertAcceptedSo({
      soNumber: 'SO-P2-B',
      qtNumber: 'QT-P2-B',
      customerId: oasis.id,
      projectName: 'Piece2 Modified Review',
      externalOrderNumber: 'P2-B',
      complexity: ManufacturingComplexity.MODIFIED,
      productId: product.id,
      description: `${product.nameEn} (custom width)`,
      quantity: 1,
      specifications: `Fabric: ${fabricLabel}; Dims: ${customW}×${catalogH}×${catalogD} cm`,
      orderSpec: {
        productId: product.id,
        productName: product.nameEn,
        quantity: 1,
        manufacturingComplexity: 'MODIFIED',
        catalogDimensions: { width: catalogW, height: catalogH, depth: catalogD },
        requestedDimensions: { width: customW, height: catalogH, depth: catalogD },
        fabric: { type: 'Velvet', color: 'Navy' },
      },
    });
    const line = so.lines[0]!;
    await createSetup({
      salesOrderId: so.id,
      lineId: line.id,
      status: SalesOrderProductionSetupStatus.SETUP_IN_PROGRESS,
      lineStatus: SalesOrderLineSetupStatus.NEEDS_REVIEW,
      complexity: ManufacturingComplexity.MODIFIED,
      manufacturingName: `${product.nameEn} (custom width)`,
      catalogDimensions: { width: catalogW, height: catalogH, depth: catalogD },
      orderDimensions: { width: customW, height: catalogH, depth: catalogD },
      requestedFabricLabel: fabricLabel,
      materials: catalogMaterialCreates(true, fabricLabel),
      workflowId,
      confirmWorkflow: Boolean(workflowId),
    });
  }

  // P2-C — CUSTOM empty materials / needs workflow
  {
    const so = await upsertAcceptedSo({
      soNumber: 'SO-P2-C',
      qtNumber: 'QT-P2-C',
      customerId: nile.id,
      projectName: 'Piece2 Custom Build',
      externalOrderNumber: 'P2-C',
      complexity: ManufacturingComplexity.CUSTOM,
      productId: null,
      description: 'Bespoke corner unit — Nile showroom',
      quantity: 1,
      orderSpec: {
        productId: null,
        productName: 'Bespoke corner unit',
        quantity: 1,
        manufacturingComplexity: 'CUSTOM',
        requestedDimensions: { width: 240, height: 90, depth: 100 },
        notes: 'Dealer sketch attached',
      },
    });
    const line = so.lines[0]!;
    await createSetup({
      salesOrderId: so.id,
      lineId: line.id,
      status: SalesOrderProductionSetupStatus.SETUP_REQUIRED,
      lineStatus: SalesOrderLineSetupStatus.NOT_STARTED,
      complexity: ManufacturingComplexity.CUSTOM,
      manufacturingName: 'Bespoke corner unit — Nile showroom',
      catalogDimensions: {},
      orderDimensions: { width: 240, height: 90, depth: 100 },
      materials: [],
      workflowId: null,
      confirmWorkflow: false,
    });
  }

  // P2-D — READY_FOR_RELEASE, materials available
  {
    const so = await upsertAcceptedSo({
      soNumber: 'SO-P2-D',
      qtNumber: 'QT-P2-D',
      customerId: oasis.id,
      projectName: 'Piece2 Ready Release',
      externalOrderNumber: 'P2-D',
      complexity: ManufacturingComplexity.STANDARD,
      productId: product.id,
      description: product.nameEn,
      quantity: 1,
      orderSpec: {
        productId: product.id,
        productName: product.nameEn,
        quantity: 1,
        manufacturingComplexity: 'STANDARD',
        catalogDimensions: { width: catalogW, height: catalogH, depth: catalogD },
        requestedDimensions: { width: catalogW, height: catalogH, depth: catalogD },
      },
    });
    const line = so.lines[0]!;
    const mats = catalogMaterialCreates(false).map((m) => ({ ...m, needsReview: false }));
    await createSetup({
      salesOrderId: so.id,
      lineId: line.id,
      status: SalesOrderProductionSetupStatus.READY_FOR_RELEASE,
      lineStatus: SalesOrderLineSetupStatus.READY,
      complexity: ManufacturingComplexity.STANDARD,
      manufacturingName: product.nameEn,
      catalogDimensions: { width: catalogW, height: catalogH, depth: catalogD },
      orderDimensions: { width: catalogW, height: catalogH, depth: catalogD },
      materials: mats,
      workflowId,
      confirmWorkflow: true,
      factoryNotes: 'Ready for release — stock OK',
    });
  }

  // P2-E — READY_FOR_RELEASE with intentional shortage (huge fabric qty)
  {
    const so = await upsertAcceptedSo({
      soNumber: 'SO-P2-E',
      qtNumber: 'QT-P2-E',
      customerId: nile.id,
      projectName: 'Piece2 Ready Shortage',
      externalOrderNumber: 'P2-E',
      complexity: ManufacturingComplexity.STANDARD,
      productId: product.id,
      description: product.nameEn,
      quantity: 8,
      orderSpec: {
        productId: product.id,
        productName: product.nameEn,
        quantity: 8,
        manufacturingComplexity: 'STANDARD',
        catalogDimensions: { width: catalogW, height: catalogH, depth: catalogD },
        requestedDimensions: { width: catalogW, height: catalogH, depth: catalogD },
      },
    });
    const line = so.lines[0]!;
    const mats = catalogMaterialCreates(false).map((m, idx) =>
      idx === 0
        ? { ...m, expectedQty: 5000, needsReview: false }
        : { ...m, needsReview: false },
    );
    await createSetup({
      salesOrderId: so.id,
      lineId: line.id,
      status: SalesOrderProductionSetupStatus.READY_FOR_RELEASE,
      lineStatus: SalesOrderLineSetupStatus.READY,
      complexity: ManufacturingComplexity.STANDARD,
      manufacturingName: product.nameEn,
      catalogDimensions: { width: catalogW, height: catalogH, depth: catalogD },
      orderDimensions: { width: catalogW, height: catalogH, depth: catalogD },
      materials: mats,
      workflowId,
      confirmWorkflow: true,
      factoryNotes: 'Intentional shortage demo',
    });
  }

  // P2-F — RELEASED with POs + snapshots, no schedule
  {
    const so = await upsertAcceptedSo({
      soNumber: 'SO-P2-F',
      qtNumber: 'QT-P2-F',
      customerId: oasis.id,
      projectName: 'Piece2 Released No Schedule',
      externalOrderNumber: 'P2-F',
      complexity: ManufacturingComplexity.STANDARD,
      productId: product.id,
      description: product.nameEn,
      quantity: 1,
      orderSpec: {
        productId: product.id,
        productName: product.nameEn,
        quantity: 1,
        manufacturingComplexity: 'STANDARD',
        catalogDimensions: { width: catalogW, height: catalogH, depth: catalogD },
        requestedDimensions: { width: catalogW, height: catalogH, depth: catalogD },
      },
    });
    const line = so.lines[0]!;
    const mats = catalogMaterialCreates(false).map((m) => ({ ...m, needsReview: false }));
    await createSetup({
      salesOrderId: so.id,
      lineId: line.id,
      status: SalesOrderProductionSetupStatus.RELEASED,
      lineStatus: SalesOrderLineSetupStatus.READY,
      complexity: ManufacturingComplexity.STANDARD,
      manufacturingName: product.nameEn,
      catalogDimensions: { width: catalogW, height: catalogH, depth: catalogD },
      orderDimensions: { width: catalogW, height: catalogH, depth: catalogD },
      materials: mats,
      workflowId,
      confirmWorkflow: true,
      factoryNotes: 'Released — worker assignment required',
    });

    const existingPo = await prisma.productionOrder.findFirst({
      where: { salesOrderId: so.id },
    });
    // Prefer PO-P2-F by number; fall back to SO-linked PO.
    let po =
      (await prisma.productionOrder.findUnique({ where: { number: 'PO-P2-F' } })) ??
      existingPo;

    if (!po && workflowId) {
      po = await prisma.productionOrder.create({
        data: {
          number: 'PO-P2-F',
          salesOrderId: so.id,
          salesOrderLineId: line.id,
          customerId: oasis.id,
          productId: product.id,
          productDescription: product.nameEn,
          quantity: 1,
          status: 'PLANNED',
          createdById: opts.adminUserId,
          notes: 'Worker assignment required',
        },
      });
    } else if (po) {
      await prisma.productionOrder.update({
        where: { id: po.id },
        data: {
          salesOrderId: so.id,
          salesOrderLineId: line.id,
          status: 'PLANNED',
          notes: 'Worker assignment required',
        },
      });
    }

    if (po) {
      await prisma.salesOrder.update({
        where: { id: so.id },
        data: { status: SalesOrderStatus.READY_FOR_PRODUCTION },
      });
    }

    if (po && workflowId) {
      let snapshot = await prisma.productionOrderWorkflowSnapshot.findUnique({
        where: { productionOrderId: po.id },
        include: {
          nodes: {
            include: {
              stageDefinition: {
                select: { code: true, nameEn: true, nameAr: true, nameHe: true, executionKind: true },
              },
            },
          },
        },
      });

      if (!snapshot) {
        const wf = await prisma.productionWorkflow.findUnique({
          where: { id: workflowId },
          select: {
            id: true,
            activeVersionId: true,
            activeVersion: {
              select: {
                id: true,
                versionNumber: true,
                nodes: {
                  orderBy: { sortOrder: 'asc' },
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
                edges: {
                  select: { fromNodeId: true, toNodeId: true },
                },
              },
            },
          },
        });
        const version = wf?.activeVersion;
        if (version) {
          snapshot = await prisma.productionOrderWorkflowSnapshot.create({
            data: {
              productionOrderId: po.id,
              sourceWorkflowId: workflowId,
              sourceWorkflowVersionId: version.id,
              sourceVersionNumber: version.versionNumber,
            },
            include: {
              nodes: {
                include: {
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
            },
          });
          const snapNodeIdBySource = new Map<string, string>();
          for (const n of version.nodes) {
            const stageInstance = await prisma.productionStageInstance.create({
              data: {
                productionOrderId: po.id,
                stageDefinitionId: n.stageDefinitionId,
                status: 'PENDING',
                progressPercent: 0,
              },
            });
            const stageCode = n.stageDefinition.code;
            const executionKind = n.stageDefinition.executionKind ?? 'PRODUCTION';
            const snapNode = await prisma.productionOrderWorkflowSnapshotNode.create({
              data: {
                snapshotId: snapshot.id,
                sourceWorkflowNodeId: n.id,
                stageDefinitionId: n.stageDefinitionId,
                stageInstanceId: stageInstance.id,
                nodeKey: n.nodeKey,
                stageCode,
                nameEnSnapshot: n.stageDefinition.nameEn || stageCode,
                nameArSnapshot: n.stageDefinition.nameAr || stageCode,
                nameHeSnapshot: n.stageDefinition.nameHe ?? null,
                executionKind,
              },
            });
            snapNodeIdBySource.set(n.id, snapNode.id);
          }
          for (const e of version.edges) {
            const fromId = snapNodeIdBySource.get(e.fromNodeId);
            const toId = snapNodeIdBySource.get(e.toNodeId);
            if (!fromId || !toId) continue;
            await prisma.productionOrderWorkflowSnapshotEdge.create({
              data: {
                snapshotId: snapshot.id,
                fromSnapshotNodeId: fromId,
                toSnapshotNodeId: toId,
              },
            });
          }
          snapshot = await prisma.productionOrderWorkflowSnapshot.findUniqueOrThrow({
            where: { id: snapshot.id },
            include: {
              nodes: {
                include: {
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
            },
          });
        }
      }

      // Always backfill missing executable tasks (legacy P2-F had snapshot without tasks).
      if (snapshot) {
        let taskIdx = 0;
        for (const node of snapshot.nodes) {
          const stageCode = node.stageCode || node.stageDefinition?.code || 'STAGE';
          const executionKind =
            node.executionKind || node.stageDefinition?.executionKind || 'PRODUCTION';
          if (
            String(executionKind).toUpperCase() === 'LOGISTICS' ||
            String(stageCode).toUpperCase() === 'DELIVERY'
          ) {
            continue;
          }
          if (!node.stageDefinitionId) continue;
          taskIdx += 1;
          const taskNumber = `TSK-P2-F-${String(taskIdx).padStart(2, '0')}`;
          const stageInstanceId = node.stageInstanceId ?? null;
          const existingTask = await prisma.productionTask.findFirst({
            where: {
              productionOrderId: po.id,
              OR: [
                { number: taskNumber },
                ...(stageInstanceId ? [{ stageInstanceId }] : []),
                { stageDefinitionId: node.stageDefinitionId, isRework: false },
              ],
            },
          });
          if (existingTask) continue;
          await prisma.productionTask.create({
            data: {
              number: taskNumber,
              productionOrderId: po.id,
              stageDefinitionId: node.stageDefinitionId,
              stageInstanceId: stageInstanceId ?? undefined,
              name: node.nameEnSnapshot || node.stageDefinition?.nameEn || stageCode,
              description: `${node.nameEnSnapshot || stageCode} for ${product.nameEn}`,
              status: 'NOT_STARTED',
              progressPercent: 0,
              estimatedMinutes: 120,
              targetQty: 1,
              completedQty: 0,
            },
          });
        }
      }
    }
  }
}
