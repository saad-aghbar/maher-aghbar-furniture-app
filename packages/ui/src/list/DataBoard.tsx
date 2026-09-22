'use client';

import { useCallback, type KeyboardEvent, type ReactNode } from 'react';
import type { AppLinkComponent } from '../AppLinkComponent';
import { Board, type BoardProps } from '../board/Board';
import { cn } from '../cn';
import { DataBoardSkeleton } from '../overlay/ErrorBoard';
import { ListRow, ListRows, type ListRowProps } from './ListRow';

export interface DataColumn<Row> {
  key: string;
  header: ReactNode;
  cell: (row: Row, index: number) => ReactNode;
  /** Right-aligned tabular LTR (money, qty, dates, codes). */
  numeric?: boolean;
  /** Hide below a breakpoint; `md` = only on ≥768, `lg` = only on ≥1024. */
  hideBelow?: 'md' | 'lg' | 'xl';
  width?: string;
  /** Sort key sent to `onSort`; header becomes a button. */
  sortKey?: string;
  className?: string;
}

export interface DataBoardProps<Row> {
  columns: DataColumn<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string;
  /** Whole-row navigation. */
  rowHref?: (row: Row) => string | undefined;
  onRowClick?: (row: Row) => void;
  LinkComponent?: AppLinkComponent;
  /** Header band. Omit for a bare table. */
  title?: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  tone?: BoardProps['tone'];
  footer?: ReactNode;
  /** Shown when `rows` is empty (use `Board.Empty`). */
  empty?: ReactNode;
  loading?: boolean;
  skeletonRows?: number;
  /** Below `md`, render rows as ListRows using this mapper. */
  mobileRow?: (row: Row) => Omit<ListRowProps, 'href' | 'LinkComponent' | 'onClick'>;
  sort?: { key: string; dir: 'asc' | 'desc' } | null;
  onSort?: (key: string) => void;
  /** Selection (adds a checkbox column). */
  selectedKeys?: ReadonlySet<string>;
  onToggleRow?: (key: string, row: Row) => void;
  onToggleAll?: (keys: string[]) => void;
  /** Sticky header inside a scrolling body. */
  maxHeight?: number | string;
  className?: string;
  /** Extra row attributes (tone wash for late rows, etc.). */
  rowClassName?: (row: Row) => string | undefined;
  'aria-label'?: string;
  copy?: { selectAll?: string; selectRow?: string; sortAsc?: string; sortDesc?: string };
  /** Render without the Board shell — for tables inside an existing Board (tabbed panels). */
  flush?: boolean;
}

const HIDE: Record<NonNullable<DataColumn<unknown>['hideBelow']>, string> = {
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
  xl: 'hidden xl:table-cell',
};

/**
 * DataBoard — a table inside a Board. Header band, hairline rows, tabular
 * LTR numerics, whole-row links, sortable headers, optional selection.
 * Below `md` it becomes a stack of ListRows when `mobileRow` is given.
 */
