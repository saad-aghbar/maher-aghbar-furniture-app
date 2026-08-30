/**
 * Demo physical inventory helpers.
 * Aligns curated seed with ProductionInventoryService / WorkflowSnapshotService semantics
 * without calling Nest services (direct Prisma).
 */
import {
  InventoryAllocationMode,
  InventoryItemClass,
  InventoryLotStatus,
  InventoryTracking,
  InventoryTxType,
  MaterialScrapReason,
  Prisma,
  PrismaClient,
  WarehouseType,
} from '@prisma/client';
import {
  outputQtyForOrder,
  resolveProductStageOutput,
  type ProductStageOutputRow,
} from '../../../../apps/api/src/modules/production/product-inventory-output.resolver';
import { nextDoc, type SeqBag } from './seq';

type SnapNodeInput = {
  sourceWorkflowNodeId: string;
  stageDefinitionId: string;
  stageCode: string;
  nodeKey: string;
};

export async function loadProductInventoryOutputs(
  prisma: PrismaClient,
  productId: string,
): Promise<ProductStageOutputRow[]> {
  return prisma.productStageInventoryOutput.findMany({ where: { productId } });
}

export async function loadProductInventoryInputs(prisma: PrismaClient, productId: string) {
  return prisma.productStageInventoryInput.findMany({
    where: { productId },
    include: { output: true },
  });
}

export async function loadProductMaterialInputs(prisma: PrismaClient, productId: string) {
  return prisma.productStageMaterialInput.findMany({
    where: { productId },
    include: { inventoryItem: { select: { sku: true, unit: true } } },
  });
}

export function resolveDemoSnapshotInventory(
  node: SnapNodeInput & {
    inventoryTracking?: InventoryTracking | null;
    consumesRawMaterials?: boolean | null;
    consumesSemiFinished?: boolean | null;
  },
  productOutputs: ProductStageOutputRow[],
) {
  return resolveProductStageOutput(
    {
      sourceWorkflowNodeId: node.sourceWorkflowNodeId,
      stageDefinitionId: node.stageDefinitionId,
      inventoryTracking: node.inventoryTracking ?? 'NONE',
      consumesRawMaterials: node.consumesRawMaterials ?? false,
      consumesSemiFinished: node.consumesSemiFinished ?? false,
    },
    productOutputs,
  );
}

export type DemoSnapNodeRow = {
  id: string;
  stageInstanceId: string | null;
  stageCode: string;
  inventoryTracking: InventoryTracking;
  consumesSemiFinished: boolean;
  outputQtyPerUnit: Prisma.Decimal | number | null;
  outputNameEn: string | null;
  outputNameAr: string | null;
  outputNameHe: string | null;
  outputUnit: string | null;
  outputDefinitionId: string | null;
  outputInventoryItemId: string | null;
  defaultWarehouseId: string | null;
};

type CompletedStageContext = {
  prisma: PrismaClient;
  productionOrderId: string;
  salesOrderId: string | null;
  salesOrderLineId: string | null;
  orderQty: number;
  adminId: string;
  counters: SeqBag;
  at: Date;
  completedStageCodes: Set<string>;
  snapNodes: DemoSnapNodeRow[];
  /** FIN lots stay AVAILABLE/RESERVED in factory (truck PLANNED). */
  keepFinInFactory: boolean;
  /** Historical: receipt then DELIVERY_ISSUE (truck already left). */
  leaveFactoryViaDelivery: boolean;
  deliveryId?: string | null;
};

/**
 * Posts SEMI/FIN lots for completed producer stages so demo status matches physical truth.
 */
