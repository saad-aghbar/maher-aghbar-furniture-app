/**
 * Recompute manufacturingComplexity with the tightened classifier.
 *
 * Skips sales orders whose production is released or started.
 * Does not invent MIXED. Does not touch lifecycle statuses.
 *
 * Usage:
 *   DRY_RUN=1 pnpm --filter @maher/database exec tsx prisma/scripts/backfill-manufacturing-complexity.ts
 *   pnpm --filter @maher/database exec tsx prisma/scripts/backfill-manufacturing-complexity.ts
 */
import { config } from 'dotenv';
import { resolve } from 'path';
import { PrismaClient } from '@prisma/client';
import { classifyManufacturingComplexity } from '../../../types/src/manufacturing-complexity';

config({ path: resolve(__dirname, '../../../../.env') });

const prisma = new PrismaClient();
const dryRun = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';

const LOCKED_PO_STATUSES = [
  'IN_PROGRESS',
  'ON_HOLD',
  'QUALITY_CHECK',
  'READY_FOR_PACKAGING',
  'READY_FOR_DELIVERY',
  'COMPLETED',
] as const;

function num(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function catalogFromProduct(product: {
  width?: unknown;
  height?: unknown;
  depth?: unknown;
  seatHeight?: unknown;
  customMeasurements?: unknown;
} | null) {
  if (!product) return null;
  return {
    width: num(product.width),
    height: num(product.height),
    depth: num(product.depth),
    seatHeight: num(product.seatHeight),
    customMeasurements: product.customMeasurements,
  };
}

type Tally = Record<'STANDARD' | 'MODIFIED' | 'CUSTOM' | 'NULL', number>;

function emptyTally(): Tally {
  return { STANDARD: 0, MODIFIED: 0, CUSTOM: 0, NULL: 0 };
}

async function tallyRequestItems(): Promise<Tally> {
  const rows = await prisma.requestItem.groupBy({
    by: ['manufacturingComplexity'],
    _count: { _all: true },
  });
  const tally = emptyTally();
  for (const row of rows) {
    const count = row._count._all;
    if (row.manufacturingComplexity === 'STANDARD') tally.STANDARD = count;
    else if (row.manufacturingComplexity === 'MODIFIED') tally.MODIFIED = count;
    else if (row.manufacturingComplexity === 'CUSTOM') tally.CUSTOM = count;
    else tally.NULL = count;
  }
  return tally;
}

async function tallyQuotationLines(): Promise<Tally> {
  const rows = await prisma.quotationLine.groupBy({
    by: ['manufacturingComplexity'],
    _count: { _all: true },
  });
  const tally = emptyTally();
  for (const row of rows) {
    if (row.manufacturingComplexity === 'STANDARD') tally.STANDARD = row._count._all;
    else if (row.manufacturingComplexity === 'MODIFIED') tally.MODIFIED = row._count._all;
    else if (row.manufacturingComplexity === 'CUSTOM') tally.CUSTOM = row._count._all;
    else tally.NULL = row._count._all;
  }
  return tally;
}

async function tallySalesOrderLines(): Promise<Tally> {
  const rows = await prisma.salesOrderLine.groupBy({
    by: ['manufacturingComplexity'],
    _count: { _all: true },
  });
  const tally = emptyTally();
  for (const row of rows) {
    if (row.manufacturingComplexity === 'STANDARD') tally.STANDARD = row._count._all;
    else if (row.manufacturingComplexity === 'MODIFIED') tally.MODIFIED = row._count._all;
    else if (row.manufacturingComplexity === 'CUSTOM') tally.CUSTOM = row._count._all;
    else tally.NULL = row._count._all;
  }
  return tally;
}

function printTally(label: string, tally: Tally) {
  console.log(
    `${label}: STANDARD=${tally.STANDARD} MODIFIED=${tally.MODIFIED} CUSTOM=${tally.CUSTOM} NULL=${tally.NULL}`,
  );
}

async function lockedSalesOrderIds(): Promise<Set<string>> {
  const pos = await prisma.productionOrder.findMany({
    where: {
      salesOrderId: { not: null },
      OR: [
        { releasedToFactoryAt: { not: null } },
        { actualStartDate: { not: null } },
        { status: { in: [...LOCKED_PO_STATUSES] } },
      ],
    },
    select: { salesOrderId: true },
  });
  return new Set(
    pos.map((po) => po.salesOrderId).filter((id): id is string => Boolean(id)),
  );
}

async function main() {
  console.log(`Backfill manufacturingComplexity dryRun=${dryRun}`);

  const before = {
    requestItems: await tallyRequestItems(),
    quotationLines: await tallyQuotationLines(),
    salesOrderLines: await tallySalesOrderLines(),
  };
  printTally('before request_items', before.requestItems);
  printTally('before quotation_lines', before.quotationLines);
  printTally('before sales_order_lines', before.salesOrderLines);

  const locked = await lockedSalesOrderIds();
  console.log(`locked sales orders (released/started): ${locked.size}`);

  let requestChanged = 0;
  let quotationChanged = 0;
  let salesOrderChanged = 0;
  let salesOrderSkipped = 0;

  const requestItems = await prisma.requestItem.findMany({
    include: {
      product: {
        select: {
          width: true,
          height: true,
          depth: true,
          seatHeight: true,
          customMeasurements: true,
        },
      },
    },
  });
  for (const item of requestItems) {
    const next = classifyManufacturingComplexity({
      productId: item.productId,
      width: num(item.width),
      height: num(item.height),
      depth: num(item.depth),
      seatHeight: num(item.seatHeight),
      material: item.material,
      woodType: item.woodType,
      woodColor: item.woodColor,
      foamDensity: item.foamDensity,
      finish: item.finish,
      accessories: item.accessories,
      customMeasurements: item.customMeasurements,
      catalog: catalogFromProduct(item.product),
    });
    if (item.manufacturingComplexity === next) continue;
    requestChanged += 1;
    if (dryRun) continue;
    await prisma.requestItem.update({
      where: { id: item.id },
      data: { manufacturingComplexity: next },
    });
  }

  const quotationLines = await prisma.quotationLine.findMany({
    include: {
      product: {
        select: {
          width: true,
          height: true,
          depth: true,
          seatHeight: true,
          customMeasurements: true,
        },
      },
    },
  });
  for (const line of quotationLines) {
    const next = classifyManufacturingComplexity({
      productId: line.productId,
      width: num(line.width),
      height: num(line.height),
      depth: num(line.depth),
      material: line.material,
      customMeasurements: line.customMeasurements,
      catalog: catalogFromProduct(line.product),
    });
    if (line.manufacturingComplexity === next) continue;
    quotationChanged += 1;
    if (dryRun) continue;
    await prisma.quotationLine.update({
      where: { id: line.id },
      data: { manufacturingComplexity: next },
    });
  }

  const salesOrderLines = await prisma.salesOrderLine.findMany({
    include: {
      product: {
        select: {
          width: true,
          height: true,
          depth: true,
          seatHeight: true,
          customMeasurements: true,
        },
      },
      productionSetup: { select: { id: true, manufacturingComplexity: true } },
    },
  });
  for (const line of salesOrderLines) {
    if (locked.has(line.salesOrderId)) {
      salesOrderSkipped += 1;
      continue;
    }
    const spec =
      line.orderSpec && typeof line.orderSpec === 'object'
        ? (line.orderSpec as Record<string, unknown>)
        : null;
    const requested = spec?.requestedDimensions as
      | { width?: unknown; height?: unknown; depth?: unknown; seatHeight?: unknown }
      | undefined;
    const next = classifyManufacturingComplexity({
      productId: line.productId,
      width: num(requested?.width),
      height: num(requested?.height),
      depth: num(requested?.depth),
      seatHeight: num(requested?.seatHeight),
      material: typeof spec?.material === 'string' ? spec.material : null,
      woodType: typeof spec?.woodType === 'string' ? spec.woodType : null,
      foamDensity: typeof spec?.foamDensity === 'string' ? spec.foamDensity : null,
      finish: typeof spec?.finish === 'string' ? spec.finish : null,
      accessories: typeof spec?.accessories === 'string' ? spec.accessories : null,
      customMeasurements: spec?.customMeasurements ?? null,
      catalog: catalogFromProduct(line.product),
    });
    if (line.manufacturingComplexity === next) continue;
    salesOrderChanged += 1;
    if (dryRun) continue;
    const nextOrderSpec = spec
      ? ({ ...spec, manufacturingComplexity: next } as object)
      : undefined;
    await prisma.salesOrderLine.update({
      where: { id: line.id },
      data: {
        manufacturingComplexity: next,
        ...(nextOrderSpec ? { orderSpec: nextOrderSpec } : {}),
      },
    });
    if (
      line.productionSetup &&
      line.productionSetup.manufacturingComplexity !== next
    ) {
      await prisma.salesOrderLineSetup.update({
        where: { id: line.productionSetup.id },
        data: { manufacturingComplexity: next },
      });
    }
  }

  console.log(
    `changed request_items=${requestChanged} quotation_lines=${quotationChanged} sales_order_lines=${salesOrderChanged} skipped_locked_so_lines=${salesOrderSkipped}`,
  );

  if (!dryRun) {
    printTally('after request_items', await tallyRequestItems());
    printTally('after quotation_lines', await tallyQuotationLines());
    printTally('after sales_order_lines', await tallySalesOrderLines());
  } else {
    console.log('dry run — no rows written. Re-run without DRY_RUN=1 to apply.');
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
