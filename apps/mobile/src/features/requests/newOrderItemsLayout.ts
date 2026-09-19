import type { NewOrderLine } from './newOrderLine';
import type { PendingAttachment } from './pendingAttachment';

/** Cap the 3-step rail so it does not stretch across an iPad header. */
export const NEW_ORDER_STAGE_RAIL_MAX = 360;

export function newOrderBasketColumns(isDesk: boolean): 1 | 2 {
  return isDesk ? 2 : 1;
}

export function pairBasketRows<T>(items: T[], columns: 1 | 2): T[][] {
  if (columns <= 1) return items.map((item) => [item]);
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += columns) {
    rows.push(items.slice(i, i + columns));
  }
  return rows;
}

export function attachmentsForLine(
  all: PendingAttachment[],
  lineId: string | null,
): PendingAttachment[] {
  if (!lineId) return [];
  return all.filter((row) => row.lineId === lineId);
}

export function replaceLineAttachments(
  all: PendingAttachment[],
  lineId: string,
  nextForLine: PendingAttachment[],
): PendingAttachment[] {
  const stamped = nextForLine.map((row) => ({ ...row, lineId }));
  return [...all.filter((row) => row.lineId !== lineId), ...stamped];
}

export function uniqueNonEmpty(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const value = raw.trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

/** Copy a draft-level PO onto the first line when none of the items have one. */
export function seedLineDealerPo(lines: NewOrderLine[], fallback: string): NewOrderLine[] {
  const po = fallback.trim();
  if (!po || lines.some((line) => line.externalOrderNumber.trim())) return lines;
  return lines.map((line, index) =>
    index === 0 ? { ...line, externalOrderNumber: po } : line,
  );
}

/** Request-level dealer PO — first filled line number, else the draft field. */
export function resolveRequestDealerPo(
  lines: Array<Pick<NewOrderLine, 'externalOrderNumber'>>,
  fallback = '',
): string {
  const filled = uniqueNonEmpty(lines.map((line) => line.externalOrderNumber ?? ''));
  return filled[0] ?? fallback.trim();
}

export function applyLineAttachmentsToBasket(
  lines: NewOrderLine[],
  attachments: PendingAttachment[],
): NewOrderLine[] {
  return lines.map((line) => {
    const mine = attachments.filter((row) => row.lineId === line.id);
    if (!mine.length) return line;
    const ids = uniqueNonEmpty([
      ...line.photoDocumentIds,
      ...mine.map((row) => row.documentId ?? ''),
    ]);
    if (ids.join(',') === line.photoDocumentIds.join(',')) return line;
    return {
      ...line,
      photoDocumentIds: ids,
      primaryImageDocumentId: line.primaryImageDocumentId || ids[0] || '',
    };
  });
}
