'use client';

import { MasterCrudPage } from '@/components/admin/master-crud-page';
import { apiFetch } from '@/lib/api-client';
import { localizedName } from '@maher/i18n';
import { Button, StatusBadge } from '@maher/ui';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';

interface Product {
  id: string;
  sku: string;
  nameAr: string;
  nameEn: string;
  unit: string;
  isActive: boolean;
  basePrice?: string | number | null;
  categoryId?: string | null;
  category?: { id: string; nameAr: string; nameEn: string; code: string } | null;
  description?: string | null;
}

interface Category {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
}

interface Unit {
  id: string;
  code: string;
  nameEn: string;
  nameAr: string;
}

export default function ProductsPage() {
  const t = useTranslations('catalog');
  const tCommon = useTranslations('common');
  const locale = useLocale();

  const categoriesQuery = useQuery({
    queryKey: ['product-categories-pick'],
    queryFn: () =>
      apiFetch<{ data: Category[] }>('/api/v1/product-categories?pageSize=100').then((r) => r.data),
  });

  const unitsQuery = useQuery({
    queryKey: ['units-pick'],
    queryFn: () =>
      apiFetch<{ data: Unit[] }>('/api/v1/units').then((r) => r.data),
  });

  const categoryOptions = [
    { value: '', label: t('select') },
    ...(categoriesQuery.data ?? []).map((c) => ({
      value: c.id,
      label: localizedName(locale, c),
    })),
  ];

  const unitOptions = (unitsQuery.data ?? []).map((u) => ({
    value: u.code,
    label: `${u.code} — ${localizedName(locale, u)}`,
  }));

  return (
    <MasterCrudPage<Product>
      title={t('products')}
      queryKey="products"
      listPath="/api/v1/products"
      createPath="/api/v1/products"
      patchPath={(id) => `/api/v1/products/${id}`}
      activatePath={(id) => `/api/v1/products/${id}/activate`}
      deactivatePath={(id) => `/api/v1/products/${id}/deactivate`}
      deletePath={(id) => `/api/v1/products/${id}`}
      emptyTitle={t('noProducts')}
      activeField="isActive"
      columns={[
        { key: 'sku', header: t('sku'), render: (r) => <span dir="ltr">{r.sku}</span> },
        { key: 'name', header: t('name'), render: (r) => localizedName(locale, r) },
        {
          key: 'category',
          header: t('category'),
          render: (r) => (r.category ? localizedName(locale, r.category) : '—'),
        },
        { key: 'unit', header: t('unit'), render: (r) => r.unit },
        {
          key: 'price',
          header: t('price'),
          render: (r) =>
            r.basePrice != null ? <span dir="ltr">{String(r.basePrice)}</span> : '—',
        },
        {
          key: 'active',
          header: t('active'),
          render: (r) => (
            <StatusBadge
              status={r.isActive ? 'ACTIVE' : 'INACTIVE'}
              label={r.isActive ? tCommon('yes') : tCommon('no')}
            />
          ),
        },
      ]}
      fields={[
        { name: 'sku', label: t('sku'), required: true },
        { name: 'nameEn', label: t('nameEn'), required: true },
        { name: 'nameAr', label: t('nameAr'), required: true },
        {
          name: 'categoryId',
          label: t('category'),
          type: 'select',
          options: categoryOptions,
        },
        {
          name: 'unit',
          label: t('unit'),
          type: 'select',
          required: true,
          options:
            unitOptions.length > 0
              ? unitOptions
              : [{ value: 'pcs', label: 'pcs' }],
        },
        { name: 'basePrice', label: t('basePrice'), type: 'number' },
        { name: 'description', label: t('description') },
        { name: 'isActive', label: t('active'), type: 'checkbox' },
      ]}
      mapRowToForm={(r) => ({
        sku: r.sku,
        nameEn: r.nameEn,
        nameAr: r.nameAr,
        categoryId: r.categoryId ?? '',
        unit: r.unit,
        basePrice: Number(r.basePrice ?? 0),
        description: r.description ?? '',
        isActive: r.isActive,
      })}
      buildPayload={(form) => ({
        sku: String(form.sku).trim(),
        nameEn: String(form.nameEn).trim(),
        nameAr: String(form.nameAr).trim(),
        categoryId: String(form.categoryId || '').trim() || null,
        unit: String(form.unit).trim(),
        basePrice: Number(form.basePrice),
        description: String(form.description || '').trim() || undefined,
        isActive: Boolean(form.isActive),
      })}
      extraActions={(row, refresh) => (
        <Button
          size="sm"
          variant="ghost"
          onClick={async () => {
            await apiFetch(`/api/v1/products/${row.id}/duplicate`, { method: 'POST' });
            refresh();
          }}
        >
          {t('duplicate')}
        </Button>
      )}
    />
  );
}
