'use client';

import { useCatalogCopy, useTranslateName, type Category, type ProductRow } from '@/components/catalog/catalog-shared';
import { Link } from '@/i18n/navigation';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import { API_URL, ApiClientError, apiFetch, apiUpload } from '@/lib/api-client';
import { useKitCopy } from '@/lib/kit-copy';
import type { Paginated } from '@/lib/paginated';
import { toApiQuery, useListParams } from '@/lib/use-list-params';
import { localizedName } from '@maher/i18n';
import {
  Alert,
  Board,
  BoardSkeleton,
  Button,
  Combobox,
  DataBoard,
  ErrorBoard,
  Figure,
  ImageSourceField,
  Input,
  ListToolbar,
  Ltr,
  Meter,
  MoneyField,
  Pagination,
  Ribbon,
  RowThumb,
  SegmentedControl,
  Sheet,
  Stamp,
  StatusChips,
  useToast,
  type DataColumn,
} from '@maher/ui';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Armchair, LayoutGrid, List, Plus, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Suspense, useMemo, useState } from 'react';

const DEFAULTS = { q: '', categoryId: '', active: '' as '' | 'true' | 'false', view: 'grid' as 'grid' | 'list', page: 1, pageSize: 48 };

function ProductsPageInner() {
  const copy = useCatalogCopy();
  const kit = useKitCopy();
  const t = useTranslations('catalog');
  const tCommon = useTranslations('common');
  const tSales = useTranslations('sales');
  const toast = useToast();
  const qc = useQueryClient();
  const { params, set, reset, activeCount } = useListParams({ defaults: DEFAULTS });

  const [sectionOpen, setSectionOpen] = useState(false);
  const [sectionCode, setSectionCode] = useState('');
  const [sectionNameEn, setSectionNameEn] = useState('');
  const [sectionNameAr, setSectionNameAr] = useState('');
  const [productOpen, setProductOpen] = useState(false);
  const [nameEn, setNameEn] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [nameHe, setNameHe] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [basePrice, setBasePrice] = useState<number | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const translate = useTranslateName();

  const categories = useQuery({ queryKey: ['product-categories'], queryFn: () => apiFetch<{ data: Category[] }>('/api/v1/product-categories?pageSize=100').then((r) => r.data) });

  const apiQuery = useMemo(
    () => toApiQuery({ page: params.page, pageSize: params.pageSize, q: params.q.trim(), categoryId: params.categoryId || undefined, isActive: params.active || undefined }),
    [params],
  );
  const products = useQuery({ queryKey: ['products', apiQuery], queryFn: () => apiFetch<Paginated<ProductRow>>(`/api/v1/products${apiQuery}`), placeholderData: keepPreviousData });

  // Pulse: totals per category + active share (one wide probe, cached).
  const pulse = useQuery({
    queryKey: ['products-pulse'],
    queryFn: async () => {
      const [all, inactive] = await Promise.all([apiFetch<Paginated<ProductRow>>('/api/v1/products?pageSize=100'), apiFetch<Paginated<ProductRow>>('/api/v1/products?pageSize=1&isActive=false')]);
      const byCategory = new Map<string, number>();
      let priced = 0;
      let costed = 0;
      all.data.forEach((p) => {
        byCategory.set(p.categoryId ?? '__none', (byCategory.get(p.categoryId ?? '__none') ?? 0) + 1);
        if (Number(p.basePrice) > 0) priced += 1;
        if (Number(p.productionCost ?? p.manufacturingCost) > 0) costed += 1;
      });
      return { total: all.meta.totalItems, inactive: inactive.meta.totalItems, byCategory, priced, costed, sample: all.data.length };
    },
    staleTime: 60_000,
  });

  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey: ['products'] });
    await qc.invalidateQueries({ queryKey: ['products-pulse'] });
    await qc.invalidateQueries({ queryKey: ['product-categories'] });
  };

  const createSection = useMutation({
    mutationFn: async () => {
      if (!sectionCode.trim() || !sectionNameEn.trim() || !sectionNameAr.trim()) throw new ApiClientError(t('codeAndNamesRequired'), 400);
      return apiFetch('/api/v1/product-categories', { method: 'POST', body: JSON.stringify({ code: sectionCode.trim().toUpperCase().replace(/\s+/g, '_'), nameEn: sectionNameEn.trim(), nameAr: sectionNameAr.trim() }) });
    },
    onSuccess: async () => {
      setSectionOpen(false);
      setSectionCode('');
      setSectionNameEn('');
      setSectionNameAr('');
      setFormError(null);
      toast.success(t('sectionCreated'));
      await invalidate();
    },
    onError: (err) => setFormError(mutationErrorMessage(err)),
  });

  const createProduct = useMutation({
    mutationFn: async () => {
      if (!nameEn.trim() || !nameAr.trim()) throw new ApiClientError(t('namesRequired'), 400);
      return apiFetch<ProductRow>('/api/v1/products', {
        method: 'POST',
        body: JSON.stringify({
          nameEn: nameEn.trim(),
          nameAr: nameAr.trim(),
          nameHe: nameHe.trim() || undefined,
          categoryId: categoryId || null,
          basePrice: basePrice ?? undefined,
          imageUrl: photos[0] || undefined,
          galleryUrls: photos.slice(1),
          unit: 'pcs',
          isActive: true,
        }),
      });
    },
    onSuccess: async () => {
      setProductOpen(false);
      setNameEn('');
      setNameAr('');
      setNameHe('');
      setCategoryId(null);
      setBasePrice(null);
      setPhotos([]);
      setFormError(null);
      toast.success(t('productCreated'));
      await invalidate();
    },
    onError: (err) => setFormError(mutationErrorMessage(err)),
  });

  async function suggestNames() {
    const source = nameAr.trim() ? { text: nameAr.trim(), sourceLocale: 'ar' as const } : nameEn.trim() ? { text: nameEn.trim(), sourceLocale: 'en' as const } : null;
    if (!source) return;
    try {
      const res = await translate.mutateAsync(source);
      if (!nameEn.trim()) setNameEn(res.nameEn);
      if (!nameAr.trim()) setNameAr(res.nameAr);
      if (!nameHe.trim()) setNameHe(res.nameHe);
    } catch (err) {
      toast.error(mutationErrorMessage(err));
    }
  }

  const cats = categories.data ?? [];
  const rows = products.data?.data ?? [];
  const meta = products.data?.meta;
  const pulseData = pulse.data;

  const columns: DataColumn<ProductRow>[] = [
    {
      key: 'name',
      header: t('product'),
      cell: (p) => (
        <span className="flex items-center gap-3">
          <RowThumb src={p.imageUrl} icon={<Armchair className="h-4 w-4" />} />
          <span className="min-w-0">
            <span className="block truncate font-semibold text-[var(--maher-text-primary)]">{localizedName(copy.locale, p)}</span>
            <Ltr className="block text-[12px] text-[var(--maher-text-tertiary)]">{p.sku}</Ltr>
          </span>
        </span>
      ),
    },
    { key: 'category', header: t('category'), hideBelow: 'md', cell: (p) => (p.category ? localizedName(copy.locale, p.category) : '—') },
    {
      key: 'status',
      header: tCommon('status'),
      hideBelow: 'lg',
      cell: (p) => (
        <Stamp tone={p.isActive ? 'success' : 'neutral'} size="sm">
          {p.isActive ? t('active') : t('inactive' as never)}
        </Stamp>
      ),
    },
    { key: 'price', header: t('basePrice'), numeric: true, cell: (p) => copy.money(p.basePrice) },
    { key: 'cost', header: tSales('productionPrice'), numeric: true, hideBelow: 'lg', cell: (p) => copy.money(p.productionCost ?? p.manufacturingCost) },
    {
      key: 'margin',
      header: tSales('profit'),
      numeric: true,
      hideBelow: 'xl',
      cell: (p) => {
        const m = copy.margin(p.basePrice, p.productionCost ?? p.manufacturingCost);
        return m == null ? '—' : <span style={{ color: m < 0 ? 'var(--maher-error)' : m < 20 ? 'var(--maher-warning)' : 'var(--maher-success)' }}>{m}%</span>;
      },
    },
  ];

  return (
    <div className="maher-stagger space-y-5">
      <Board tone="brand" wash="top" as="section">
        <div className="grid gap-5 px-5 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:items-center">
          <div className="min-w-0">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-[24px] font-semibold leading-8 tracking-[-0.02em] text-[var(--maher-text-primary)] sm:text-[28px] sm:leading-9 rtl:tracking-normal">{t('products')}</h1>
                <p className="mt-1 max-w-[56ch] text-[14px] leading-5 text-[var(--maher-text-secondary)]">{t('productsShopHint')}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  variant="secondary"
                  leadingIcon={<Plus className="h-4 w-4" />}
                  onClick={() => {
                    setFormError(null);
                    setSectionOpen(true);
                  }}
                >
                  {t('addSection')}
                </Button>
                <Button
                  leadingIcon={<Plus className="h-4 w-4" />}
                  onClick={() => {
                    setFormError(null);
                    setCategoryId(params.categoryId || null);
                    setProductOpen(true);
                  }}
                >
                  {t('addProduct')}
                </Button>
              </div>
            </div>
          </div>
          <div className="min-w-0">
            {pulseData && cats.length ? (
              <Ribbon
                size="sm"
                segments={cats.map((c, i) => ({ key: c.id, label: localizedName(copy.locale, c), value: pulseData.byCategory.get(c.id) ?? 0, tone: (['brand', 'info', 'success', 'warning', 'neutral'] as const)[i % 5] }))}
              />
            ) : null}
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
              <Figure size="sm" value={pulseData?.total ?? 0} label={t('products')} />
              <Figure size="sm" value={cats.length} label={tSales('desk.sections')} tone="neutral" />
              <Figure size="sm" value={pulseData?.inactive ?? 0} label={t('inactive' as never)} tone={pulseData?.inactive ? 'warning' : 'neutral'} />
              <Figure size="sm" value={pulseData ? `${Math.round((pulseData.costed / Math.max(1, pulseData.sample)) * 100)}%` : '—'} label={tSales('desk.costed')} tone={pulseData && pulseData.costed < pulseData.sample ? 'warning' : 'success'} locale={copy.locale} />
            </div>
          </div>
        </div>
      </Board>

      <ListToolbar
        copy={kit.toolbar}
        search={{ value: params.q, onChange: (q) => set({ q }, { replace: true }), placeholder: t('searchProducts') }}
        actions={
          <>
            <SegmentedControl
              size="sm"
              aria-label={tCommon('view' as never)}
              value={params.active || 'all'}
              onChange={(v) => set({ active: v === 'all' ? '' : (v as 'true' | 'false') })}
              options={[
                { value: 'all', label: tCommon('all') },
                { value: 'true', label: t('active') },
                { value: 'false', label: t('inactive' as never) },
              ]}
            />
            <SegmentedControl
              size="sm"
              aria-label={tCommon('view' as never)}
              value={params.view}
              onChange={(view) => set({ view }, { replace: true })}
              options={[
                { value: 'grid', label: <LayoutGrid className="h-4 w-4" /> },
                { value: 'list', label: <List className="h-4 w-4" /> },
              ]}
            />
          </>
        }
      >
        <StatusChips
          aria-label={t('category')}
          value={params.categoryId || 'all'}
          onChange={(id) => set({ categoryId: id === 'all' ? '' : id })}
          items={[{ id: 'all', label: t('allSections'), count: pulseData?.total ?? null }, ...cats.map((c) => ({ id: c.id, label: localizedName(copy.locale, c), count: pulseData?.byCategory.get(c.id) ?? null }))]}
        />
      </ListToolbar>

      {products.isError && !products.data ? (
        <ErrorBoard title={tCommon('loadFailed')} description={mutationErrorMessage(products.error)} onRetry={() => products.refetch()} />
      ) : params.view === 'list' ? (
        <DataBoard<ProductRow>
          aria-label={t('products')}
          columns={columns}
          rows={rows}
          rowKey={(p) => p.id}
          rowHref={(p) => `/admin/products/${p.id}`}
          LinkComponent={Link}
          loading={products.isLoading && !products.data}
          mobileRow={(p) => ({
            leading: <RowThumb src={p.imageUrl} icon={<Armchair className="h-4 w-4" />} />,
            title: localizedName(copy.locale, p),
            meta: `${p.sku}${p.category ? ` · ${localizedName(copy.locale, p.category)}` : ''}`,
            trailing: <span>{copy.money(p.basePrice)}</span>,
          })}
          empty={<ProductsEmpty filtered={Boolean(params.q || activeCount)} onReset={reset} onCreate={() => setProductOpen(true)} />}
          footer={meta && meta.totalPages > 1 ? <Pagination className="w-full" page={params.page} pageSize={params.pageSize} total={meta.totalItems} onPageChange={(page) => set({ page })} copy={kit.pagination} /> : null}
        />
      ) : products.isLoading && !products.data ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <BoardSkeleton key={i} header={false} rows={2} bodyClassName="pt-28" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <Board tone="neutral">
          <ProductsEmpty filtered={Boolean(params.q || activeCount)} onReset={reset} onCreate={() => setProductOpen(true)} />
        </Board>
      ) : (
        <>
          <div className={`maher-stagger grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 ${products.isFetching ? 'opacity-80 transition-opacity' : ''}`}>
            {rows.map((p) => {
              const title = localizedName(copy.locale, p);
              const sell = Number(p.basePrice);
              const cost = Number(p.productionCost ?? p.manufacturingCost);
              const m = copy.margin(p.basePrice, p.productionCost ?? p.manufacturingCost);
              return (
                <Board key={p.id} as="article" href={`/admin/products/${p.id}`} LinkComponent={Link} tone={p.isActive ? 'brand' : 'neutral'} className="h-full">
                  <div className="relative aspect-[5/4] w-full overflow-hidden bg-[var(--maher-surface-muted)]">
                    {p.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.imageUrl} alt={title} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" loading="lazy" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[var(--maher-text-tertiary)]">
                        <Armchair className="h-8 w-8 opacity-40" />
                      </div>
                    )}
                    {!p.isActive ? (
                      <Stamp tone="neutral" size="sm" className="absolute start-2 top-2 bg-[var(--maher-surface)]">
                        {t('inactive' as never)}
                      </Stamp>
                    ) : null}
                  </div>
                  <div className="flex flex-1 flex-col gap-1.5 px-3 pb-3 pt-2.5">
                    <p className="line-clamp-2 text-[14px] font-semibold leading-5 text-[var(--maher-text-primary)]">{title}</p>
                    <p className="truncate text-[12px] leading-4 text-[var(--maher-text-secondary)]">
                      {p.category ? localizedName(copy.locale, p.category) : <Ltr>{p.sku}</Ltr>}
                    </p>
                    <div className="mt-auto flex items-end justify-between gap-2 border-t border-[var(--maher-border)] pt-2">
                      <span className="min-w-0">
                        <span className="block text-[11px] leading-4 text-[var(--maher-text-tertiary)]">{t('basePrice')}</span>
                        <Ltr className="block text-[15px] font-semibold leading-5 text-[var(--maher-text-primary)]">{copy.money(p.basePrice)}</Ltr>
                      </span>
                      {Number.isFinite(sell) && Number.isFinite(cost) && sell > 0 ? (
                        <span className="w-16">
                          <Meter value={Math.min(cost, sell)} max={sell} size="sm" showValue={false} tone={m != null && m < 0 ? 'error' : m != null && m < 20 ? 'warning' : 'success'} />
                          <span className="mt-0.5 block text-end text-[11px] leading-4 text-[var(--maher-text-tertiary)]" dir="ltr">
                            {m}%
                          </span>
                        </span>
                      ) : null}
                    </div>
                  </div>
                </Board>
              );
            })}
          </div>
          {meta && meta.totalPages > 1 ? <Pagination page={params.page} pageSize={params.pageSize} total={meta.totalItems} onPageChange={(page) => set({ page })} copy={kit.pagination} /> : null}
        </>
      )}

      <Sheet
        open={sectionOpen}
        onClose={() => setSectionOpen(false)}
        title={t('addSection')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setSectionOpen(false)}>
              {tCommon('cancel')}
            </Button>
            <Button loading={createSection.isPending} onClick={() => createSection.mutate()}>
              {tCommon('save')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {formError ? <Alert variant="error">{formError}</Alert> : null}
          <Input label={t('code')} value={sectionCode} onChange={(e) => setSectionCode(e.target.value)} dir="ltr" />
          <Input label={t('nameEn')} value={sectionNameEn} onChange={(e) => setSectionNameEn(e.target.value)} />
          <Input label={t('nameAr')} value={sectionNameAr} onChange={(e) => setSectionNameAr(e.target.value)} dir="rtl" />
        </div>
      </Sheet>

      <Sheet
        open={productOpen}
        onClose={() => setProductOpen(false)}
        title={t('addProduct')}
        widthClassName="max-w-xl"
        footer={
          <>
            <Button variant="ghost" onClick={() => setProductOpen(false)}>
              {tCommon('cancel')}
            </Button>
            <Button loading={createProduct.isPending} onClick={() => createProduct.mutate()}>
              {tCommon('save')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {formError ? <Alert variant="error">{formError}</Alert> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label={t('nameAr')} value={nameAr} onChange={(e) => setNameAr(e.target.value)} dir="rtl" />
            <Input label={t('nameEn')} value={nameEn} onChange={(e) => setNameEn(e.target.value)} dir="ltr" />
            <Input label={t('nameHe' as never)} value={nameHe} onChange={(e) => setNameHe(e.target.value)} dir="rtl" />
            <div className="flex items-end">
              <Button variant="secondary" size="sm" leadingIcon={<Sparkles className="h-4 w-4" />} loading={translate.isPending} disabled={!nameAr.trim() && !nameEn.trim()} onClick={() => void suggestNames()}>
                {tSales('desk.suggestNames')}
              </Button>
            </div>
          </div>
          <Combobox
            label={t('category')}
            value={categoryId}
            onChange={(id) => setCategoryId(id)}
            options={cats.map((c) => ({ value: c.id, label: localizedName(copy.locale, c), description: c.code }))}
            placeholder={t('select')}
            emptyText={kit.combobox.empty}
            clearLabel={kit.combobox.clear}
          />
          <MoneyField label={t('basePrice')} currency="ILS" value={basePrice} onChange={setBasePrice} min={0} />
          <ImageSourceField
            label={t('changeProductPhoto')}
            value={photos[0] ?? ''}
            onChange={(url) => setPhotos(url ? [url] : [])}
            hint={t('imageUrlHint')}
            uploadLabel={tCommon('uploadFromDevice')}
            uploadingLabel={tCommon('uploading')}
            allowUrl={false}
            multiple
            showPreview={Boolean(photos[0])}
            onUploadFiles={async (files) => {
              const uploaded: string[] = [];
              for (const file of files) {
                const form = new FormData();
                form.append('file', file);
                const res = await apiUpload<{ downloadPath: string }>('/api/v1/uploads?category=PRODUCT_IMAGE', form);
                uploaded.push(`${API_URL}${res.downloadPath}`);
              }
              setPhotos((prev) => {
                const next = [...prev];
                for (const u of uploaded) if (!next.includes(u)) next.push(u);
                return next;
              });
            }}
          />
          {photos.length > 1 ? (
            <div className="flex flex-wrap gap-2">
              {photos.map((url, i) => (
                <button key={`${url}-${i}`} type="button" className="maher-press relative h-16 w-16 overflow-hidden rounded-[10px] border border-[var(--maher-border)]" onClick={() => setPhotos((prev) => prev.filter((_, idx) => idx !== i))} title={t('removeProductPhoto')}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </Sheet>
    </div>
  );
}

function ProductsEmpty({ filtered, onReset, onCreate }: { filtered: boolean; onReset: () => void; onCreate: () => void }) {
  const t = useTranslations('catalog');
  const tSales = useTranslations('sales');
  const tCommon = useTranslations('common');
  return (
    <Board.Empty
      title={filtered ? tSales('desk.emptyFilteredTitle') : t('noProducts')}
      description={filtered ? tSales('desk.emptyFilteredBody') : t('productsShopHint')}
      action={
        filtered ? (
          <Button size="sm" variant="secondary" onClick={onReset}>
            {tCommon('clearFilters')}
          </Button>
        ) : (
          <Button size="sm" onClick={onCreate}>
            {t('addProduct')}
          </Button>
        )
      }
    />
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<div className="maher-board h-64 animate-pulse rounded-[18px] bg-[var(--maher-surface)]" />}>
      <ProductsPageInner />
    </Suspense>
  );
}
