import type { RequestDetail, RequestDocument, RequestItem } from './types';

const IMPORTANT_KEYS = new Set(['productName', 'quantity', 'width', 'height', 'depth']);

export type AiReadingFlag = {
  key: string;
  reason: 'missing' | 'unclear' | 'mismatch';
};

export function isHandwrittenDocument(doc: Pick<RequestDocument, 'category' | 'fileName'>): boolean {
  const cat = (doc.category ?? '').toUpperCase();
  const name = (doc.fileName ?? '').toLowerCase();
  return cat.includes('HANDWRITTEN') || name.includes('handwritten');
}

function confidenceOf(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Flags the factory should check on the original sheet — not a second AI inbox. */
export function requestAiReadingFlags(
  detail: Pick<RequestDetail, 'aiJobs' | 'items'>,
): AiReadingFlag[] {
  const hasJob = (detail.aiJobs?.length ?? 0) > 0;
  const seen = new Set<string>();
  const flags: AiReadingFlag[] = [];

  const push = (flag: AiReadingFlag) => {
    const id = `${flag.key}:${flag.reason}`;
    if (seen.has(id)) return;
    seen.add(id);
    flags.push(flag);
  };

  for (const item of detail.items ?? []) {
    for (const row of item.provenance ?? []) {
      if (row.ai && row.dealer && row.ai !== row.dealer) {
        push({ key: row.key, reason: 'mismatch' });
        continue;
      }
      if (hasJob && row.source === 'missing' && IMPORTANT_KEYS.has(row.key)) {
        push({ key: row.key, reason: 'missing' });
      }
    }
  }

  for (const job of detail.aiJobs ?? []) {
    for (const field of job.fields ?? []) {
      const conf = confidenceOf(field.confidence);
      const empty = !String(field.reviewedValue ?? field.fieldValue ?? '').trim();
      if (empty || (conf != null && conf < 0.7)) {
        push({
          key: field.fieldName,
          reason: empty ? 'missing' : 'unclear',
        });
      }
    }
  }

  return flags;
}

export function latestJobNotes(detail: Pick<RequestDetail, 'aiJobs'>): string | null {
  for (const job of detail.aiJobs ?? []) {
    const notes = job.fields?.find((f) => f.fieldName === 'notes');
    const text = String(notes?.reviewedValue ?? notes?.fieldValue ?? '').trim();
    if (text) return text;
  }
  return null;
}

export function handwrittenDocuments(docs: RequestDocument[] | undefined): RequestDocument[] {
  return (docs ?? []).filter(isHandwrittenDocument);
}

export function lineHasAiFill(item: RequestItem): boolean {
  return (item.provenance ?? []).some((row) => row.source === 'ai' || row.source === 'both');
}

export function sheetFieldI18nKey(key: string): string {
  const map: Record<string, string> = {
    productName: 'mobile.adminRequest.product',
    quantity: 'mobile.adminRequest.qty',
    product: 'mobile.aiIntake.fields.product',
    width: 'mobile.aiIntake.fields.width',
    height: 'mobile.aiIntake.fields.height',
    depth: 'mobile.aiIntake.fields.depth',
    fabric: 'mobile.aiIntake.fields.fabric',
    notes: 'mobile.adminRequest.itemNotes',
    foamDensity: 'mobile.adminRequest.foamDensity',
    woodType: 'mobile.adminRequest.woodType',
    finish: 'mobile.adminRequest.finish',
    orientation: 'mobile.adminRequest.orientation',
  };
  return map[key] ?? `mobile.aiIntake.fields.${key}`;
}

export function sheetFlagReasonI18nKey(reason: AiReadingFlag['reason']): string {
  if (reason === 'missing') return 'mobile.adminRequest.sheetUnclearMissing';
  if (reason === 'unclear') return 'mobile.adminRequest.sheetUnclearUnclear';
  return 'mobile.adminRequest.sheetUnclearMismatch';
}
