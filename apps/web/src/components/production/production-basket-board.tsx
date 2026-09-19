'use client';

import { Link } from '@/i18n/navigation';
import { Badge, Ltr, StatusBadge } from '@maher/ui';
import { localizedName } from '@maher/i18n';
import { useLocale, useTranslations } from 'next-intl';

export type ProductionBasketItem = {
  id: string;
  number: string;
  productDescription: string;
  status: string;
  progressPercent: number;
  imageUrl?: string | null;
  manufacturingComplexity?: string | null;
  salesOrder?: { id: string; number: string; externalOrderNumber?: string | null } | null;
  product?: {
    nameEn: string;
    nameAr?: string | null;
    nameHe?: string | null;
    imageUrl?: string | null;
  } | null;
};

export type ProductionBasket = {
  id: string;
  salesOrderId: string | null;
  items: ProductionBasketItem[];
};

export function ProductionBasketBoard({ boards }: { boards: ProductionBasket[] }) {
  const locale = useLocale();
  const tc = useTranslations('catalog');
  const tNav = useTranslations('navigation');

  if (boards.length === 0) return null;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {boards.map((board) => {
        const first = board.items[0];
        const soId = board.salesOrderId ?? first?.salesOrder?.id;
        const href = soId
          ? `/sales-orders/${soId}/production-plan`
          : first
            ? `/production/${first.id}`
            : '/production';
        const title = first?.salesOrder?.number ?? first?.number ?? board.id;
        return (
          <Link
            key={board.id}
            href={href}
            className="rounded-xl border border-border bg-surface p-4 transition hover:border-brand/40"
          >
            <div className="flex items-start justify-between gap-2">
              <Ltr className="font-medium">{title}</Ltr>
              <Badge>{board.items.length}</Badge>
            </div>
            <ul className="mt-3 space-y-2">
              {board.items.map((item) => {
                const kind =
                  item.manufacturingComplexity === 'CUSTOM'
                    ? tc('lineKindCustom')
                    : item.manufacturingComplexity === 'MODIFIED'
                      ? tc('lineKindCustomized')
                      : tc('lineKindStandard');
                const name = item.product
                  ? localizedName(locale, item.product, item.product.nameEn)
                  : item.productDescription;
                const image = item.imageUrl ?? item.product?.imageUrl;
                return (
                  <li key={item.id} className="flex items-center gap-2">
                    <div className="h-10 w-10 overflow-hidden rounded-md bg-[var(--maher-surface-muted)]">
                      {image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={image} alt="" className="h-full w-full object-cover" />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] text-text-tertiary" dir="ltr">
                        {item.number}
                      </p>
                      <p className="truncate text-sm">{name}</p>
                      <p className="text-[11px] text-[var(--maher-brand)]">{kind}</p>
                    </div>
                    <StatusBadge status={item.status} />
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-xs text-text-secondary">{tNav('productionPlan')}</p>
          </Link>
        );
      })}
    </div>
  );
}
