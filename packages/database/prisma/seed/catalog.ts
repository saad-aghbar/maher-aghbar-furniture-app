import { PrismaClient, Prisma } from '@prisma/client';
import { money } from './util';
import { assignRandomProductPhotos } from './productPhotoPool';
import {
  measurementsToPrisma,
  standardMeasurementsForProduct,
} from './productMeasurements';
import type { DealerRef } from './people';

export type ProductRef = {
  id: string;
  sku: string;
  nameEn: string;
  nameAr: string;
  basePrice: Prisma.Decimal;
  manufacturingCost: Prisma.Decimal | null;
  imageUrl: string | null;
  categoryCode: string;
};

const CATEGORIES = [
  { code: 'SOFA', nameEn: 'Sofas', nameAr: 'كنب' },
  { code: 'CHAIR', nameEn: 'Chairs', nameAr: 'كراسي' },
  { code: 'BED', nameEn: 'Beds', nameAr: 'أسرّة' },
  { code: 'TABLE', nameEn: 'Tables', nameAr: 'طاولات' },
  { code: 'CUSTOM', nameEn: 'Custom', nameAr: 'تفصيل' },
];

const PRODUCTS: Array<{
  sku: string;
  categoryCode: string;
  nameEn: string;
  nameAr: string;
  basePrice: number;
  mfg: number;
}> = [
  { sku: 'SOF-3S-STD', categoryCode: 'SOFA', nameEn: '3-Seater Sofa Standard', nameAr: 'كنبة ثلاثية قياسية', basePrice: 890, mfg: 420 },
  { sku: 'SOF-3S-LUX', categoryCode: 'SOFA', nameEn: '3-Seater Sofa Luxury', nameAr: 'كنبة ثلاثية فاخرة', basePrice: 1280, mfg: 610 },
  { sku: 'SOF-L-SEC', categoryCode: 'SOFA', nameEn: 'L-Sectional Sofa', nameAr: 'كنبة زاوية L', basePrice: 1650, mfg: 780 },
  { sku: 'SOF-2S', categoryCode: 'SOFA', nameEn: '2-Seater Loveseat', nameAr: 'كنبة ثنائية', basePrice: 720, mfg: 340 },
  { sku: 'SOF-CHAISE', categoryCode: 'SOFA', nameEn: 'Chaise Lounge', nameAr: 'شيزلونج', basePrice: 640, mfg: 300 },
  { sku: 'ARM-01', categoryCode: 'CHAIR', nameEn: 'Armchair Classic', nameAr: 'كرسي بذراعين كلاسيك', basePrice: 380, mfg: 175 },
  { sku: 'ARM-02', categoryCode: 'CHAIR', nameEn: 'Armchair Club', nameAr: 'كرسي نادي', basePrice: 450, mfg: 210 },
  { sku: 'CHAIR-DIN', categoryCode: 'CHAIR', nameEn: 'Dining Chair Upholstered', nameAr: 'كرسي سفرة منجد', basePrice: 145, mfg: 68 },
  { sku: 'CHAIR-DIN-W', categoryCode: 'CHAIR', nameEn: 'Dining Chair Wood', nameAr: 'كرسي سفرة خشب', basePrice: 110, mfg: 48 },
  { sku: 'CHAIR-BAR', categoryCode: 'CHAIR', nameEn: 'Bar Stool Padded', nameAr: 'كرسي بار مبطن', basePrice: 165, mfg: 72 },
  { sku: 'CHAIR-OFF', categoryCode: 'CHAIR', nameEn: 'Office Guest Chair', nameAr: 'كرسي ضيف مكتبي', basePrice: 220, mfg: 95 },
  { sku: 'BED-Q', categoryCode: 'BED', nameEn: 'Queen Bed Frame', nameAr: 'سرير كوين', basePrice: 780, mfg: 360 },
  { sku: 'BED-K', categoryCode: 'BED', nameEn: 'King Bed Frame', nameAr: 'سرير كينج', basePrice: 940, mfg: 430 },
  { sku: 'BED-SGL', categoryCode: 'BED', nameEn: 'Single Bed Frame', nameAr: 'سرير مفرد', basePrice: 520, mfg: 240 },
  { sku: 'BED-HEAD', categoryCode: 'BED', nameEn: 'Upholstered Headboard', nameAr: 'مسند رأس منجد', basePrice: 310, mfg: 140 },
  { sku: 'TABLE-CF', categoryCode: 'TABLE', nameEn: 'Coffee Table Oak', nameAr: 'طاولة قهوة سنديان', basePrice: 290, mfg: 130 },
  { sku: 'TABLE-DIN-6', categoryCode: 'TABLE', nameEn: 'Dining Table 6-Seat', nameAr: 'طاولة سفرة لستة', basePrice: 680, mfg: 310 },
  { sku: 'TABLE-DIN-8', categoryCode: 'TABLE', nameEn: 'Dining Table 8-Seat', nameAr: 'طاولة سفرة لثمانية', basePrice: 860, mfg: 400 },
  { sku: 'TABLE-SIDE', categoryCode: 'TABLE', nameEn: 'Side Table', nameAr: 'طاولة جانبية', basePrice: 180, mfg: 75 },
  { sku: 'TABLE-CONS', categoryCode: 'TABLE', nameEn: 'Console Table', nameAr: 'طاولة كونسول', basePrice: 340, mfg: 150 },
  { sku: 'CUS-BANQ', categoryCode: 'CUSTOM', nameEn: 'Banquette Custom', nameAr: 'بانكيت تفصيل', basePrice: 980, mfg: 460 },
  { sku: 'CUS-BOOT', categoryCode: 'CUSTOM', nameEn: 'Booth Seating Custom', nameAr: 'جلسة بوث تفصيل', basePrice: 1120, mfg: 520 },
  { sku: 'CUS-WALL', categoryCode: 'CUSTOM', nameEn: 'Wall Panel Set', nameAr: 'ألواح جدارية', basePrice: 740, mfg: 340 },
  { sku: 'CUS-REC', categoryCode: 'CUSTOM', nameEn: 'Reception Desk Custom', nameAr: 'مكتب استقبال تفصيل', basePrice: 1450, mfg: 680 },
  { sku: 'SOF-MOD', categoryCode: 'SOFA', nameEn: 'Modular Sofa Unit', nameAr: 'وحدة كنبة مودولار', basePrice: 520, mfg: 245 },
  { sku: 'SOF-OUT', categoryCode: 'SOFA', nameEn: 'Outdoor Sofa Set', nameAr: 'طقم كنبة خارجي', basePrice: 1180, mfg: 550 },
  { sku: 'ARM-SWIV', categoryCode: 'CHAIR', nameEn: 'Swivel Lounge Chair', nameAr: 'كرسي دوار', basePrice: 490, mfg: 230 },
  { sku: 'BED-STO', categoryCode: 'BED', nameEn: 'Storage Bed Queen', nameAr: 'سرير كوين مع تخزين', basePrice: 1050, mfg: 490 },
  { sku: 'TABLE-NEST', categoryCode: 'TABLE', nameEn: 'Nesting Tables Set', nameAr: 'طقم طاولات متداخلة', basePrice: 260, mfg: 115 },
  { sku: 'CUS-BAR', categoryCode: 'CUSTOM', nameEn: 'Bar Counter Custom', nameAr: 'كاونتر بار تفصيل', basePrice: 1680, mfg: 790 },
  { sku: 'SOF-CORN', categoryCode: 'SOFA', nameEn: 'Corner Sofa Compact', nameAr: 'كنبة زاوية مدمجة', basePrice: 980, mfg: 460 },
  { sku: 'CHAIR-BENCH', categoryCode: 'CHAIR', nameEn: 'Dining Bench', nameAr: 'مقعد سفرة', basePrice: 320, mfg: 145 },
  { sku: 'TABLE-WRK', categoryCode: 'TABLE', nameEn: 'Work Desk Solid', nameAr: 'مكتب عمل خشب', basePrice: 540, mfg: 250 },
  { sku: 'CUS-OTT', categoryCode: 'CUSTOM', nameEn: 'Ottoman Custom', nameAr: 'عثماني تفصيل', basePrice: 210, mfg: 95 },
  { sku: 'SOF-DAY', categoryCode: 'SOFA', nameEn: 'Daybed', nameAr: 'سرير نهاري', basePrice: 860, mfg: 400 },
  { sku: 'ARM-WING', categoryCode: 'CHAIR', nameEn: 'Wingback Chair', nameAr: 'كرسي جناح', basePrice: 560, mfg: 260 },
  { sku: 'BED-TT', categoryCode: 'BED', nameEn: 'Twin Twin Bunk Frame', nameAr: 'سرير طابقين', basePrice: 690, mfg: 320 },
  { sku: 'TABLE-CONF', categoryCode: 'TABLE', nameEn: 'Conference Table 10', nameAr: 'طاولة اجتماعات 10', basePrice: 1450, mfg: 680 },
  { sku: 'CUS-LIBR', categoryCode: 'CUSTOM', nameEn: 'Library Wall Custom', nameAr: 'مكتبة جدارية تفصيل', basePrice: 2100, mfg: 980 },
  { sku: 'SOF-RECL', categoryCode: 'SOFA', nameEn: 'Recliner Sofa 3S', nameAr: 'كنبة استرخاء ثلاثية', basePrice: 1520, mfg: 720 },
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

export async function seedCatalog(prisma: PrismaClient, dealers: DealerRef[]) {
  const catByCode: Record<string, string> = {};
  for (const c of CATEGORIES) {
    const row = await prisma.productCategory.create({
      data: { code: c.code, nameEn: c.nameEn, nameAr: c.nameAr },
    });
    catByCode[c.code] = row.id;
  }

  const products: ProductRef[] = [];
  for (const p of PRODUCTS) {
    const photos = assignRandomProductPhotos({ min: 1, max: 6 });
    const measures = standardMeasurementsForProduct({
      categoryCode: p.categoryCode,
      sku: p.sku,
      nameEn: p.nameEn,
    });
    const row = await prisma.product.create({
      data: {
        sku: p.sku,
        categoryId: catByCode[p.categoryCode]!,
        nameEn: p.nameEn,
        nameAr: p.nameAr,
        basePrice: money(p.basePrice),
        manufacturingCost: money(p.mfg),
        isActive: true,
        imageUrl: photos.imageUrl,
        galleryUrls: photos.galleryUrls,
        ...measurementsToPrisma(measures),
        bomDefaults: {
          fabricMeters: p.categoryCode === 'SOFA' || p.categoryCode === 'CHAIR' ? 8 : 2,
          woodUnits: 1,
          foamBlocks: p.categoryCode === 'TABLE' ? 0 : 1,
        },
      },
    });
    products.push({
      id: row.id,
      sku: row.sku,
      nameEn: row.nameEn,
      nameAr: row.nameAr,
      basePrice: row.basePrice ?? money(0),
      manufacturingCost: row.manufacturingCost,
      imageUrl: row.imageUrl,
      categoryCode: p.categoryCode,
    });
  }

  for (const f of FABRICS) {
    await prisma.fabric.create({
      data: {
        code: f.code,
        nameEn: f.nameEn,
        nameAr: f.nameAr,
        color: f.color,
        isActive: true,
      },
    });
  }
  for (const c of COLORS) {
    await prisma.colorReference.create({
      data: { code: c.code, nameEn: c.nameEn, nameAr: c.nameAr, hex: c.hex },
    });
  }

  for (const dealer of dealers) {
    const off = ['balqis', 'deadsea', 'nile'].includes(dealer.username) ? 0.06 : 0.1;
    for (const product of products) {
      const base = Number(product.basePrice);
      await prisma.dealerPrice.create({
        data: {
          customerId: dealer.id,
          productId: product.id,
          price: money(base * (1 - off)),
          currency: 'ILS',
        },
      });
    }
  }

  return { products, fabrics: FABRICS, colors: COLORS };
}
