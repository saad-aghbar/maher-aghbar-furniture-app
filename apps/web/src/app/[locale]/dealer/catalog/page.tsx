'use client';

import { ProductBoard, type CatalogCategory, type CatalogProduct } from '@/components/dealer/catalog-shared';
import { useRouter } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api-client';
import { useKitCopy } from '@/lib/kit-copy';
import { Board, BoardSkeleton, Button, ErrorBoard, Figure, ListToolbar, StatusChips } from '@maher/ui';
import { localizedName } from '@maher/i18n';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Sparkles } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

export default function CatalogPage() {
  const locale = useLocale();
  const t = useTranslations('navigation');
  const tc = useTranslations('catalog');
  const kit = useKitCopy();
  const router = useRouter();
  const [q, setQ] = useState('');
  const [sectionId, setSectionId] = useState('all');

  const categoriesQuery = useQuery({ queryKey: ['catalog-browse-categories'], queryFn: () => apiFetch<CatalogCategory[]>('/api/v1/catalog/browse/categories') });
  const listParams = useMemo(() => {
    const params = new URLSearchParams({ pageSize: '100' });
    if (q.trim()) params.set('q', q.trim());
    if (sectionId !== 'all') params.set('categoryId', sectionId);
    return params.toString();
  }, [q, sectionId]);
  const productsQuery = useQuery({
    queryKey: ['catalog-browse', listParams],
    queryFn: () => apiFetch<{ data: CatalogProduct[] }>(`/api/v1/catalog/browse/products?${listParams}`).then((r) => r.data ?? []),
    placeholderData: keepPreviousData,
  });
  const previouslyQuery = useQuery({
    queryKey: ['catalog-browse-previously-ordered'],
    queryFn: () => apiFetch<{ data: CatalogProduct[] }>('/api/v1/catalog/browse/previously-ordered').then((r) => r.data ?? []),
    staleTime: 60_000,
  });

  const categories = categoriesQuery.data ?? [];
  const products = productsQuery.data ?? [];
  const previously = previouslyQuery.data ?? [];
  const initialLoading = (productsQuery.isLoading && !productsQuery.data) || categoriesQuery.isLoading;
  const showShelf = !q.trim() && sectionId === 'all' && previously.length > 0;

  return (
    <div className="maher-stagger space-y-5">
      <Board tone="brand" wash="top" as="section">
        <div className="grid gap-5 px-5 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-[24px] font-semibold leading-8 tracking-[-0.02em] text-[var(--maher-text-primary)] sm:text-[28px] sm:leading-9 rtl:tracking-normal">{t('catalog')}</h1>
              <p className="mt-1 max-w-[56ch] text-[14px] leading-5 text-[var(--maher-text-secondary)]">{tc('catalogHint')}</p>
            </div>
            <Button variant="secondary" leadingIcon={<Sparkles className="h-4 w-4" />} onClick={() => router.push('/dealer/order/custom')}>
              {t('customItem')}
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-5 lg:min-w-[20rem]">
            <Figure size="sm" value={products.length} label={tc('products')} />
            <Figure size="sm" value={categories.length} label={tc('allSections')} tone="info" />
            <Figure size="sm" value={previously.length} label={tc('previouslyOrdered')} tone="success" />
          </div>
        </div>
      </Board>

      <ListToolbar copy={kit.toolbar} search={{ value: q, onChange: setQ, placeholder: tc('searchProducts') }} />

      <StatusChips
        aria-label={tc('allSections')}
        value={sectionId}
        onChange={setSectionId}
        items={[{ id: 'all', label: tc('allSections'), count: sectionId === 'all' ? products.length : undefined }, ...categories.map((c) => ({ id: c.id, label: localizedName(locale, c) }))]}
      />

      {showShelf ? (
        <Board tone="success" wash="top">
          <Board.Header title={tc('previouslyOrdered')} description={tc('previouslyOrderedHint')} />
          <ul className="flex gap-3 overflow-x-auto px-5 pb-5 pt-1 [scrollbar-width:thin]">
            {previously.slice(0, 12).map((product) => (
              <div key={product.id} className="w-44 shrink-0">
                <ProductBoard product={product} compact badge={tc('previouslyOrdered')} />
              </div>
            ))}
          </ul>
        </Board>
      ) : null}

      {productsQuery.isError && !productsQuery.data ? (
        <ErrorBoard title={t('catalog')} onRetry={() => productsQuery.refetch()} />
      ) : initialLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <BoardSkeleton key={i} rows={3} />
          ))}
        </div>
      ) : products.length === 0 ? (
        <Board tone="neutral">
          <Board.Empty title={tc('noProducts')} action={<Button size="sm" variant="secondary" onClick={() => (setQ(''), setSectionId('all'))}>{tc('allSections')}</Button>} />
        </Board>
      ) : (
        <ul className={`maher-stagger grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 ${productsQuery.isFetching ? 'opacity-70 transition-opacity' : 'transition-opacity'}`}>
          {products.map((product) => (
            <ProductBoard key={product.id} product={product} />
          ))}
        </ul>
      )}
    </div>
  );
}
