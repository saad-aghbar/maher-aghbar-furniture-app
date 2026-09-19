'use client';

import { InventoryItemThumb } from '@/components/admin/inventory-item-thumb';
import {
  FG_FILTERS,
  fgFilterLabelKey,
  fgLeaveByLabelKey,
  fgLeaveUrgency,
  selectFinishedOrders,
  type AdminFinishedLot,
  type FinishedBoardScope,
  type FinishedOrderGroup,
  type FgFilter,
} from '@/lib/select-finished-orders';
import { Badge, Button, EmptyState } from '@maher/ui';
import { useLocale, useTranslations } from 'next-intl';

type Props = {
  lots: AdminFinishedLot[];
  scope: FinishedBoardScope;
  filter: FgFilter;
  /** Server-side search already applied; used only for empty-state copy. */
  search: string;
  /** Lot-level total from API meta when scope/q/warehouse are server-filtered. */
  serverTotalLots?: number;
  onScopeChange: (scope: FinishedBoardScope) => void;
  onFilterChange: (filter: FgFilter) => void;
  onOpenOrder: (order: FinishedOrderGroup) => void;
  historyFrom?: string;
  historyTo?: string;
  onHistoryFromChange?: (value: string) => void;
  onHistoryToChange?: (value: string) => void;
  warehouseId?: string;
  warehouses?: Array<{ id: string; code: string; nameEn: string; nameAr?: string }>;
  onWarehouseChange?: (id: string) => void;
};

function productLabel(order: FinishedOrderGroup, locale: string): string {
  if (locale === 'ar') return order.productNameAr || order.productNameEn;
  if (locale === 'he') return order.productNameHe || order.productNameEn;
  return order.productNameEn || order.productNameAr;
}

function dealerLabel(order: FinishedOrderGroup, locale: string): string {
  if (locale === 'ar') return order.dealerNameAr || order.dealerNameEn || '—';
  if (locale === 'he') return order.dealerNameHe || order.dealerNameEn || '—';
  return order.dealerNameEn || order.dealerNameAr || '—';
}

