'use client';

import { InventoryItemThumb } from '@/components/admin/inventory-item-thumb';
import { Link } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api-client';
import { Board, BoardSkeleton, Figure, Ltr, Meter, Ribbon, Stamp, type BoardTone } from '@maher/ui';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

export type InventoryGroupKey = 'fabric' | 'foam' | 'wood' | 'accessories';
export type InventoryGroupSummary = { categoryGroup: InventoryGroupKey; materialCount: number; lowStockCount: number; totalOnHand: number | string; primaryUnit: string | null };
export type FabricHoldingRow = {
  id: string;
  label: string;
  role: string | null;
  sku: string;
  imageUrl?: string | null;
  salesOrderId?: string | null;
  orderNumber: string | null;
  productionOrderId?: string | null;
  dealerName: string | null;
  productName?: string | null;
  productImageUrl?: string | null;
  derivedStatus: string;
  expectedQty: number | null;
  arrivedQty: number;
  unit: string;
  lots: Array<{ id: string; qrCode?: string | null; remainingQty: number; status: string; locationLabel?: string | null; warehouseLabel?: string | null }>;
};

export type InventoryOverview = {
  rawMaterials: { itemCount: number; lowStockCount: number };
  semiFinished: { itemCount: number; totalQty: number | string };
  finishedGoods: { onHandQty?: number | string; availableQty: number | string; reservedQty: number | string; freeQty?: number | string; readyForDeliveryQty?: number | string };
};

const GROUP_TONE: Record<InventoryGroupKey, BoardTone> = { fabric: 'brand', foam: 'info', wood: 'warning', accessories: 'neutral' };

export function useInventoryGroups() {
  return useQuery({ queryKey: ['inventory-groups'], queryFn: () => apiFetch<InventoryGroupSummary[] | { data: InventoryGroupSummary[] }>('/api/v1/inventory/groups').then((r) => (Array.isArray(r) ? r : r.data)), staleTime: 60_000 });
}

export function useFabricHolding(enabled = true) {
  return useQuery({ queryKey: ['inventory-fabric-holding'], queryFn: () => apiFetch<{ holding: FabricHoldingRow[] }>('/api/v1/inventory/fabric-holding').then((r) => r.holding), staleTime: 60_000, enabled });
}

export function groupLabel(ti: ReturnType<typeof useTranslations>, key: InventoryGroupKey) {
  return key === 'fabric' ? ti('categoryFabric') : key === 'foam' ? ti('categoryFoam') : key === 'wood' ? ti('categoryWood') : ti('categoryAccessories');
}

/** Inventory hero: title + actions on the start, lifecycle figures and the group ribbon on the end. */
export function InventoryHero({ title, description, actions, overview, groups }: { title: string; description?: string; actions?: ReactNode; overview?: InventoryOverview | null; groups?: InventoryGroupSummary[] }) {
  const ti = useTranslations('inventory');
  const lowStock = overview?.rawMaterials.lowStockCount ?? 0;
  const tone: BoardTone = lowStock > 0 ? 'warning' : 'brand';
  return (
    <Board tone={tone} wash="top" as="section">
      <div className="grid gap-5 px-5 py-5 sm:px-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] xl:items-center">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[24px] font-semibold leading-8 tracking-[-0.02em] text-[var(--maher-text-primary)] sm:text-[28px] sm:leading-9 rtl:tracking-normal">{title}</h1>
            {description ? <p className="mt-1 max-w-[56ch] text-[14px] leading-5 text-[var(--maher-text-secondary)]">{description}</p> : null}
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
        </div>
        <div className="min-w-0">
          {groups?.length ? <Ribbon size="sm" segments={groups.map((g) => ({ key: g.categoryGroup, label: groupLabel(ti, g.categoryGroup), value: g.materialCount, tone: GROUP_TONE[g.categoryGroup] }))} /> : null}
          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
            <Figure size="sm" value={overview?.rawMaterials.itemCount ?? 0} label={ti('overviewRaw')} />
            <Figure size="sm" value={lowStock} label={ti('lowStock')} tone={lowStock ? 'warning' : 'success'} />
            <Figure size="sm" value={overview?.semiFinished.itemCount ?? 0} label={ti('overviewSemi')} tone="info" delta={overview ? <Ltr>{String(overview.semiFinished.totalQty)}</Ltr> : undefined} />
            <Figure size="sm" value={Number(overview?.finishedGoods.onHandQty ?? overview?.finishedGoods.availableQty ?? 0)} label={ti('overviewFinished')} tone="success" delta={overview ? `${ti('reserved')} ${overview.finishedGoods.reservedQty} · ${ti('available')} ${overview.finishedGoods.freeQty ?? overview.finishedGoods.readyForDeliveryQty ?? 0}` : undefined} />
          </div>
        </div>
      </div>
    </Board>
  );
}

