import { money } from './util';

export type StandardProductMeasurements = {
  width: number;
  height: number;
  depth: number;
  seatHeight: number | null;
  unit: string;
  descriptionEn: string;
  descriptionAr: string;
};

/**
 * Standard catalog measurements (cm) by category — used in seed + backfill
 * so dealers always see W/H/D (+ seat when relevant).
 */
export function standardMeasurementsForProduct(input: {
  categoryCode: string;
  sku: string;
  nameEn: string;
}): StandardProductMeasurements {
  const code = input.categoryCode.toUpperCase();
  const sku = input.sku.toUpperCase();

  if (code === 'SOFA' || sku.startsWith('SOF')) {
    const wide = sku.includes('L-') || sku.includes('SEC') || sku.includes('CORN') || sku.includes('OUT');
    const love = sku.includes('2S') || sku.includes('LOVE');
    const chaise = sku.includes('CHAISE') || sku.includes('DAY');
    const width = wide ? 280 : love ? 160 : chaise ? 180 : 220;
    const depth = chaise ? 160 : wide ? 100 : 95;
    return {
      width,
      height: 85,
      depth,
      seatHeight: 45,
      unit: 'pcs',
      descriptionEn: `Standard ${input.nameEn}. Factory dimensions in cm — confirm fabric and finish on the order.`,
      descriptionAr: `${input.nameEn} قياسي. الأبعاد بالمسم — أكّد القماش والتشطيب في الطلب.`,
    };
  }

  if (code === 'CHAIR' || sku.startsWith('ARM') || sku.startsWith('CHAIR')) {
    const bar = sku.includes('BAR');
    const dining = sku.includes('DIN') || sku.includes('BENCH');
    return {
      width: dining ? (sku.includes('BENCH') ? 140 : 48) : bar ? 42 : 78,
      height: bar ? 110 : dining ? 95 : 92,
      depth: dining ? 55 : bar ? 48 : 82,
      seatHeight: bar ? 75 : dining ? 48 : 45,
      unit: 'pcs',
      descriptionEn: `Standard ${input.nameEn}. Seating dimensions in cm.`,
      descriptionAr: `${input.nameEn} قياسي. قياسات الجلوس بالمسم.`,
    };
  }

  if (code === 'BED' || sku.startsWith('BED')) {
    const king = sku.includes('-K') || sku.includes('KING');
    const single = sku.includes('SGL') || sku.includes('TT') || sku.includes('TWIN');
    const head = sku.includes('HEAD');
    if (head) {
      return {
        width: 160,
        height: 120,
        depth: 12,
        seatHeight: null,
        unit: 'pcs',
        descriptionEn: `Standard ${input.nameEn}. Headboard dimensions in cm.`,
        descriptionAr: `${input.nameEn} قياسي. أبعاد مسند الرأس بالمسم.`,
      };
    }
    return {
      width: king ? 200 : single ? 100 : 160,
      height: 120,
      depth: king ? 220 : single ? 200 : 210,
      seatHeight: null,
      unit: 'pcs',
      descriptionEn: `Standard ${input.nameEn}. Frame outer dimensions in cm (mattress sold separately unless noted).`,
      descriptionAr: `${input.nameEn} قياسي. الأبعاد الخارجية للإطار بالمسم.`,
    };
  }

  if (code === 'TABLE' || sku.startsWith('TABLE')) {
    const dining = sku.includes('DIN') || sku.includes('CONF');
    const coffee = sku.includes('CF') || sku.includes('NEST') || sku.includes('SIDE');
    return {
      width: dining ? (sku.includes('8') || sku.includes('10') || sku.includes('CONF') ? 280 : 180) : coffee ? 110 : 120,
      height: dining ? 75 : coffee ? 42 : 78,
      depth: dining ? 100 : coffee ? 60 : 40,
      seatHeight: null,
      unit: 'pcs',
      descriptionEn: `Standard ${input.nameEn}. Tabletop dimensions in cm.`,
      descriptionAr: `${input.nameEn} قياسي. أبعاد الطاولة بالمسم.`,
    };
  }

  // CUSTOM / fallback
  return {
    width: 120,
    height: 90,
    depth: 60,
    seatHeight: null,
    unit: 'pcs',
    descriptionEn: `Custom-capable ${input.nameEn}. Listed sizes are the starting standard — specify changes on the order.`,
    descriptionAr: `${input.nameEn} قابل للتفصيل. القياسات المعروضة معيارية للبداية — حدّد التعديلات في الطلب.`,
  };
}

export function measurementsToPrisma(m: StandardProductMeasurements) {
  return {
    width: money(m.width),
    height: money(m.height),
    depth: money(m.depth),
    seatHeight: m.seatHeight == null ? null : money(m.seatHeight),
    unit: m.unit,
    description: m.descriptionEn,
  };
}
