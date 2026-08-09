import {
  PrismaClient,
  InventoryCategory,
  InventoryTxType,
} from '@prisma/client';
import { daysAgo, money, monthsAgo } from './util';

export type InvItemRef = {
  id: string;
  sku: string;
  nameEn: string;
  category: InventoryCategory;
};

const MATERIALS: Array<{
  sku: string;
  nameEn: string;
  nameAr: string;
  category: InventoryCategory;
  unit: string;
  reorder: number;
  opening: number;
  unitCost: number;
  /** Optional accessory photo (HTTPS) for demos */
  imageUrl?: string;
}> = [
  { sku: 'MAT-BEECH', nameEn: 'Beech lumber', nameAr: 'خشب زان', category: InventoryCategory.WOOD, unit: 'm', reorder: 40, opening: 220, unitCost: 11.5 },
  { sku: 'MAT-OAK', nameEn: 'Oak boards', nameAr: 'ألواح سنديان', category: InventoryCategory.WOOD, unit: 'm', reorder: 30, opening: 160, unitCost: 18 },
  { sku: 'MAT-PLY', nameEn: 'Plywood 18mm', nameAr: 'أبلكاش 18مم', category: InventoryCategory.WOOD, unit: 'sheet', reorder: 50, opening: 180, unitCost: 14 },
  { sku: 'MAT-MDF', nameEn: 'MDF 16mm', nameAr: 'MDF 16مم', category: InventoryCategory.WOOD, unit: 'sheet', reorder: 40, opening: 140, unitCost: 9.5 },
  { sku: 'MAT-FOAM-HD', nameEn: 'HD foam block', nameAr: 'إسفنج عالي الكثافة', category: InventoryCategory.FOAM, unit: 'block', reorder: 20, opening: 85, unitCost: 92 },
  { sku: 'MAT-FOAM-MD', nameEn: 'MD foam sheet', nameAr: 'إسفنج متوسط', category: InventoryCategory.FOAM, unit: 'sheet', reorder: 25, opening: 70, unitCost: 48 },
  { sku: 'MAT-FAB-ROLL', nameEn: 'Upholstery fabric roll', nameAr: 'رول قماش تنجيد', category: InventoryCategory.FABRIC, unit: 'm', reorder: 80, opening: 28, unitCost: 6.5 },
  { sku: 'MAT-VEL-ROLL', nameEn: 'Velvet fabric roll', nameAr: 'رول مخمل', category: InventoryCategory.FABRIC, unit: 'm', reorder: 40, opening: 95, unitCost: 12 },
  {
    sku: 'MAT-HW-KIT',
    nameEn: 'Hardware kit standard',
    nameAr: 'طقم معدات قياسي',
    category: InventoryCategory.METAL_ACCESSORY,
    unit: 'kit',
    reorder: 30,
    opening: 120,
    unitCost: 8,
    imageUrl:
      'https://images.unsplash.com/photo-1597484662317-9bd7bdda2907?auto=format&fit=crop&w=800&h=600&q=80',
  },
  { sku: 'MAT-GLUE', nameEn: 'Wood glue industrial', nameAr: 'صمغ خشب صناعي', category: InventoryCategory.ADHESIVE, unit: 'L', reorder: 20, opening: 60, unitCost: 4.2 },
  { sku: 'MAT-LACQ', nameEn: 'Lacquer clear', nameAr: 'لاكيه شفاف', category: InventoryCategory.PAINT, unit: 'L', reorder: 15, opening: 48, unitCost: 7.8 },
  { sku: 'MAT-STAIN-WAL', nameEn: 'Walnut stain', nameAr: 'صبغة جوز', category: InventoryCategory.PAINT, unit: 'L', reorder: 10, opening: 32, unitCost: 9.1 },
  { sku: 'MAT-FOIL', nameEn: 'Protective wrap', nameAr: 'تغليف واقي', category: InventoryCategory.PACKAGING, unit: 'roll', reorder: 20, opening: 55, unitCost: 3.5 },
  { sku: 'MAT-CARTON', nameEn: 'Carton crate blank', nameAr: 'كرتون تغليف', category: InventoryCategory.PACKAGING, unit: 'pcs', reorder: 40, opening: 200, unitCost: 2.1 },
  { sku: 'FG-SAMPLE-SOF', nameEn: 'Showroom sample sofa', nameAr: 'عينة كنبة صالة عرض', category: InventoryCategory.FINISHED, unit: 'pcs', reorder: 1, opening: 2, unitCost: 420 },
];

