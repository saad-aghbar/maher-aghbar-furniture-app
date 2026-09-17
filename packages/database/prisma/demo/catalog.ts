import {
  InventoryItemClass,
  Prisma,
  PrismaClient,
  type InventoryCategory,
  type RawMaterialGroup,
} from '@prisma/client';
import { money } from '../seed/util';
import { assignRandomProductPhotos } from '../seed/productPhotoPool';
import { materialPhotoUrl } from './material-photo-pool';
import { standardMeasurementsForProduct } from '../seed/productMeasurements';
import { seedProductEstimates } from '../seed/product-estimates';
import { STANDARD_FURNITURE_WORKFLOW_CODE } from '../seed/workflow';
import { createRng } from '../seed/util';
import type { DealerRef } from './people';
import { seedSpecOptionLibraries } from '../seed/spec-options';
import { backfillDefaultVariants } from '../seed/backfill-default-variants';
import { ensureFurnitureInventoryRecipes } from './inventory-lifecycle';

export type ProductRef = {
  id: string;
  sku: string;
  nameEn: string;
  nameAr: string;
  nameHe: string;
  basePrice: Prisma.Decimal;
  manufacturingCost: Prisma.Decimal | null;
  imageUrl: string | null;
  categoryCode: string;
  workflowCode: string;
  bom: Array<{ sku: string; qty: number }>;
  defaultVariantId: string;
  defaultVariantSku: string;
  defaultVariantCode: string;
  defaultVariantLabel: string;
  factoryNotesAr: string;
  factoryNotesEn: string;
  factoryNotesHe: string | null;
  width?: unknown;
  height?: unknown;
  depth?: unknown;
};

export type VariantRef = {
  id: string;
  productId: string;
  productSku: string;
  sku: string;
  code: string;
  nameEn: string;
  nameAr: string;
  nameHe: string | null;
  isDefault: boolean;
  basePrice: Prisma.Decimal;
  manufacturingCost: Prisma.Decimal | null;
  bom: Array<{ sku: string; qty: number }>;
  workflowCode: string;
  categoryCode: string;
  factoryNotesAr: string;
  factoryNotesEn: string;
  factoryNotesHe: string | null;
};

export type MaterialRef = {
  id: string;
  sku: string;
  nameEn: string;
  category: InventoryCategory;
  unit: string;
  unitCost: number;
  opening: number;
};

const CATEGORIES = [
  { code: 'SOFA', nameEn: 'Sofas', nameAr: 'كنب', nameHe: 'ספות' },
  { code: 'CHAIR', nameEn: 'Chairs', nameAr: 'كراسي', nameHe: 'כיסאות' },
  { code: 'BED', nameEn: 'Beds', nameAr: 'أسرّة', nameHe: 'מיטות' },
  { code: 'CUSTOM', nameEn: 'Custom', nameAr: 'تفصيل', nameHe: 'התאמה אישית' },
];

type ProductSpec = {
  sku: string;
  categoryCode: string;
  workflowCode: string;
  nameEn: string;
  nameAr: string;
  nameHe: string;
  basePrice: number;
  mfg: number;
  bom: Array<{ sku: string; qty: number }>;
};

