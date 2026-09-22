'use client';

import { cn } from '../cn';

export interface PaginationCopy {
  previous?: string;
  next?: string;
  /** e.g. "{from}–{to} of {total}" — tokens replaced. */
  range?: string;
  pageSize?: string;
}

export interface PaginationProps {
  page: number;
  pageSize: number;
  /** Total rows when the API returns it. */
  total?: number | null;
  /** When `total` is unknown, tell us if another page exists. */
  hasNext?: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizes?: number[];
  copy?: PaginationCopy;
  className?: string;
}

/** Offset pagination row: range line at start, prev/next pills at end. */
export function Pagination({ page, pageSize, total, hasNext, onPageChange, onPageSizeChange, pageSizes = [20, 50, 100], copy, className }: PaginationProps) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = total != null ? Math.min(page * pageSize, total) : page * pageSize;
  const totalPages = total != null ? Math.max(1, Math.ceil(total / pageSize)) : null;
  const canPrev = page > 1;
  const canNext = totalPages != null ? page < totalPages : Boolean(hasNext);
  if (total != null && total <= pageSize && page === 1 && !onPageSizeChange) return null;

  const range = (copy?.range ?? '{from}–{to} of {total}')
    .replace('{from}', String(from))
    .replace('{to}', String(to))
    .replace('{total}', total != null ? String(total) : '…');

  const pill = 'maher-press inline-flex h-8 items-center gap-1 rounded-full border border-[var(--maher-border)] bg-[var(--maher-surface)] px-3 text-[13px] font-medium text-[var(--maher-text-primary)] hover:border-[var(--maher-border-strong)] disabled:opacity-40 disabled:pointer-events-none';

  return (
    <nav className={cn('flex flex-wrap items-center justify-between gap-3 text-[13px] text-[var(--maher-text-secondary)]', className)} aria-label="Pagination">
      <div className="flex items-center gap-3">
        <span className="tabular-nums" dir="ltr">
          {range}
        </span>
        {onPageSizeChange ? (
          <label className="flex items-center gap-1.5">
            <span className="sr-only">{copy?.pageSize ?? 'Rows per page'}</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="h-8 rounded-full border border-[var(--maher-border)] bg-[var(--maher-surface)] px-2.5 text-[13px] text-[var(--maher-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--maher-brand)]/20"
            >
              {pageSizes.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
      <div className="flex items-center gap-1.5">
        <button type="button" className={pill} disabled={!canPrev} onClick={() => onPageChange(page - 1)}>
          <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 rtl:-scale-x-100" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="m12 5-5 5 5 5" />
          </svg>
          {copy?.previous ?? 'Previous'}
        </button>
        {totalPages != null ? (
          <span className="px-1 tabular-nums" dir="ltr">
            {page} / {totalPages}
          </span>
        ) : null}
        <button type="button" className={pill} disabled={!canNext} onClick={() => onPageChange(page + 1)}>
          {copy?.next ?? 'Next'}
          <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 rtl:-scale-x-100" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="m8 5 5 5-5 5" />
          </svg>
        </button>
      </div>
    </nav>
  );
}
