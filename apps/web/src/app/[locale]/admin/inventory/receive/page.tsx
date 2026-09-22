'use client';

import { InventoryScanBar } from '@/components/inventory/inventory-scan-bar';
import { Link } from '@/i18n/navigation';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import { apiFetch } from '@/lib/api-client';
import { Board, BoardSkeleton, DataBoard, ErrorBoard, Figure, Ltr, Meter, Ribbon, Stamp, type BoardTone, type DataColumn } from '@maher/ui';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';

type PO = {
  id: string;
  number: string;
  status: string;
  expectedDate?: string | null;
  orderedQty?: number;
  receivedQty?: number;
  total?: string | number | null;
  supplier?: { name?: string | null; nameAr?: string | null; nameEn?: string | null; code?: string } | null;
  lines?: Array<{ quantity: string | number; receivedQty?: string | number }>;
};

const RECEIVABLE = new Set(['SENT', 'CONFIRMED', 'PARTIAL', 'PARTIALLY_RECEIVED']);
const tone = (s: string): BoardTone => (s === 'PARTIAL' || s === 'PARTIALLY_RECEIVED' ? 'warning' : s === 'CONFIRMED' ? 'success' : 'info');

export default function InventoryReceivePage() {
  const t = useTranslations('navigation');
  const ti = useTranslations('inventory');
  const tc = useTranslations('catalog');
  const tStatus = useTranslations('statuses');
  const locale = useLocale();
  const query = useQuery({ queryKey: ['purchase-orders-receive'], queryFn: () => apiFetch<{ data: PO[] }>('/api/v1/purchase-orders?pageSize=100').then((r) => r.data ?? []) });

  if (query.isLoading) return <BoardSkeleton rows={5} />;
  if (query.isError) return <ErrorBoard title={t('receive')} description={mutationErrorMessage(query.error)} onRetry={() => query.refetch()} />;
  const rows = (query.data ?? []).filter((row) => RECEIVABLE.has(row.status));
  const progress = (po: PO) => {
    const ordered = po.orderedQty ?? (po.lines ?? []).reduce((s, l) => s + Number(l.quantity), 0);
    const received = po.receivedQty ?? (po.lines ?? []).reduce((s, l) => s + Number(l.receivedQty ?? 0), 0);
    return { ordered, received };
  };
  const label = (s: string) => (tStatus.has(s as never) ? tStatus(s as never) : s.replace(/_/g, ' '));
  const date = (v?: string | null) => (v ? new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(new Date(v)) : '—');
  const late = rows.filter((r) => r.expectedDate && new Date(r.expectedDate).getTime() < Date.now()).length;
  const partial = rows.filter((r) => r.status === 'PARTIAL' || r.status === 'PARTIALLY_RECEIVED').length;

  const columns: DataColumn<PO>[] = [
    {
      key: 'po',
      header: tc('purchaseOrders'),
      cell: (po) => (
        <span className="min-w-0">
          <Ltr className="block font-semibold text-[var(--maher-text-primary)]">{po.number}</Ltr>
          <span className="block truncate text-[12px] text-[var(--maher-text-tertiary)]">{po.supplier?.nameEn || po.supplier?.nameAr || po.supplier?.name || '—'}</span>
        </span>
      ),
    },
    { key: 'status', header: t('receive'), cell: (po) => <Stamp tone={tone(po.status)} size="sm">{label(po.status)}</Stamp> },
    {
      key: 'expected',
      header: ti('expectedDate'),
      hideBelow: 'md',
      cell: (po) => <span className={po.expectedDate && new Date(po.expectedDate).getTime() < Date.now() ? 'font-semibold text-[var(--maher-error)]' : ''}>{date(po.expectedDate)}</span>,
    },
    {
      key: 'progress',
      header: ti('received'),
      width: '200px',
      cell: (po) => {
        const p = progress(po);
        return <Meter value={p.received} max={Math.max(1, p.ordered)} size="sm" valueLabel={`${p.received}/${p.ordered}`} tone={p.received >= p.ordered && p.ordered > 0 ? 'success' : 'brand'} />;
      },
    },
  ];

  return (
    <div className="maher-stagger space-y-5">
      <Board tone={late ? 'error' : 'brand'} wash="top" as="section">
        <div className="grid gap-5 px-5 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center">
          <div className="min-w-0">
            <h1 className="text-[24px] font-semibold leading-8 tracking-[-0.02em] text-[var(--maher-text-primary)] sm:text-[28px] sm:leading-9 rtl:tracking-normal">{t('receive')}</h1>
            <p className="mt-1 max-w-[56ch] text-[14px] leading-5 text-[var(--maher-text-secondary)]">{ti('receiveHint')}</p>
          </div>
          <div className="min-w-0">
            <Ribbon
              size="sm"
              segments={[
                { key: 'sent', label: label('SENT'), value: rows.filter((r) => r.status === 'SENT').length, tone: 'info' },
                { key: 'confirmed', label: label('CONFIRMED'), value: rows.filter((r) => r.status === 'CONFIRMED').length, tone: 'success' },
                { key: 'partial', label: label('PARTIAL'), value: partial, tone: 'warning' },
              ]}
            />
            <div className="mt-3 grid grid-cols-3 gap-4">
              <Figure size="sm" value={rows.length} label={t('receive')} />
              <Figure size="sm" value={partial} label={label('PARTIAL')} tone={partial ? 'warning' : 'neutral'} />
              <Figure size="sm" value={late} label={ti('overdue')} tone={late ? 'error' : 'success'} />
            </div>
          </div>
        </div>
      </Board>
      <InventoryScanBar />
      <DataBoard<PO> aria-label={t('receive')} columns={columns} rows={rows} rowKey={(r) => r.id} rowHref={(r) => `/admin/inventory/receive/${r.id}`} LinkComponent={Link} mobileRow={(po) => ({ title: po.number, meta: po.supplier?.nameEn || po.supplier?.name || '', trailing: <Stamp tone={tone(po.status)} size="sm">{label(po.status)}</Stamp> })} empty={<Board.Empty title={ti('empty')} description={ti('receiveEmptyBody')} />} />
    </div>
  );
}