/** Compact catalog: 4 products / 7 variants (STD + named). */
const PRODUCTS: ProductSpec[] = [
  {
    sku: 'SOF-3S-STD',
    categoryCode: 'SOFA',
    workflowCode: STANDARD_FURNITURE_WORKFLOW_CODE,
    nameEn: 'Model 204',
    nameAr: 'موديل 204',
    nameHe: 'מודל 204',
    basePrice: 890,
    mfg: 420,
    bom: [
      { sku: 'MAT-BEECH', qty: 12 },
      { sku: 'MAT-FOAM-HD', qty: 2 },
      { sku: 'MAT-VEL-SAND', qty: 14 },
      { sku: 'MAT-HW-KIT', qty: 1 },
    ],
  },
  {
    sku: 'SOF-LUNA',
    categoryCode: 'SOFA',
    workflowCode: STANDARD_FURNITURE_WORKFLOW_CODE,
    nameEn: 'Luna Sofa',
    nameAr: 'كنبة لونا',
    nameHe: 'ספת לונה',
    basePrice: 1180,
    mfg: 540,
    bom: [
      { sku: 'MAT-BEECH', qty: 16 },
      { sku: 'MAT-FOAM-HD', qty: 4 },
      { sku: 'MAT-BOU-CRM', qty: 18 },
      { sku: 'MAT-HW-KIT', qty: 2 },
    ],
  },
  {
    sku: 'ARM-01',
    categoryCode: 'CHAIR',
    workflowCode: STANDARD_FURNITURE_WORKFLOW_CODE,
    nameEn: 'Classic Chair',
    nameAr: 'كرسي كلاسيك',
    nameHe: 'כיסא קלאסי',
    basePrice: 380,
    mfg: 175,
    bom: [
      { sku: 'MAT-BEECH', qty: 4 },
      { sku: 'MAT-FOAM-MD', qty: 1 },
      { sku: 'MAT-VEL-SAND', qty: 4 },
      { sku: 'MAT-HW-KIT', qty: 1 },
    ],
  },
  {
    sku: 'BED-Q',
    categoryCode: 'BED',
    workflowCode: STANDARD_FURNITURE_WORKFLOW_CODE,
    nameEn: 'Queen Bed',
    nameAr: 'سرير كوين',
    nameHe: 'מיטת קווין',
    basePrice: 780,
    mfg: 360,
    bom: [
      { sku: 'MAT-PINE', qty: 14 },
      { sku: 'MAT-FOAM-MD', qty: 1 },
      { sku: 'MAT-LIN-NAT', qty: 6 },
      { sku: 'MAT-HW-KIT', qty: 2 },
    ],
  },
];

type NamedVariantSpec = {
  code: string;
  nameEn: string;
  nameAr: string;
  nameHe: string;
  price: number;
  mfg: number;
  replaceSku?: Record<string, string>;
  options?: Array<{ group: string; value: string }>;
  notes: { ar: string; en: string; he: string };
};

function applyBomReplace(
  bom: Array<{ sku: string; qty: number }>,
  replace?: Record<string, string>,
): Array<{ sku: string; qty: number }> {
  if (!replace) return bom.map((row) => ({ ...row }));
  return bom.map((row) => ({ sku: replace[row.sku] ?? row.sku, qty: row.qty }));
}

function stdFactoryNotes(p: ProductSpec): { ar: string; en: string; he: string } {
  const fabric = p.bom.find((b) => b.sku.startsWith('MAT-VEL') || b.sku.startsWith('MAT-LIN') || b.sku.startsWith('MAT-BOU') || b.sku.startsWith('MAT-LEA') || b.sku.startsWith('MAT-CHE'))?.sku;
  if (fabric) {
    return {
      ar: `قص القماش من اللوت المعتمد لـ ${p.nameAr}. لا تخلط لوتين على نفس القطعة. راجع المقاس قبل التنجيد.`,
      en: `Cut fabric from the approved lot for ${p.nameEn}. Do not mix leftover rolls on the same piece. Recheck size before upholstery.`,
      he: `חתוך בד מהלוט המאושר. אל תערבב גלילים על אותה יחידה.`,
    };
  }
  return {
    ar: `راجع مقاسات ${p.nameAr} قبل القص. صنفرة ناعمة قبل الدهان. لا تغيّر اللون بدون تأكيد.`,
    en: `Check ${p.nameEn} dimensions before cutting. Fine sand before paint. Do not change colour without confirmation.`,
    he: `בדוק מידות לפני ניסור. ליטוש עדין לפני צביעה.`,
  };
}

