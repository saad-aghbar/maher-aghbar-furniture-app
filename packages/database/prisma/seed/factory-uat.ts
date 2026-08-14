import {
  InventoryItemClass,
  InventoryTracking,
  type PrismaClient,
} from '@prisma/client';
import { STANDARD_FURNITURE_WORKFLOW_CODE, STAGE_LIBRARY_NAME_HE } from './workflow';

const UAT_PARALLEL_WORKFLOW_CODE = 'UAT_PARALLEL';

/**
 * Isolated Product B graph: carpentry and foam are siblings after material prep.
 * Upholstery is DAG-ready after carpentry only, so missing foam kit fails closed
 * on inventory (no silent under-issue) instead of being hidden by a HARD edge.
 */
async function ensureUatParallelWorkflow(prisma: PrismaClient) {
  const codes = ['MATERIAL_PREP', 'CARPENTRY', 'FOAM', 'UPHOLSTERY', 'INSPECTION', 'PACKAGING'];
  const stages = await prisma.productionStageDefinition.findMany({
    where: { code: { in: codes } },
  });
  const byCode = new Map(stages.map((s) => [s.code, s]));
  for (const code of codes) {
    if (!byCode.has(code)) {
      throw new Error(`Factory UAT parallel workflow needs stage ${code}`);
    }
  }

  const workflow = await prisma.productionWorkflow.upsert({
    where: { code: UAT_PARALLEL_WORKFLOW_CODE },
    update: {
      nameEn: 'UAT parallel branches',
      nameAr: 'اختبار فروع متوازية',
      nameHe: 'ענפים מקבילים לבדיקה',
      status: 'ACTIVE',
      archivedAt: null,
    },
    create: {
      code: UAT_PARALLEL_WORKFLOW_CODE,
      nameEn: 'UAT parallel branches',
      nameAr: 'اختبار فروع متوازية',
      nameHe: 'ענפים מקבילים לבדיקה',
      status: 'ACTIVE',
    },
  });

  let version = await prisma.productionWorkflowVersion.findUnique({
    where: { workflowId_versionNumber: { workflowId: workflow.id, versionNumber: 1 } },
  });
  if (!version) {
    version = await prisma.productionWorkflowVersion.create({
      data: {
        workflowId: workflow.id,
        versionNumber: 1,
        status: 'PUBLISHED',
        name: 'UAT parallel v1',
        changelog: 'Fixture: parallel carpentry/foam; upholstery gated by inventory inputs.',
        publishedAt: new Date(),
      },
    });
  } else if (version.status !== 'PUBLISHED') {
    version = await prisma.productionWorkflowVersion.update({
      where: { id: version.id },
      data: { status: 'PUBLISHED', publishedAt: version.publishedAt ?? new Date() },
    });
  }

  const existingNodeCount = await prisma.productionWorkflowNode.count({
    where: { workflowVersionId: version.id },
  });
  if (existingNodeCount === 0) {
    let sortOrder = 1;
    for (const code of codes) {
      const stage = byCode.get(code)!;
      await prisma.productionWorkflowNode.create({
        data: {
          workflowVersionId: version.id,
          stageDefinitionId: stage.id,
          nodeKey: code,
          sortOrder: sortOrder,
          isRequiredByDefault: true,
          canBeSkipped: false,
          requiresInspectionOverride: stage.requiresInspection ? true : null,
          requiresPhotosOverride: false,
        },
      });
      sortOrder += 1;
    }
  }

  const graphNodes = await prisma.productionWorkflowNode.findMany({
    where: { workflowVersionId: version.id },
    include: { stageDefinition: true },
  });
  const nodeIds = new Map(graphNodes.map((n) => [n.stageDefinition.code, n.id]));
  const edges: Array<[string, string]> = [
    ['MATERIAL_PREP', 'CARPENTRY'],
    ['MATERIAL_PREP', 'FOAM'],
    ['CARPENTRY', 'UPHOLSTERY'],
    ['UPHOLSTERY', 'INSPECTION'],
    ['INSPECTION', 'PACKAGING'],
    // Foam is parallel (not a predecessor of upholstery) but must join the single terminal.
    ['FOAM', 'PACKAGING'],
  ];
  for (const [from, to] of edges) {
    const fromNodeId = nodeIds.get(from);
    const toNodeId = nodeIds.get(to);
    if (!fromNodeId || !toNodeId) continue;
    const exists = await prisma.productionWorkflowEdge.findFirst({
      where: { workflowVersionId: version.id, fromNodeId, toNodeId },
    });
    if (!exists) {
      await prisma.productionWorkflowEdge.create({
        data: {
          workflowVersionId: version.id,
          fromNodeId,
          toNodeId,
          dependencyType: 'HARD',
        },
      });
    }
  }

  await prisma.productionWorkflow.update({
    where: { id: workflow.id },
    data: { activeVersionId: version.id, status: 'ACTIVE' },
  });
  return prisma.productionWorkflow.findUniqueOrThrow({
    where: { id: workflow.id },
    include: { activeVersion: true },
  });
}

