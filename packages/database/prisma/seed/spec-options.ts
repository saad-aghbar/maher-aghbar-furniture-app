import type { PrismaClient } from '@prisma/client';

type SeedGroup = {
  code: string;
  nameAr: string;
  nameEn: string;
  nameHe: string;
  inputType: 'SELECT' | 'SELECT_WITH_QTY' | 'DIMENSION' | 'COLOR';
  appliesTo: string;
  sortOrder: number;
  values: Array<{
    code: string;
    nameAr: string;
    nameEn: string;
    nameHe: string;
    hex?: string;
    numericValue?: number;
    unit?: string;
    colorCode?: string;
    inventorySku?: string;
    sortOrder: number;
  }>;
};

/** Factory vocabulary from the handwritten spec sheet (كرينا / أوكرانيه). */
export const SPEC_OPTION_GROUPS: SeedGroup[] = [
  {
    code: 'FOAM_DENSITY',
    nameAr: 'كثافة الإسفنج',
    nameEn: 'Foam density',
    nameHe: 'צפיפות ספוג',
    inputType: 'SELECT',
    appliesTo: 'SOFA,CHAIR,CUSTOM',
    sortOrder: 10,
    values: [
      { code: 'D30', nameAr: 'إسفنج 30', nameEn: 'Foam 30', nameHe: 'ספוג 30', numericValue: 30, unit: 'kg', inventorySku: 'MAT-FOAM-LD', sortOrder: 10 },
      { code: 'D35', nameAr: 'إسفنج 35', nameEn: 'Foam 35', nameHe: 'ספוג 35', numericValue: 35, unit: 'kg', inventorySku: 'MAT-FOAM-MD', sortOrder: 20 },
      { code: 'D40', nameAr: 'إسفنج 40', nameEn: 'Foam 40', nameHe: 'ספוג 40', numericValue: 40, unit: 'kg', inventorySku: 'MAT-FOAM-HD', sortOrder: 30 },
      { code: 'HR', nameAr: 'إسفنج جلوس HR', nameEn: 'HR seating foam', nameHe: 'ספוג ישיבה HR', inventorySku: 'MAT-FOAM-HR', sortOrder: 40 },
    ],
  },
  {
    code: 'PAINT_COLOR',
    nameAr: 'لون الدهان',
    nameEn: 'Paint colour',
    nameHe: 'צבע צביעה',
    inputType: 'COLOR',
    appliesTo: 'SOFA,CHAIR,TABLE,BED,CUSTOM',
    sortOrder: 20,
    values: [
      { code: 'GOLD', nameAr: 'ذهبي', nameEn: 'Gold', nameHe: 'זהב', hex: '#C9A227', colorCode: 'CLR-GOLD', sortOrder: 10 },
      { code: 'MATTE', nameAr: 'مت', nameEn: 'Matte', nameHe: 'מט', hex: '#8A857C', sortOrder: 20 },
      { code: 'WALNUT', nameAr: 'جوز', nameEn: 'Walnut', nameHe: 'אגוז', hex: '#5C4033', colorCode: 'CLR-WAL', sortOrder: 30 },
      { code: 'OAK', nameAr: 'سنديان', nameEn: 'Oak', nameHe: 'אלון', hex: '#C4A35A', colorCode: 'CLR-OAK', sortOrder: 40 },
      { code: 'WHITE', nameAr: 'أبيض مطلي', nameEn: 'Painted white', nameHe: 'לבן צבוע', hex: '#F5F1EA', colorCode: 'CLR-WHT', sortOrder: 50 },
    ],
  },
  {
    code: 'WOOD_TYPE',
    nameAr: 'نوع الخشب',
    nameEn: 'Wood type',
    nameHe: 'סוג עץ',
    inputType: 'SELECT',
    appliesTo: 'SOFA,CHAIR,TABLE,BED,CUSTOM',
    sortOrder: 30,
    values: [
      { code: 'BEECH', nameAr: 'زان', nameEn: 'Beech', nameHe: 'אשור', inventorySku: 'MAT-BEECH', sortOrder: 10 },
      { code: 'OAK', nameAr: 'سنديان', nameEn: 'Oak', nameHe: 'אלון', inventorySku: 'MAT-OAK', sortOrder: 20 },
      { code: 'WALNUT', nameAr: 'جوز', nameEn: 'Walnut', nameHe: 'אגוז', inventorySku: 'MAT-WALNUT', sortOrder: 30 },
      { code: 'TEAK', nameAr: 'تيك', nameEn: 'Teak', nameHe: 'טיק', inventorySku: 'MAT-TEAK', sortOrder: 40 },
      { code: 'MDF', nameAr: 'ام دي اف', nameEn: 'MDF', nameHe: 'MDF', inventorySku: 'MAT-MDF', sortOrder: 50 },
    ],
  },
  {
    code: 'FABRIC_FINISH',
    nameAr: 'تشطيب القماش',
    nameEn: 'Fabric finish',
    nameHe: 'גימור בד',
    inputType: 'SELECT',
    appliesTo: 'SOFA,CHAIR,CUSTOM',
    sortOrder: 40,
    values: [
      { code: 'MATTE', nameAr: 'مت', nameEn: 'Matte', nameHe: 'מט', sortOrder: 10 },
      { code: 'VELVET', nameAr: 'مخمل', nameEn: 'Velvet', nameHe: 'קטיפה', sortOrder: 20 },
      { code: 'LINEN', nameAr: 'كتان', nameEn: 'Linen', nameHe: 'פשתן', sortOrder: 30 },
      { code: 'BOUCLE', nameAr: 'بوكليه', nameEn: 'Bouclé', nameHe: 'בוקלה', sortOrder: 40 },
    ],
  },
  {
    code: 'PIPING_STYLE',
    nameAr: 'أسلوب البريم',
    nameEn: 'Piping style',
    nameHe: 'סגנון פאספול',
    inputType: 'SELECT',
    appliesTo: 'SOFA,CHAIR,CUSTOM',
    sortOrder: 50,
    values: [
      { code: 'BACK_SAME', nameAr: 'بريم داير الظهر نفس اللون', nameEn: 'Piping around the back, same colour', nameHe: 'פאספול סביב הגב באותו צבע', sortOrder: 10 },
      { code: 'SIMPLE_WRAP', nameAr: 'لف بسيط', nameEn: 'Simple wrap', nameHe: 'עטיפה פשוטה', sortOrder: 20 },
      { code: 'NO_ELBOW', nameAr: 'لف بسيط مع بدون كوع', nameEn: 'Simple wrap without elbow', nameHe: 'עטיפה פשוטה בלי מרפק', sortOrder: 30 },
      { code: 'NONE', nameAr: 'بدون بريم', nameEn: 'No piping', nameHe: 'בלי פאספול', sortOrder: 40 },
    ],
  },
  {
    code: 'LEG_TYPE',
    nameAr: 'نوع الأرجل',
    nameEn: 'Leg / ring type',
    nameHe: 'סוג רגליים',
    inputType: 'DIMENSION',
    appliesTo: 'SOFA,CHAIR,CUSTOM',
    sortOrder: 60,
    values: [
      { code: 'RING_9', nameAr: 'حلق ارتفاع 9 سم', nameEn: 'Ring 9 cm', nameHe: 'טבעת 9 ס״מ', numericValue: 9, unit: 'cm', sortOrder: 10 },
      { code: 'RING_12', nameAr: 'حلق ارتفاع 12 سم', nameEn: 'Ring 12 cm', nameHe: 'טבעת 12 ס״מ', numericValue: 12, unit: 'cm', sortOrder: 20 },
      { code: 'WOOD_TAPERED', nameAr: 'أرجل خشب مخروطية', nameEn: 'Tapered wood legs', nameHe: 'רגלי עץ מתחדדות', sortOrder: 30 },
      { code: 'METAL_HAIRPIN', nameAr: 'أرجل معدنية', nameEn: 'Metal hairpin legs', nameHe: 'רגלי מתכת', sortOrder: 40 },
    ],
  },
  {
    code: 'CUSHION_SIZE',
    nameAr: 'مقاس القرن',
    nameEn: 'Cushion size',
    nameHe: 'גודל כרית',
    inputType: 'SELECT_WITH_QTY',
    appliesTo: 'SOFA,CHAIR,CUSTOM',
    sortOrder: 70,
    values: [
      { code: 'SQ_47', nameAr: 'قرن 47×47 سم', nameEn: 'Cushion 47×47 cm', nameHe: 'כרית 47×47 ס״מ', numericValue: 47, unit: 'cm', sortOrder: 10 },
      { code: 'RECT_55_35', nameAr: 'قرن 55×35 سم', nameEn: 'Cushion 55×35 cm', nameHe: 'כרית 55×35 ס״מ', numericValue: 55, unit: 'cm', sortOrder: 20 },
      { code: 'FOOTBALL_SMALL', nameAr: 'قرنة كرة قدم الحجم الصغير', nameEn: 'Small football cushion', nameHe: 'כרית כדורגל קטנה', sortOrder: 30 },
    ],
  },
];