export function DataBoard<Row>({
  columns,
  rows,
  rowKey,
  rowHref,
  onRowClick,
  LinkComponent,
  title,
  description,
  meta,
  actions,
  tone = 'neutral',
  footer,
  empty,
  loading,
  skeletonRows = 6,
  mobileRow,
  sort,
  onSort,
  selectedKeys,
  onToggleRow,
  onToggleAll,
  maxHeight,
  className,
  rowClassName,
  copy,
  flush,
  ...aria
}: DataBoardProps<Row>) {
  const selectable = Boolean(selectedKeys && onToggleRow);
  const allKeys = rows.map(rowKey);
  const allSelected = selectable && allKeys.length > 0 && allKeys.every((k) => selectedKeys!.has(k));
  const someSelected = selectable && !allSelected && allKeys.some((k) => selectedKeys!.has(k));

  // Whole-row activation delegates to the first-cell anchor so modifier clicks and
  // middle-click keep native link behaviour; rows without an href call `onRowClick`.
  const activate = useCallback(
    (rowEl: HTMLTableRowElement, row: Row) => {
      const href = rowHref?.(row);
      if (href) (rowEl.querySelector('a[data-row-link]') as HTMLAnchorElement | null)?.click();
      else onRowClick?.(row);
    },
    [rowHref, onRowClick],
  );

  const onRowKey = (e: KeyboardEvent<HTMLTableRowElement>, row: Row) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    if ((e.target as HTMLElement).closest('a,button,input,select,textarea')) return;
    e.preventDefault();
    activate(e.currentTarget, row);
  };

  if (loading) return <DataBoardSkeleton rows={skeletonRows} columns={Math.min(columns.length + (selectable ? 1 : 0), 6)} className={className} flush={flush} />;

  const Link = LinkComponent ?? 'a';
  const hasHeader = Boolean(title || description || meta || actions);
  const Shell = flush ? 'div' : Board;
  const shellProps = flush ? { className: cn('maher-data-board maher-data-board--flush', className), ...aria } : { tone, className: cn('maher-data-board', className), as: 'section' as const, ...aria };

  return (
    <Shell {...(shellProps as Record<string, unknown>)}>
      {hasHeader ? <Board.Header title={title ?? ''} description={description} meta={meta} actions={actions} stamp={tone !== 'neutral'} /> : null}
      {rows.length === 0 ? (
        empty ?? null
      ) : (
        <>
          {/* Desktop table */}
          <div className={cn(mobileRow && 'hidden md:block', 'overflow-x-auto')} style={maxHeight ? { maxHeight, overflowY: 'auto' } : undefined}>
            <table>
              <thead className={maxHeight ? 'sticky top-0 z-[1]' : undefined}>
                <tr>
                  {selectable ? (
                    <th style={{ width: 40 }} className="!ps-4 !pe-0">
                      <input
                        type="checkbox"
                        aria-label={copy?.selectAll ?? 'Select all'}
                        checked={allSelected}
                        ref={(el) => {
                          if (el) el.indeterminate = someSelected;
                        }}
                        onChange={() => onToggleAll?.(allKeys)}
                        className="h-4 w-4 cursor-pointer accent-[var(--maher-brand)]"
                      />
                    </th>
                  ) : null}
                  {columns.map((col) => {
                    const sorted = sort?.key === col.sortKey && col.sortKey;
                    return (
                      <th
                        key={col.key}
                        data-numeric={col.numeric || undefined}
                        aria-sort={sorted ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : col.sortKey ? 'none' : undefined}
                        className={cn(col.hideBelow && HIDE[col.hideBelow], col.className)}
                        style={col.width ? { width: col.width } : undefined}
                      >
                        {col.sortKey && onSort ? (
                          <button type="button" onClick={() => onSort(col.sortKey!)} className="maher-press">
                            {col.header}
                            <span aria-hidden className={cn('text-[10px] transition-opacity', sorted ? 'opacity-100' : 'opacity-0')}>
                              {sorted && sort!.dir === 'asc' ? '↑' : '↓'}
                            </span>
                          </button>
                        ) : (
                          col.header
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="maher-stagger-rows">
                {rows.map((row, i) => {
                  const key = rowKey(row);
                  const href = rowHref?.(row);
                  const interactive = Boolean(href || onRowClick);
                  const selected = selectedKeys?.has(key);
                  return (
                    <tr
                      key={key}
                      data-interactive={interactive || undefined}
                      data-selected={selected || undefined}
                      tabIndex={interactive ? 0 : undefined}
                      aria-selected={selectable ? selected : undefined}
                      className={cn(selected && 'bg-[var(--maher-brand-soft)]', rowClassName?.(row))}
                      onClick={(e) => {
                        if (!interactive) return;
                        if ((e.target as HTMLElement).closest('a,button,input,select,textarea,label')) return;
                        activate(e.currentTarget, row);
                      }}
                      onKeyDown={(e) => interactive && onRowKey(e, row)}
                    >
                      {selectable ? (
                        <td className="!ps-4 !pe-0">
                          <input
                            type="checkbox"
                            aria-label={copy?.selectRow ?? 'Select row'}
                            checked={Boolean(selected)}
                            onChange={() => onToggleRow?.(key, row)}
                            className="h-4 w-4 cursor-pointer accent-[var(--maher-brand)]"
                          />
                        </td>
                      ) : null}
                      {columns.map((col, ci) => (
                        <td
                          key={col.key}
                          data-numeric={col.numeric || undefined}
                          dir={col.numeric ? 'ltr' : undefined}
                          className={cn(col.hideBelow && HIDE[col.hideBelow], col.className)}
                        >
                          {ci === 0 && href ? (
                            <Link href={href} data-row-link className="block text-inherit no-underline outline-none focus-visible:text-[var(--maher-brand)]" onClick={() => onRowClick?.(row)}>
                              {col.cell(row, i)}
                            </Link>
                          ) : (
                            col.cell(row, i)
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Compact rows */}
          {mobileRow ? (
            <ListRows className="md:hidden">
              {rows.map((row) => {
                const key = rowKey(row);
                const props = mobileRow(row);
                return (
                  <ListRow
                    key={key}
                    {...props}
                    href={rowHref?.(row)}
                    LinkComponent={LinkComponent}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    selected={selectedKeys?.has(key)}
                  />
                );
              })}
            </ListRows>
          ) : null}
        </>
      )}
      {footer ? <Board.Footer>{footer}</Board.Footer> : null}
    </Shell>
  );
}
