import type { PrismaClient } from '@prisma/client';
import { STAGE_LIBRARY_NAME_HE } from './workflow';

const BRANCH_HE: Record<string, string> = { AMMAN: 'עמאן' };

const WAREHOUSE_HE: Record<string, string> = {
  RAW: 'חומרי גלם',
  SEMI: 'חצי מוגמר',
  FIN: 'מוצרים מוגמרים',
  'FIN-P10': 'מוצרים מוגמרים — חלופי',
  'RAW-B': 'חומרי גלם — חלופי',
};

const DEPT_HE: Record<string, string> = {
  MGMT: 'הנהלה',
  SALES: 'מכירות',
  PURCH: 'רכש',
  WH: 'מחסן',
  PROD: 'ייצור',
  CARP: 'נגרות',
  PAINT: 'צביעה',
  UPHOL: 'ריפוד',
  ASM: 'הרכבה',
  QC: 'איכות',
  PACK: 'אריזה',
  DEL: 'משלוח',
  ACCT: 'הנהלת חשבונות',
};

const CATEGORY_HE: Record<string, string> = {
  SOFA: 'ספות',
  CHAIR: 'כיסאות',
  BED: 'מיטות',
  TABLE: 'שולחנות',
  CUSTOM: 'התאמה אישית',
};

const FABRIC_HE: Record<string, string> = {
  'FAB-VEL-SAND': 'קטיפה חול',
  'FAB-VEL-NAVY': 'קטיפה כחול',
  'FAB-LIN-NAT': 'פשתן טבעי',
  'FAB-LIN-OLV': 'פשתן זית',
  'FAB-BOU-CRM': 'בוקלה קרם',
  'FAB-LEA-BRN': 'דמוי עור חום',
  'FAB-LEA-BLK': 'דמוי עור שחור',
  'FAB-CHE-GRY': 'שניל אפור',
};

const COLOR_HE: Record<string, string> = {
  'CLR-WAL': 'אגוז',
  'CLR-OAK': 'אלון טבעי',
  'CLR-EBONY': 'אבוני',
  'CLR-WHT': 'לבן צבוע',
  'CLR-GRY': 'אפור חם',
  'CLR-TEAK': 'טיק',
  'CLR-GOLD': 'זהב',
};

const DEALER_HE: Record<string, string> = {
  'CUS-0101': 'נייל לעיצוב פנים',
  'CUS-0102': 'אואזיס ליווינג',
  'CUS-0103': 'בלקיס לאירוח',
  'CUS-0104': 'בית הארז עמאן',
  'CUS-0105': 'זעתר הום',
  'CUS-0106': 'קסר סוויטס',
  'CUS-0107': 'רוונאק לתצוגה',
  'CUS-0108': 'דיואן לישיבה',
  'CUS-0109': 'נור לריהוט',
  'CUS-0110': "ג'בל לחוזים",
};

const SUPPLIER_HE: Record<string, string> = {
  'SUP-TIMBER': 'חצר עץ זרקא',
  'SUP-FOAM': 'תעשיות ספוג ירדן',
  'SUP-FABRIC': 'מפעל טקסטיל עבדלי',
  'SUP-HW': 'סחאב לחומרה',
  'SUP-FINISH': 'מרקה לציפויים',
  'SUP-PACK': 'איסט פק לאריזה',
  'SUP-SPRING': 'עבודות קפיצים אירביד',
  'SUP-ADH': 'דבקים עקבה',
};

const ITEM_HE: Record<string, string> = {
  'P4-ZERO-COST': 'קישוט ללא עלות (דמו)',
  'P5-ZERO-COST': 'קישוט P5 ללא עלות',
  'SEMI-COST-FRAME': 'שלד ספה WIP',
  'FIN-COST-SOFA': 'ספה גמורה לחישוב עלות',
  'COST-GAP-TRIM': 'קישוט ללא מחיר',
};

function warehouseHeFallback(code: string, type: string): string | undefined {
  if (WAREHOUSE_HE[code]) return WAREHOUSE_HE[code];
  if (code.startsWith('RAW')) return 'חומרי גלם — חלופי';
  if (code.startsWith('FIN')) return 'מוצרים מוגמרים — חלופי';
  if (code.startsWith('SEMI')) return 'חצי מוגמר — חלופי';
  if (type === 'RAW_MATERIALS') return 'חומרי גלם';
  if (type === 'SEMI_FINISHED') return 'חצי מוגמר';
  if (type === 'FINISHED_GOODS') return 'מוצרים מוגמרים';
  return undefined;
}