export async function postDemoPhysicalOutputs(ctx: CompletedStageContext): Promise<void> {
  const { prisma } = ctx;
  const semiWh =
    (await prisma.warehouse.findFirst({
      where: { type: WarehouseType.SEMI_FINISHED, isActive: true, isDefault: true },
    })) ??
    (await prisma.warehouse.findFirst({
      where: { type: WarehouseType.SEMI_FINISHED, isActive: true },
    }));
  const finWh =
    (await prisma.warehouse.findFirst({
      where: { type: WarehouseType.FINISHED_GOODS, isActive: true, isDefault: true },
    })) ??
    (await prisma.warehouse.findFirst({
      where: { type: WarehouseType.FINISHED_GOODS, isActive: true },
    }));

  const producedSemiLotIds: string[] = [];

  for (const node of ctx.snapNodes) {
    if (!ctx.completedStageCodes.has(node.stageCode)) continue;
    const tracking = node.inventoryTracking;
    if (
      tracking !== InventoryTracking.PRODUCES_SEMI_FINISHED &&
      tracking !== InventoryTracking.PRODUCES_FINISHED
    ) {
      continue;
    }
    if (!node.outputInventoryItemId || !node.outputNameEn) continue;

    const isFin = tracking === InventoryTracking.PRODUCES_FINISHED;
    const warehouseId =
      node.defaultWarehouseId ?? (isFin ? finWh?.id : semiWh?.id) ?? null;
    if (!warehouseId) continue;

    const qty = outputQtyForOrder(Number(node.outputQtyPerUnit) || 1, ctx.orderQty);
    const type = isFin
      ? InventoryTxType.FINISHED_GOODS_RECEIPT
      : InventoryTxType.SEMI_FINISHED_RECEIPT;
    const sourceKey = `${type}:${ctx.productionOrderId}:${node.stageInstanceId}:${node.outputDefinitionId ?? node.stageCode}`;
    const existing = await prisma.inventoryLot.findFirst({ where: { sourceKey } });
    if (existing) {
      if (!isFin) producedSemiLotIds.push(existing.id);
      continue;
    }

    const reserved = Boolean(isFin && ctx.salesOrderId && ctx.keepFinInFactory);
    const lotStatus: InventoryLotStatus =
      isFin && ctx.leaveFactoryViaDelivery
        ? InventoryLotStatus.DELIVERED
        : reserved
          ? InventoryLotStatus.RESERVED
          : InventoryLotStatus.AVAILABLE;

    await bumpBalance(prisma, {
      inventoryItemId: node.outputInventoryItemId,
      warehouseId,
      delta: qty,
      reservedDelta: reserved ? qty : 0,
    });

    await prisma.inventoryTransaction.create({
      data: {
        number: await nextDoc(prisma, 'invtx', ctx.counters),
        type,
        inventoryItemId: node.outputInventoryItemId,
        warehouseId,
        quantity: qty,
        createdById: ctx.adminId,
        createdAt: ctx.at,
        referenceType: 'ProductionOrder',
        referenceId: ctx.productionOrderId,
        idempotencyKey: sourceKey,
        notes: isFin ? 'Demo FINISHED_GOODS_RECEIPT' : 'Demo SEMI_FINISHED_RECEIPT',
      },
    });

    const lot = await prisma.inventoryLot.create({
      data: {
        inventoryItemId: node.outputInventoryItemId,
        warehouseId,
        productionOrderId: ctx.productionOrderId,
        salesOrderId: ctx.salesOrderId,
        salesOrderLineId: ctx.salesOrderLineId,
        stageInstanceId: node.stageInstanceId,
        outputDefinitionId: node.outputDefinitionId,
        quantity: qty,
        status: lotStatus,
        allocationMode: ctx.salesOrderId
          ? InventoryAllocationMode.ORDER_ALLOCATED
          : InventoryAllocationMode.GENERAL_STOCK,
        sourceKey,
        producedAt: ctx.at,
      },
    });

    if (!isFin) producedSemiLotIds.push(lot.id);

    if (isFin && ctx.leaveFactoryViaDelivery && ctx.deliveryId) {
      await prisma.inventoryTransaction.create({
        data: {
          number: await nextDoc(prisma, 'invtx', ctx.counters),
          type: InventoryTxType.DELIVERY_ISSUE,
          inventoryItemId: node.outputInventoryItemId,
          warehouseId,
          quantity: -qty,
          createdById: ctx.adminId,
          createdAt: ctx.at,
          referenceType: 'Delivery',
          referenceId: ctx.deliveryId,
          idempotencyKey: `delivery-issue:${ctx.deliveryId}:${lot.id}`,
          notes: 'Demo DELIVERY_ISSUE at truck departure',
        },
      });
      await bumpBalance(prisma, {
        inventoryItemId: node.outputInventoryItemId,
        warehouseId,
        delta: -qty,
        reservedDelta: reserved ? -qty : 0,
      });
    }
  }

  // Consume SEMI when a completed consumer stage needs it (typically PACKAGING).
  const consumerDone = ctx.snapNodes.some(
    (n) => n.consumesSemiFinished && ctx.completedStageCodes.has(n.stageCode),
  );
  if (consumerDone) {
    for (const lotId of producedSemiLotIds) {
      const lot = await prisma.inventoryLot.findUnique({ where: { id: lotId } });
      if (!lot || lot.status !== InventoryLotStatus.AVAILABLE) continue;
      const consumer = ctx.snapNodes.find(
        (n) => n.consumesSemiFinished && ctx.completedStageCodes.has(n.stageCode),
      );
      await consumeSemiLot(prisma, {
        lotId: lot.id,
        inventoryItemId: lot.inventoryItemId,
        warehouseId: lot.warehouseId,
        qty: Number(lot.quantity),
        productionOrderId: ctx.productionOrderId,
        stageInstanceId: consumer?.stageInstanceId ?? lot.stageInstanceId,
        adminId: ctx.adminId,
        at: ctx.at,
        counters: ctx.counters,
      });
    }
  }
}