const UAT_SKUS = ['UAT-SOFA-A', 'UAT-SOFA-B', 'UAT-SOFA-C'] as const;

async function ensureBomSku(prisma: PrismaClient, sku: string, nameEn: string, nameAr: string) {
  const material = await prisma.material.upsert({
    where: { sku },
    update: { nameEn, nameAr },
    create: {
      sku,
      nameEn,
      nameAr,
      category: sku.includes('FAB') ? 'FABRIC' : 'WOOD',
      unit: 'pcs',
    },
  });
  await prisma.inventoryItem.upsert({
    where: { sku },
    update: { nameEn, nameAr, isPurchasable: true, itemClass: 'RAW_MATERIAL' },
    create: {
      sku,
      nameEn,
      nameAr,
      category: sku.includes('FAB') ? 'FABRIC' : 'WOOD',
      itemClass: 'RAW_MATERIAL',
      materialGroup: sku.includes('FAB') ? 'FABRIC' : 'WOOD',
      unit: 'pcs',
      isPurchasable: true,
      materialId: material.id,
    },
  });
  return sku;
}

async function ensureWipItem(
  prisma: PrismaClient,
  sku: string,
  productId: string,
  nameEn: string,
  nameAr: string,
  nameHe: string,
  itemClass: InventoryItemClass,
) {
  return prisma.inventoryItem.upsert({
    where: { sku },
    update: { nameEn, nameAr, nameHe, productId, itemClass, isPurchasable: false },
    create: {
      sku,
      nameEn,
      nameAr,
      nameHe,
      category: itemClass === InventoryItemClass.FINISHED_GOOD ? 'FINISHED' : 'SEMI_FINISHED',
      itemClass,
      unit: 'pcs',
      isPurchasable: false,
      productId,
    },
  });
}

async function upsertOutput(
  prisma: PrismaClient,
  args: {
    productId: string;
    nodeId: string;
    stageDefinitionId: string;
    itemClass: InventoryItemClass;
    tracking: InventoryTracking;
    consumesRaw: boolean;
    consumesSemi: boolean;
    nameEn: string;
    nameAr: string;
    nameHe: string;
    inventoryItemId: string | null;
    warehouseId: string | null;
  },
) {
  const existing = await prisma.productStageInventoryOutput.findFirst({
    where: { productId: args.productId, workflowNodeId: args.nodeId },
  });
  const data = {
    productId: args.productId,
    workflowNodeId: args.nodeId,
    stageDefinitionId: args.stageDefinitionId,
    itemClass: args.itemClass,
    inventoryTracking: args.tracking,
    consumesRawMaterials: args.consumesRaw,
    consumesSemiFinished: args.consumesSemi,
    outputNameEn: args.nameEn,
    outputNameAr: args.nameAr,
    outputNameHe: args.nameHe,
    outputQtyPerUnit: 1,
    unit: 'pcs',
    defaultWarehouseId: args.warehouseId,
    inventoryItemId: args.inventoryItemId,
  };
  return existing
    ? prisma.productStageInventoryOutput.update({ where: { id: existing.id }, data })
    : prisma.productStageInventoryOutput.create({ data });
}

/**
 * Isolated factory UAT fixtures. Names are fixtures only — never runtime branches.
 * Enable with SEED_FACTORY_UAT=1. Do not import from default seed.
 */