async function fillMissing<T extends { id: string; code?: string; sku?: string }>(
  rows: T[],
  nameHeOf: (row: T) => string | undefined,
  update: (id: string, nameHe: string) => Promise<unknown>,
): Promise<number> {
  let n = 0;
  for (const row of rows) {
    const nameHe = nameHeOf(row);
    if (!nameHe) continue;
    await update(row.id, nameHe);
    n += 1;
  }
  return n;
}

/** Fill null `nameHe` on live rows so Hebrew UI can resolve without a full reseed. */
export async function backfillNameHe(prisma: PrismaClient): Promise<void> {
  const branches = await prisma.branch.findMany({ where: { nameHe: null } });
  const b = await fillMissing(
    branches,
    (row) => BRANCH_HE[row.code],
    (id, nameHe) => prisma.branch.update({ where: { id }, data: { nameHe } }),
  );

  const warehouses = await prisma.warehouse.findMany({ where: { nameHe: null } });
  const w = await fillMissing(
    warehouses,
    (row) => warehouseHeFallback(row.code, row.type),
    (id, nameHe) => prisma.warehouse.update({ where: { id }, data: { nameHe } }),
  );

  const depts = await prisma.department.findMany({ where: { nameHe: null } });
  const d = await fillMissing(
    depts,
    (row) => DEPT_HE[row.code],
    (id, nameHe) => prisma.department.update({ where: { id }, data: { nameHe } }),
  );

  const fabrics = await prisma.fabric.findMany({ where: { nameHe: null } });
  const f = await fillMissing(
    fabrics,
    (row) => FABRIC_HE[row.code],
    (id, nameHe) => prisma.fabric.update({ where: { id }, data: { nameHe } }),
  );

  const materials = await prisma.material.findMany({
    where: { nameHe: null },
    select: { id: true, sku: true },
  });
  let mat = 0;
  for (const row of materials) {
    const item = await prisma.inventoryItem.findFirst({
      where: { sku: row.sku, nameHe: { not: null } },
      select: { nameHe: true },
    });
    const nameHe = item?.nameHe ?? ITEM_HE[row.sku];
    if (!nameHe) continue;
    await prisma.material.update({ where: { id: row.id }, data: { nameHe } });
    mat += 1;
  }

  const categories = await prisma.productCategory.findMany({ where: { nameHe: null } });
  const c = await fillMissing(
    categories,
    (row) => CATEGORY_HE[row.code],
    (id, nameHe) => prisma.productCategory.update({ where: { id }, data: { nameHe } }),
  );

  const colors = await prisma.colorReference.findMany({ where: { nameHe: null } });
  const col = await fillMissing(
    colors,
    (row) => COLOR_HE[row.code],
    (id, nameHe) => prisma.colorReference.update({ where: { id }, data: { nameHe } }),
  );

  const customers = await prisma.customer.findMany({ where: { nameHe: null } });
  const cu = await fillMissing(
    customers,
    (row) => DEALER_HE[row.code],
    (id, nameHe) => prisma.customer.update({ where: { id }, data: { nameHe } }),
  );

  const suppliers = await prisma.supplier.findMany({ where: { nameHe: null } });
  const s = await fillMissing(
    suppliers,
    (row) => SUPPLIER_HE[row.code],
    (id, nameHe) => prisma.supplier.update({ where: { id }, data: { nameHe } }),
  );

  const items = await prisma.inventoryItem.findMany({
    where: { nameHe: null },
    select: { id: true, sku: true },
  });
  let it = 0;
  for (const row of items) {
    const nameHe = ITEM_HE[row.sku];
    if (!nameHe) continue;
    await prisma.inventoryItem.update({ where: { id: row.id }, data: { nameHe } });
    it += 1;
  }

  const stages = await prisma.productionStageDefinition.findMany({ where: { nameHe: null } });
  const st = await fillMissing(
    stages,
    (row) => STAGE_LIBRARY_NAME_HE[row.code] ?? (row.code.startsWith('PAINTING') ? 'צביעה' : undefined),
    (id, nameHe) => prisma.productionStageDefinition.update({ where: { id }, data: { nameHe } }),
  );

  console.log(
    `  nameHe backfill: branch ${b} · warehouse ${w} · dept ${d} · fabric ${f} · material ${mat} · category ${c} · color ${col} · customer ${cu} · supplier ${s} · item ${it} · stage ${st}`,
  );
}