const NAMED_VARIANTS: Record<string, NamedVariantSpec[]> = {
  'SOF-3S-STD': [
    {
      code: 'KARINA',
      nameEn: 'Model 204 Karina',
      nameAr: 'موديل 204 كرينا',
      nameHe: 'מודל 204 קרינה',
      price: 980,
      mfg: 455,
      replaceSku: { 'MAT-VEL-SAND': 'MAT-VEL-NAVY' },
      options: [
        { group: 'FOAM_DENSITY', value: 'D40' },
        { group: 'FABRIC_FINISH', value: 'VELVET' },
        { group: 'WOOD_TYPE', value: 'BEECH' },
        { group: 'PIPING_STYLE', value: 'BACK_SAME' },
        { group: 'LEG_TYPE', value: 'RING_12' },
      ],
      notes: {
        ar: 'كرينا: قص المخمل الكحلي مع بريم داير الظهر نفس اللون. حلق 12 سم.',
        en: 'Karina: cut navy velvet with same-colour piping around the back. 12 cm rings.',
        he: 'קרינה: קטיפה כחולה עם פאספול באותו צבע. טבעות 12 ס״מ.',
      },
    },
    {
      code: 'XL',
      nameEn: 'Model 204 XL',
      nameAr: 'موديل 204 XL',
      nameHe: 'מודל 204 XL',
      price: 1040,
      mfg: 480,
      replaceSku: { 'MAT-VEL-SAND': 'MAT-LIN-NAT' },
      options: [
        { group: 'FOAM_DENSITY', value: 'D35' },
        { group: 'FABRIC_FINISH', value: 'LINEN' },
        { group: 'WOOD_TYPE', value: 'BEECH' },
        { group: 'PIPING_STYLE', value: 'SIMPLE_WRAP' },
        { group: 'LEG_TYPE', value: 'WOOD_TAPERED' },
      ],
      notes: {
        ar: 'XL: كتان طبيعي، عرض أوسع. راجع اتجاه النسيج قبل القص.',
        en: 'XL: natural linen, wider seat. Check fabric nap before cutting.',
        he: 'XL: פשתן טבעי, מושב רחב יותר.',
      },
    },
  ],
  'SOF-LUNA': [
    {
      code: 'CORNER',
      nameEn: 'Luna Sofa Corner',
      nameAr: 'كنبة لونا زاوية',
      nameHe: 'ספת לונה פינה',
      price: 1380,
      mfg: 620,
      options: [
        { group: 'FABRIC_FINISH', value: 'BOUCLE' },
        { group: 'FOAM_DENSITY', value: 'D40' },
        { group: 'CUSHION_SIZE', value: 'SQ_47' },
      ],
      notes: {
        ar: 'زاوية لونا: قص القطع الكبيرة أولاً. بوكليه كريمي.',
        en: 'Luna corner: cut large panels first. Cream bouclé.',
        he: 'פינת לונה: חתוך פאנלים גדולים קודם.',
      },
    },
  ],
};