const HOLD_TONE = (s: string): BoardTone => (/READY|ARRIVED|RECEIVED|COMPLETE/.test(s) ? 'success' : /PARTIAL|WAITING|PENDING/.test(s) ? 'warning' : /MISSING|LATE|SHORT/.test(s) ? 'error' : 'info');

const FABRIC_STATUS_KEY: Record<string, string> = {
  NEEDS_ORDERING: 'needsOrdering',
  REQUESTED: 'waitingSupplier',
  SENT: 'waitingSupplier',
  SUPPLIER_CONFIRMED: 'waitingSupplier',
  DELAYED: 'waiting',
  PARTIALLY_AVAILABLE: 'partial',
  PARTIAL: 'partial',
  READY_FOR_PICKUP: 'readyForPickup',
  ARRIVED: 'inHolding',
  RECEIVED: 'inHolding',
  READY_FOR_PRODUCTION: 'ready',
  ISSUED: 'taken',
  UNAVAILABLE: 'unavailable',
};

/** Fabric holding — dealer fabric that arrived for a specific order and waits for the floor (mobile-only endpoint). */
export function FabricHoldingBoard({ className }: { className?: string }) {
  const ti = useTranslations('inventory');
  const tf = useTranslations('mobile.fabricStatus');
  const holdingLabel = (s: string) => {
    const key = FABRIC_STATUS_KEY[s.toUpperCase()];
    if (key && tf.has(key as never)) return tf(key as never);
    const t = s.replace(/_/g, ' ').toLowerCase();
    return t.charAt(0).toUpperCase() + t.slice(1);
  };
  const q = useFabricHolding();
  const rows = q.data ?? [];
  const waiting = rows.filter((r) => HOLD_TONE(r.derivedStatus) !== 'success').length;
  return (
    <Board tone={waiting ? 'warning' : 'brand'} className={className}>
      <Board.Header title={ti('fabricHolding')} description={ti('fabricHoldingHint')} meta={rows.length ? <Stamp tone={waiting ? 'warning' : 'success'} size="sm">{rows.length}</Stamp> : null} />
      {q.isLoading ? (
        <BoardSkeleton header={false} rows={3} />
      ) : rows.length === 0 ? (
        <Board.Empty title={ti('fabricHoldingEmpty')} />
      ) : (
        <ul className="divide-y divide-[var(--maher-border)]">
          {rows.slice(0, 8).map((r) => {
            const pct = r.expectedQty ? Math.min(100, Math.round((r.arrivedQty / r.expectedQty) * 100)) : null;
            const href = r.productionOrderId ? `/admin/production/${r.productionOrderId}?tab=materials` : r.salesOrderId ? `/admin/sales-orders/${r.salesOrderId}` : `/admin/inventory/fabric-bundle/${encodeURIComponent(r.sku)}`;
            return (
              <li key={r.id} className="flex items-center gap-3 px-5 py-3">
                <InventoryItemThumb src={r.imageUrl ?? r.productImageUrl} alt="" size={36} />
                <span className="min-w-0 flex-1">
                  <Link href={href} className="block truncate text-[14px] font-semibold text-[var(--maher-text-primary)] hover:text-[var(--maher-brand)]">
                    {r.label}
                  </Link>
                  <span className="block truncate text-[12px] text-[var(--maher-text-tertiary)]">
                    <Ltr>{r.sku}</Ltr>
                    {r.orderNumber ? ` · ${r.orderNumber}` : ''}
                    {r.dealerName ? ` · ${r.dealerName}` : ''}
                    {r.lots[0]?.locationLabel ? ` · ${r.lots[0].locationLabel}` : ''}
                  </span>
                  {pct != null ? <Meter className="mt-1 max-w-[220px]" value={r.arrivedQty} max={Math.max(1, r.expectedQty ?? r.arrivedQty)} size="sm" valueLabel={`${r.arrivedQty}/${r.expectedQty} ${r.unit}`} tone={HOLD_TONE(r.derivedStatus)} /> : null}
                </span>
                <Stamp tone={HOLD_TONE(r.derivedStatus)} size="sm">
                  {holdingLabel(r.derivedStatus)}
                </Stamp>
              </li>
            );
          })}
        </ul>
      )}
    </Board>
  );
}
