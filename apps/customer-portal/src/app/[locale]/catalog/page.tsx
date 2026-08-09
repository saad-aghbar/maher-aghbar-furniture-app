'use client';

import { Link } from '@/i18n/navigation';
import { apiFetch, API_URL } from '@/lib/api-client';
import {
  EmptyState,
  ErrorState,
  Input,
  MotionSection,
  PageHero,
  Skeleton,
  StaggerGrid,
  SurfaceCard,
} from '@maher/ui';
import { localizedName } from '@maher/i18n';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Armchair } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

interface CatalogCategory {
  id: string;
  code: string;
  nameEn: string;
  nameAr?: string | null;
  nameHe?: string | null;
}

interface CatalogProduct {
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
  category?: {
    id?: string;
    nameEn: string;
    nameAr?: string;
    nameHe?: string;
  } | null;
}

function mediaSrc(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  if (/^https?:\/\//i.test(url) || url.startsWith('blob:')) return url;
  return `${API_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

export default function CatalogPage() {
  const locale = useLocale();
  const t = useTranslations('navigation');
  const tc = useTranslations('catalog');
  const tCommon = useTranslations('common');
  const [q, setQ] = useState('');
  const [sectionId, setSectionId] = useState('all');

  const categoriesQuery = useQuery({
    queryKey: ['catalog-browse-categories'],
    queryFn: () => apiFetch<CatalogCategory[]>('/api/v1/catalog/browse/categories'),
  });

  const listParams = useMemo(() => {
    const params = new URLSearchParams({ pageSize: '100' });
    if (q.trim()) params.set('q', q.trim());
    if (sectionId !== 'all') params.set('categoryId', sectionId);
    return params.toString();
  }, [q, sectionId]);

  const productsQuery = useQuery({
    queryKey: ['catalog-browse', listParams],
    queryFn: () =>
      apiFetch<{ data: CatalogProduct[] }>(
        `/api/v1/catalog/browse/products?${listParams}`,
      ).then((r) => r.data ?? []),
    placeholderData: keepPreviousData,
  });

  const categories = categoriesQuery.data ?? [];
  const products = productsQuery.data ?? [];
  const initialLoading =
    (productsQuery.isLoading && !productsQuery.data) || categoriesQuery.isLoading;

  return (
    <div className="space-y-6">
      <PageHero tone="soft" title={t('catalog')} description={tc('products')} />

      <MotionSection delayMs={40} className="space-y-4">
        <div className="maher-stagger flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSectionId('all')}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              sectionId === 'all'
                ? 'bg-brand text-white'
                : 'bg-[var(--maher-surface-muted)] text-text-secondary hover:text-text-primary'
            }`}
          >
            {tc('allSections')}
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSectionId(c.id)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                sectionId === c.id
                  ? 'bg-brand text-white'
                  : 'bg-[var(--maher-surface-muted)] text-text-secondary hover:text-text-primary'
              }`}
            >
              {localizedName(locale, c)}
            </button>
          ))}
        </div>

        <Input
          type="search"
          withSearchIcon
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={tc('searchProducts')}
          className="max-w-md"
        />
      </MotionSection>

      {productsQuery.isError && !productsQuery.data ? (
        <ErrorState title={t('catalog')} onRetry={() => productsQuery.refetch()} />
      ) : initialLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[4/5] rounded-xl" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <EmptyState title={tc('noProducts')} />
      ) : (
        <StaggerGrid
          className={`grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 ${
            productsQuery.isFetching ? 'opacity-70 transition-opacity' : ''
          }`}
        >
          {products.map((product) => {
            const title = localizedName(locale, product);
            const image = mediaSrc(product.imageUrl);
            const price = product.price ?? product.dealerPrice ?? product.basePrice;
            const priceNum = price != null ? Number(price) : NaN;
            return (
              <SurfaceCard
                key={product.id}
                tilt
                className="maher-list-card group flex flex-col !rounded-xl"
              >
                <div className="relative aspect-[5/4] overflow-hidden bg-[var(--maher-surface-muted)]">
                  {image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={image}
                      alt={title}
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.05]"
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-text-tertiary">
                      <Armchair className="h-8 w-8 opacity-40" />
                    </div>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-1.5 p-3">
                  <h2 className="line-clamp-2 text-sm font-semibold leading-snug text-text-primary">
                    {title}
                  </h2>
                  {product.category ? (
                    <p className="truncate text-xs text-text-secondary">
                      {localizedName(locale, product.category)}
                    </p>
                  ) : null}
                  <div className="mt-auto flex items-end justify-between gap-2 maher-card-rule-t pt-2.5">
                    <span className="text-sm font-bold tracking-tight text-text-primary" dir="ltr">
                      {Number.isFinite(priceNum)
                        ? `${priceNum.toFixed(0)} ${tCommon('currency')}`
                        : '—'}
                    </span>
                    <Link
                      href={`/orders/new?productId=${product.id}`}
                      className="shrink-0 text-xs font-semibold text-brand hover:underline"
                    >
                      {t('createOrder')}
                    </Link>
                  </div>
                </div>
              </SurfaceCard>
            );
          })}
        </StaggerGrid>
      )}
    </div>
  );
}