const MATERIALS: Array<{
  sku: string;
  nameEn: string;
  nameAr: string;
  nameHe: string;
  category: InventoryCategory;
  group: RawMaterialGroup | null;
  unit: string;
  reorder: number;
  opening: number;
  unitCost: number;
}> = [
  // Beech is the low-stock fixture (opening below reorder).
  { sku: 'MAT-BEECH', nameEn: 'Beech lumber', nameAr: 'خشب زان', nameHe: 'עץ אשור', category: 'WOOD', group: 'WOOD', unit: 'm', reorder: 40, opening: 18, unitCost: 11.5 },
  { sku: 'MAT-PINE', nameEn: 'Pine battens', nameAr: 'عوارض صنوبر', nameHe: 'קורות אורן', category: 'WOOD', group: 'WOOD', unit: 'm', reorder: 20, opening: 120, unitCost: 6.2 },
  { sku: 'MAT-FOAM-HD', nameEn: 'HD foam block', nameAr: 'إسفنج عالي الكثافة', nameHe: 'ספוג צפיפות גבוהה', category: 'FOAM', group: 'FOAM', unit: 'block', reorder: 8, opening: 40, unitCost: 92 },
  { sku: 'MAT-FOAM-MD', nameEn: 'MD foam sheet', nameAr: 'إسفنج متوسط', nameHe: 'ספוג בינוני', category: 'FOAM', group: 'FOAM', unit: 'sheet', reorder: 10, opening: 50, unitCost: 48 },
  { sku: 'MAT-VEL-SAND', nameEn: 'Velvet 302 Sand', nameAr: 'مخمل 302 رملي', nameHe: 'קטיפה 302 חול', category: 'FABRIC', group: 'FABRIC', unit: 'm', reorder: 20, opening: 80, unitCost: 12 },
  { sku: 'MAT-VEL-NAVY', nameEn: 'Velvet Navy', nameAr: 'مخمل كحلي', nameHe: 'קטיפה כחול', category: 'FABRIC', group: 'FABRIC', unit: 'm', reorder: 20, opening: 60, unitCost: 12.5 },
  { sku: 'MAT-LIN-NAT', nameEn: 'Linen 180 Natural', nameAr: 'كتان 180 طبيعي', nameHe: 'פשתן 180', category: 'FABRIC', group: 'FABRIC', unit: 'm', reorder: 20, opening: 70, unitCost: 9 },
  { sku: 'MAT-BOU-CRM', nameEn: 'Bouclé 611 Cream', nameAr: 'بوكليه 611 كريمي', nameHe: 'בוקלה 611', category: 'FABRIC', group: 'FABRIC', unit: 'm', reorder: 15, opening: 50, unitCost: 14 },
  { sku: 'MAT-HW-KIT', nameEn: 'Hardware kit / Karsta', nameAr: 'طقم معدات / كارستا', nameHe: 'ערכת חומרה', category: 'METAL_ACCESSORY', group: 'ACCESSORIES', unit: 'kit', reorder: 10, opening: 80, unitCost: 8 },
];

const FABRICS = [
  { code: 'FAB-VEL-SAND', nameEn: 'Velvet 302', nameAr: 'مخمل 302', nameHe: 'קטיפה 302', color: 'Sand' },
  { code: 'FAB-VEL-NAVY', nameEn: 'Velvet Navy', nameAr: 'مخمل كحلي', nameHe: 'קטיפה כחול', color: 'Navy' },
  { code: 'FAB-LIN-NAT', nameEn: 'Linen 180', nameAr: 'كتان 180', nameHe: 'פשתן 180', color: 'Natural' },
  { code: 'FAB-BOU-CRM', nameEn: 'Bouclé 611', nameAr: 'بوكليه 611', nameHe: 'בוקלה 611', color: 'Cream' },
];

const COLORS = [
  { code: 'CLR-WAL', nameEn: 'Walnut', nameAr: 'جوز', nameHe: 'אגוז', hex: '#5C4033' },
  { code: 'CLR-OAK', nameEn: 'Natural Oak', nameAr: 'سنديان طبيعي', nameHe: 'אלון טבעי', hex: '#C4A35A' },
  { code: 'CLR-WHT', nameEn: 'Painted White', nameAr: 'أبيض مطلي', nameHe: 'לבן צבוע', hex: '#F5F1EA' },
];