export async function seedFactoryUat(prisma: PrismaClient) {
  console.log('Seeding isolated factory UAT products…');

  for (const [code, nameHe] of Object.entries(STAGE_LIBRARY_NAME_HE)) {
    await prisma.productionStageDefinition.updateMany({
      where: { code },
      data: { nameHe },
    });
  }

  await prisma.warehouse.updateMany({
    where: { code: 'RAW' },
    data: { isDefault: true, type: 'RAW_MATERIALS' },
  });
  await prisma.warehouse.updateMany({
    where: { code: 'SEMI' },
    data: { isDefault: true, type: 'SEMI_FINISHED' },
  });
  await prisma.warehouse.updateMany({
    where: { code: 'FIN' },
    data: { isDefault: true, type: 'FINISHED_GOODS' },
  });
  const semiWh = await prisma.warehouse.findUnique({ where: { code: 'SEMI' } });
  const finWh = await prisma.warehouse.findUnique({ where: { code: 'FIN' } });

  const woodSku = await ensureBomSku(prisma, 'UAT-WOOD', 'UAT beech lumber', 'خشب اختبار');
  const fabSku = await ensureBomSku(prisma, 'UAT-FABRIC', 'UAT upholstery fabric', 'قماش اختبار');

  const category = await prisma.productCategory.findFirst({ where: { code: 'SOFAS' } })
    ?? await prisma.productCategory.findFirst();

  const standard = await prisma.productionWorkflow.findUnique({
    where: { code: STANDARD_FURNITURE_WORKFLOW_CODE },
    include: { activeVersion: true },
  });
  if (!standard?.activeVersionId) {
    console.warn('Factory UAT skipped: STANDARD_FURNITURE workflow is not published.');
    return;
  }
  const parallel = await ensureUatParallelWorkflow(prisma);

  const standardNodes = await prisma.productionWorkflowNode.findMany({
    where: { workflowVersionId: standard.activeVersionId },
    include: { stageDefinition: true },
  });
  const parallelNodes = await prisma.productionWorkflowNode.findMany({
    where: { workflowVersionId: parallel.activeVersionId! },
    include: { stageDefinition: true },
  });

  const products: Array<{
    sku: (typeof UAT_SKUS)[number];
    nameEn: string;
    nameAr: string;
    nameHe: string;
  }> = [
    { sku: 'UAT-SOFA-A', nameEn: 'UAT Standard Sofa', nameAr: 'كنبة اختبار قياسية', nameHe: 'ספת UAT רגילה' },
    { sku: 'UAT-SOFA-B', nameEn: 'UAT Parallel Sofa', nameAr: 'كنبة اختبار متوازية', nameHe: 'ספת UAT מקבילה' },
    { sku: 'UAT-SOFA-C', nameEn: 'UAT Optional Paint Sofa', nameAr: 'كنبة اختبار دهان اختياري', nameHe: 'ספת UAT עם צביעה אופציונלית' },
  ];

  for (const spec of products) {
    const product = await prisma.product.upsert({
      where: { sku: spec.sku },
      update: {
        nameEn: spec.nameEn,
        nameAr: spec.nameAr,
        nameHe: spec.nameHe,
        isActive: true,
        bomDefaults: { materials: [{ sku: woodSku, qty: 4 }, { sku: fabSku, qty: 8 }] },
      },
      create: {
        sku: spec.sku,
        nameEn: spec.nameEn,
        nameAr: spec.nameAr,
        nameHe: spec.nameHe,
        categoryId: category?.id,
        unit: 'pcs',
        isActive: true,
        bomDefaults: { materials: [{ sku: woodSku, qty: 4 }, { sku: fabSku, qty: 8 }] },
      },
    });

    const attachedWorkflow = spec.sku === 'UAT-SOFA-B' ? parallel : standard;
    const byCode = new Map(
      (spec.sku === 'UAT-SOFA-B' ? parallelNodes : standardNodes).map((n) => [
        n.stageDefinition.code,
        n,
      ]),
    );

    await prisma.productWorkflowConfiguration.upsert({
      where: { productId: product.id },
      create: { productId: product.id, workflowId: attachedWorkflow.id },
      update: { workflowId: attachedWorkflow.id },
    });

    const carpentry = byCode.get('CARPENTRY');
    const foam = byCode.get('FOAM');
    const painting = byCode.get('PAINTING');
    const upholstery = byCode.get('UPHOLSTERY');
    const packaging = byCode.get('PACKAGING');
    const materialPrep = byCode.get('MATERIAL_PREP');

    if (materialPrep) {
      await upsertOutput(prisma, {
        productId: product.id,
        nodeId: materialPrep.id,
        stageDefinitionId: materialPrep.stageDefinitionId,
        itemClass: InventoryItemClass.RAW_MATERIAL,
        tracking: InventoryTracking.NONE,
        consumesRaw: true,
        consumesSemi: false,
        nameEn: 'Materials',
        nameAr: 'مواد',
        nameHe: 'חומרים',
        inventoryItemId: null,
        warehouseId: null,
      });
    }

    if (carpentry) {
      const frame = await ensureWipItem(
        prisma,
        `${spec.sku}-FRAME`,
        product.id,
        `${spec.nameEn} Frame`,
        `هيكل ${spec.nameAr}`,
        `שלדת ${spec.nameHe}`,
        InventoryItemClass.SEMI_FINISHED_GOOD,
      );
      await upsertOutput(prisma, {
        productId: product.id,
        nodeId: carpentry.id,
        stageDefinitionId: carpentry.stageDefinitionId,
        itemClass: InventoryItemClass.SEMI_FINISHED_GOOD,
        tracking: InventoryTracking.PRODUCES_SEMI_FINISHED,
        consumesRaw: false,
        consumesSemi: false,
        nameEn: `${spec.nameEn} Frame`,
        nameAr: `هيكل ${spec.nameAr}`,
        nameHe: `שלדת ${spec.nameHe}`,
        inventoryItemId: frame.id,
        warehouseId: semiWh?.id ?? null,
      });
    }

    if (spec.sku === 'UAT-SOFA-B' && foam) {
      const kit = await ensureWipItem(
        prisma,
        `${spec.sku}-KIT`,
        product.id,
        `${spec.nameEn} Foam Kit`,
        `طقم إسفنج ${spec.nameAr}`,
        `ערכת ספוג ${spec.nameHe}`,
        InventoryItemClass.SEMI_FINISHED_GOOD,
      );
      await upsertOutput(prisma, {
        productId: product.id,
        nodeId: foam.id,
        stageDefinitionId: foam.stageDefinitionId,
        itemClass: InventoryItemClass.SEMI_FINISHED_GOOD,
        tracking: InventoryTracking.PRODUCES_SEMI_FINISHED,
        consumesRaw: false,
        consumesSemi: false,
        nameEn: `${spec.nameEn} Foam Kit`,
        nameAr: `طقم إسفنج ${spec.nameAr}`,
        nameHe: `ערכת ספוג ${spec.nameHe}`,
        inventoryItemId: kit.id,
        warehouseId: semiWh?.id ?? null,
      });
    }

    if (spec.sku === 'UAT-SOFA-C' && painting) {
      const painted = await ensureWipItem(
        prisma,
        `${spec.sku}-PAINT`,
        product.id,
        `${spec.nameEn} Painted Frame`,
        `هيكل دهان ${spec.nameAr}`,
        `שלדה צבועה ${spec.nameHe}`,
        InventoryItemClass.SEMI_FINISHED_GOOD,
      );
      await upsertOutput(prisma, {
        productId: product.id,
        nodeId: painting.id,
        stageDefinitionId: painting.stageDefinitionId,
        itemClass: InventoryItemClass.SEMI_FINISHED_GOOD,
        tracking: InventoryTracking.PRODUCES_SEMI_FINISHED,
        consumesRaw: false,
        consumesSemi: false,
        nameEn: `${spec.nameEn} Painted Frame`,
        nameAr: `هيكل دهان ${spec.nameAr}`,
        nameHe: `שלדה צבועה ${spec.nameHe}`,
        inventoryItemId: painted.id,
        warehouseId: semiWh?.id ?? null,
      });
      const config = await prisma.productWorkflowConfiguration.findUnique({
        where: { productId: product.id },
      });
      if (config) {
        await prisma.productWorkflowStageOverride.deleteMany({
          where: { configurationId: config.id, stageDefinitionId: painting.stageDefinitionId },
        });
        await prisma.productWorkflowStageOverride.create({
          data: {
            configurationId: config.id,
            productId: product.id,
            stageDefinitionId: painting.stageDefinitionId,
            workflowNodeId: painting.id,
            applicability: 'OPTIONAL',
          },
        });
      }
    }

    if (upholstery && carpentry) {
      const frameOut = await prisma.productStageInventoryOutput.findFirst({
        where: { productId: product.id, workflowNodeId: carpentry.id },
      });
      const foamOut =
        spec.sku === 'UAT-SOFA-B' && foam
          ? await prisma.productStageInventoryOutput.findFirst({
              where: { productId: product.id, workflowNodeId: foam.id },
            })
          : null;
      await upsertOutput(prisma, {
        productId: product.id,
        nodeId: upholstery.id,
        stageDefinitionId: upholstery.stageDefinitionId,
        itemClass: InventoryItemClass.RAW_MATERIAL,
        tracking: InventoryTracking.NONE,
        consumesRaw: false,
        consumesSemi: true,
        nameEn: 'Upholstery',
        nameAr: 'تنجيد',
        nameHe: 'ריפוד',
        inventoryItemId: null,
        warehouseId: null,
      });
      await prisma.productStageInventoryInput.deleteMany({
        where: { productId: product.id, workflowNodeId: upholstery.id },
      });
      if (frameOut) {
        await prisma.productStageInventoryInput.create({
          data: {
            productId: product.id,
            workflowNodeId: upholstery.id,
            stageDefinitionId: upholstery.stageDefinitionId,
            outputId: frameOut.id,
          },
        });
      }
      if (foamOut) {
        await prisma.productStageInventoryInput.create({
          data: {
            productId: product.id,
            workflowNodeId: upholstery.id,
            stageDefinitionId: upholstery.stageDefinitionId,
            outputId: foamOut.id,
          },
        });
      }
    }

    if (packaging) {
      const fg = await ensureWipItem(
        prisma,
        `${spec.sku}-FG`,
        product.id,
        spec.nameEn,
        spec.nameAr,
        spec.nameHe,
        InventoryItemClass.FINISHED_GOOD,
      );
      await upsertOutput(prisma, {
        productId: product.id,
        nodeId: packaging.id,
        stageDefinitionId: packaging.stageDefinitionId,
        itemClass: InventoryItemClass.FINISHED_GOOD,
        tracking: InventoryTracking.PRODUCES_FINISHED,
        consumesRaw: false,
        consumesSemi: false,
        nameEn: spec.nameEn,
        nameAr: spec.nameAr,
        nameHe: spec.nameHe,
        inventoryItemId: fg.id,
        warehouseId: finWh?.id ?? null,
      });
    }
  }

  console.log(`Factory UAT products: ${UAT_SKUS.join(', ')}`);

  await ensureSecondaryLifecycleWarehouses(prisma);
}

