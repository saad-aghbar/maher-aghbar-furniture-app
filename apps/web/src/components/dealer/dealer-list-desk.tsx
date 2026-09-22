'use client';

import { useRouter } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api-client';
import { useKitCopy } from '@/lib/kit-copy';
import { Board, DataBoard, ErrorBoard, Figure, ListToolbar, Ribbon, StatusChips, type BoardTone, type DataColumn, type ListRowProps } from '@maher/ui';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useMemo, useState, type ReactNode } from 'react';

export interface DealerListChip<Row> {
  id: string;
  label: string;
  tone?: BoardTone;
  match: (row: Row) => boolean;
}

export interface DealerListDeskProps<Row extends { id: string }> {
  title: string;
  description?: string;
  queryKey: string[];
  fetchPath: string;
  columns: DataColumn<Row>[];
  rowHref: (row: Row) => string;
  emptyTitle: string;
  emptyDescription?: string;
  /** Header-end action (New request / Submit return). */
  actions?: ReactNode;
  /** Optional lane chips; the first is the default. Add an `all` chip yourself if wanted. */
  chips?: DealerListChip<Row>[];
  /** Ribbon segments derived from rows (hero). Defaults to the chips (minus `all`). */
  ribbon?: (rows: Row[]) => Array<{ key: string; label: string; value: number; tone?: BoardTone }>;
  figures?: (rows: Row[]) => Array<{ label: string; value: number | string; tone?: BoardTone }>;
  search?: { placeholder: string; match: (row: Row, q: string) => boolean };
  mobileRow: (row: Row) => Omit<ListRowProps, 'href' | 'LinkComponent' | 'onClick'>;
  tone?: BoardTone;
  /** Extra content between the chips and the list (a banner, a calendar). */
  children?: ReactNode;
}

/** Dealer list page — hero board with lane ribbon, chips, and a DataBoard. */
export function DealerListDesk<Row extends { id: string }>({
  title,
  description,
  queryKey,
  fetchPath,
  columns,
  rowHref,
  emptyTitle,
  emptyDescription,
  actions,
  chips,
  ribbon,
  figures,
  search,
  mobileRow,
  tone = 'brand',
  children,
}: DealerListDeskProps<Row>) {
  const tCommon = useTranslations('common');
  const kit = useKitCopy();
  const router = useRouter();
  const [chip, setChip] = useState(chips?.[0]?.id ?? 'all');
  const [q, setQ] = useState('');

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const json = await apiFetch<{ data?: Row[] } | Row[]>(fetchPath);
      return Array.isArray(json) ? json : (json.data ?? []);
    },
  });
  const rows = useMemo(() => query.data ?? [], [query.data]);
  const counts = useMemo(() => Object.fromEntries((chips ?? []).map((c) => [c.id, rows.filter(c.match).length])), [chips, rows]);
  const visible = useMemo(() => {
    let next = rows;
    const active = chips?.find((c) => c.id === chip);
    if (active) next = next.filter(active.match);
    const needle = q.trim().toLowerCase();
    if (needle && search) next = next.filter((row) => search.match(row, needle));
    return next;
  }, [rows, chips, chip, q, search]);

  if (query.isError && !query.data) {
    return <ErrorBoard title={title} description={tCommon('loadFailed')} onRetry={() => query.refetch()} retryLabel={tCommon('retry')} />;
  }

  const segments = ribbon ? ribbon(rows) : (chips ?? []).filter((c) => c.id !== 'all').map((c) => ({ key: c.id, label: c.label, value: counts[c.id] ?? 0, tone: c.tone }));
  const figs = figures ? figures(rows) : [{ label: title, value: rows.length }];

  return (
    <div className="maher-stagger space-y-5">
      <Board tone={tone} wash="top" as="section">
        <div className="grid gap-5 px-5 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-[24px] font-semibold leading-8 tracking-[-0.02em] text-[var(--maher-text-primary)] sm:text-[28px] sm:leading-9 rtl:tracking-normal">{title}</h1>
              {description ? <p className="mt-1 max-w-[56ch] text-[14px] leading-5 text-[var(--maher-text-secondary)]">{description}</p> : null}
            </div>
            {actions}
          </div>
          <div className="min-w-0">
            {segments.length ? <Ribbon size="sm" segments={segments} /> : null}
            <div className={`mt-3 grid gap-4 ${figs.length >= 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
              {figs.map((f) => (
                <Figure key={f.label} size="sm" value={f.value} label={f.label} tone={f.tone} />
              ))}
            </div>
          </div>
        </div>
      </Board>

      {search ? <ListToolbar copy={kit.toolbar} search={{ value: q, onChange: setQ, placeholder: search.placeholder }} /> : null}

      {chips?.length ? <StatusChips aria-label={title} value={chip} onChange={setChip} items={chips.map((c) => ({ id: c.id, label: c.label, count: counts[c.id] ?? 0, tone: c.tone }))} /> : null}

      {children}

      <DataBoard<Row>
        aria-label={title}
        columns={columns}
        rows={visible}
        rowKey={(r) => r.id}
        onRowClick={(r) => router.push(rowHref(r))}
        loading={query.isLoading && !query.data}
        mobileRow={mobileRow}
        empty={<Board.Empty title={emptyTitle} description={emptyDescription} />}
      />
    </div>
  );
}
