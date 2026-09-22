'use client';

import { Link } from '@/i18n/navigation';
import { API_URL } from '@/lib/api-client';
import { Board, Stamp } from '@maher/ui';
import { localizedName } from '@maher/i18n';
import { Armchair } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

export interface CatalogCategory {
  id: string;
  code: string;
  nameEn: string;
  nameAr?: string | null;
  nameHe?: string | null;
}

export interface CatalogProduct {
  id: string;
  sku: string;
  nameEn: string;
  nameAr?: string;
  nameHe?: string;
  description?: string | null;
  imageUrl?: string | null;
  basePrice?: string | number | null;
  price?: string | number | null;
  dealerPrice?: string | number | null;
  categoryId?: string | null;
  category?: { id?: string; nameEn: string; nameAr?: string; nameHe?: string } | null;
}

export function mediaSrc(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  if (/^https?:\/\//i.test(url) || url.startsWith('blob:')) return url;
  return `${API_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

export function dealerPriceOf(product: CatalogProduct): number | null {
  const price = product.price ?? product.dealerPrice ?? product.basePrice;
  const n = price != null ? Number(price) : NaN;
  return Number.isFinite(n) ? n : null;
}

export function useDealerMoney() {
  const locale = useLocale();
  return (value: number | null | undefined, currency = 'ILS') => {
    if (value == null || !Number.isFinite(value)) return '—';
    return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
  };
}

/** Product board — image, name, category, dealer price. Whole board is the link. */
export function ProductBoard({ product, badge, compact }: { product: CatalogProduct; badge?: string; compact?: boolean }) {
  const locale = useLocale();
  const tc = useTranslations('catalog');
  const money = useDealerMoney();
  const title = localizedName(locale, product);
  const image = mediaSrc(product.imageUrl);
  const price = dealerPriceOf(product);
  return (
    <Board as="li" tone="brand" interactive href={`/dealer/catalog/${product.id}`} LinkComponent={Link} className="h-full">
      <div className={compact ? 'relative aspect-[4/3] overflow-hidden bg-[var(--maher-surface-muted)]' : 'relative aspect-[5/4] overflow-hidden bg-[var(--maher-surface-muted)]'}>
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt={title} className="h-full w-full object-cover transition duration-500 ease-out group-hover:scale-[1.04]" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[var(--maher-text-tertiary)]">
            <Armchair className="h-8 w-8 opacity-40" />
          </div>
        )}
        {badge ? (
          <span className="absolute start-2 top-2">
            <Stamp tone="success" size="sm">{badge}</Stamp>
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-1 px-3.5 pb-3.5 pt-3">
        <h2 className="line-clamp-2 text-[14px] font-semibold leading-5 text-[var(--maher-text-primary)]">{title}</h2>
        {product.category ? <p className="truncate text-[12px] text-[var(--maher-text-tertiary)]">{localizedName(locale, product.category)}</p> : null}
        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <span className="text-[15px] font-semibold tracking-tight text-[var(--maher-text-primary)]" dir="ltr">
            {money(price)}
          </span>
          <span className="shrink-0 text-[12px] font-semibold text-[var(--maher-brand)] opacity-0 transition group-hover:opacity-100">{tc('viewDetails')}</span>
        </div>
      </div>
    </Board>
  );
}