async function ensureSecondaryLifecycleWarehouses(prisma: PrismaClient) {
  const extras = [
    {
      code: 'RAW-2',
      type: 'RAW_MATERIALS' as const,
      nameEn: 'Raw Materials 2',
      nameAr: 'المواد الخام 2',
      nameHe: 'חומרי גלם 2',
    },
    {
      code: 'SEMI-2',
      type: 'SEMI_FINISHED' as const,
      nameEn: 'Semi-Finished 2',
      nameAr: 'منتجات نصف مصنّعة 2',
      nameHe: 'חצי מוגמר 2',
    },
    {
      code: 'FIN-2',
      type: 'FINISHED_GOODS' as const,
      nameEn: 'Finished Goods 2',
      nameAr: 'المنتجات الجاهزة 2',
      nameHe: 'מוצרים מוגמרים 2',
    },
  ];
  for (const wh of extras) {
    await prisma.warehouse.upsert({
      where: { code: wh.code },
      update: {
        type: wh.type,
        isDefault: false,
        isActive: true,
        nameEn: wh.nameEn,
        nameAr: wh.nameAr,
        nameHe: wh.nameHe,
      },
      create: { ...wh, isDefault: false, isActive: true },
    });
  }

  const raw = await prisma.warehouse.findUnique({ where: { code: 'RAW' } });
  const raw2 = await prisma.warehouse.findUnique({ where: { code: 'RAW-2' } });
  if (!raw || !raw2) return;

  const opening: Array<[string, number]> = [
    ['UAT-WOOD', 80],
    ['UAT-FABRIC', 40],
  ];
  for (const [sku, qty] of opening) {
    const item = await prisma.inventoryItem.findUnique({ where: { sku } });
    if (!item) continue;
    for (const warehouseId of [raw.id, raw2.id]) {
      const existing = await prisma.inventoryBalance.findFirst({
        where: { inventoryItemId: item.id, warehouseId, locationId: null },
      });
      if (existing) continue;
      await prisma.inventoryBalance.create({
        data: {
          inventoryItemId: item.id,
          warehouseId,
          availableQty: qty,
        },
      });
    }
  }
}