export async function seedDemoCatalog(prisma: PrismaClient, dealers: DealerRef[]) {
  const rng = createRng(20260912);
  const catByCode: Record<string, string> = {};
  for (const c of CATEGORIES) {
    const row = await prisma.productCategory.create({
      data: { code: c.code, nameEn: c.nameEn, nameAr: c.nameAr, nameHe: c.nameHe },
    });
    catByCode[c.code] = row.id;
  }

  for (const f of FABRICS) {
    await prisma.fabric.create({
      data: { code: f.code, nameEn: f.nameEn, nameAr: f.nameAr, nameHe: f.nameHe, color: f.color },
    });
  }
  for (const c of COLORS) {
    await prisma.colorReference.create({
      data: { code: c.code, nameEn: c.nameEn, nameAr: c.nameAr, nameHe: c.nameHe, hex: c.hex },
    });
  }

  const materials: MaterialRef[] = [];
  for (const m of MATERIALS) {
    const material = await prisma.material.create({
      data: {
        sku: m.sku,
        nameEn: m.nameEn,
        nameAr: m.nameAr,
        nameHe: m.nameHe,
        category: m.category,
        unit: m.unit,
        minStock: m.reorder,
        reorderQty: m.reorder,
      },
    });
    const item = await prisma.inventoryItem.create({
      data: {
        sku: m.sku,
        nameEn: m.nameEn,
        nameAr: m.nameAr,
        nameHe: m.nameHe,
        category: m.category,
        itemClass: InventoryItemClass.RAW_MATERIAL,
        materialGroup: m.group ?? undefined,
        unit: m.unit,
        standardCost: money(m.unitCost),
        minStock: m.reorder,
        reorderQty: m.reorder,
        isPurchasable: true,
        materialId: material.id,
        imageUrl: materialPhotoUrl(m.sku),
        qrCode: m.sku,
      },
    });
    materials.push({
      id: item.id,
      sku: m.sku,
      nameEn: m.nameEn,
      category: m.category,
      unit: m.unit,
      unitCost: m.unitCost,
      opening: m.opening,
    });
  }

  const specOptions = await seedSpecOptionLibraries(prisma);
  console.log(`  spec options: ${specOptions.groups} groups · ${specOptions.values} values`);

  const workflows = await prisma.productionWorkflow.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, code: true, activeVersionId: true },
  });
  const wfByCode = new Map(workflows.map((w) => [w.code, w]));

  const optionValues = await prisma.specOptionValue.findMany({
    include: { group: { select: { code: true } } },
  });
  const optionByKey = new Map(
    optionValues.map((v) => [`${v.group.code}:${v.code}`, v.id] as const),
  );

  const products: ProductRef[] = [];
  const variants: VariantRef[] = [];

  for (const p of PRODUCTS) {
    const photos = assignRandomProductPhotos({ min: 2, max: 5, random: () => rng.next() });
    const measures = standardMeasurementsForProduct({
      categoryCode: p.categoryCode,
      sku: p.sku,
      nameEn: p.nameEn,
    });
    const wf = wfByCode.get(p.workflowCode);
    if (!wf) throw new Error(`Missing workflow ${p.workflowCode} for ${p.sku}`);
    const row = await prisma.product.create({
      data: {
        sku: p.sku,
        categoryId: catByCode[p.categoryCode]!,
        nameEn: p.nameEn,
        nameAr: p.nameAr,
        nameHe: p.nameHe,
        description: measures.descriptionEn,
        unit: 'pcs',
        imageUrl: photos.imageUrl,
        galleryUrls: photos.galleryUrls,
        workflowConfiguration: { create: { workflowId: wf.id } },
      },
    });

    const stdNotes = stdFactoryNotes(p);
    const std = await prisma.productVariant.create({
      data: {
        productId: row.id,
        sku: `${p.sku}-STD`,
        code: 'STD',
        nameAr: p.nameAr,
        nameEn: p.nameEn,
        nameHe: p.nameHe,
        isDefault: true,
        isActive: true,
        sortOrder: 0,
        basePrice: money(p.basePrice),
        manufacturingCost: money(p.mfg),
        bomDefaults: { materials: p.bom },
        imageUrl: photos.imageUrl,
        galleryUrls: photos.galleryUrls,
        workflowId: wf.id,
        width: money(measures.width),
        height: money(measures.height),
        depth: money(measures.depth),
        seatHeight: measures.seatHeight == null ? null : money(measures.seatHeight),
        measurements: [
          { key: 'width', labelAr: 'العرض', labelEn: 'Width', labelHe: 'רוחב', value: measures.width, unit: 'cm' },
          { key: 'height', labelAr: 'الارتفاع', labelEn: 'Height', labelHe: 'גובה', value: measures.height, unit: 'cm' },
          { key: 'depth', labelAr: 'العمق', labelEn: 'Depth', labelHe: 'עומק', value: measures.depth, unit: 'cm' },
          ...(measures.seatHeight == null
            ? []
            : [{ key: 'seatHeight', labelAr: 'ارتفاع المقعد', labelEn: 'Seat height', labelHe: 'גובה ישיבה', value: measures.seatHeight, unit: 'cm' }]),
        ],
        factoryNotesAr: stdNotes.ar,
        factoryNotesEn: stdNotes.en,
        factoryNotesHe: stdNotes.he,
        adminNotes: `STD ${p.workflowCode}. Confirm fabric lot before cutting.`,
      },
    });

    await prisma.product.update({
      where: { id: row.id },
      data: {
        basePrice: std.basePrice,
        manufacturingCost: std.manufacturingCost,
        bomDefaults: std.bomDefaults as never,
        width: std.width,
        height: std.height,
        depth: std.depth,
        seatHeight: std.seatHeight,
        adminNotes: std.adminNotes,
        imageUrl: std.imageUrl,
        galleryUrls: std.galleryUrls,
      },
    });

    const stdRef: VariantRef = {
      id: std.id,
      productId: row.id,
      productSku: p.sku,
      sku: std.sku,
      code: std.code,
      nameEn: std.nameEn,
      nameAr: std.nameAr,
      nameHe: std.nameHe,
      isDefault: true,
      basePrice: std.basePrice ?? money(p.basePrice),
      manufacturingCost: std.manufacturingCost,
      bom: p.bom,
      workflowCode: p.workflowCode,
      categoryCode: p.categoryCode,
      factoryNotesAr: stdNotes.ar,
      factoryNotesEn: stdNotes.en,
      factoryNotesHe: stdNotes.he,
    };
    variants.push(stdRef);

    products.push({
      id: row.id,
      sku: p.sku,
      nameEn: p.nameEn,
      nameAr: p.nameAr,
      nameHe: p.nameHe,
      basePrice: std.basePrice ?? money(p.basePrice),
      manufacturingCost: std.manufacturingCost,
      imageUrl: std.imageUrl,
      categoryCode: p.categoryCode,
      workflowCode: p.workflowCode,
      bom: p.bom,
      defaultVariantId: std.id,
      defaultVariantSku: std.sku,
      defaultVariantCode: std.code,
      defaultVariantLabel: std.nameAr || std.nameEn,
      factoryNotesAr: stdNotes.ar,
      factoryNotesEn: stdNotes.en,
      factoryNotesHe: stdNotes.he,
      width: std.width,
      height: std.height,
      depth: std.depth,
    });

    let sort = 10;
    for (const extra of NAMED_VARIANTS[p.sku] ?? []) {
      const extraPhotos = assignRandomProductPhotos({ min: 2, max: 4, random: () => rng.next() });
      const extraBom = applyBomReplace(p.bom, extra.replaceSku);
      const created = await prisma.productVariant.create({
        data: {
          productId: row.id,
          sku: `${p.sku}-${extra.code}`,
          code: extra.code,
          nameAr: extra.nameAr,
          nameEn: extra.nameEn,
          nameHe: extra.nameHe,
          isDefault: false,
          isActive: true,
          sortOrder: sort,
          basePrice: money(extra.price),
          manufacturingCost: money(extra.mfg),
          bomDefaults: { materials: extraBom },
          imageUrl: extraPhotos.imageUrl,
          galleryUrls: extraPhotos.galleryUrls,
          workflowId: wf.id,
          width: money(measures.width),
          height: money(measures.height),
          depth: money(measures.depth),
          seatHeight: measures.seatHeight == null ? null : money(measures.seatHeight),
          measurements: [
            { key: 'width', labelAr: 'العرض', labelEn: 'Width', labelHe: 'רוחב', value: measures.width, unit: 'cm' },
            { key: 'height', labelAr: 'الارتفاع', labelEn: 'Height', labelHe: 'גובה', value: measures.height, unit: 'cm' },
            { key: 'depth', labelAr: 'العمق', labelEn: 'Depth', labelHe: 'עומק', value: measures.depth, unit: 'cm' },
            ...(measures.seatHeight == null
              ? []
              : [{ key: 'seatHeight', labelAr: 'ارتفاع المقعد', labelEn: 'Seat height', labelHe: 'גובה ישיבה', value: measures.seatHeight, unit: 'cm' }]),
          ],
          factoryNotesAr: extra.notes.ar,
          factoryNotesEn: extra.notes.en,
          factoryNotesHe: extra.notes.he,
        },
      });
      sort += 10;
      const optionIds = (extra.options ?? [])
        .map((opt) => optionByKey.get(`${opt.group}:${opt.value}`))
        .filter((id): id is string => Boolean(id));
      if (optionIds.length) {
        await prisma.productVariantOption.createMany({
          data: optionIds.map((specOptionValueId) => ({
            variantId: created.id,
            specOptionValueId,
          })),
        });
      }
      variants.push({
        id: created.id,
        productId: row.id,
        productSku: p.sku,
        sku: created.sku,
        code: created.code,
        nameEn: created.nameEn,
        nameAr: created.nameAr,
        nameHe: created.nameHe,
        isDefault: false,
        basePrice: created.basePrice ?? money(extra.price),
        manufacturingCost: created.manufacturingCost,
        bom: extraBom,
        workflowCode: p.workflowCode,
        categoryCode: p.categoryCode,
        factoryNotesAr: extra.notes.ar,
        factoryNotesEn: extra.notes.en,
        factoryNotesHe: extra.notes.he,
      });
    }
  }

  for (const variant of variants) {
    for (const dealer of dealers) {
      const factor = dealer.username === 'nile' ? 0.94 : 0.9;
      await prisma.dealerPrice.create({
        data: {
          customerId: dealer.id,
          productId: variant.productId,
          variantId: variant.id,
          price: money(Number(variant.basePrice) * factor),
          currency: 'ILS',
        },
      });
    }
  }

  const safety = await backfillDefaultVariants(prisma);
  console.log(`  default variants: ${variants.filter((v) => v.isDefault).length} STD · backfill skipped ${safety.skipped}`);

  const estimates = await seedProductEstimates(
    prisma,
    variants.map((v) => ({
      id: v.productId,
      categoryCode: v.categoryCode,
      variantId: v.id,
    })),
  );
  console.log(`  estimates: ${estimates.profiles} profiles · ${estimates.estimates} stage rows`);

  await ensureFurnitureInventoryRecipes(
    prisma,
    variants.map((v) => ({
      id: v.productId,
      sku: v.productSku,
      nameEn: v.nameEn,
      nameAr: v.nameAr,
      nameHe: v.nameHe,
      variantId: v.id,
    })),
  );

  await seedStageMaterialMaps(prisma, variants);

  console.log(`  catalog: ${products.length} products · ${variants.length} variants · ${materials.length} raw SKUs`);
  return { products, variants, materials };
}

