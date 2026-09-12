import { parseItemsFromFields } from '../ai-intake/ai-intake.mapper';

export type SpecProvenanceField = {
  key: string;
  ai: string | null;
  dealer: string | null;
  source: 'ai' | 'dealer' | 'both' | 'missing';
};

function str(value: unknown): string | null {
  if (value == null) return null;
  const next = String(value).trim();
  return next || null;
}

export function specProvenance(params: {
  item: {
    productName?: string | null;
    quantity?: unknown;
    width?: unknown;
    height?: unknown;
    depth?: unknown;
    foamDensity?: string | null;
    woodType?: string | null;
    finish?: string | null;
    orientation?: string | null;
  };
  jobFields?: Array<{ fieldName: string; fieldValue?: string | null; reviewedValue?: string | null }>;
  itemIndex?: number;
}): SpecProvenanceField[] {
  const aiItems = parseItemsFromFields(params.jobFields ?? []);
  const ai = aiItems[params.itemIndex ?? 0] ?? aiItems[0];
  const pairs: Array<[string, string | null, string | null]> = [
    ['productName', str(ai?.productName), str(params.item.productName)],
    ['quantity', str(ai?.quantity), str(params.item.quantity)],
    ['width', str(ai?.width), str(params.item.width)],
    ['height', str(ai?.height), str(params.item.height)],
    ['depth', str(ai?.depth), str(params.item.depth)],
    ['foamDensity', str(ai?.foamDensity), str(params.item.foamDensity)],
    ['woodType', str(ai?.woodType), str(params.item.woodType)],
    ['finish', str(ai?.finish), str(params.item.finish)],
    ['orientation', str(ai?.orientation), str(params.item.orientation)],
  ];
  return pairs.map(([key, left, dealer]) => {
    if (!left && !dealer) return { key, ai: left, dealer, source: 'missing' as const };
    if (left && dealer && left === dealer) return { key, ai: left, dealer, source: 'both' as const };
    if (dealer && !left) return { key, ai: left, dealer, source: 'dealer' as const };
    if (left && !dealer) return { key, ai: left, dealer, source: 'ai' as const };
    return { key, ai: left, dealer, source: dealer ? 'dealer' : 'ai' };
  });
}
