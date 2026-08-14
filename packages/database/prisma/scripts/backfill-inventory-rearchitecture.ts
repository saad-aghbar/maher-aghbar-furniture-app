import { PrismaClient } from '@prisma/client';

/**
 * Backfill warehouse types and inventory item classification after schema push.
 * Safe to re-run. Does not wipe data or rewrite SKUs.
 */

const prisma = new PrismaClient();

const WAREHOUSE_MAP: Record<string, string> = {
  RAW: 'RAW_MATERIALS',
  RAW_MATERIALS: 'RAW_MATERIALS',
  SEMI: 'SEMI_FINISHED',
  SEMI_FINISHED: 'SEMI_FINISHED',
  FINISHED: 'FINISHED_GOODS',
  FINISHED_GOODS: 'FINISHED_GOODS',
  FIN: 'FINISHED_GOODS',
};

function mapWarehouse(type: string, code: string): { type: string; reviewRequired: boolean } {
  const mapped = WAREHOUSE_MAP[String(type).toUpperCase()] ?? WAREHOUSE_MAP[String(code).toUpperCase()];
  if (mapped) return { type: mapped, reviewRequired: false };
  return { type: 'RAW_MATERIALS', reviewRequired: true };
}

function classify(category: string) {
  const cat = String(category ?? 'OTHER').toUpperCase();
  if (cat === 'WOOD') return { itemClass: 'RAW_MATERIAL', materialGroup: 'WOOD', reviewRequired: false, isPurchasable: true };
  if (cat === 'FABRIC') return { itemClass: 'RAW_MATERIAL', materialGroup: 'FABRIC', reviewRequired: false, isPurchasable: true };
  if (cat === 'FOAM') return { itemClass: 'RAW_MATERIAL', materialGroup: 'FOAM', reviewRequired: false, isPurchasable: true };
  if (['METAL_ACCESSORY', 'DECORATIVE_ACCESSORY', 'PACKAGING', 'PAINT', 'ADHESIVE'].includes(cat)) {
    return { itemClass: 'RAW_MATERIAL', materialGroup: 'ACCESSORIES', reviewRequired: false, isPurchasable: true };
  }
  if (cat === 'SEMI_FINISHED') return { itemClass: 'SEMI_FINISHED_GOOD', materialGroup: null, reviewRequired: false, isPurchasable: false };
  if (cat === 'FINISHED') return { itemClass: 'FINISHED_GOOD', materialGroup: null, reviewRequired: false, isPurchasable: false };
  return { itemClass: 'RAW_MATERIAL', materialGroup: null, reviewRequired: true, isPurchasable: true };
}

const SETTING_KEYS: Record<string, string> = {
  RAW_MATERIALS: 'inventory.defaultWarehouse.RAW_MATERIALS',
  SEMI_FINISHED: 'inventory.defaultWarehouse.SEMI_FINISHED',
  FINISHED_GOODS: 'inventory.defaultWarehouse.FINISHED_GOODS',
};

async function main() {
  const warehouses = await prisma.warehouse.findMany();
  const seenDefault = new Set<string>();
  for (const wh of warehouses) {
    const mapped = mapWarehouse(String(wh.type), wh.code);
    const isDefault = Boolean(wh.isDefault) || !seenDefault.has(mapped.type);
    if (isDefault) seenDefault.add(mapped.type);
    await prisma.warehouse.update({
      where: { id: wh.id },
      data: {
        type: mapped.type as never,
        classificationReviewRequired: mapped.reviewRequired,
        isDefault,
      },
    });
  }

  for (const [type, key] of Object.entries(SETTING_KEYS)) {
    const def = await prisma.warehouse.findFirst({
      where: { type: type as never, isDefault: true, isActive: true },
    });
    if (!def) continue;
    await prisma.systemSetting.upsert({
      where: { key },
      update: { value: def.id },
      create: { key, value: def.id },
    });
  }

  const fin = await prisma.warehouse.findFirst({
    where: { type: 'FINISHED_GOODS' as never, isDefault: true },
  });
  if (fin) {
    await prisma.warehouseLocation.upsert({
      where: { warehouseId_code: { warehouseId: fin.id, code: 'QUARANTINE' } },
      update: {},
      create: { warehouseId: fin.id, code: 'QUARANTINE', name: 'Quarantine' },
    });
  }

  const items = await prisma.inventoryItem.findMany({ select: { id: true, category: true } });
  let review = 0;
  for (const item of items) {
    const mapped = classify(item.category);
    if (mapped.reviewRequired) review += 1;
    await prisma.inventoryItem.update({
      where: { id: item.id },
      data: {
        itemClass: mapped.itemClass as never,
        materialGroup: mapped.materialGroup as never,
        isPurchasable: mapped.isPurchasable,
        classificationReviewRequired: mapped.reviewRequired,
      },
    });
  }

  console.log(JSON.stringify({ warehouses: warehouses.length, items: items.length, reviewRequired: review }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