export function FinishedOrderBoard({
  lots,
  scope,
  filter,
  search,
  serverTotalLots,
  onScopeChange,
  onFilterChange,
  onOpenOrder,
  historyFrom,
  historyTo,
  onHistoryFromChange,
  onHistoryToChange,
  warehouseId,
  warehouses,
  onWarehouseChange,
}: Props) {
  const ti = useTranslations('inventory');
  const tl = useTranslations('lifecycle');
  const locale = useLocale();

  const orders = selectFinishedOrders(lots, { fgFilter: filter, scope });

  const emptyTitle = (() => {
    if (search.trim()) return tl('noFinishedGoodsSearch', { query: search.trim() });
    if (scope === 'history') return ti('finishedOrderHistoryEmpty');
    if (filter !== 'all') return tl('noFinishedGoodsFilter');
    return tl('noFinishedGoods');
  })();

  return (
    <div className="mb-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-text-secondary">{ti('finishedOrderBoardTitle')}</p>
          <p className="text-xs text-text-tertiary">{ti('finishedOrderBoardHint')}</p>
          {typeof serverTotalLots === 'number' && filter === 'all' ? (
            <p className="mt-1 text-[11px] text-text-tertiary" dir="ltr">
              {ti('finishedOrderLotTotal', { count: serverTotalLots })}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(['inWarehouse', 'history'] as const).map((s) => (
            <Button
              key={s}
              type="button"
              size="sm"
              variant={scope === s ? 'primary' : 'subtle'}
              onClick={() => onScopeChange(s)}
            >
              {s === 'inWarehouse' ? ti('finishedScopeInWarehouse') : ti('finishedScopeHistory')}
            </Button>
          ))}
        </div>
      </div>

      {scope === 'history' ? (
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-text-secondary">
            {ti('finishedHistoryFrom')}
            <input
              type="date"
              className="mt-1 block rounded-md border border-[var(--maher-border)] bg-[var(--maher-surface)] px-2 py-1.5 text-sm"
              value={historyFrom ?? ''}
              onChange={(e) => onHistoryFromChange?.(e.target.value)}
            />
          </label>
          <label className="text-xs text-text-secondary">
            {ti('finishedHistoryTo')}
            <input
              type="date"
              className="mt-1 block rounded-md border border-[var(--maher-border)] bg-[var(--maher-surface)] px-2 py-1.5 text-sm"
              value={historyTo ?? ''}
              onChange={(e) => onHistoryToChange?.(e.target.value)}
            />
          </label>
          <p className="pb-1.5 text-[11px] text-text-tertiary">{ti('finishedHistoryHint')}</p>
        </div>
      ) : null}

      {warehouses && warehouses.length > 0 && onWarehouseChange ? (
        <label className="block max-w-xs text-xs text-text-secondary">
          {ti('warehouse')}
          <select
            className="mt-1 block w-full rounded-md border border-[var(--maher-border)] bg-[var(--maher-surface)] px-2 py-1.5 text-sm"
            value={warehouseId ?? ''}
            onChange={(e) => onWarehouseChange(e.target.value)}
          >
            <option value="">{ti('finishedAllWarehouses')}</option>
            {warehouses.map((wh) => (
              <option key={wh.id} value={wh.id}>
                {wh.code} — {locale === 'ar' ? wh.nameAr || wh.nameEn : wh.nameEn}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {scope === 'inWarehouse' ? (
        <div className="flex flex-wrap gap-2">
          {FG_FILTERS.map((f) => (
            <Button
              key={f}
              type="button"
              size="sm"
              variant={filter === f ? 'primary' : 'subtle'}
              onClick={() => onFilterChange(f)}
            >
              {tl(fgFilterLabelKey(f) as 'waitingForTruck')}
            </Button>
          ))}
        </div>
      ) : null}

      {orders.length === 0 ? (
        <EmptyState title={emptyTitle} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {orders.map((order) => {
            const urgency = fgLeaveUrgency({
              deliveryStatus: order.deliveryStatus,
              deliveryDate: order.deliveryDate,
            });
            const leave = fgLeaveByLabelKey({
              deliveryStatus: order.deliveryStatus,
              deliveryDate: order.deliveryDate,
            });
            const leaveLabel =
              leave.values != null
                ? tl(leave.key as 'overdueByDays', leave.values)
                : tl(leave.key as 'waitingForTruck');
            const packageLine = order.packageSummary
              ? ti('finishedPackagesLine', {
                  count: order.packageCount,
                  summary: order.packageSummary,
                })
              : ti('finishedPackagesCount', { count: order.packageCount });
            const warehouseLine = order.multiWarehouse
              ? ti('finishedMultiWarehouses', { count: order.warehouseIds.length })
              : order.warehouseLabels[0] || null;
            const urgencyBorder =
              urgency === 'overdue'
                ? 'border-red-400/60'
                : urgency === 'leavingToday'
                  ? 'border-amber-400/60'
                  : 'border-[var(--maher-border)]';

            return (
              <button
                key={order.salesOrderId}
                type="button"
                onClick={() => onOpenOrder(order)}
                className={`rounded-xl border bg-[var(--maher-surface)] p-3 text-start transition hover:border-brand ${urgencyBorder}`}
              >
                <div className="flex gap-3">
                  <InventoryItemThumb
                    src={order.productImageUrl}
                    alt={productLabel(order, locale)}
                    size={56}
                  />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-text-primary" dir="ltr">
                          {order.salesOrderNumber}
                        </p>
                        {order.productionOrderNumbers.length ? (
                          <p className="text-xs text-text-secondary" dir="ltr">
                            {order.productionOrderNumbers.join(', ')}
                          </p>
                        ) : null}
                      </div>
                      <Badge>
                        <span className="text-[11px]">{leaveLabel}</span>
                      </Badge>
                    </div>
                    <p className="line-clamp-2 text-sm text-text-primary">
                      {order.projectName || productLabel(order, locale)}
                    </p>
                    <p className="text-xs text-text-secondary">{dealerLabel(order, locale)}</p>
                    <p className="text-[11px] font-medium text-[var(--maher-brand)] line-clamp-2">
                      {packageLine}
                    </p>
                    {warehouseLine ? (
                      <p className="text-[11px] text-text-secondary">{warehouseLine}</p>
                    ) : null}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {order.daysWaiting > 0 ? (
                        <span className="text-[11px] text-text-tertiary">
                          {tl('daysWaiting', { count: order.daysWaiting })}
                        </span>
                      ) : null}
                      {order.loadTotal > 0 ? (
                        <span className="text-[11px] font-medium text-text-secondary" dir="ltr">
                          {ti('finishedLoadProgress', {
                            checked: order.loadChecked,
                            total: order.loadTotal,
                          })}
                        </span>
                      ) : null}
                      <span className="ms-auto text-[11px] font-medium text-brand">
                        {ti('finishedOpen')}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