function stageCodeForRawSku(sku: string, codes: Set<string>): string | null {
  const has = (code: string) => (codes.has(code) ? code : null);
  if (sku.startsWith('MAT-FOAM') || sku === 'MAT-DACRON') {
    return has('FOAM') ?? has('UPHOLSTERY');
  }
  if (
    sku.startsWith('MAT-VEL') ||
    sku.startsWith('MAT-LIN') ||
    sku.startsWith('MAT-BOU') ||
    sku.startsWith('MAT-LEA') ||
    sku.startsWith('MAT-CHE') ||
    sku === 'MAT-ITAL-VEL' ||
    sku === 'MAT-ZIP' ||
    sku === 'MAT-BUTTON' ||
    sku === 'MAT-THREAD' ||
    sku === 'MAT-SPRAY-ADH'
  ) {
    return has('UPHOLSTERY');
  }
  if (sku === 'MAT-LACQ' || sku.startsWith('MAT-STAIN') || sku === 'MAT-PRIMER' || sku === 'MAT-WHT-PAINT') {
    return has('PAINTING') ?? has('CARPENTRY');
  }
  if (sku.startsWith('MAT-FOIL') || sku === 'MAT-CARTON' || sku === 'MAT-CORNER' || sku === 'MAT-STRAP') {
    return has('PACKAGING');
  }
  if (sku.startsWith('MAT-HW') || sku === 'MAT-SPRING' || sku === 'MAT-MECH-RECL' || sku === 'MAT-CASTER') {
    return has('ASSEMBLY') ?? has('CARPENTRY');
  }
  if (sku === 'MAT-GLUE' || sku.startsWith('MAT-BEECH') || sku.startsWith('MAT-OAK') || sku.startsWith('MAT-PLY') || sku.startsWith('MAT-MDF') || sku.startsWith('MAT-WALNUT') || sku.startsWith('MAT-PINE') || sku.startsWith('MAT-TEAK') || sku.startsWith('MAT-BIRCH') || sku === 'MAT-EDGE' || sku === 'MAT-DOWEL') {
    return has('CARPENTRY');
  }
  return has('CARPENTRY');
}

