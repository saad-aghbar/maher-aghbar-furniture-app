const IMPORTANT_KEYS = new Set(['productName', 'quantity', 'width', 'height', 'depth']);

export type AiReadingFlag = {
  key: string;
  reason: 'missing' | 'unclear' | 'mismatch';
};

type ProvenanceRow = {
  key: string;
  ai: string | null;
  dealer: string | null;
  source: string;
};

type JobField = {
  fieldName: string;
  fieldValue?: string | null;
  reviewedValue?: string | null;
  confidence?: number | string | null;
};

export type RequestAiReadingInput = {
  aiJobs?: Array<{ fields?: JobField[] }>;
  items?: Array<{ provenance?: ProvenanceRow[] | null }>;
};

export function isHandwrittenDocument(doc: { category?: string | null; fileName?: string }): boolean {
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
export function requestAiReadingFlags(detail: RequestAiReadingInput): AiReadingFlag[] {
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

export function latestJobNotes(detail: Pick<RequestAiReadingInput, 'aiJobs'>): string | null {
  for (const job of detail.aiJobs ?? []) {
    const notes = job.fields?.find((f) => f.fieldName === 'notes');
    const text = String(notes?.reviewedValue ?? notes?.fieldValue ?? '').trim();
    if (text) return text;
  }
  return null;
}

export function lineHasAiFill(item: { provenance?: ProvenanceRow[] | null }): boolean {
  return (item.provenance ?? []).some((row) => row.source === 'ai' || row.source === 'both');
}
