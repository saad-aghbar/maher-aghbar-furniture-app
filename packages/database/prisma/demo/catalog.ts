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
import {
  WF_ARMCHAIR,
  WF_OTTOMAN,
  WF_PAINTED_WOOD,
  WF_SECTIONAL,
} from './workflows';

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
  { code: 'TABLE', nameEn: 'Tables', nameAr: 'طاولات', nameHe: 'שולחנות' },
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

const PRODUCTS: ProductSpec[] = [
  {
    sku: 'SOF-3S-STD',
    categoryCode: 'SOFA',
    workflowCode: STANDARD_FURNITURE_WORKFLOW_CODE,
    nameEn: '3-Seater Sofa Standard',
    nameAr: 'كنبة ثلاثية قياسية',
    nameHe: 'ספה סטנדרטית',
    basePrice: 890,
    mfg: 420,
    bom: [
      { sku: 'MAT-BEECH', qty: 12 },
      { sku: 'MAT-PLY', qty: 3 },
      { sku: 'MAT-FOAM-HD', qty: 2 },
      { sku: 'MAT-VEL-SAND', qty: 14 },
      { sku: 'MAT-HW-KIT', qty: 1 },
    ],
  },
  {
    sku: 'SOF-3S-LUX',
    categoryCode: 'SOFA',
    workflowCode: STANDARD_FURNITURE_WORKFLOW_CODE,
    nameEn: '3-Seater Sofa Luxury',
    nameAr: 'كنبة ثلاثية فاخرة',
    nameHe: 'ספת יוקרה',
    basePrice: 1280,
    mfg: 610,
    bom: [
      { sku: 'MAT-OAK', qty: 10 },
      { sku: 'MAT-PLY', qty: 4 },
      { sku: 'MAT-FOAM-HD', qty: 3 },
      { sku: 'MAT-VEL-NAVY', qty: 16 },
      { sku: 'MAT-SPRING', qty: 1 },
    ],
  },
  {
    sku: 'SOF-2S',
    categoryCode: 'SOFA',
    workflowCode: STANDARD_FURNITURE_WORKFLOW_CODE,
    nameEn: '2-Seater Loveseat',
    nameAr: 'كنبة ثنائية',
    nameHe: 'ספת שניים',
    basePrice: 720,
    mfg: 340,
    bom: [
      { sku: 'MAT-BEECH', qty: 8 },
      { sku: 'MAT-FOAM-MD', qty: 2 },
      { sku: 'MAT-LIN-NAT', qty: 10 },
      { sku: 'MAT-HW-KIT', qty: 1 },
    ],
  },
  {
    sku: 'SOF-RECL',
    categoryCode: 'SOFA',
    workflowCode: STANDARD_FURNITURE_WORKFLOW_CODE,
    nameEn: 'Recliner Sofa 3S',
    nameAr: 'كنبة استرخاء ثلاثية',
    nameHe: 'ספת ריקליינר',
    basePrice: 1520,
    mfg: 720,
    bom: [
      { sku: 'MAT-BEECH', qty: 14 },
      { sku: 'MAT-FOAM-HD', qty: 3 },
      { sku: 'MAT-LEA-BRN', qty: 12 },
      { sku: 'MAT-MECH-RECL', qty: 3 },
      { sku: 'MAT-ITAL-VEL', qty: 8 },
    ],
  },
  {
    sku: 'SOF-L-SEC',
    categoryCode: 'SOFA',
    workflowCode: WF_SECTIONAL,
    nameEn: 'L-Sectional Sofa',
    nameAr: 'كنبة زاوية L',
    nameHe: 'ספת פינה L',
    basePrice: 1650,
    mfg: 780,
    bom: [
      { sku: 'MAT-BEECH', qty: 18 },
      { sku: 'MAT-PLY', qty: 6 },
      { sku: 'MAT-FOAM-HD', qty: 5 },
      { sku: 'MAT-BOU-CRM', qty: 22 },
      { sku: 'MAT-HW-KIT', qty: 2 },
    ],
  },
  {
    sku: 'SOF-CORN',
    categoryCode: 'SOFA',
    workflowCode: WF_SECTIONAL,
    nameEn: 'Corner Sofa Compact',
    nameAr: 'كنبة زاوية مدمجة',
    nameHe: 'ספת פינה קומפקטית',
    basePrice: 980,
    mfg: 460,
    bom: [
      { sku: 'MAT-BEECH', qty: 14 },
      { sku: 'MAT-FOAM-MD', qty: 4 },
      { sku: 'MAT-CHE-GRY', qty: 16 },
      { sku: 'MAT-HW-KIT', qty: 2 },
    ],
  },
  {
    sku: 'CUS-BANQ',
    categoryCode: 'CUSTOM',
    workflowCode: WF_SECTIONAL,
    nameEn: 'Banquette Custom',
    nameAr: 'بانكيت تفصيل',
    nameHe: 'ספסל מסעדה בהתאמה',
    basePrice: 980,
    mfg: 460,
    bom: [
      { sku: 'MAT-BEECH', qty: 10 },
      { sku: 'MAT-FOAM-HD', qty: 3 },
      { sku: 'MAT-VEL-NAVY', qty: 12 },
      { sku: 'MAT-HW-KIT', qty: 1 },
    ],
  },
  {
    sku: 'ARM-01',
    categoryCode: 'CHAIR',
    workflowCode: WF_ARMCHAIR,
    nameEn: 'Armchair Classic',
    nameAr: 'كرسي بذراعين كلاسيك',
    nameHe: 'כורסה קלאסית',
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
    sku: 'ARM-02',
    categoryCode: 'CHAIR',
    workflowCode: WF_ARMCHAIR,
    nameEn: 'Armchair Club',
    nameAr: 'كرسي نادي',
    nameHe: 'כורסת מועדון',
    basePrice: 450,
    mfg: 210,
    bom: [
      { sku: 'MAT-OAK', qty: 4 },
      { sku: 'MAT-FOAM-HD', qty: 1 },
      { sku: 'MAT-LEA-BLK', qty: 5 },
      { sku: 'MAT-HW-KIT', qty: 1 },
    ],
  },
  {
    sku: 'ARM-WING',
    categoryCode: 'CHAIR',
    workflowCode: WF_ARMCHAIR,
    nameEn: 'Wingback Chair',
    nameAr: 'كرسي جناح',
    nameHe: 'כורסת כנפיים',
    basePrice: 560,
    mfg: 260,
    bom: [
      { sku: 'MAT-BEECH', qty: 5 },
      { sku: 'MAT-FOAM-HD', qty: 1 },
      { sku: 'MAT-VEL-NAVY', qty: 6 },
      { sku: 'MAT-HW-KIT', qty: 1 },
    ],
  },
  {
    sku: 'CHAIR-DIN',
    categoryCode: 'CHAIR',
    workflowCode: WF_ARMCHAIR,
    nameEn: 'Dining Chair Upholstered',
    nameAr: 'كرسي سفرة منجد',
    nameHe: 'כיסא אוכל מרופד',
    basePrice: 145,
    mfg: 68,
    bom: [
      { sku: 'MAT-BEECH', qty: 2 },
      { sku: 'MAT-FOAM-MD', qty: 0.5 },
      { sku: 'MAT-LIN-OLV', qty: 1.5 },
      { sku: 'MAT-HW-SCREW', qty: 8 },
    ],
  },
  {
    sku: 'CHAIR-DIN-W',
    categoryCode: 'CHAIR',
    workflowCode: WF_PAINTED_WOOD,
    nameEn: 'Dining Chair Wood',
    nameAr: 'كرسي سفرة خشب',
    nameHe: 'כיסא אוכל מעץ',
    basePrice: 110,
    mfg: 48,
    bom: [
      { sku: 'MAT-BEECH', qty: 2.5 },
      { sku: 'MAT-LACQ', qty: 0.3 },
      { sku: 'MAT-HW-SCREW', qty: 6 },
    ],
  },
  {
    sku: 'TABLE-DIN-6',
    categoryCode: 'TABLE',
    workflowCode: WF_PAINTED_WOOD,
    nameEn: 'Dining Table 6-Seat',
    nameAr: 'طاولة سفرة لستة',
    nameHe: 'שולחן אוכל לשישה',
    basePrice: 680,
    mfg: 310,
    bom: [
      { sku: 'MAT-OAK', qty: 8 },
      { sku: 'MAT-STAIN-WAL', qty: 1 },
      { sku: 'MAT-LACQ', qty: 1 },
      { sku: 'MAT-HW-KIT', qty: 1 },
    ],
  },
  {
    sku: 'TABLE-DIN-8',
    categoryCode: 'TABLE',
    workflowCode: WF_PAINTED_WOOD,
    nameEn: 'Dining Table 8-Seat',
    nameAr: 'طاولة سفرة لثمانية',
    nameHe: 'שולחן אוכל לשמונה',
    basePrice: 860,
    mfg: 400,
    bom: [
      { sku: 'MAT-OAK', qty: 12 },
      { sku: 'MAT-STAIN-WAL', qty: 1.5 },
      { sku: 'MAT-LACQ', qty: 1.2 },
      { sku: 'MAT-HW-KIT', qty: 1 },
    ],
  },
  {
    sku: 'TABLE-CF',
    categoryCode: 'TABLE',
    workflowCode: WF_PAINTED_WOOD,
    nameEn: 'Coffee Table Oak',
    nameAr: 'طاولة قهوة سنديان',
    nameHe: 'שולחן קפה אלון',
    basePrice: 290,
    mfg: 130,
    bom: [
      { sku: 'MAT-OAK', qty: 3 },
      { sku: 'MAT-LACQ', qty: 0.4 },
      { sku: 'MAT-HW-SCREW', qty: 8 },
    ],
  },
  {
    sku: 'TABLE-SIDE',
    categoryCode: 'TABLE',
    workflowCode: WF_PAINTED_WOOD,
    nameEn: 'Side Table',
    nameAr: 'طاولة جانبية',
    nameHe: 'שולחן צד',
    basePrice: 180,
    mfg: 75,
    bom: [
      { sku: 'MAT-BEECH', qty: 2 },
      { sku: 'MAT-LACQ', qty: 0.2 },
      { sku: 'MAT-HW-SCREW', qty: 4 },
    ],
  },
  {
    sku: 'TABLE-CONS',
    categoryCode: 'TABLE',
    workflowCode: WF_PAINTED_WOOD,
    nameEn: 'Console Table',
    nameAr: 'طاولة كونسول',
    nameHe: 'שולחן קונסולה',
    basePrice: 340,
    mfg: 150,
    bom: [
      { sku: 'MAT-OAK', qty: 4 },
      { sku: 'MAT-STAIN-WAL', qty: 0.5 },
      { sku: 'MAT-HW-KIT', qty: 1 },
    ],
  },
  {
    sku: 'BED-Q',
    categoryCode: 'BED',
    workflowCode: STANDARD_FURNITURE_WORKFLOW_CODE,
    nameEn: 'Queen Bed Frame',
    nameAr: 'سرير كوين',
    nameHe: 'מיטת קווין',
    basePrice: 780,
    mfg: 360,
    bom: [
      { sku: 'MAT-BEECH', qty: 14 },
      { sku: 'MAT-PLY', qty: 4 },
      { sku: 'MAT-FOAM-MD', qty: 1 },
      { sku: 'MAT-LIN-NAT', qty: 6 },
      { sku: 'MAT-HW-KIT', qty: 2 },
    ],
  },
  {
    sku: 'BED-K',
    categoryCode: 'BED',
    workflowCode: WF_PAINTED_WOOD,
    nameEn: 'King Bed Frame',
    nameAr: 'سرير كينج',
    nameHe: 'מיטת קינג',
    basePrice: 940,
    mfg: 430,
    bom: [
      { sku: 'MAT-OAK', qty: 16 },
      { sku: 'MAT-PLY', qty: 5 },
      { sku: 'MAT-STAIN-WAL', qty: 1 },
      { sku: 'MAT-HW-KIT', qty: 2 },
    ],
  },
  {
    sku: 'BED-HEAD',
    categoryCode: 'BED',
    workflowCode: STANDARD_FURNITURE_WORKFLOW_CODE,
    nameEn: 'Upholstered Headboard',
    nameAr: 'مسند رأس منجد',
    nameHe: 'ראש מיטה מרופד',
    basePrice: 310,
    mfg: 140,
    bom: [
      { sku: 'MAT-PLY', qty: 2 },
      { sku: 'MAT-FOAM-MD', qty: 1 },
      { sku: 'MAT-VEL-SAND', qty: 4 },
      { sku: 'MAT-HW-SCREW', qty: 10 },
    ],
  },
  {
    sku: 'CUS-OTT',
    categoryCode: 'CUSTOM',
    workflowCode: WF_OTTOMAN,
    nameEn: 'Ottoman Custom',
    nameAr: 'عثماني تفصيل',
    nameHe: 'הדום בהתאמה',
    basePrice: 210,
    mfg: 95,
    bom: [
      { sku: 'MAT-PLY', qty: 1 },
      { sku: 'MAT-FOAM-HD', qty: 1 },
      { sku: 'MAT-VEL-SAND', qty: 2 },
      { sku: 'MAT-HW-SCREW', qty: 4 },
    ],
  },
  {
    sku: 'CHAIR-BENCH',
    categoryCode: 'CHAIR',
    workflowCode: WF_OTTOMAN,
    nameEn: 'Dining Bench',
    nameAr: 'مقعد سفرة',
    nameHe: 'ספסל אוכל',
    basePrice: 320,
    mfg: 145,
    bom: [
      { sku: 'MAT-BEECH', qty: 4 },
      { sku: 'MAT-FOAM-MD', qty: 1 },
      { sku: 'MAT-LIN-NAT', qty: 3 },
      { sku: 'MAT-HW-KIT', qty: 1 },
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
      nameEn: '3-Seater Karina velvet',
      nameAr: 'كنبة ثلاثية كرينا',
      nameHe: 'ספה קרינה',
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
        ar: 'كرينا: قص المخمل الكحلي مع بريم داير الظهر نفس اللون. حلق 12 سم. لا تخلط مع الرملي.',
        en: 'Karina: cut navy velvet with same-colour piping around the back. 12 cm rings. Do not mix with sand velvet.',
        he: 'קרינה: קטיפה כחולה עם פאספול באותו צבע. טבעות 12 ס״מ.',
      },
    },
    {
      code: 'UKR',
      nameEn: '3-Seater Ukrainian linen',
      nameAr: 'كنبة ثلاثية أوكرانية',
      nameHe: 'ספה אוקראינית',
      price: 940,
      mfg: 440,
      replaceSku: { 'MAT-VEL-SAND': 'MAT-LIN-NAT' },
      options: [
        { group: 'FOAM_DENSITY', value: 'D35' },
        { group: 'FABRIC_FINISH', value: 'LINEN' },
        { group: 'WOOD_TYPE', value: 'BEECH' },
        { group: 'PIPING_STYLE', value: 'SIMPLE_WRAP' },
        { group: 'LEG_TYPE', value: 'WOOD_TAPERED' },
      ],
      notes: {
        ar: 'أوكرانيه: كتان طبيعي، لف بسيط بدون كوع. إسفنج 35. راجع اتجاه النسيج قبل القص.',
        en: 'Ukrainian: natural linen, simple wrap without elbow. Foam 35. Check fabric nap before cutting.',
        he: 'אוקראינית: פשתן טבעי, עטיפה פשוטה.',
      },
    },
  ],
  'SOF-3S-LUX': [
    {
      code: 'NAVY',
      nameEn: 'Luxury sofa navy velvet',
      nameAr: 'كنبة فاخرة مخمل كحلي',
      nameHe: 'ספת יוקרה כחולה',
      price: 1320,
      mfg: 630,
      options: [
        { group: 'FOAM_DENSITY', value: 'HR' },
        { group: 'FABRIC_FINISH', value: 'VELVET' },
        { group: 'WOOD_TYPE', value: 'OAK' },
      ],
      notes: {
        ar: 'فاخرة كحلي: إسفنج جلوس HR ونوابض. قص المخمل باتجاه واحد.',
        en: 'Luxury navy: HR seating foam and springs. Cut velvet in one nap direction.',
        he: 'יוקרה כחולה: ספוג HR. כיוון הקטיפה אחיד.',
      },
    },
  ],
  'SOF-2S': [
    {
      code: 'OLIVE',
      nameEn: 'Loveseat olive linen',
      nameAr: 'كنبة ثنائية كتان زيتوني',
      nameHe: 'ספת שניים זית',
      price: 760,
      mfg: 355,
      replaceSku: { 'MAT-LIN-NAT': 'MAT-LIN-OLV' },
      options: [
        { group: 'FABRIC_FINISH', value: 'LINEN' },
        { group: 'FOAM_DENSITY', value: 'D35' },
      ],
      notes: {
        ar: 'كتان زيتوني: راجع اللوت مع العينة. لا تستخدم بقايا الرملي.',
        en: 'Olive linen: match the approved swatch lot. Do not use leftover sand rolls.',
        he: 'פשתן זית: התאם ללוט הדוגמה.',
      },
    },
  ],
  'SOF-L-SEC': [
    {
      code: 'CREAM',
      nameEn: 'L-sectional bouclé cream',
      nameAr: 'زاوية L بوكليه كريمي',
      nameHe: 'ספת פינה בוקלה',
      price: 1720,
      mfg: 810,
      options: [
        { group: 'FABRIC_FINISH', value: 'BOUCLE' },
        { group: 'FOAM_DENSITY', value: 'D40' },
        { group: 'CUSHION_SIZE', value: 'SQ_47' },
      ],
      notes: {
        ar: 'زاوية بوكليه: قص القطع الكبيرة أولاً. قرن 47×47. راجع اتجاه الوبرة.',
        en: 'Bouclé sectional: cut large panels first. 47×47 cushions. Check pile direction.',
        he: 'פינה בוקלה: חתוך פאנלים גדולים קודם. כריות 47.',
      },
    },
  ],
  'SOF-CORN': [
    {
      code: 'GREY',
      nameEn: 'Corner sofa chenille grey',
      nameAr: 'زاوية مدمجة شنيل رمادي',
      nameHe: 'ספת פינה שניל',
      price: 1020,
      mfg: 480,
      options: [{ group: 'FABRIC_FINISH', value: 'MATTE' }, { group: 'FOAM_DENSITY', value: 'D35' }],
      notes: {
        ar: 'شنيل رمادي: قص مع اتجاه الوبرة. لا تستخدم مخمل على هذه الزاوية.',
        en: 'Grey chenille: cut with the pile. Do not substitute velvet on this corner.',
        he: 'שניל אפור: חתוך עם כיוון הסיב.',
      },
    },
  ],
  'SOF-RECL': [
    {
      code: 'ITAL',
      nameEn: 'Recliner Italian velvet',
      nameAr: 'استرخاء مخمل إيطالي',
      nameHe: 'ריקליינר קטיפה איטלקית',
      price: 1680,
      mfg: 790,
      replaceSku: { 'MAT-LEA-BRN': 'MAT-ITAL-VEL' },
      options: [{ group: 'FABRIC_FINISH', value: 'VELVET' }, { group: 'FOAM_DENSITY', value: 'HR' }],
      notes: {
        ar: 'مخمل إيطالي محجوز: لا تقص قبل وصول اللوت. آلية الاسترخاء تُركّب بعد التنجيد.',
        en: 'Reserved Italian velvet: do not cut until the lot arrives. Fit the recliner mechanism after upholstery.',
        he: 'קטיפה איטלקית שמורה: לא לחתוך לפני הגעת הלוט.',
      },
    },
  ],
  'ARM-01': [
    {
      code: 'SAND',
      nameEn: 'Classic armchair sand velvet',
      nameAr: 'كرسي كلاسيك مخمل رملي',
      nameHe: 'כורסה קטיפה חול',
      price: 410,
      mfg: 190,
      options: [
        { group: 'FABRIC_FINISH', value: 'VELVET' },
        { group: 'FOAM_DENSITY', value: 'D40' },
        { group: 'PIPING_STYLE', value: 'BACK_SAME' },
      ],
      notes: {
        ar: 'مخمل رملي: بريم داير الظهر نفس اللون. إسفنج 40 للمقعد.',
        en: 'Sand velvet: piping around the back, same colour. Foam 40 on the seat.',
        he: 'קטיפה חול: פאספול באותו צבע. ספוג 40.',
      },
    },
  ],
  'ARM-02': [
    {
      code: 'BLK',
      nameEn: 'Club armchair black leatherette',
      nameAr: 'كرسي نادي جلد أسود',
      nameHe: 'כורסת מועדון שחור',
      price: 480,
      mfg: 225,
      options: [{ group: 'FABRIC_FINISH', value: 'MATTE' }, { group: 'WOOD_TYPE', value: 'OAK' }],
      notes: {
        ar: 'جلد أسود: شدّ بدون تجاعيد على المسند. لا تستخدم مخمل بديلاً.',
        en: 'Black leatherette: pull the backrest tight with no wrinkles. Do not substitute velvet.',
        he: 'דמוי עור שחור: מתיחה חלקה במשענת.',
      },
    },
  ],
  'ARM-WING': [
    {
      code: 'NAVY',
      nameEn: 'Wingback navy velvet',
      nameAr: 'كرسي جناح مخمل كحلي',
      nameHe: 'כנפיים קטיפה כחולה',
      price: 590,
      mfg: 275,
      options: [{ group: 'FABRIC_FINISH', value: 'VELVET' }, { group: 'FOAM_DENSITY', value: 'D40' }],
      notes: {
        ar: 'جناح كحلي: قص الأجنحة من نفس اللوت. إسفنج 40.',
        en: 'Navy wingback: cut both wings from the same lot. Foam 40.',
        he: 'כנפיים כחולות: שתי הכנפיים מאותו לוט.',
      },
    },
  ],
  'CHAIR-DIN': [
    {
      code: 'OLIVE',
      nameEn: 'Dining chair olive linen',
      nameAr: 'كرسي سفرة كتان زيتوني',
      nameHe: 'כיסא אוכל פשתן זית',
      price: 155,
      mfg: 72,
      replaceSku: { 'MAT-LIN-OLV': 'MAT-LIN-OLV' },
      options: [{ group: 'FABRIC_FINISH', value: 'LINEN' }, { group: 'WOOD_TYPE', value: 'BEECH' }],
      notes: {
        ar: 'كتان زيتوني: ستة كراسي من نفس اللوت. راجع لون الخشب قبل التنجيد.',
        en: 'Olive linen: keep a six-chair set on the same lot. Confirm wood colour before upholstery.',
        he: 'פשתן זית: שמור סט של שישה מאותו לוט.',
      },
    },
  ],
  'CHAIR-DIN-W': [
    {
      code: 'WHT',
      nameEn: 'Dining chair painted white',
      nameAr: 'كرسي سفرة أبيض مطلي',
      nameHe: 'כיסא אוכל לבן',
      price: 125,
      mfg: 55,
      options: [{ group: 'PAINT_COLOR', value: 'WHITE' }, { group: 'WOOD_TYPE', value: 'BEECH' }],
      notes: {
        ar: 'أبيض مطلي: طبقة برايمر ثم إينamel. لا تخلط مع صبغة الجوز.',
        en: 'Painted white: primer then enamel. Do not mix with walnut stain.',
        he: 'לבן צבוע: פריימר ואז אמייל.',
      },
    },
  ],
  'TABLE-DIN-6': [
    {
      code: 'WAL',
      nameEn: 'Dining table 6 walnut stain',
      nameAr: 'سفرة لستة صبغة جوز',
      nameHe: 'שולחן שישה אגוז',
      price: 720,
      mfg: 330,
      options: [{ group: 'PAINT_COLOR', value: 'WALNUT' }, { group: 'WOOD_TYPE', value: 'OAK' }],
      notes: {
        ar: 'صبغة جوز ثم لاكيه شفاف. راجع اتجاه العرق على السطح.',
        en: 'Walnut stain then clear lacquer. Keep grain direction aligned on the top.',
        he: 'צבע אגוז ואז לכה שקופה.',
      },
    },
  ],
  'TABLE-DIN-8': [
    {
      code: 'OAK',
      nameEn: 'Dining table 8 natural oak',
      nameAr: 'سفرة لثمانية سنديان طبيعي',
      nameHe: 'שולחן שמונה אלון',
      price: 890,
      mfg: 415,
      options: [{ group: 'PAINT_COLOR', value: 'OAK' }, { group: 'WOOD_TYPE', value: 'OAK' }],
      notes: {
        ar: 'سنديان طبيعي: صنفرة ناعمة. لا تستخدم صبغة جوز على هذا الطلب.',
        en: 'Natural oak: fine sand only. Do not walnut-stain this order.',
        he: 'אלון טבעי: ליטוש עדין בלבד.',
      },
    },
  ],
  'BED-Q': [
    {
      code: 'LIN',
      nameEn: 'Queen bed natural linen',
      nameAr: 'سرير كوين كتان طبيعي',
      nameHe: 'מיטת קווין פשתן',
      price: 820,
      mfg: 375,
      options: [{ group: 'FABRIC_FINISH', value: 'LINEN' }, { group: 'WOOD_TYPE', value: 'BEECH' }],
      notes: {
        ar: 'كتان طبيعي على المسند. راجع عرض 160 قبل القص.',
        en: 'Natural linen on the headboard. Confirm 160 cm width before cutting.',
        he: 'פשתן על הראש. אשר רוחב 160.',
      },
    },
  ],
  'BED-K': [
    {
      code: 'WAL',
      nameEn: 'King bed walnut oak',
      nameAr: 'سرير كينج صبغة جوز',
      nameHe: 'מיטת קינג אגוז',
      price: 980,
      mfg: 450,
      options: [{ group: 'PAINT_COLOR', value: 'WALNUT' }, { group: 'WOOD_TYPE', value: 'OAK' }],
      notes: {
        ar: 'كينج جوز: راجع عرض 180. لاكيه بعد الصبغة.',
        en: 'King walnut: confirm 180 cm width. Lacquer after stain.',
        he: 'קינג אגוז: אשר רוחב 180.',
      },
    },
  ],
  'CUS-OTT': [
    {
      code: 'SAND',
      nameEn: 'Ottoman sand velvet',
      nameAr: 'عثماني مخمل رملي',
      nameHe: 'הדום קטיפה חול',
      price: 230,
      mfg: 105,
      options: [{ group: 'FABRIC_FINISH', value: 'VELVET' }, { group: 'FOAM_DENSITY', value: 'D40' }],
      notes: {
        ar: 'عثماني رملي: إسفنج 40. قص غطاء واحد لكل قطعة.',
        en: 'Sand ottoman: foam 40. Cut one cover per piece.',
        he: 'הדום חול: ספוג 40. כיסוי אחד ליחידה.',
      },
    },
  ],
  'CUS-BANQ': [
    {
      code: 'NAVY',
      nameEn: 'Banquette navy velvet',
      nameAr: 'بانكيت مخمل كحلي',
      nameHe: 'ספסל קטיפה כחולה',
      price: 1040,
      mfg: 490,
      options: [{ group: 'FABRIC_FINISH', value: 'VELVET' }, { group: 'FOAM_DENSITY', value: 'D40' }],
      notes: {
        ar: 'بانكيت كحلي: قص حسب الطول المعتمد. لا تقص قبل تأكيد الزاوية.',
        en: 'Navy banquette: cut to the confirmed length. Do not cut before the corner is confirmed.',
        he: 'ספסל כחול: חתוך לפי האורך המאושר.',
      },
    },
  ],
  'CHAIR-BENCH': [
    {
      code: 'LIN',
      nameEn: 'Dining bench natural linen',
      nameAr: 'مقعد سفرة كتان طبيعي',
      nameHe: 'ספסל פשתן',
      price: 340,
      mfg: 155,
      options: [{ group: 'FABRIC_FINISH', value: 'LINEN' }, { group: 'WOOD_TYPE', value: 'BEECH' }],
      notes: {
        ar: 'مقعد كتان: قص الغطاء باتجاه واحد. راجع الطول قبل التنجيد.',
        en: 'Linen bench: cut the cover in one direction. Confirm length before upholstery.',
        he: 'ספסל פשתן: כיוון אחד לכיסוי.',
      },
    },
  ],
  'TABLE-CF': [
    {
      code: 'WAL',
      nameEn: 'Coffee table walnut',
      nameAr: 'طاولة قهوة صبغة جوز',
      nameHe: 'שולחן קפה אגוז',
      price: 310,
      mfg: 140,
      options: [{ group: 'PAINT_COLOR', value: 'WALNUT' }, { group: 'WOOD_TYPE', value: 'OAK' }],
      notes: {
        ar: 'قهوة جوز: صبغة ثم لاكيه. احمِ الأركان عند التغليف.',
        en: 'Walnut coffee table: stain then lacquer. Protect corners when packing.',
        he: 'שולחן קפה אגוז: צבע ואז לכה.',
      },
    },
  ],
  'BED-HEAD': [
    {
      code: 'SAND',
      nameEn: 'Headboard sand velvet',
      nameAr: 'مسند رأس مخمل رملي',
      nameHe: 'ראש מיטה קטיפה חול',
      price: 340,
      mfg: 155,
      options: [{ group: 'FABRIC_FINISH', value: 'VELVET' }, { group: 'FOAM_DENSITY', value: 'D35' }],
      notes: {
        ar: 'مسند رملي: قص المخمل باتجاه الوبرة. راجع العرض مع السرير.',
        en: 'Sand headboard: cut velvet with the pile. Confirm width against the bed.',
        he: 'ראש מיטה חול: כיוון הקטיפה. אשר רוחב.',
      },
    },
  ],
  'TABLE-SIDE': [
    {
      code: 'WHT',
      nameEn: 'Side table painted white',
      nameAr: 'طاولة جانبية أبيض مطلي',
      nameHe: 'שולחן צד לבן',
      price: 195,
      mfg: 82,
      options: [{ group: 'PAINT_COLOR', value: 'WHITE' }, { group: 'WOOD_TYPE', value: 'BEECH' }],
      notes: {
        ar: 'جانبية بيضاء: برايمر ثم إينamel. لا تخلط مع صبغة الجوز.',
        en: 'Painted white side table: primer then enamel. Do not mix with walnut stain.',
        he: 'שולחן צד לבן: פריימר ואמייל.',
      },
    },
  ],
  'TABLE-CONS': [
    {
      code: 'WAL',
      nameEn: 'Console walnut stain',
      nameAr: 'كونسول صبغة جوز',
      nameHe: 'קונסולה אגוז',
      price: 365,
      mfg: 165,
      options: [{ group: 'PAINT_COLOR', value: 'WALNUT' }, { group: 'WOOD_TYPE', value: 'OAK' }],
      notes: {
        ar: 'كونسول جوز: صبغة ثم لاكيه. راجع استواء السطح.',
        en: 'Walnut console: stain then lacquer. Check the top is flat.',
        he: 'קונסולה אגוז: צבע ואז לכה.',
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
  { sku: 'MAT-BEECH', nameEn: 'Beech lumber', nameAr: 'خشب زان', nameHe: 'עץ אשור', category: 'WOOD', group: 'WOOD', unit: 'm', reorder: 40, opening: 900, unitCost: 11.5 },
  { sku: 'MAT-OAK', nameEn: 'Oak boards', nameAr: 'ألواح سنديان', nameHe: 'לוחות אלון', category: 'WOOD', group: 'WOOD', unit: 'm', reorder: 30, opening: 620, unitCost: 18 },
  { sku: 'MAT-PLY', nameEn: 'Plywood 18mm', nameAr: 'أبلكاش 18مم', nameHe: 'דיקט 18 מ״מ', category: 'WOOD', group: 'WOOD', unit: 'sheet', reorder: 50, opening: 480, unitCost: 14 },
  { sku: 'MAT-MDF', nameEn: 'MDF 16mm', nameAr: 'MDF 16مم', nameHe: 'MDF 16 מ״מ', category: 'WOOD', group: 'WOOD', unit: 'sheet', reorder: 40, opening: 360, unitCost: 9.5 },
  { sku: 'MAT-WALNUT', nameEn: 'Walnut veneer', nameAr: 'قشرة جوز', nameHe: 'פורניר אגוז', category: 'WOOD', group: 'WOOD', unit: 'sheet', reorder: 20, opening: 140, unitCost: 22 },
  { sku: 'MAT-PINE', nameEn: 'Pine battens', nameAr: 'عوارض صنوبر', nameHe: 'קורות אורן', category: 'WOOD', group: 'WOOD', unit: 'm', reorder: 40, opening: 300, unitCost: 6.2 },
  { sku: 'MAT-TEAK', nameEn: 'Teak offcuts', nameAr: 'بقايا تيك', nameHe: 'שאריות טיק', category: 'WOOD', group: 'WOOD', unit: 'm', reorder: 10, opening: 80, unitCost: 28 },
  { sku: 'MAT-BIRCH', nameEn: 'Birch ply 12mm', nameAr: 'أبلكاش بتولا 12مم', nameHe: 'דיקט ליבנה', category: 'WOOD', group: 'WOOD', unit: 'sheet', reorder: 25, opening: 160, unitCost: 16 },
  { sku: 'MAT-EDGE', nameEn: 'Edge banding oak', nameAr: 'شريط حواف سنديان', nameHe: 'פס קנט אלון', category: 'WOOD', group: 'WOOD', unit: 'm', reorder: 80, opening: 400, unitCost: 1.4 },
  { sku: 'MAT-DOWEL', nameEn: 'Beech dowels', nameAr: 'مسامير خشب زان', nameHe: 'דיבל אשור', category: 'WOOD', group: 'WOOD', unit: 'pcs', reorder: 200, opening: 2000, unitCost: 0.15 },
  { sku: 'MAT-FOAM-HD', nameEn: 'HD foam block', nameAr: 'إسفنج عالي الكثافة', nameHe: 'ספוג צפיפות גבוהה', category: 'FOAM', group: 'FOAM', unit: 'block', reorder: 20, opening: 220, unitCost: 92 },
  { sku: 'MAT-FOAM-MD', nameEn: 'MD foam sheet', nameAr: 'إسفنج متوسط', nameHe: 'ספוג בינוני', category: 'FOAM', group: 'FOAM', unit: 'sheet', reorder: 25, opening: 180, unitCost: 48 },
  { sku: 'MAT-FOAM-LD', nameEn: 'LD foam sheet', nameAr: 'إسفنج خفيف', nameHe: 'ספוג קל', category: 'FOAM', group: 'FOAM', unit: 'sheet', reorder: 20, opening: 120, unitCost: 32 },
  { sku: 'MAT-FOAM-HR', nameEn: 'HR seating foam', nameAr: 'إسفنج جلوس HR', nameHe: 'ספוג ישיבה HR', category: 'FOAM', group: 'FOAM', unit: 'block', reorder: 12, opening: 70, unitCost: 110 },
  { sku: 'MAT-DACRON', nameEn: 'Dacron wrap', nameAr: 'حشوة داكرون', nameHe: 'עטיפת דקרון', category: 'FOAM', group: 'FOAM', unit: 'm', reorder: 40, opening: 250, unitCost: 4.5 },
  { sku: 'MAT-VEL-SAND', nameEn: 'Velvet sand roll', nameAr: 'رول مخمل رملي', nameHe: 'גליל קטיפה חול', category: 'FABRIC', group: 'FABRIC', unit: 'm', reorder: 40, opening: 280, unitCost: 12 },
  { sku: 'MAT-VEL-NAVY', nameEn: 'Velvet navy roll', nameAr: 'رول مخمل كحلي', nameHe: 'גליל קטיפה כחול', category: 'FABRIC', group: 'FABRIC', unit: 'm', reorder: 40, opening: 240, unitCost: 12.5 },
  { sku: 'MAT-LIN-NAT', nameEn: 'Linen natural roll', nameAr: 'رول كتان طبيعي', nameHe: 'גליל פשתן', category: 'FABRIC', group: 'FABRIC', unit: 'm', reorder: 50, opening: 300, unitCost: 9 },
  { sku: 'MAT-LIN-OLV', nameEn: 'Linen olive roll', nameAr: 'رول كتان زيتوني', nameHe: 'גליל פשתן זית', category: 'FABRIC', group: 'FABRIC', unit: 'm', reorder: 30, opening: 160, unitCost: 9.2 },
  { sku: 'MAT-BOU-CRM', nameEn: 'Boucle cream roll', nameAr: 'رول بوكليه كريمي', nameHe: 'גליל בוקלה', category: 'FABRIC', group: 'FABRIC', unit: 'm', reorder: 35, opening: 200, unitCost: 14 },
  { sku: 'MAT-LEA-BRN', nameEn: 'Leatherette brown', nameAr: 'جلد صناعي بني', nameHe: 'דמוי עור חום', category: 'FABRIC', group: 'FABRIC', unit: 'm', reorder: 25, opening: 140, unitCost: 18 },
  { sku: 'MAT-LEA-BLK', nameEn: 'Leatherette black', nameAr: 'جلد صناعي أسود', nameHe: 'דמוי עור שחור', category: 'FABRIC', group: 'FABRIC', unit: 'm', reorder: 25, opening: 130, unitCost: 18 },
  { sku: 'MAT-CHE-GRY', nameEn: 'Chenille grey', nameAr: 'شنيل رمادي', nameHe: 'שניל אפור', category: 'FABRIC', group: 'FABRIC', unit: 'm', reorder: 30, opening: 170, unitCost: 11 },
  { sku: 'MAT-ITAL-VEL', nameEn: 'Italian velvet reserved', nameAr: 'مخمل إيطالي محجوز', nameHe: 'קטיפה איטלקית', category: 'FABRIC', group: 'FABRIC', unit: 'm', reorder: 20, opening: 0, unitCost: 24 },
  { sku: 'MAT-HW-KIT', nameEn: 'Hardware kit standard', nameAr: 'طقم معدات قياسي', nameHe: 'ערכה חומרה', category: 'METAL_ACCESSORY', group: 'ACCESSORIES', unit: 'kit', reorder: 30, opening: 400, unitCost: 8 },
  { sku: 'MAT-HW-SCREW', nameEn: 'Confirmat screws', nameAr: 'براغي كونفرمات', nameHe: 'ברגי קונפירמט', category: 'METAL_ACCESSORY', group: 'ACCESSORIES', unit: 'pcs', reorder: 500, opening: 8000, unitCost: 0.08 },
  { sku: 'MAT-SPRING', nameEn: 'Sinous spring pack', nameAr: 'طقم نوابض', nameHe: 'חבילת קפיצים', category: 'METAL_ACCESSORY', group: 'ACCESSORIES', unit: 'pack', reorder: 20, opening: 90, unitCost: 22 },
  { sku: 'MAT-MECH-RECL', nameEn: 'Recliner mechanism', nameAr: 'آلية استرخاء', nameHe: 'מנגנון ריקליינר', category: 'METAL_ACCESSORY', group: 'ACCESSORIES', unit: 'pcs', reorder: 8, opening: 40, unitCost: 95 },
  { sku: 'MAT-CASTER', nameEn: 'Furniture casters', nameAr: 'عجلات أثاث', nameHe: 'גלגלים', category: 'METAL_ACCESSORY', group: 'ACCESSORIES', unit: 'set', reorder: 20, opening: 80, unitCost: 14 },
  { sku: 'MAT-ZIP', nameEn: 'Upholstery zips', nameAr: 'سحّابات تنجيد', nameHe: 'רוכסני ריפוד', category: 'DECORATIVE_ACCESSORY', group: 'ACCESSORIES', unit: 'pcs', reorder: 80, opening: 400, unitCost: 1.1 },
  { sku: 'MAT-BUTTON', nameEn: 'Tufting buttons', nameAr: 'أزرار تطريز', nameHe: 'כפתורי קיבוע', category: 'DECORATIVE_ACCESSORY', group: 'ACCESSORIES', unit: 'pcs', reorder: 200, opening: 1200, unitCost: 0.4 },
  { sku: 'MAT-LACQ', nameEn: 'Lacquer clear', nameAr: 'لاكيه شفاف', nameHe: 'לכה שקופה', category: 'PAINT', group: null, unit: 'L', reorder: 15, opening: 160, unitCost: 7.8 },
  { sku: 'MAT-STAIN-WAL', nameEn: 'Walnut stain', nameAr: 'صبغة جوز', nameHe: 'צבע אגוז', category: 'PAINT', group: null, unit: 'L', reorder: 10, opening: 90, unitCost: 9.1 },
  { sku: 'MAT-PRIMER', nameEn: 'Wood primer', nameAr: 'برايمر خشب', nameHe: 'פריימר עץ', category: 'PAINT', group: null, unit: 'L', reorder: 12, opening: 70, unitCost: 6.4 },
  { sku: 'MAT-WHT-PAINT', nameEn: 'Painted white enamel', nameAr: 'دهان أبيض', nameHe: 'אמייל לבן', category: 'PAINT', group: null, unit: 'L', reorder: 10, opening: 55, unitCost: 8.2 },
  { sku: 'MAT-GLUE', nameEn: 'Wood glue industrial', nameAr: 'صمغ خشب صناعي', nameHe: 'דבק עץ', category: 'ADHESIVE', group: null, unit: 'L', reorder: 20, opening: 120, unitCost: 4.2 },
  { sku: 'MAT-SPRAY-ADH', nameEn: 'Spray adhesive', nameAr: 'لاصق رذاذ', nameHe: 'דבק תרסיס', category: 'ADHESIVE', group: null, unit: 'can', reorder: 24, opening: 80, unitCost: 9.5 },
  { sku: 'MAT-THREAD', nameEn: 'Upholstery thread', nameAr: 'خيط تنجيد', nameHe: 'חוט ריפוד', category: 'ADHESIVE', group: 'ACCESSORIES', unit: 'spool', reorder: 30, opening: 90, unitCost: 3.2 },
  { sku: 'MAT-FOIL', nameEn: 'Protective wrap', nameAr: 'تغليف واقي', nameHe: 'ניילון מגן', category: 'PACKAGING', group: null, unit: 'roll', reorder: 20, opening: 140, unitCost: 3.5 },
  { sku: 'MAT-CARTON', nameEn: 'Carton crate blank', nameAr: 'كرتون تغليف', nameHe: 'קרטון אריזה', category: 'PACKAGING', group: null, unit: 'pcs', reorder: 40, opening: 500, unitCost: 2.1 },
  { sku: 'MAT-CORNER', nameEn: 'Corner protectors', nameAr: 'زوايا حماية', nameHe: 'מגני פינות', category: 'PACKAGING', group: null, unit: 'pcs', reorder: 80, opening: 600, unitCost: 0.6 },
  { sku: 'MAT-STRAP', nameEn: 'Packing strap', nameAr: 'شريط ربط', nameHe: 'רצועת אריזה', category: 'PACKAGING', group: null, unit: 'roll', reorder: 15, opening: 70, unitCost: 5.5 },
];

const FABRICS = [
  { code: 'FAB-VEL-SAND', nameEn: 'Velvet Sand', nameAr: 'مخمل رملي', color: 'Sand' },
  { code: 'FAB-VEL-NAVY', nameEn: 'Velvet Navy', nameAr: 'مخمل كحلي', color: 'Navy' },
  { code: 'FAB-LIN-NAT', nameEn: 'Linen Natural', nameAr: 'كتان طبيعي', color: 'Natural' },
  { code: 'FAB-LIN-OLV', nameEn: 'Linen Olive', nameAr: 'كتان زيتوني', color: 'Olive' },
  { code: 'FAB-BOU-CRM', nameEn: 'Boucle Cream', nameAr: 'بوكليه كريمي', color: 'Cream' },
  { code: 'FAB-LEA-BRN', nameEn: 'Leatherette Brown', nameAr: 'جلد صناعي بني', color: 'Brown' },
  { code: 'FAB-LEA-BLK', nameEn: 'Leatherette Black', nameAr: 'جلد صناعي أسود', color: 'Black' },
  { code: 'FAB-CHE-GRY', nameEn: 'Chenille Grey', nameAr: 'شنيل رمادي', color: 'Grey' },
];

const COLORS = [
  { code: 'CLR-WAL', nameEn: 'Walnut', nameAr: 'جوز', hex: '#5C4033' },
  { code: 'CLR-OAK', nameEn: 'Natural Oak', nameAr: 'سنديان طبيعي', hex: '#C4A35A' },
  { code: 'CLR-EBONY', nameEn: 'Ebony', nameAr: 'أبنوس', hex: '#1C1C1C' },
  { code: 'CLR-WHT', nameEn: 'Painted White', nameAr: 'أبيض مطلي', hex: '#F5F1EA' },
  { code: 'CLR-GRY', nameEn: 'Warm Grey', nameAr: 'رمادي دافئ', hex: '#8A857C' },
  { code: 'CLR-TEAK', nameEn: 'Teak', nameAr: 'تيك', hex: '#B8860B' },
  { code: 'CLR-GOLD', nameEn: 'Gold', nameAr: 'ذهبي', hex: '#C9A227' },
];

export async function seedDemoCatalog(prisma: PrismaClient, dealers: DealerRef[]) {
  const rng = createRng(20260912);
  const catByCode: Record<string, string> = {};
  for (const c of CATEGORIES) {
    const row = await prisma.productCategory.create({
      data: { code: c.code, nameEn: c.nameEn, nameAr: c.nameAr },
    });
    catByCode[c.code] = row.id;
  }

  for (const f of FABRICS) {
    await prisma.fabric.create({
      data: { code: f.code, nameEn: f.nameEn, nameAr: f.nameAr, color: f.color },
    });
  }
  for (const c of COLORS) {
    await prisma.colorReference.create({
      data: { code: c.code, nameEn: c.nameEn, nameAr: c.nameAr, hex: c.hex },
    });
  }

  const materials: MaterialRef[] = [];
  for (const m of MATERIALS) {
    const material = await prisma.material.create({
      data: {
        sku: m.sku,
        nameEn: m.nameEn,
        nameAr: m.nameAr,
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
      const factor = ['nile', 'balqis', 'qasr', 'jabal'].includes(dealer.username) ? 0.94 : 0.9;
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
