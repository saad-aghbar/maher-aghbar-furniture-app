'use client';

import { Link } from '@/i18n/navigation';
import { localizedName } from '@maher/i18n';
import { Board, Ltr, Meter, RowThumb, Stamp } from '@maher/ui';
import { Armchair } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { complexityTone, productionTone, useProductionCopy } from './production-shared';

export type ProductionBasketItem = {
  id: string;
  number: string;
  productDescription: string;
  status: string;
  progressPercent: number;
  imageUrl?: string | null;
  manufacturingComplexity?: string | null;
  salesOrder?: { id: string; number: string; externalOrderNumber?: string | null } | null;
  product?: { nameEn: string; nameAr?: string | null; nameHe?: string | null; imageUrl?: string | null } | null;
};

export type ProductionBasket = { id: string; salesOrderId: string | null; items: ProductionBasketItem[] };

/** Basket view — one board per sales order, its production orders as hairline rows. */
export function ProductionBasketBoard({ boards }: { boards: ProductionBasket[] }) {
  const locale = useLocale();
  const tc = useTranslations('catalog');
  const tNav = useTranslations('navigation');
  const tm = useTranslations('mobile.production');
  const copy = useProductionCopy();
  if (boards.length === 0) return null;

  return (
    <div className="maher-stagger grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {boards.map((board) => {
        const first = board.items[0];
        const soId = board.salesOrderId ?? first?.salesOrder?.id;
        const href = soId ? `/admin/sales-orders/${soId}/production-plan` : first ? `/admin/production/${first.id}` : '/admin/production';
        const title = first?.salesOrder?.externalOrderNumber?.trim() || first?.salesOrder?.number || first?.number || board.id;
        const done = board.items.filter((i) => i.status === 'COMPLETED').length;
        const avg = board.items.length ? board.items.reduce((s, i) => s + Number(i.progressPercent ?? 0), 0) / board.items.length : 0;
        const late = board.items.some((i) => i.status === 'ON_HOLD' || i.status === 'WAITING_FOR_MATERIALS');
        return (
          <Board key={board.id} href={href} LinkComponent={Link} tone={done === board.items.length ? 'success' : late ? 'error' : 'brand'} as="article" className="h-full">
            <Board.Header title={<Ltr>{title}</Ltr>} description={first?.salesOrder?.number && first.salesOrder.externalOrderNumber ? <Ltr>{first.salesOrder.number}</Ltr> : undefined} meta={<Stamp tone="neutral" size="sm">{tm('basketItemsOf', { done, n: board.items.length })}</Stamp>} />
            <Board.Body className="space-y-3">
              <Meter value={avg} max={100} size="sm" label={tm('overallProgress')} valueLabel={`${Math.round(avg)}%`} tone={done === board.items.length ? 'success' : 'brand'} />
              <ul className="divide-y divide-[var(--maher-border)]">
                {board.items.map((item) => {
                  const kind = item.manufacturingComplexity === 'CUSTOM' ? tc('lineKindCustom') : item.manufacturingComplexity === 'MODIFIED' ? tc('lineKindCustomized') : tc('lineKindStandard');
                  const name = item.product ? localizedName(locale, item.product, item.product.nameEn) : item.productDescription;
                  return (
                    <li key={item.id} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
                      <RowThumb src={item.imageUrl ?? item.product?.imageUrl} icon={<Armchair className="h-4 w-4" />} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-medium text-[var(--maher-text-primary)]">{name}</span>
                        <span className="flex items-center gap-1.5 text-[12px] text-[var(--maher-text-tertiary)]">
                          <Ltr>{item.number}</Ltr>
                          <Stamp tone={complexityTone(item.manufacturingComplexity)} size="sm">
                            {kind}
                          </Stamp>
                        </span>
                      </span>
                      <Stamp tone={productionTone(item.status)} size="sm">
                        {copy.status(item.status)}
                      </Stamp>
                    </li>
                  );
                })}
              </ul>
            </Board.Body>
            <Board.Footer>
              <span className="text-[12px] text-[var(--maher-text-secondary)]">{tNav('productionPlan')}</span>
            </Board.Footer>
          </Board>
        );
      })}
    </div>
  );
}
