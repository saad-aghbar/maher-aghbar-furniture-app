'use client';

import { Link } from '@/i18n/navigation';
import { apiFetch, apiUpload, API_URL, ApiClientError } from '@/lib/api-client';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import { localizedName } from '@maher/i18n';
import {
  Alert,
  Button,
  EmptyState,
  ErrorState,
  ImageSourceField,
  Input,
  Modal,
  PageHero,
  Select,
  Skeleton,
  StatusBadge,
} from '@maher/ui';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Armchair, Plus } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

interface Category {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  nameHe?: string | null;
}

interface Product {
  id: string;
  sku: string;
  nameAr: string;
  nameEn: string;
  nameHe?: string | null;
  isActive: boolean;
  basePrice?: string | number | null;
  manufacturingCost?: string | number | null;
  productionCost?: string | number | null;
  imageUrl?: string | null;
  categoryId?: string | null;
  category?: Category | null;
}

export default function ProductsPage() {
  const t = useTranslations('catalog');
  const tCommon = useTranslations('common');
  const tSales = useTranslations('sales');
  const locale = useLocale();
  const qc = useQueryClient();

  const [sectionId, setSectionId] = useState<string>('all');
  const [q, setQ] = useState('');
  const [banner, setBanner] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [sectionOpen, setSectionOpen] = useState(false);
  const [sectionCode, setSectionCode] = useState('');
  const [sectionNameEn, setSectionNameEn] = useState('');
  const [sectionNameAr, setSectionNameAr] = useState('');

  const [productOpen, setProductOpen] = useState(false);
  const [sku, setSku] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [basePrice, setBasePrice] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  const categoriesQuery = useQuery({
    queryKey: ['product-categories'],
    queryFn: () =>
      apiFetch<{ data: Category[] }>('/api/v1/product-categories?pageSize=100').then((r) => r.data),
  });

  const listParams = useMemo(() => {
    const params = new URLSearchParams({ pageSize: '100' });
    if (q.trim()) params.set('q', q.trim());
    if (sectionId !== 'all') params.set('categoryId', sectionId);
    return params.toString();
  }, [q, sectionId]);

  const productsQuery = useQuery({
    queryKey: ['products', listParams],
    queryFn: () =>
      apiFetch<{ data: Product[] }>(`/api/v1/products?${listParams}`).then((r) => r.data),
    placeholderData: keepPreviousData,
  });

  const createSectionMutation = useMutation({
    mutationFn: async () => {
      if (!sectionCode.trim() || !sectionNameEn.trim() || !sectionNameAr.trim()) {
        throw new ApiClientError(t('codeAndNamesRequired'), 400);
      }
      return apiFetch('/api/v1/product-categories', {
        method: 'POST',
        body: JSON.stringify({
          code: sectionCode.trim().toUpperCase().replace(/\s+/g, '_'),
          nameEn: sectionNameEn.trim(),
          nameAr: sectionNameAr.trim(),
        }),
      });
    },
    onSuccess: async () => {
      setSectionOpen(false);
      setSectionCode('');
      setSectionNameEn('');
      setSectionNameAr('');
      setBanner(t('sectionCreated'));
      setFormError(null);
      await qc.invalidateQueries({ queryKey: ['product-categories'] });
    },
    onError: (err) => setFormError(mutationErrorMessage(err)),
  });

  const createProductMutation = useMutation({
    mutationFn: async () => {
      if (!sku.trim() || !nameEn.trim() || !nameAr.trim()) {
        throw new ApiClientError(t('namesRequired'), 400);
      }
      return apiFetch<Product>('/api/v1/products', {
        method: 'POST',
        body: JSON.stringify({
          sku: sku.trim(),
          nameEn: nameEn.trim(),
          nameAr: nameAr.trim(),
          categoryId: categoryId || null,
          basePrice: basePrice ? Number(basePrice) : undefined,
          imageUrl: imageUrl.trim() || undefined,
          unit: 'pcs',
          isActive: true,
        }),
      });
    },
    onSuccess: async () => {
      setProductOpen(false);
      setSku('');
      setNameEn('');
      setNameAr('');
      setCategoryId('');
      setBasePrice('');
      setImageUrl('');
      setBanner(t('productCreated'));
      setFormError(null);
      await qc.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (err) => setFormError(mutationErrorMessage(err)),
  });

  const categories = categoriesQuery.data ?? [];
  const products = productsQuery.data ?? [];

  return (
    <div className="space-y-6">
      <PageHero
        title={t('products')}
        description={t('productsShopHint')}
        tone="soft"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
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
              size="sm"
              leadingIcon={<Plus className="h-4 w-4" />}
              onClick={() => {
                setFormError(null);
                setCategoryId(sectionId !== 'all' ? sectionId : '');
                setProductOpen(true);
              }}
            >
              {t('addProduct')}
            </Button>
          </div>
        }
      />

      {banner ? <Alert variant="success">{banner}</Alert> : null}
      {productsQuery.isError ? (
        <ErrorState title={tCommon('error')} description={mutationErrorMessage(productsQuery.error)} />
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setSectionId('all')}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
            sectionId === 'all'
              ? 'bg-brand text-white'
              : 'bg-[var(--maher-surface-muted)] text-text-secondary hover:text-text-primary'
          }`}
        >
          {t('allSections')}
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

      <label className="relative block max-w-md">
        <Input
        withSearchIcon
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('searchProducts')}
        />
      </label>

      {(productsQuery.isLoading && !productsQuery.data) || categoriesQuery.isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[5/4] rounded-xl" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <EmptyState title={t('noProducts')} description={t('productsShopHint')} />
      ) : (
        <div className={`maher-stagger grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 ${productsQuery.isFetching ? 'opacity-70 transition-opacity' : ''}`}>
          {products.map((product) => {
            const title = localizedName(locale, product);
            const sell = Number(product.basePrice ?? NaN);
            const prod = Number(product.productionCost ?? product.manufacturingCost ?? NaN);
            return (
              <article
                key={product.id}
                className="maher-list-card group flex flex-col overflow-hidden rounded-xl border border-border bg-surface transition hover:border-brand/40 hover:shadow-sm"
              >
                <Link
                  href={`/products/${product.id}`}
                  className="relative block aspect-[5/4] overflow-hidden bg-[var(--maher-surface-muted)]"
                >
                  {product.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={product.imageUrl}
                      alt={title}
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-text-tertiary">
                      <Armchair className="h-7 w-7 opacity-40" />
                      <span className="text-[10px] font-medium uppercase tracking-wide" dir="ltr">
                        {product.sku}
                      </span>
                    </div>
                  )}
                  <div className="absolute start-1.5 top-1.5 origin-top-start scale-90">
                    <StatusBadge
                      status={product.isActive ? 'ACTIVE' : 'INACTIVE'}
                      label={product.isActive ? t('active') : tCommon('no')}
                    />
                  </div>
                </Link>
                <div className="flex flex-1 flex-col gap-1.5 p-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary" dir="ltr">
                    {product.sku}
                  </p>
                  <Link
                    href={`/products/${product.id}`}
                    className="line-clamp-2 text-sm font-semibold leading-snug text-text-primary hover:text-brand"
                  >
                    {title}
                  </Link>
                  {product.category ? (
                    <p className="truncate text-xs text-text-secondary">
                      {localizedName(locale, product.category)}
                    </p>
                  ) : null}
                  <div className="mt-auto space-y-0.5 border-t border-border/60 pt-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[10px] text-text-tertiary">{t('basePrice')}</span>
                      <span className="text-sm font-bold tracking-tight text-text-primary" dir="ltr">
                        {Number.isFinite(sell) ? `${sell.toFixed(2)} ${tCommon('currency')}` : '—'}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[10px] text-text-tertiary">{tSales('productionPrice')}</span>
                      <span className="text-xs font-semibold text-text-secondary" dir="ltr">
                        {Number.isFinite(prod) ? `${prod.toFixed(2)} ${tCommon('currency')}` : '—'}
                      </span>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Modal
        open={sectionOpen}
        onClose={() => setSectionOpen(false)}
        title={t('addSection')}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setSectionOpen(false)}>
              {tCommon('cancel')}
            </Button>
            <Button
              loading={createSectionMutation.isPending}
              onClick={() => createSectionMutation.mutate()}
            >
              {tCommon('save')}
            </Button>
          </div>
        }
      >
        <div className="maher-form-section space-y-3">
          {formError ? <Alert variant="error">{formError}</Alert> : null}
          <Input label={t('code')} value={sectionCode} onChange={(e) => setSectionCode(e.target.value)} />
          <Input
            label={t('nameEn')}
            value={sectionNameEn}
            onChange={(e) => setSectionNameEn(e.target.value)}
          />
          <Input
            label={t('nameAr')}
            value={sectionNameAr}
            onChange={(e) => setSectionNameAr(e.target.value)}
          />
        </div>
      </Modal>

      <Modal
        open={productOpen}
        onClose={() => setProductOpen(false)}
        title={t('addProduct')}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setProductOpen(false)}>
              {tCommon('cancel')}
            </Button>
            <Button
              loading={createProductMutation.isPending}
              onClick={() => createProductMutation.mutate()}
            >
              {tCommon('save')}
            </Button>
          </div>
        }
      >
        <div className="maher-form-section space-y-3">
          {formError ? <Alert variant="error">{formError}</Alert> : null}
          <Input label={t('sku')} value={sku} onChange={(e) => setSku(e.target.value)} dir="ltr" />
          <Input label={t('nameEn')} value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
          <Input label={t('nameAr')} value={nameAr} onChange={(e) => setNameAr(e.target.value)} />
          <Select
            label={t('category')}
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            options={[
              { value: '', label: t('select') },
              ...categories.map((c) => ({
                value: c.id,
                label: localizedName(locale, c),
              })),
            ]}
          />
          <Input
            label={t('basePrice')}
            type="number"
            value={basePrice}
            onChange={(e) => setBasePrice(e.target.value)}
            dir="ltr"
          />
          <ImageSourceField
            label={t('imageUrl')}
            value={imageUrl}
            onChange={setImageUrl}
            hint={t('imageUrlHint')}
            uploadLabel={tCommon('uploadFromDevice')}
            uploadingLabel={tCommon('uploading')}
            urlPlaceholder="https://…"
            showPreview={Boolean(imageUrl.trim())}
            onUploadFile={async (file) => {
              const form = new FormData();
              form.append('file', file);
              const res = await apiUpload<{ downloadPath: string }>(
                '/api/v1/uploads?category=PRODUCT_IMAGE',
                form,
              );
              return `${API_URL}${res.downloadPath}`;
            }}
          />
        </div>
      </Modal>
    </div>
  );
}
