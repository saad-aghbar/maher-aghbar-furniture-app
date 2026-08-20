import {
  InventoryItemClass,
  InventoryTracking,
  Prisma,
  PrismaClient,
  type InventoryCategory,
  type RawMaterialGroup,
} from '@prisma/client';
import { money } from '../seed/util';
import { assignRandomProductPhotos } from '../seed/productPhotoPool';
import {
  measurementsToPrisma,
  standardMeasurementsForProduct,
} from '../seed/productMeasurements';
import { seedProductEstimates } from '../seed/product-estimates';
import { STANDARD_FURNITURE_WORKFLOW_CODE } from '../seed/workflow';
import { createRng } from '../seed/util';
import type { DealerRef } from './people';
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
];

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
  await prisma.productStageInventoryOutput.create({
    data: {
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
    },
  });
}

export async function seedDemoCatalog(prisma: PrismaClient, dealers: DealerRef[]) {
  const rng = createRng(20260816);
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

  const workflows = await prisma.productionWorkflow.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, code: true, activeVersionId: true },
  });
  const wfByCode = new Map(workflows.map((w) => [w.code, w]));

  const products: ProductRef[] = [];
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
        basePrice: money(p.basePrice),
        manufacturingCost: money(p.mfg),
        unit: 'pcs',
        imageUrl: photos.imageUrl,
        galleryUrls: photos.galleryUrls,
        bomDefaults: { materials: p.bom },
        adminNotes: `Family ${p.workflowCode}. Confirm fabric lot before cutting.`,
        ...measurementsToPrisma(measures),
        workflowConfiguration: { create: { workflowId: wf.id } },
      },
    });
    products.push({
      id: row.id,
      sku: p.sku,
      nameEn: p.nameEn,
      nameAr: p.nameAr,
      nameHe: p.nameHe,
      basePrice: row.basePrice ?? money(p.basePrice),
      manufacturingCost: row.manufacturingCost,
      imageUrl: row.imageUrl,
      categoryCode: p.categoryCode,
      workflowCode: p.workflowCode,
      bom: p.bom,
    });

    for (const dealer of dealers) {
      const factor = ['nile', 'balqis', 'qasr', 'jabal'].includes(dealer.username) ? 0.94 : 0.9;
      await prisma.dealerPrice.create({
        data: {
          customerId: dealer.id,
          productId: row.id,
          price: money(p.basePrice * factor),
          currency: 'ILS',
        },
      });
    }
  }

  const estimates = await seedProductEstimates(prisma, products);
  console.log(`  estimates: ${estimates.profiles} profiles · ${estimates.estimates} stage rows`);

  const sofa = products.find((p) => p.sku === 'SOF-3S-STD');
  const standard = wfByCode.get(STANDARD_FURNITURE_WORKFLOW_CODE);
  if (sofa && standard?.activeVersionId) {
    const nodes = await prisma.productionWorkflowNode.findMany({
      where: { workflowVersionId: standard.activeVersionId },
      include: { stageDefinition: true },
    });
    const byCode = new Map(nodes.map((n) => [n.stageDefinition.code, n]));
    const semiWh = await prisma.warehouse.findUniqueOrThrow({ where: { code: 'SEMI' } });
    const finWh = await prisma.warehouse.findUniqueOrThrow({ where: { code: 'FIN' } });
    const carpentry = byCode.get('CARPENTRY');
    const packaging = byCode.get('PACKAGING');
    const materialPrep = byCode.get('MATERIAL_PREP');
    if (materialPrep) {
      await upsertOutput(prisma, {
        productId: sofa.id,
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
      const frame = await prisma.inventoryItem.create({
        data: {
          sku: 'SOF-3S-STD-FRAME',
          nameEn: '3-Seater Sofa Standard Frame',
          nameAr: 'هيكل كنبة ثلاثية قياسية',
          nameHe: 'שלדת ספה סטנדרטית',
          category: 'SEMI_FINISHED',
          itemClass: InventoryItemClass.SEMI_FINISHED_GOOD,
          unit: 'pcs',
          isPurchasable: false,
          productId: sofa.id,
        },
      });
      await upsertOutput(prisma, {
        productId: sofa.id,
        nodeId: carpentry.id,
        stageDefinitionId: carpentry.stageDefinitionId,
        itemClass: InventoryItemClass.SEMI_FINISHED_GOOD,
        tracking: InventoryTracking.PRODUCES_SEMI_FINISHED,
        consumesRaw: false,
        consumesSemi: false,
        nameEn: frame.nameEn,
        nameAr: frame.nameAr,
        nameHe: frame.nameHe ?? 'שלדת ספה סטנדרטית',
        inventoryItemId: frame.id,
        warehouseId: semiWh.id,
      });
    }
    if (packaging) {
      const fg = await prisma.inventoryItem.create({
        data: {
          sku: 'SOF-3S-STD-FG',
          nameEn: '3-Seater Sofa Standard FG',
          nameAr: 'كنبة ثلاثية قياسية جاهزة',
          nameHe: 'ספה סטנדרטית מוגמרת',
          category: 'FINISHED',
          itemClass: InventoryItemClass.FINISHED_GOOD,
          unit: 'pcs',
          isPurchasable: false,
          productId: sofa.id,
        },
      });
      await upsertOutput(prisma, {
        productId: sofa.id,
        nodeId: packaging.id,
        stageDefinitionId: packaging.stageDefinitionId,
        itemClass: InventoryItemClass.FINISHED_GOOD,
        tracking: InventoryTracking.PRODUCES_FINISHED,
        consumesRaw: false,
        consumesSemi: true,
        nameEn: fg.nameEn,
        nameAr: fg.nameAr,
        nameHe: fg.nameHe ?? 'ספה סטנדרטית מוגמרת',
        inventoryItemId: fg.id,
        warehouseId: finWh.id,
      });
    }
  }

  console.log(`  catalog: ${products.length} products · ${materials.length} raw SKUs`);
  return { products, materials };
}