export async function seedSpecOptionLibraries(prisma: PrismaClient): Promise<{ groups: number; values: number }> {
  const items = await prisma.inventoryItem.findMany({ select: { id: true, sku: true } });
  const itemBySku = new Map(items.map((i) => [i.sku, i.id]));
  const colors = await prisma.colorReference.findMany({ select: { id: true, code: true } });
  const colorByCode = new Map(colors.map((c) => [c.code, c.id]));

  let groups = 0;
  let values = 0;
  for (const group of SPEC_OPTION_GROUPS) {
    const row = await prisma.specOptionGroup.create({
      data: {
        code: group.code,
        nameAr: group.nameAr,
        nameEn: group.nameEn,
        nameHe: group.nameHe,
        inputType: group.inputType,
        appliesTo: group.appliesTo,
        isActive: true,
        sortOrder: group.sortOrder,
      },
    });
    groups += 1;
    for (const value of group.values) {
      await prisma.specOptionValue.create({
        data: {
          groupId: row.id,
          code: value.code,
          nameAr: value.nameAr,
          nameEn: value.nameEn,
          nameHe: value.nameHe,
          hex: value.hex,
          numericValue: value.numericValue,
          unit: value.unit,
          colorReferenceId: value.colorCode ? colorByCode.get(value.colorCode) : undefined,
          inventoryItemId: value.inventorySku ? itemBySku.get(value.inventorySku) : undefined,
          isActive: true,
          sortOrder: value.sortOrder,
        },
      });
      values += 1;
    }
  }
  return { groups, values };
}
