'use client';

import { Link } from '@/i18n/navigation';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import { apiFetch } from '@/lib/api-client';
import { useKitCopy } from '@/lib/kit-copy';
import { useListParams } from '@/lib/use-list-params';
import { Board, Button, DataBoard, ErrorBoard, Figure, ListToolbar, Ltr, Ribbon, Stamp, StatusChips, Ticket, type BoardTone, type DataColumn } from '@maher/ui';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { Suspense, useMemo } from 'react';

type InspectionRow = {
  id: string;
  number: string;
  result?: string | null;
  stageCode?: string | null;
  createdAt?: string;
  inspectedAt?: string | null;
  productionOrderId?: string;
  productionOrder?: { id: string; number: string; status?: string; productDescription?: string | null } | null;
  rework?: Array<{ id: string; status: string }>;
};

type AttentionCard = {
  kind: string;
  titleEn?: string;
  subtitleEn?: string;
  reasonEn?: string;
  actionEn?: string;
  productionOrderId: string;
  productionOrderNumber?: string;
  inspectionId?: string | null;
  reworkId?: string;
};

type Filter = '' | 'passed' | 'failed' | 'pending' | 'rework';

const isPass = (r?: string | null) => r === 'PASSED' || r === 'PASS';
const isFail = (r?: string | null) => r === 'FAILED' || r === 'FAIL';
const hasOpenRework = (row: InspectionRow) => (row.rework ?? []).some((rw) => ['AWAITING_STAGE', 'IN_PROGRESS', 'OPEN'].includes(String(rw.status).toUpperCase()));
const resultTone = (r?: string | null): BoardTone => (isPass(r) ? 'success' : isFail(r) ? 'error' : r === 'PARTIAL' ? 'warning' : 'info');

