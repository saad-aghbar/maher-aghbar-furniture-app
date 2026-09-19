'use client';

import { InventoryItemThumb } from '@/components/admin/inventory-item-thumb';
import {
  boardParamsForSemiFilter,
  custodyLabelKey,
  selectSemiOrdersFromBoard,
  waitingForKey,
  type SemiOrderFilter,
  type SemiOrderGroup,
  type WipKitBoardSection,
} from '@/lib/select-semi-orders';
import { localizedName } from '@maher/i18n';
import { Badge, Button, EmptyState, StatusBadge } from '@maher/ui';
import { useLocale, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

type Props = {
  sections: WipKitBoardSection[];
  filter: SemiOrderFilter;
  search: string;
  onFilterChange: (filter: SemiOrderFilter) => void;
  onInspectKit: (kitId: string) => void;
  ensureBinsSlot?: ReactNode;
};

function productLabel(
  group: SemiOrderGroup,
  locale: string,
): string {
  if (group.product) return localizedName(locale, group.product);
  return group.productDescription;
}

function stageLabel(
  group: SemiOrderGroup,
  locale: string,
): string {
  const s = group.primaryStage;
  if (!s) return '—';
  if (locale === 'ar') return s.nameAr || s.nameEn;
  if (locale === 'he') return s.nameHe || s.nameEn;
  return s.nameEn;
}

function holderName(group: SemiOrderGroup): string | null {
  for (const kit of group.kits) {
    if (kit.claimedByUser) {
      return `${kit.claimedByUser.firstName} ${kit.claimedByUser.lastName}`.trim();
    }
  }
  return null;
}

function qtyLabel(group: SemiOrderGroup): string {
  const pieces = group.kits.reduce((s, k) => s + (k.pieces?.length ?? 0), 0);
  const expected = group.kits.reduce((s, k) => s + (k.expectedPieceCount || 0), 0);
  return `${pieces}/${expected || pieces}`;
}

export function boardQueryFromSemiFilter(filter: SemiOrderFilter, q: string) {
  return boardParamsForSemiFilter(filter, { q: q.trim() || undefined });
}

export function SemiOrderBoard({
  sections,
  filter,
  search,
  onFilterChange,
  onInspectKit,
  ensureBinsSlot,
}: Props) {
  const ti = useTranslations('inventory');
  const locale = useLocale();

  const orders = selectSemiOrdersFromBoard(sections, {
    filter,
    q: search,
  });

  return (
    <div className="mb-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-text-secondary">{ti('semiOrderBoardTitle')}</p>
          <p className="text-xs text-text-tertiary">{ti('semiOrderBoardHint')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(['active', 'history'] as const).map((f) => (
            <Button
              key={f}
              type="button"
              size="sm"
              variant={filter === f ? 'primary' : 'subtle'}
              onClick={() => onFilterChange(f)}
            >
              {f === 'active' ? ti('semiFilterActive') : ti('semiFilterHistory')}
            </Button>
          ))}
          {ensureBinsSlot}
        </div>
      </div>

      {orders.length === 0 ? (
        <EmptyState title={ti('semiOrderEmpty')} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {orders.map((order) => {
            const firstKit = order.kits[0];
            const holder = holderName(order);
            const waitKey = waitingForKey(order);
            return (
              <button
                key={order.productionOrderId}
                type="button"
                onClick={() => firstKit && onInspectKit(firstKit.id)}
                className="rounded-xl border border-[var(--maher-border)] bg-[var(--maher-surface)] p-3 text-start transition hover:border-brand"
              >
                <div className="flex gap-3">
                  <InventoryItemThumb
                    src={order.product?.imageUrl}
                    alt={productLabel(order, locale)}
                    size={56}
                  />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-text-primary" dir="ltr">
                          {order.number}
                        </p>
                        {order.salesOrderNumber ? (
                          <p className="text-xs text-text-secondary" dir="ltr">
                            {order.salesOrderNumber}
                          </p>
                        ) : null}
                      </div>
                      <Badge>
                        {order.counts.active}/{order.counts.total}
                      </Badge>
                    </div>
                    <p className="line-clamp-2 text-sm text-text-primary">
                      {productLabel(order, locale)}
                    </p>
                    {order.dealerName ? (
                      <p className="text-xs text-text-secondary">{order.dealerName}</p>
                    ) : null}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <span className="text-[11px] font-medium text-[var(--maher-brand)]">
                        {stageLabel(order, locale)}
                      </span>
                      <span className="text-[11px] text-text-tertiary" dir="ltr">
                        {ti('semiOrderQty')}: {qtyLabel(order)}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {firstKit ? <StatusBadge status={firstKit.status} /> : null}
                      <span className="text-[11px] text-text-secondary">
                        {ti(custodyLabelKey(firstKit?.status ?? 'OPEN') as 'semiCustodyWaitingPickup')}
                      </span>
                    </div>
                    {holder ? (
                      <p className="text-[11px] text-text-secondary">
                        {ti('semiOrderHolder', { name: holder })}
                      </p>
                    ) : null}
                    <p className="text-[11px] text-text-tertiary">
                      {ti(
                        waitKey === 'waiting_pickup'
                          ? 'semiWaitingPickup'
                          : waitKey === 'at_receiver'
                            ? 'semiWaitingReceiver'
                            : waitKey === 'at_station'
                              ? 'semiWaitingStation'
                              : waitKey === 'used'
                                ? 'semiWaitingUsed'
                                : 'semiWaitingIdle',
                      )}
                    </p>
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