async function consumeSemiLot(
  prisma: PrismaClient,
  args: {
    lotId: string;
    inventoryItemId: string;
    warehouseId: string;
    qty: number;
    productionOrderId: string;
    stageInstanceId: string | null;
    adminId: string;
    at: Date;
    counters: SeqBag;
  },
) {
  const key = `semi-issue:${args.productionOrderId}:${args.stageInstanceId}:${args.lotId}`;
  const existing = await prisma.inventoryTransaction.findFirst({
    where: { idempotencyKey: key },
  });
  if (existing) return;

  await prisma.inventoryTransaction.create({
    data: {
      number: await nextDoc(prisma, 'invtx', args.counters),
      type: InventoryTxType.SEMI_FINISHED_ISSUE,
      inventoryItemId: args.inventoryItemId,
      warehouseId: args.warehouseId,
      quantity: -args.qty,
      createdById: args.adminId,
      createdAt: args.at,
      referenceType: 'ProductionOrder',
      referenceId: args.productionOrderId,
      idempotencyKey: key,
      notes: 'Demo SEMI_FINISHED_ISSUE',
    },
  });
  await bumpBalance(prisma, {
    inventoryItemId: args.inventoryItemId,
    warehouseId: args.warehouseId,
    delta: -args.qty,
    reservedDelta: 0,
  });
  await prisma.inventoryLot.update({
    where: { id: args.lotId },
    data: { status: InventoryLotStatus.CONSUMED },
  });
}

async function bumpBalance(
  prisma: PrismaClient,
  args: {
    inventoryItemId: string;
    warehouseId: string;
    delta: number;
    reservedDelta: number;
  },
) {
  const existing = await prisma.inventoryBalance.findFirst({
    where: {
      inventoryItemId: args.inventoryItemId,
      warehouseId: args.warehouseId,
      locationId: null,
    },
  });
  if (!existing) {
    await prisma.inventoryBalance.create({
      data: {
        inventoryItemId: args.inventoryItemId,
        warehouseId: args.warehouseId,
        availableQty: Math.max(0, args.delta),
        reservedQty: Math.max(0, args.reservedDelta),
      },
    });
    return;
  }
  await prisma.inventoryBalance.update({
    where: { id: existing.id },
    data: {
      availableQty: Number(existing.availableQty) + args.delta,
      reservedQty: Number(existing.reservedQty) + args.reservedDelta,
    },
  });
}

