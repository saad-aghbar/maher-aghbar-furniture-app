/**
 * Piece 4 deterministic manufacturing-spec examples (P4-A–H).
 * Preserves Piece 1–3 rows; demonstrates STANDARD / MODIFIED / CUSTOM dossiers,
 * cost unavailable, shortage, multi-line, and released freeze vs catalog drift.
 */
import {
  InventoryCategory,
  InventoryItemClass,
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

type MaterialCreate = {
  inventoryItemId?: string;
  sku?: string;
  displayName?: string;
  category?: InventoryCategory;
  unit: string;
  expectedQty: number;
  source: SalesOrderMaterialRequirementSource;
  needsReview: boolean;
  requestedFabricLabel?: string;
  notes?: string;
  sortOrder: number;
};

export async function seedPiece4ManufacturingSpecExamples(
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

  // Prefer in-memory catalog dims so P4-H bump stays idempotent within a full demo seed.
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
        select: {
          id: true,
          sku: true,
          nameEn: true,
          category: true,
          unit: true,
          standardCost: true,
        },
      },
    },
    take: 20,
  });

  const inventoryItems = await prisma.inventoryItem.findMany({
    where: { archivedAt: null, isActive: true, itemClass: 'RAW_MATERIAL' },
    take: 20,
    orderBy: { sku: 'asc' },
  });
  const fabricItem =
    inventoryItems.find((i) => i.category === 'FABRIC') ?? inventoryItems[0] ?? null;
  const woodItem =
    inventoryItems.find((i) => i.category === 'WOOD') ?? inventoryItems[1] ?? inventoryItems[0] ?? null;

  // P4-E: inventory item with null/0 standardCost (create or find).
  let zeroCostItem =
    inventoryItems.find((i) => i.standardCost == null || Number(i.standardCost) === 0) ?? null;
  if (!zeroCostItem) {
    zeroCostItem = await prisma.inventoryItem.upsert({
      where: { sku: 'P4-ZERO-COST' },
      update: { standardCost: money(0), isActive: true, archivedAt: null },
      create: {
        sku: 'P4-ZERO-COST',
        nameEn: 'Demo zero-cost trim',
        nameAr: 'تقليم بدون تكلفة (تجريبي)',
        category: InventoryCategory.OTHER,
        itemClass: InventoryItemClass.RAW_MATERIAL,
        unit: 'pcs',
        standardCost: money(0),
        isPurchasable: true,
        isActive: true,
        qrCode: 'P4-ZERO-COST',
      },
    });
  } else if (Number(zeroCostItem.standardCost) !== 0) {
    await prisma.inventoryItem.update({
      where: { id: zeroCostItem.id },
      data: { standardCost: money(0) },
    });
  }

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

  const anyDoc = await prisma.document.findFirst({
    where: { archivedAt: null },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });
  const referenceDocIds = anyDoc ? [anyDoc.id] : [];

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

  function catalogMaterialCreates(needsReview: boolean, fabricLabel?: string | null): MaterialCreate[] {
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
    ].filter(Boolean) as MaterialCreate[];
    return rows;
  }

  function manualMaterialCreates(): MaterialCreate[] {
    return [
      woodItem && {
        inventoryItemId: woodItem.id,
        sku: woodItem.sku,
        displayName: woodItem.nameEn,
        category: woodItem.category,
        unit: woodItem.unit,
        expectedQty: 6,
        source: SalesOrderMaterialRequirementSource.CUSTOM,
        needsReview: false,
        notes: 'Factory-entered custom build wood',
        sortOrder: 0,
      },
      {
        sku: 'CUSTOM-FABRIC',
        displayName: 'Customer-supplied linen',
        category: InventoryCategory.FABRIC,
        unit: 'm',
        expectedQty: 18,
        source: SalesOrderMaterialRequirementSource.CUSTOM,
        needsReview: true,
        requestedFabricLabel: 'Linen Sand',
        notes: 'Manual fabric — no catalog SKU',
        sortOrder: 1,
      },
    ].filter(Boolean) as MaterialCreate[];
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
    materials: MaterialCreate[];
    workflowId?: string | null;
    confirmWorkflow?: boolean;
    factoryNotes?: string;
    measurements?: unknown;
    referenceDocumentIds?: string[];
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
            measurements: input.measurements ?? undefined,
            referenceDocumentIds: input.referenceDocumentIds ?? undefined,
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

  // ── P4-A — STANDARD sofa, catalog seed, costs available ─────────────────
  {
    const so = await upsertAcceptedSo({
      soNumber: 'SO-P4-A',
      qtNumber: 'QT-P4-A',
      customerId: oasis.id,
      projectName: 'Piece4 Standard Spec',
      externalOrderNumber: 'P4-A',
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
      status: SalesOrderProductionSetupStatus.SETUP_IN_PROGRESS,
      lineStatus: SalesOrderLineSetupStatus.NOT_STARTED,
      complexity: ManufacturingComplexity.STANDARD,
      manufacturingName: product.nameEn,
      catalogDimensions: { width: catalogW, height: catalogH, depth: catalogD },
      orderDimensions: { width: catalogW, height: catalogH, depth: catalogD },
      materials: mats,
      workflowId,
      confirmWorkflow: Boolean(workflowId),
      factoryNotes: 'P4-A: STANDARD — catalog materials with costs',
    });
  }

  // ── P4-B — MODIFIED dims (catalog width → width+20) ─────────────────────
  {
    const orderW = catalogW + 20;
    const so = await upsertAcceptedSo({
      soNumber: 'SO-P4-B',
      qtNumber: 'QT-P4-B',
      customerId: oasis.id,
      projectName: 'Piece4 Modified Dimensions',
      externalOrderNumber: 'P4-B',
      complexity: ManufacturingComplexity.MODIFIED,
      productId: product.id,
      description: `${product.nameEn} (wider)`,
      quantity: 1,
      specifications: `Dims: ${orderW}×${catalogH}×${catalogD} cm (catalog ${catalogW})`,
      orderSpec: {
        productId: product.id,
        productName: product.nameEn,
        quantity: 1,
        manufacturingComplexity: 'MODIFIED',
        catalogDimensions: { width: catalogW, height: catalogH, depth: catalogD },
        requestedDimensions: { width: orderW, height: catalogH, depth: catalogD },
      },
    });
    const line = so.lines[0]!;
    await createSetup({
      salesOrderId: so.id,
      lineId: line.id,
      status: SalesOrderProductionSetupStatus.SETUP_IN_PROGRESS,
      lineStatus: SalesOrderLineSetupStatus.NEEDS_REVIEW,
      complexity: ManufacturingComplexity.MODIFIED,
      manufacturingName: `${product.nameEn} (wider)`,
      catalogDimensions: { width: catalogW, height: catalogH, depth: catalogD },
      orderDimensions: { width: orderW, height: catalogH, depth: catalogD },
      materials: catalogMaterialCreates(false),
      workflowId,
      confirmWorkflow: Boolean(workflowId),
      factoryNotes: 'P4-B: MODIFIED — width catalog vs order (+20)',
      measurements: [
        {
          key: 'width',
          label: 'Width',
          value: orderW,
          unit: 'cm',
          catalogValue: catalogW,
        },
      ],
    });
  }

  // ── P4-C — MODIFIED fabric; FABRIC needsReview ──────────────────────────
  {
    const fabricLabel = 'Bouclé Ivory';
    const so = await upsertAcceptedSo({
      soNumber: 'SO-P4-C',
      qtNumber: 'QT-P4-C',
      customerId: nile.id,
      projectName: 'Piece4 Modified Fabric',
      externalOrderNumber: 'P4-C',
      complexity: ManufacturingComplexity.MODIFIED,
      productId: product.id,
      description: `${product.nameEn} (custom fabric)`,
      quantity: 1,
      specifications: `Fabric: ${fabricLabel}`,
      orderSpec: {
        productId: product.id,
        productName: product.nameEn,
        quantity: 1,
        manufacturingComplexity: 'MODIFIED',
        catalogDimensions: { width: catalogW, height: catalogH, depth: catalogD },
        requestedDimensions: { width: catalogW, height: catalogH, depth: catalogD },
        fabric: { type: 'Bouclé', color: 'Ivory' },
      },
    });
    const line = so.lines[0]!;
    await createSetup({
      salesOrderId: so.id,
      lineId: line.id,
      status: SalesOrderProductionSetupStatus.SETUP_IN_PROGRESS,
      lineStatus: SalesOrderLineSetupStatus.NEEDS_REVIEW,
      complexity: ManufacturingComplexity.MODIFIED,
      manufacturingName: `${product.nameEn} (custom fabric)`,
      catalogDimensions: { width: catalogW, height: catalogH, depth: catalogD },
      orderDimensions: { width: catalogW, height: catalogH, depth: catalogD },
      requestedFabricLabel: fabricLabel,
      materials: catalogMaterialCreates(true, fabricLabel),
      workflowId,
      confirmWorkflow: Boolean(workflowId),
      factoryNotes: 'P4-C: MODIFIED fabric — FABRIC needsReview',
    });
  }

  // ── P4-D — CUSTOM; measurements; manual materials; reference photo ──────
  {
    const so = await upsertAcceptedSo({
      soNumber: 'SO-P4-D',
      qtNumber: 'QT-P4-D',
      customerId: nile.id,
      projectName: 'Piece4 Custom Build',
      externalOrderNumber: 'P4-D',
      complexity: ManufacturingComplexity.CUSTOM,
      productId: null,
      description: 'Bespoke lounge daybed — Nile custom',
      quantity: 1,
      orderSpec: {
        productId: null,
        productName: 'Bespoke lounge daybed',
        quantity: 1,
        manufacturingComplexity: 'CUSTOM',
        requestedDimensions: { width: 210, height: 75, depth: 95 },
        customMeasurements: [
          { key: 'arm_height', label: 'Arm height', value: 62, unit: 'cm' },
          { key: 'seat_depth', label: 'Seat depth', value: 58, unit: 'cm' },
        ],
        notes: 'Reference sketch from dealer',
      },
    });
    const line = so.lines[0]!;
    await createSetup({
      salesOrderId: so.id,
      lineId: line.id,
      status: SalesOrderProductionSetupStatus.SETUP_REQUIRED,
      lineStatus: SalesOrderLineSetupStatus.NOT_STARTED,
      complexity: ManufacturingComplexity.CUSTOM,
      manufacturingName: 'Bespoke lounge daybed — Nile custom',
      catalogDimensions: {},
      orderDimensions: { width: 210, height: 75, depth: 95 },
      materials: manualMaterialCreates(),
      workflowId: null,
      confirmWorkflow: false,
      factoryNotes: 'P4-D: CUSTOM — manual materials + measurements',
      measurements: [
        { key: 'arm_height', label: 'Arm height', value: 62, unit: 'cm' },
        { key: 'seat_depth', label: 'Seat depth', value: 58, unit: 'cm' },
        { key: 'leg_height', label: 'Leg height', value: 12, unit: 'cm' },
      ],
      referenceDocumentIds: referenceDocIds,
    });
  }

  // ── P4-E — Cost unavailable (zero-cost inventory item) ──────────────────
  {
    const so = await upsertAcceptedSo({
      soNumber: 'SO-P4-E',
      qtNumber: 'QT-P4-E',
      customerId: oasis.id,
      projectName: 'Piece4 Cost Unavailable',
      externalOrderNumber: 'P4-E',
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
    const mats: MaterialCreate[] = [
      ...catalogMaterialCreates(false).map((m) => ({ ...m, needsReview: false })),
      {
        inventoryItemId: zeroCostItem.id,
        sku: zeroCostItem.sku,
        displayName: zeroCostItem.nameEn,
        category: zeroCostItem.category,
        unit: zeroCostItem.unit,
        expectedQty: 2,
        source: SalesOrderMaterialRequirementSource.FACTORY_MODIFIED,
        needsReview: false,
        notes: 'P4-E: intentional zero standardCost',
        sortOrder: 99,
      },
    ];
    await createSetup({
      salesOrderId: so.id,
      lineId: line.id,
      status: SalesOrderProductionSetupStatus.SETUP_IN_PROGRESS,
      lineStatus: SalesOrderLineSetupStatus.NEEDS_REVIEW,
      complexity: ManufacturingComplexity.STANDARD,
      manufacturingName: product.nameEn,
      catalogDimensions: { width: catalogW, height: catalogH, depth: catalogD },
      orderDimensions: { width: catalogW, height: catalogH, depth: catalogD },
      materials: mats,
      workflowId,
      confirmWorkflow: Boolean(workflowId),
      factoryNotes: 'P4-E: at least one material with cost unavailable',
    });
  }

  // ── P4-F — Material shortage (huge expectedQty) ─────────────────────────
  {
    const so = await upsertAcceptedSo({
      soNumber: 'SO-P4-F',
      qtNumber: 'QT-P4-F',
      customerId: nile.id,
      projectName: 'Piece4 Material Shortage',
      externalOrderNumber: 'P4-F',
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
      factoryNotes: 'P4-F: intentional shortage — huge expectedQty',
    });
  }

  // ── P4-G — Multi-line: STANDARD + MODIFIED + CUSTOM ─────────────────────
  {
    const soNumber = 'SO-P4-G';
    const qtNumber = 'QT-P4-G';
    const lineDefs = [
      {
        complexity: ManufacturingComplexity.STANDARD,
        productId: product.id as string | null,
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
        sortOrder: 0,
      },
      {
        complexity: ManufacturingComplexity.MODIFIED,
        productId: product.id as string | null,
        description: `${product.nameEn} (mod width)`,
        quantity: 1,
        orderSpec: {
          productId: product.id,
          productName: product.nameEn,
          quantity: 1,
          manufacturingComplexity: 'MODIFIED',
          catalogDimensions: { width: catalogW, height: catalogH, depth: catalogD },
          requestedDimensions: { width: catalogW + 20, height: catalogH, depth: catalogD },
        },
        sortOrder: 1,
      },
      {
        complexity: ManufacturingComplexity.CUSTOM,
        productId: null as string | null,
        description: 'Bespoke ottoman — multi-line CUSTOM',
        quantity: 1,
        orderSpec: {
          productId: null,
          productName: 'Bespoke ottoman',
          quantity: 1,
          manufacturingComplexity: 'CUSTOM',
          requestedDimensions: { width: 80, height: 45, depth: 80 },
          customMeasurements: [
            { key: 'cushion_thickness', label: 'Cushion thickness', value: 15, unit: 'cm' },
          ],
        },
        sortOrder: 2,
      },
    ];
    const qtySum = lineDefs.reduce((s, l) => s + l.quantity, 0);
    const totals = lineTotals(qtySum, unitPriceNum, VAT);
    const perLine = lineTotals(1, unitPriceNum, VAT);

    const quote = await prisma.quotation.upsert({
      where: { number_version: { number: qtNumber, version: 1 } },
      update: { status: QuotationStatus.ACCEPTED, sentAt, acceptedAt },
      create: {
        number: qtNumber,
        version: 1,
        customerId: oasis.id,
        status: QuotationStatus.ACCEPTED,
        sentAt,
        acceptedAt,
        acceptedById: opts.adminUserId,
        subtotal: totals.subtotalM,
        taxTotal: totals.taxAmountM,
        total: totals.lineTotalM,
        lines: {
          create: lineDefs.map((l) => ({
            productId: l.productId ?? undefined,
            description: l.description,
            quantity: l.quantity,
            unitPrice,
            taxRate: VAT,
            subtotal: perLine.subtotalM,
            taxAmount: perLine.taxAmountM,
            lineTotal: perLine.lineTotalM,
            manufacturingComplexity: l.complexity,
            sortOrder: l.sortOrder,
          })),
        },
      },
    });

    let so = await prisma.salesOrder.findUnique({
      where: { number: soNumber },
      include: { lines: true, productionOrders: { select: { id: true } } },
    });
    if (so?.productionOrders.length) {
      // Keep released/PO-linked rows stable.
    } else {
      if (so) {
        await prisma.salesOrderLineMaterialRequirement.deleteMany({
          where: { lineSetup: { productionSetup: { salesOrderId: so.id } } },
        });
        await prisma.salesOrderLineSetup.deleteMany({
          where: { productionSetup: { salesOrderId: so.id } },
        });
        await prisma.salesOrderProductionSetup.deleteMany({ where: { salesOrderId: so.id } });
        await prisma.salesOrderLine.deleteMany({ where: { salesOrderId: so.id } });
        await prisma.salesOrder.update({
          where: { id: so.id },
          data: {
            status: SalesOrderStatus.DRAFT,
            archivedAt: null,
            projectName: 'Piece4 Multi-Line Mix',
            externalOrderNumber: 'P4-G',
            quotationId: quote.id,
            subtotal: totals.subtotalM,
            taxTotal: totals.taxAmountM,
            total: totals.lineTotalM,
          },
        });
        for (const l of lineDefs) {
          await prisma.salesOrderLine.create({
            data: {
              salesOrderId: so.id,
              productId: l.productId ?? undefined,
              description: l.description,
              quantity: l.quantity,
              unitPrice,
              taxRate: VAT,
              lineTotal: perLine.lineTotalM,
              manufacturingComplexity: l.complexity,
              orderSpec: l.orderSpec,
              sortOrder: l.sortOrder,
            },
          });
        }
      } else {
        so = await prisma.salesOrder.create({
          data: {
            number: soNumber,
            customerId: oasis.id,
            quotationId: quote.id,
            status: SalesOrderStatus.DRAFT,
            externalOrderNumber: 'P4-G',
            projectName: 'Piece4 Multi-Line Mix',
            subtotal: totals.subtotalM,
            taxTotal: totals.taxAmountM,
            total: totals.lineTotalM,
            createdById: opts.adminUserId,
            lines: {
              create: lineDefs.map((l) => ({
                productId: l.productId ?? undefined,
                description: l.description,
                quantity: l.quantity,
                unitPrice,
                taxRate: VAT,
                lineTotal: perLine.lineTotalM,
                manufacturingComplexity: l.complexity,
                orderSpec: l.orderSpec,
                sortOrder: l.sortOrder,
              })),
            },
          },
          include: { lines: true },
        });
      }

      so = await prisma.salesOrder.findUniqueOrThrow({
        where: { number: soNumber },
        include: { lines: { orderBy: { sortOrder: 'asc' } } },
      });

      const existingSetup = await prisma.salesOrderProductionSetup.findUnique({
        where: { salesOrderId: so.id },
      });
      if (!existingSetup) {
        const stdLine = so.lines.find((l) => l.manufacturingComplexity === 'STANDARD')!;
        const modLine = so.lines.find((l) => l.manufacturingComplexity === 'MODIFIED')!;
        const customLine = so.lines.find((l) => l.manufacturingComplexity === 'CUSTOM')!;
        await prisma.salesOrderProductionSetup.create({
          data: {
            salesOrderId: so.id,
            status: SalesOrderProductionSetupStatus.SETUP_IN_PROGRESS,
            lines: {
              create: [
                {
                  salesOrderLineId: stdLine.id,
                  status: SalesOrderLineSetupStatus.NOT_STARTED,
                  manufacturingName: product.nameEn,
                  manufacturingComplexity: ManufacturingComplexity.STANDARD,
                  catalogDimensions: { width: catalogW, height: catalogH, depth: catalogD },
                  orderDimensions: { width: catalogW, height: catalogH, depth: catalogD },
                  workflowId: workflowId ?? undefined,
                  workflowConfirmedAt: workflowId ? new Date() : undefined,
                  packagingExpectation,
                  factoryNotes: 'P4-G line STANDARD',
                  materialRequirements: {
                    create: catalogMaterialCreates(false).map((m) => ({
                      ...m,
                      needsReview: false,
                    })),
                  },
                },
                {
                  salesOrderLineId: modLine.id,
                  status: SalesOrderLineSetupStatus.NEEDS_REVIEW,
                  manufacturingName: `${product.nameEn} (mod width)`,
                  manufacturingComplexity: ManufacturingComplexity.MODIFIED,
                  catalogDimensions: { width: catalogW, height: catalogH, depth: catalogD },
                  orderDimensions: {
                    width: catalogW + 20,
                    height: catalogH,
                    depth: catalogD,
                  },
                  workflowId: workflowId ?? undefined,
                  workflowConfirmedAt: workflowId ? new Date() : undefined,
                  packagingExpectation,
                  factoryNotes: 'P4-G line MODIFIED',
                  materialRequirements: {
                    create: catalogMaterialCreates(false),
                  },
                },
                {
                  salesOrderLineId: customLine.id,
                  status: SalesOrderLineSetupStatus.NOT_STARTED,
                  manufacturingName: 'Bespoke ottoman — multi-line CUSTOM',
                  manufacturingComplexity: ManufacturingComplexity.CUSTOM,
                  catalogDimensions: {},
                  orderDimensions: { width: 80, height: 45, depth: 80 },
                  measurements: [
                    {
                      key: 'cushion_thickness',
                      label: 'Cushion thickness',
                      value: 15,
                      unit: 'cm',
                    },
                  ],
                  packagingExpectation,
                  factoryNotes: 'P4-G line CUSTOM',
                  materialRequirements: { create: manualMaterialCreates() },
                },
              ],
            },
          },
        });
      }
    }
  }

  // ── P4-H — RELEASED + PO; freeze then bump product.width ───────────────
  {
    const so = await upsertAcceptedSo({
      soNumber: 'SO-P4-H',
      qtNumber: 'QT-P4-H',
      customerId: oasis.id,
      projectName: 'Piece4 Released Freeze',
      externalOrderNumber: 'P4-H',
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

    const existingSetup = await prisma.salesOrderProductionSetup.findUnique({
      where: { salesOrderId: so.id },
    });
    if (!existingSetup) {
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
        factoryNotes: 'P4-H: RELEASED — setup/PO materials frozen vs later catalog bump',
      });
    }

    let po =
      (await prisma.productionOrder.findUnique({ where: { number: 'PO-P4-H' } })) ??
      (await prisma.productionOrder.findFirst({ where: { salesOrderId: so.id } }));

    if (!po) {
      po = await prisma.productionOrder.create({
        data: {
          number: 'PO-P4-H',
          salesOrderId: so.id,
          salesOrderLineId: line.id,
          customerId: oasis.id,
          productId: product.id,
          productDescription: product.nameEn,
          quantity: 1,
          status: 'PLANNED',
          createdById: opts.adminUserId,
          notes: 'P4-H released freeze demo',
        },
      });
    } else {
      await prisma.productionOrder.update({
        where: { id: po.id },
        data: {
          salesOrderId: so.id,
          salesOrderLineId: line.id,
          status: 'PLANNED',
          notes: 'P4-H released freeze demo',
          archivedAt: null,
        },
      });
    }

    await prisma.salesOrder.update({
      where: { id: so.id },
      data: { status: SalesOrderStatus.READY_FOR_PRODUCTION },
    });

    // Snapshot materials when workflow is available (freeze catalog material map).
    if (po && workflowId) {
      let snapshot = await prisma.productionOrderWorkflowSnapshot.findUnique({
        where: { productionOrderId: po.id },
        include: { nodes: true },
      });

      if (!snapshot) {
        const wf = await prisma.productionWorkflow.findUnique({
          where: { id: workflowId },
          select: {
            id: true,
            activeVersion: {
              select: {
                id: true,
                versionNumber: true,
                nodes: {
                  orderBy: { sortOrder: 'asc' },
                  select: {
                    id: true,
                    nodeKey: true,
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
        if (version) {
          snapshot = await prisma.productionOrderWorkflowSnapshot.create({
            data: {
              productionOrderId: po.id,
              sourceWorkflowId: workflowId,
              sourceWorkflowVersionId: version.id,
              sourceVersionNumber: version.versionNumber,
            },
            include: { nodes: true },
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
                executionKind: n.stageDefinition.executionKind ?? 'PRODUCTION',
              },
            });
            snapNodeIdBySource.set(n.id, snapNode.id);

            // Freeze material inputs onto the first executable-ish node that has catalog mats.
            if (mats.length && snapNodeIdBySource.size === 1) {
              for (const m of mats) {
                if (!m.inventoryItemId || !m.sku) continue;
                await prisma.productionOrderWorkflowSnapshotMaterialInput.create({
                  data: {
                    snapshotNodeId: snapNode.id,
                    stageCode,
                    inventoryItemId: m.inventoryItemId,
                    sku: m.sku,
                    qtyPerUnit: m.expectedQty,
                    unit: m.unit,
                    required: true,
                  },
                });
              }
            }
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
        }
      }
    }

    // After freeze: bump catalog product.width so live catalog ≠ setup/PO snapshot.
    await prisma.product.update({
      where: { id: product.id },
      data: { width: catalogW + 20 },
    });
  }

  console.log('  piece4: P4-A–H manufacturing spec examples seeded');
}