async function seedStageMaterialMaps(prisma: PrismaClient, variants: VariantRef[]) {
  const items = await prisma.inventoryItem.findMany({
    where: { archivedAt: null },
    select: { id: true, sku: true, unit: true },
  });
  const itemBySku = new Map(items.map((i) => [i.sku, i]));
  const workflows = await prisma.productionWorkflow.findMany({
    where: { archivedAt: null },
    select: { code: true, activeVersionId: true },
  });
  const wfByCode = new Map(workflows.map((w) => [w.code, w]));
  let count = 0;
  for (const variant of variants) {
    const wf = wfByCode.get(variant.workflowCode);
    if (!wf?.activeVersionId) continue;
    const nodes = await prisma.productionWorkflowNode.findMany({
      where: { workflowVersionId: wf.activeVersionId },
      include: { stageDefinition: { select: { code: true, id: true } } },
    });
    const nodeByCode = new Map(nodes.map((n) => [n.stageDefinition.code, n]));
    const codes = new Set(nodeByCode.keys());
    const qtyBySku = new Map<string, number>();
    for (const line of variant.bom) {
      qtyBySku.set(line.sku, (qtyBySku.get(line.sku) ?? 0) + line.qty);
    }
    for (const [sku, qty] of qtyBySku) {
      const item = itemBySku.get(sku);
      if (!item) continue;
      const stageCode = stageCodeForRawSku(sku, codes);
      const node = stageCode ? nodeByCode.get(stageCode) : undefined;
      if (!node) continue;
      const existing = await prisma.productStageMaterialInput.findFirst({
        where: {
          productId: variant.productId,
          workflowNodeId: node.id,
          inventoryItemId: item.id,
          variantId: variant.id,
        },
      });
      if (existing) {
        await prisma.productStageMaterialInput.update({
          where: { id: existing.id },
          data: { qtyPerUnit: Number(existing.qtyPerUnit) + qty },
        });
        continue;
      }
      await prisma.productStageMaterialInput.create({
        data: {
          productId: variant.productId,
          variantId: variant.id,
          workflowNodeId: node.id,
          stageDefinitionId: node.stageDefinitionId,
          inventoryItemId: item.id,
          qtyPerUnit: qty,
          unit: item.unit,
          required: true,
        },
      });
      count += 1;
    }
  }
  console.log(`  stage-material maps: ${count} SKU→stage rows`);
}