type RecipeProduct = {
  id: string;
  sku: string;
  nameEn: string;
  nameAr: string;
  nameHe?: string | null;
};

/**
 * Ensure standard SEMI (carpentry) + FIN (packaging) recipes for story SKUs.
 */
export async function ensureFurnitureInventoryRecipes(
  prisma: PrismaClient,
  products: RecipeProduct[],
): Promise<void> {
  const semiWh = await prisma.warehouse.findUniqueOrThrow({ where: { code: 'SEMI' } });
  const finWh = await prisma.warehouse.findUniqueOrThrow({ where: { code: 'FIN' } });

  for (const product of products) {
    const config = await prisma.productWorkflowConfiguration.findUnique({
      where: { productId: product.id },
      select: { workflowId: true },
    });
    const workflowId = config?.workflowId;
    if (!workflowId) continue;
    const wf = await prisma.productionWorkflow.findUnique({
      where: { id: workflowId },
      select: { activeVersionId: true },
    });
    if (!wf?.activeVersionId) continue;
    const nodes = await prisma.productionWorkflowNode.findMany({
      where: { workflowVersionId: wf.activeVersionId },
      include: { stageDefinition: true },
    });
    const byCode = new Map(nodes.map((n) => [n.stageDefinition.code, n]));
    const carpentry = byCode.get('CARPENTRY');
    const packaging = byCode.get('PACKAGING');
    const materialPrep = byCode.get('MATERIAL_PREP');

    const existingPrep = materialPrep
      ? await prisma.productStageInventoryOutput.findFirst({
          where: { productId: product.id, workflowNodeId: materialPrep.id },
        })
      : null;
    if (materialPrep && !existingPrep) {
      await prisma.productStageInventoryOutput.create({
        data: {
          productId: product.id,
          workflowNodeId: materialPrep.id,
          stageDefinitionId: materialPrep.stageDefinitionId,
          itemClass: InventoryItemClass.RAW_MATERIAL,
          inventoryTracking: InventoryTracking.NONE,
          consumesRawMaterials: true,
          consumesSemiFinished: false,
          outputNameEn: 'Materials',
          outputNameAr: 'مواد',
          outputNameHe: 'חומרים',
          outputQtyPerUnit: 1,
          unit: 'pcs',
        },
      });
    }

    let frameOutputId: string | null = null;
    if (carpentry) {
      const frameSku = `${product.sku}-FRAME`;
      let frame = await prisma.inventoryItem.findFirst({ where: { sku: frameSku } });
      if (!frame) {
        frame = await prisma.inventoryItem.create({
          data: {
            sku: frameSku,
            nameEn: `${product.nameEn} Frame`,
            nameAr: `هيكل ${product.nameAr}`,
            nameHe: product.nameHe ? `שלדת ${product.nameHe}` : null,
            category: 'SEMI_FINISHED',
            itemClass: InventoryItemClass.SEMI_FINISHED_GOOD,
            unit: 'pcs',
            isPurchasable: false,
            productId: product.id,
          },
        });
      }
      let out = await prisma.productStageInventoryOutput.findFirst({
        where: { productId: product.id, workflowNodeId: carpentry.id },
      });
      if (!out) {
        out = await prisma.productStageInventoryOutput.create({
          data: {
            productId: product.id,
            workflowNodeId: carpentry.id,
            stageDefinitionId: carpentry.stageDefinitionId,
            itemClass: InventoryItemClass.SEMI_FINISHED_GOOD,
            inventoryTracking: InventoryTracking.PRODUCES_SEMI_FINISHED,
            consumesRawMaterials: false,
            consumesSemiFinished: false,
            outputNameEn: frame.nameEn,
            outputNameAr: frame.nameAr,
            outputNameHe: frame.nameHe,
            outputQtyPerUnit: 1,
            unit: 'pcs',
            defaultWarehouseId: semiWh.id,
            inventoryItemId: frame.id,
          },
        });
      } else if (!out.inventoryItemId) {
        out = await prisma.productStageInventoryOutput.update({
          where: { id: out.id },
          data: { inventoryItemId: frame.id, defaultWarehouseId: semiWh.id },
        });
      }
      frameOutputId = out.id;
    }

    if (packaging) {
      const fgSku = `${product.sku}-FG`;
      let fg = await prisma.inventoryItem.findFirst({ where: { sku: fgSku } });
      if (!fg) {
        fg = await prisma.inventoryItem.create({
          data: {
            sku: fgSku,
            nameEn: `${product.nameEn} FG`,
            nameAr: `${product.nameAr} جاهز`,
            nameHe: product.nameHe ? `${product.nameHe} מוגמר` : null,
            category: 'FINISHED',
            itemClass: InventoryItemClass.FINISHED_GOOD,
            unit: 'pcs',
            isPurchasable: false,
            productId: product.id,
          },
        });
      }
      let out = await prisma.productStageInventoryOutput.findFirst({
        where: { productId: product.id, workflowNodeId: packaging.id },
      });
      if (!out) {
        out = await prisma.productStageInventoryOutput.create({
          data: {
            productId: product.id,
            workflowNodeId: packaging.id,
            stageDefinitionId: packaging.stageDefinitionId,
            itemClass: InventoryItemClass.FINISHED_GOOD,
            inventoryTracking: InventoryTracking.PRODUCES_FINISHED,
            consumesRawMaterials: false,
            consumesSemiFinished: true,
            outputNameEn: fg.nameEn,
            outputNameAr: fg.nameAr,
            outputNameHe: fg.nameHe,
            outputQtyPerUnit: 1,
            unit: 'pcs',
            defaultWarehouseId: finWh.id,
            inventoryItemId: fg.id,
          },
        });
      } else if (!out.inventoryItemId || !out.consumesSemiFinished) {
        out = await prisma.productStageInventoryOutput.update({
          where: { id: out.id },
          data: {
            inventoryItemId: fg.id,
            defaultWarehouseId: finWh.id,
            consumesSemiFinished: true,
            inventoryTracking: InventoryTracking.PRODUCES_FINISHED,
          },
        });
      }
      if (frameOutputId) {
        const link = await prisma.productStageInventoryInput.findFirst({
          where: { productId: product.id, workflowNodeId: packaging.id, outputId: frameOutputId },
        });
        if (!link) {
          await prisma.productStageInventoryInput.create({
            data: {
              productId: product.id,
              workflowNodeId: packaging.id,
              stageDefinitionId: packaging.stageDefinitionId,
              outputId: frameOutputId,
              qtyPerUnit: 1,
            },
          });
        }
      }
    }
  }
}

