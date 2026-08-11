/**
 * Dealer-facing AI intake progress — human language only.
 * Do not expose OCR / model / token / extract jargon in UI keys or copy.
 */
export type DealerAiIntakeState =
  | 'idle'
  | 'uploading'
  | 'reading'
  | 'understanding'
  | 'preparing'
  | 'ready'
  | 'needsInfo'
  | 'failed';

/** i18n key suffixes under `mobile.newOrder.aiStates.*` — must stay jargon-free. */
export const DEALER_AI_STATE_I18N_KEYS = [
  'uploading',
  'reading',
  'understanding',
  'preparing',
  'ready',
  'needsInfo',
  'failed',
] as const;

export type DealerAiStateI18nKey = (typeof DEALER_AI_STATE_I18N_KEYS)[number];

const FORBIDDEN_AI_JARGON = [
  'ocr',
  'token',
  'tokens',
  'llm',
  'gpt',
  'model',
  'extract',
  'extraction',
  'embedding',
  'prompt',
  'api',
] as const;

export function aiStateMessageKey(state: DealerAiIntakeState): string | null {
  if (state === 'idle') return null;
  return `mobile.newOrder.aiStates.${state}`;
}

export function previewNeedsInfo(preview: {
  productName?: string;
  quantity?: string;
  notes?: string;
  fabric?: string;
  deliveryAddress?: string;
  endCustomerName?: string;
}): boolean {
  const filled = [
    preview.productName,
    preview.quantity,
    preview.notes,
    preview.fabric,
    preview.deliveryAddress,
    preview.endCustomerName,
  ].filter((v) => (v ?? '').trim().length > 0);
  return filled.length === 0;
}

/** Guard for dealer-facing copy / keys — no technical AI jargon. */
export function containsTechnicalAiJargon(text: string): boolean {
  const lower = text.toLowerCase();
  return FORBIDDEN_AI_JARGON.some((term) => {
    const re = new RegExp(`(?:^|[^a-z])${term}(?:[^a-z]|$)`, 'i');
    return re.test(lower);
  });
}

export function assertDealerAiStateKeysAreHuman(): void {
  for (const key of DEALER_AI_STATE_I18N_KEYS) {
    if (containsTechnicalAiJargon(key)) {
      throw new Error(`Dealer AI state key must not include jargon: ${key}`);
    }
  }
}