function QualityListInner() {
  const tNav = useTranslations('navigation');
  const tc = useTranslations('catalog');
  const tp = useTranslations('production');
  const tCommon = useTranslations('common');
  const tStatus = useTranslations('statuses');
  const locale = useLocale();
  const kit = useKitCopy();
  const { params, set, reset, activeCount } = useListParams({ defaults: { q: '', filter: '' as Filter } });

  const list = useQuery({ queryKey: ['quality-inspections', 'list'], queryFn: () => apiFetch<{ data: InspectionRow[] }>('/api/v1/quality-inspections?page=1&pageSize=100').then((r) => r.data), placeholderData: keepPreviousData });
  const attention = useQuery({ queryKey: ['quality-inspections', 'attention'], queryFn: () => apiFetch<AttentionCard[]>('/api/v1/quality-inspections/attention'), staleTime: 30_000 });

  const attentionIds = useMemo(() => new Set((attention.data ?? []).map((c) => c.inspectionId).filter(Boolean) as string[]), [attention.data]);
  const attentionOrders = useMemo(() => new Set((attention.data ?? []).map((c) => c.productionOrderId)), [attention.data]);
  const statusLabel = (code?: string | null) => {
    if (!code) return tc('pending');
    try {
      return tStatus(code as never);
    } catch {
      return code.replace(/_/g, ' ');
    }
  };

  const rows = list.data ?? [];
  const passed = rows.filter((r) => isPass(r.result)).length;
  const failed = rows.filter((r) => isFail(r.result)).length;
  const pending = rows.filter((r) => !r.result).length;
  const rework = rows.filter(hasOpenRework).length;
  const passRate = passed + failed > 0 ? Math.round((passed / (passed + failed)) * 100) : null;
  const needsAttention = (row: InspectionRow) => attentionIds.has(row.id) || (row.productionOrderId ?? row.productionOrder?.id ? attentionOrders.has((row.productionOrderId ?? row.productionOrder?.id) as string) : false) || hasOpenRework(row);
  const visible = rows.filter((r) => {
    if (params.filter === 'passed' && !isPass(r.result)) return false;
    if (params.filter === 'failed' && !isFail(r.result)) return false;
    if (params.filter === 'pending' && r.result) return false;
    if (params.filter === 'rework' && !hasOpenRework(r)) return false;
    if (params.q.trim()) {
      const q = params.q.trim().toLowerCase();
      return [r.number, r.productionOrder?.number, r.productionOrder?.productDescription, r.stageCode].some((v) => v?.toLowerCase().includes(q));
    }
    return true;
  });
  const date = (v?: string | null) => (v ? new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(new Date(v)) : '—');

  const columns: DataColumn<InspectionRow>[] = [
    {
      key: 'number',
      header: tc('inspections'),
      cell: (r) => (
        <span className="min-w-0">
          <Ltr className="block font-semibold text-[var(--maher-text-primary)]">{r.number}</Ltr>
          <span className="block truncate text-[12px] text-[var(--maher-text-tertiary)]">{r.productionOrder?.productDescription ?? r.stageCode ?? tc('inspectionDetail')}</span>
        </span>
      ),
    },
    { key: 'order', header: tp('orders'), hideBelow: 'md', cell: (r) => (r.productionOrder ? <Ltr>{r.productionOrder.number}</Ltr> : '—') },
    { key: 'stage', header: tp('stage'), hideBelow: 'lg', cell: (r) => r.stageCode ?? '—' },
    { key: 'date', header: tCommon('date'), hideBelow: 'lg', cell: (r) => date(r.inspectedAt ?? r.createdAt) },
    {
      key: 'result',
      header: tCommon('status'),
      cell: (r) => (
        <span className="flex flex-wrap items-center gap-1.5">
          <Stamp tone={resultTone(r.result)} size="sm">
            {r.result ? statusLabel(r.result) : tc('pending')}
          </Stamp>
          {needsAttention(r) ? <Stamp tone="warning" size="sm">{tp('qualityAttentionBadge')}</Stamp> : null}
        </span>
      ),
    },
  ];

  return (
    <div className="maher-stagger space-y-5">
      <Board tone={failed || rework ? 'warning' : 'success'} wash="top" as="section">
        <div className="grid gap-5 px-5 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:items-center">
          <div className="min-w-0">
            <h1 className="text-[24px] font-semibold leading-8 tracking-[-0.02em] text-[var(--maher-text-primary)] sm:text-[28px] sm:leading-9 rtl:tracking-normal">{tNav('quality')}</h1>
            <p className="mt-1 max-w-[56ch] text-[14px] leading-5 text-[var(--maher-text-secondary)]">{tp('qualityListHint')}</p>
          </div>
          <div className="min-w-0">
            <Ribbon
              size="sm"
              segments={[
                { key: 'passed', label: statusLabel('PASSED'), value: passed, tone: 'success' },
                { key: 'failed', label: statusLabel('FAILED'), value: failed, tone: 'error' },
                { key: 'pending', label: tc('pending'), value: pending, tone: 'info' },
              ]}
            />
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
              <Figure size="sm" value={passRate == null ? '—' : `${passRate}%`} label={tp('qualityPassRate')} tone={passRate == null ? 'neutral' : passRate >= 90 ? 'success' : passRate >= 70 ? 'warning' : 'error'} locale={locale} />
              <Figure size="sm" value={pending} label={tc('pending')} tone="info" />
              <Figure size="sm" value={rework} label={tp('qualityOpenRework')} tone={rework ? 'warning' : 'success'} />
              <Figure size="sm" value={(attention.data ?? []).length} label={tp('qualityAttentionTitle')} tone={(attention.data ?? []).length ? 'warning' : 'success'} />
            </div>
          </div>
        </div>
      </Board>

      {(attention.data ?? []).length ? (
        <Board tone="warning" wash="top">
          <Board.Header title={tp('qualityAttentionTitle')} meta={<Stamp tone="warning" size="sm">{(attention.data ?? []).length}</Stamp>} />
          <Board.Body className="grid gap-3 lg:grid-cols-2">
            {(attention.data ?? []).map((card) => (
              <Ticket
                key={card.reworkId ?? `${card.productionOrderId}-${card.inspectionId}`}
                tone="warning"
                title={card.titleEn ?? tp('qualityAttentionBadge')}
                why={[card.subtitleEn ?? card.productionOrderNumber, card.reasonEn].filter(Boolean).join(' — ')}
                action={card.actionEn}
                href={card.inspectionId ? `/admin/quality/${card.inspectionId}` : `/admin/production/${card.productionOrderId}?tab=quality`}
                LinkComponent={Link}
                trailing={card.productionOrderNumber ? <Ltr className="text-[12px] text-[var(--maher-text-tertiary)]">{card.productionOrderNumber}</Ltr> : undefined}
              />
            ))}
          </Board.Body>
        </Board>
      ) : null}

      <ListToolbar copy={kit.toolbar} search={{ value: params.q, onChange: (q) => set({ q }, { replace: true }), placeholder: tCommon('search') }}>
        <StatusChips
          aria-label={tCommon('status')}
          value={params.filter || 'all'}
          onChange={(id) => set({ filter: id === 'all' ? '' : (id as Filter) })}
          items={[
            { id: 'all', label: tCommon('all'), count: rows.length },
            { id: 'pending', label: tc('pending'), count: pending, tone: 'info' },
            { id: 'failed', label: statusLabel('FAILED'), count: failed, tone: 'error' },
            { id: 'rework', label: tp('qualityOpenRework'), count: rework, tone: 'warning' },
            { id: 'passed', label: statusLabel('PASSED'), count: passed, tone: 'success' },
          ]}
        />
      </ListToolbar>

      {list.isError && !list.data ? (
        <ErrorBoard title={tNav('quality')} description={mutationErrorMessage(list.error)} onRetry={() => list.refetch()} />
      ) : (
        <DataBoard<InspectionRow>
          aria-label={tc('inspections')}
          columns={columns}
          rows={visible}
          rowKey={(r) => r.id}
          rowHref={(r) => `/admin/quality/${r.id}`}
          LinkComponent={Link}
          loading={list.isLoading && !list.data}
          rowClassName={(r) => (needsAttention(r) ? 'bg-[var(--maher-warning-soft)]/30' : undefined)}
          mobileRow={(r) => ({ title: r.number, meta: r.productionOrder?.number ?? r.stageCode ?? '', trailing: <Stamp tone={resultTone(r.result)} size="sm">{r.result ? statusLabel(r.result) : tc('pending')}</Stamp> })}
          empty={<Board.Empty title={tc('noInspections')} action={params.q || activeCount ? <Button size="sm" variant="secondary" onClick={reset}>{tCommon('clearFilters')}</Button> : undefined} />}
        />
      )}
    </div>
  );
}

export default function QualityListPage() {
  return (
    <Suspense fallback={<div className="maher-board h-64 animate-pulse rounded-[18px] bg-[var(--maher-surface)]" />}>
      <QualityListInner />
    </Suspense>
  );
}