/**
 * Curated hybrid usage rows on Sweifieh carpentry: equal / variance / return / scrap.
 * Posts matching PRODUCTION_ISSUE + PRODUCTION_RETURN so inventory matches.
 */
export async function seedDemoMaterialUsageStories(params: {
  prisma: PrismaClient;
  productionOrderId: string;
  adminId: string;
  counters: SeqBag;
  at: Date;
}): Promise<void> {
  const { prisma } = params;
  const carpentryTask = await prisma.productionTask.findFirst({
    where: {
      productionOrderId: params.productionOrderId,
      stageDefinition: { code: 'CARPENTRY' },
      status: 'COMPLETED',
    },
    include: {
      stageInstance: true,
    },
  });
  if (!carpentryTask) return;

  const snap = carpentryTask.stageInstanceId
    ? await prisma.productionOrderWorkflowSnapshotNode.findFirst({
        where: { stageInstanceId: carpentryTask.stageInstanceId },
        include: { materialInputs: true },
      })
    : null;
  const inputs = snap?.materialInputs ?? [];
  if (!inputs.length) return;

  const rawWh =
    (await prisma.warehouse.findFirst({
      where: { type: WarehouseType.RAW_MATERIALS, isActive: true, isDefault: true },
    })) ??
    (await prisma.warehouse.findFirst({
      where: { type: WarehouseType.RAW_MATERIALS, isActive: true },
    }));
  if (!rawWh) return;

  for (let i = 0; i < inputs.length; i += 1) {
    const row = inputs[i]!;
    const expected = Number(row.qtyPerUnit) || 1;
    let actual = expected;
    let returned = 0;
    let scrap = 0;
    let reasonNotes: string | null = null;
    let scrapReason: MaterialScrapReason | null = null;

    if (i === 1) {
      actual = expected;
      returned = Math.max(0.5, Number((expected * 0.1).toFixed(3)));
      scrap = Math.max(0.25, Number((expected * 0.05).toFixed(3)));
      reasonNotes = 'Demo: cutting waste + unused return after fit-up';
      scrapReason = MaterialScrapReason.CUTTING_WASTE;
    }

    const varianceQty = actual - expected;
    await prisma.productionTaskMaterialUsage.upsert({
      where: {
        taskId_inventoryItemId: {
          taskId: carpentryTask.id,
          inventoryItemId: row.inventoryItemId,
        },
      },
      create: {
        taskId: carpentryTask.id,
        productionOrderId: params.productionOrderId,
        inventoryItemId: row.inventoryItemId,
        sku: row.sku,
        expectedQty: expected,
        actualQty: actual,
        returnedQty: returned,
        scrapQty: scrap,
        varianceQty,
        scrapReason,
        reasonNotes,
        recordedById: params.adminId,
        finalizedAt: params.at,
        finalizeIdempotencyKey: `demo-usage:${carpentryTask.id}:${row.inventoryItemId}`,
      },
      update: {
        expectedQty: expected,
        actualQty: actual,
        returnedQty: returned,
        scrapQty: scrap,
        varianceQty,
        scrapReason,
        reasonNotes,
        recordedById: params.adminId,
        finalizedAt: params.at,
        finalizeIdempotencyKey: `demo-usage:${carpentryTask.id}:${row.inventoryItemId}`,
      },
    });

    const issueQty = actual + returned + scrap;
    if (issueQty <= 0) continue;
    const issueKey = `demo-usage-issue:${carpentryTask.id}:${row.inventoryItemId}`;
    const existingIssue = await prisma.inventoryTransaction.findFirst({
      where: { idempotencyKey: issueKey },
    });
    if (!existingIssue) {
      await bumpBalance(prisma, {
        inventoryItemId: row.inventoryItemId,
        warehouseId: rawWh.id,
        delta: -issueQty,
        reservedDelta: 0,
      });
      await prisma.inventoryTransaction.create({
        data: {
          number: await nextDoc(prisma, 'invtx', params.counters),
          type: InventoryTxType.PRODUCTION_ISSUE,
          inventoryItemId: row.inventoryItemId,
          warehouseId: rawWh.id,
          quantity: -issueQty,
          createdById: params.adminId,
          createdAt: params.at,
          referenceType: 'ProductionTask',
          referenceId: carpentryTask.id,
          idempotencyKey: issueKey,
          notes:
            scrap > 0
              ? `Demo usage include scrap ${scrap} (${scrapReason ?? 'OTHER'})`
              : 'Demo equal usage',
        },
      });
    }
    if (returned > 0) {
      const returnKey = `demo-usage-return:${carpentryTask.id}:${row.inventoryItemId}`;
      const existingReturn = await prisma.inventoryTransaction.findFirst({
        where: { idempotencyKey: returnKey },
      });
      if (!existingReturn) {
        await bumpBalance(prisma, {
          inventoryItemId: row.inventoryItemId,
          warehouseId: rawWh.id,
          delta: returned,
          reservedDelta: 0,
        });
        await prisma.inventoryTransaction.create({
          data: {
            number: await nextDoc(prisma, 'invtx', params.counters),
            type: InventoryTxType.PRODUCTION_RETURN,
            inventoryItemId: row.inventoryItemId,
            warehouseId: rawWh.id,
            quantity: returned,
            createdById: params.adminId,
            createdAt: params.at,
            referenceType: 'ProductionTask',
            referenceId: carpentryTask.id,
            idempotencyKey: returnKey,
            notes: 'Demo unused return',
          },
        });
      }
    }
  }
}
