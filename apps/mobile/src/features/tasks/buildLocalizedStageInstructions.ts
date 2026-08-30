import type { Locale } from '@maher/types';
import { translate } from '@/i18n/translate';

type BuildOpts = {
  locale: Locale;
  stageCode: string;
  stageName: string;
  productDescription: string;
  quantity: number | string;
  specifications?: string | null;
};

const KNOWN_STAGES = new Set([
  'MATERIAL_PREP',
  'CARPENTRY',
  'PAINTING',
  'FOAM',
  'UPHOLSTERY',
  'ASSEMBLY',
  'INSPECTION',
  'PACKAGING',
  'DELIVERY',
]);

/**
 * Locale-aware floor instructions for task detail.
 * Order numbers / SKUs stay Latin; human copy follows the active locale.
 */
export function buildLocalizedStageInstructions(opts: BuildOpts): string {
  const qty = Number(opts.quantity);
  const qtyLabel = Number.isFinite(qty) ? String(qty) : String(opts.quantity);
  const productLine = `${opts.productDescription} × ${qtyLabel}`;
  const specs = opts.specifications?.trim();
  const locale: Locale = opts.locale === 'he' ? 'he' : opts.locale === 'ar' ? 'ar' : 'en';
  const code = KNOWN_STAGES.has(opts.stageCode) ? opts.stageCode : 'DEFAULT';
  const prefix = `production.floorInstructions.${code}`;

  const heading =
    code === 'DEFAULT'
      ? translate(locale, 'production.floorInstructions.heading', {
          stage: opts.stageName,
          productLine,
        })
      : translate(locale, `${prefix}.heading`, { productLine });

  const specBlock = specs
    ? `\n${translate(locale, 'production.floorInstructions.specs', { specs })}`
    : '';

  const lines = [
    `${heading}${specBlock}`,
    translate(locale, `${prefix}.l1`),
    translate(locale, `${prefix}.l2`),
  ];
  if (code !== 'DEFAULT') {
    lines.push(translate(locale, `${prefix}.l3`));
  }
  return lines.join('\n');
}