export async function seedInventory(prisma: PrismaClient, adminId: string) {
  const rawWh = await prisma.warehouse.findUniqueOrThrow({ where: { code: 'RAW' } });
  const finWh = await prisma.warehouse.findUniqueOrThrow({ where: { code: 'FIN' } });
  const semiWh = await prisma.warehouse.findUniqueOrThrow({ where: { code: 'SEMI' } });

  const locRaw = await prisma.warehouseLocation.create({
    data: { warehouseId: rawWh.id, code: 'RAW-A1', name: 'Raw aisle A1' },
  });
  await prisma.warehouseLocation.create({
    data: { warehouseId: rawWh.id, code: 'RAW-B2', name: 'Raw aisle B2' },
  });
  await prisma.warehouseLocation.create({
    data: { warehouseId: finWh.id, code: 'FIN-DOCK', name: 'Finished dock' },
  });

  const items: InvItemRef[] = [];
  let txSeq = 1;

  for (const m of MATERIALS) {
    const wh = m.category === InventoryCategory.FINISHED ? finWh : rawWh;
    const material = await prisma.material.create({
      data: {
        sku: m.sku,
        nameEn: m.nameEn,
        nameAr: m.nameAr,
        category: m.category,
        unit: m.unit,
        minStock: money(m.reorder),
        reorderQty: money(m.reorder),
        isActive: true,
      },
    });
    const item = await prisma.inventoryItem.create({
      data: {
        sku: m.sku,
        nameEn: m.nameEn,
        nameAr: m.nameAr,
        category: m.category,
        unit: m.unit,
        minStock: money(m.reorder),
        reorderQty: money(m.reorder),
        standardCost: money(m.unitCost),
        materialId: material.id,
        imageUrl: m.imageUrl,
        isActive: true,
      },
    });
    items.push({ id: item.id, sku: m.sku, nameEn: m.nameEn, category: m.category });

    await prisma.inventoryBalance.create({
      data: {
        inventoryItemId: item.id,
        warehouseId: wh.id,
        locationId: m.category !== InventoryCategory.FINISHED ? locRaw.id : null,
        availableQty: money(m.opening),
        reservedQty: money(0),
      },
    });

    await prisma.inventoryTransaction.create({
      data: {
        number: `ITX-OPEN-${String(txSeq).padStart(4, '0')}`,
        type: InventoryTxType.INVENTORY_ADJUSTMENT,
        inventoryItemId: item.id,
        warehouseId: wh.id,
        quantity: money(m.opening),
        unitCost: money(m.unitCost),
        notes: 'Opening balance — 8-month world',
        createdById: adminId,
        createdAt: monthsAgo(8, 1),
      },
    });
    txSeq += 1;
  }

  const wood = items.find((i) => i.sku === 'MAT-BEECH')!;
  const foam = items.find((i) => i.sku === 'MAT-FOAM-HD')!;
  const fabric = items.find((i) => i.sku === 'MAT-FAB-ROLL')!;

  for (let mo = 7; mo >= 0; mo -= 1) {
    const when = monthsAgo(mo, 12);
    for (const [item, qty] of [
      [wood, 18 + mo],
      [foam, 4 + (mo % 3)],
      [fabric, 12 + mo * 2],
    ] as const) {
      await prisma.inventoryTransaction.create({
        data: {
          number: `ITX-ISS-${String(txSeq).padStart(4, '0')}`,
          type: InventoryTxType.PRODUCTION_ISSUE,
          inventoryItemId: item.id,
          warehouseId: rawWh.id,
          quantity: money(-qty),
          notes: `Floor issue month-${mo}`,
          createdById: adminId,
          createdAt: when,
        },
      });
      txSeq += 1;
    }
    if (mo % 2 === 0) {
      await prisma.inventoryTransaction.create({
        data: {
          number: `ITX-RCV-${String(txSeq).padStart(4, '0')}`,
          type: InventoryTxType.PURCHASE_RECEIPT,
          inventoryItemId: wood.id,
          warehouseId: rawWh.id,
          quantity: money(40),
          unitCost: money(11.5),
          notes: `Timber receipt month-${mo}`,
          createdById: adminId,
          createdAt: daysAgo(mo * 30 + 5),
        },
      });
      txSeq += 1;
    }
  }

  const ply = items.find((i) => i.sku === 'MAT-PLY')!;
  await prisma.inventoryBalance.create({
    data: {
      inventoryItemId: ply.id,
      warehouseId: semiWh.id,
      availableQty: money(12),
      reservedQty: money(2),
    },
  });

  await prisma.inventoryCount.create({
    data: {
      number: 'CNT-2026-07',
      warehouseId: rawWh.id,
      status: 'COMPLETED',
      countedAt: daysAgo(18),
      notes: 'Mid-year raw materials count',
      createdById: adminId,
      lines: {
        create: items
          .filter((i) => i.category !== InventoryCategory.FINISHED)
          .slice(0, 6)
          .map((i) => ({
            inventoryItemId: i.id,
            systemQty: money(50),
            countedQty: money(48 + (i.sku.length % 5)),
          })),
      },
    },
  });

  // WIP transfer sample
  await prisma.warehouseTransfer.create({
    data: {
      number: 'TRF-SEMI-001',
      fromWarehouseId: rawWh.id,
      toWarehouseId: semiWh.id,
      status: 'COMPLETED',
      notes: 'Frames staged for paint',
      createdById: adminId,
      lines: {
        create: [{ inventoryItemId: ply.id, quantity: money(6) }],
      },
    },
  });

  return { items, rawWh, finWh, semiWh, locRaw };
}
