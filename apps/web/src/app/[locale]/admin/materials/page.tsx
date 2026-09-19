'use client';

import { MasterCrudPage } from '@/components/admin/master-crud-page';
import { apiFetch } from '@/lib/api-client';
import { localizedName } from '@maher/i18n';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';

interface Material {
  id: string;
  sku: string;
  nameAr: string;
  nameEn: string;
  category: string;
  color?: string | null;
  minStock: string | number;
  isActive: boolean;
}

interface ColorRef {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
}

const CATEGORIES = [
  'WOOD',
  'FABRIC',
  'FOAM',
  'PAINT',
  'ADHESIVE',
  'METAL_ACCESSORY',
  'DECORATIVE_ACCESSORY',
  'PACKAGING',
  'SEMI_FINISHED',
  'FINISHED',
  'OTHER',
] as const;

export default function MaterialsPage() {
  const t = useTranslations('catalog');
  const tCommon = useTranslations('common');
  const locale = useLocale();

  const colorsQuery = useQuery({
    queryKey: ['colors-pick'],
    queryFn: () =>
      apiFetch<{ data: ColorRef[] }>('/api/v1/colors?pageSize=100').then((r) => r.data),
  });

  const categoryLabel = (code: string) => {
    try {
      return t(`materialCategories.${code}` as 'materialCategories.WOOD');
    } catch {
      return code;
    }
  };

  const colorOptions = [
    { value: '', label: t('noneOption') },
    ...(colorsQuery.data ?? []).map((c) => ({
      value: c.code,
      label: `${c.code} — ${localizedName(locale, c)}`,
    })),
  ];

  return (
    <MasterCrudPage<Material>
      title={t('materials')}
      queryKey="materials"
      listPath="/api/v1/materials"
      createPath="/api/v1/materials"
      patchPath={(id) => `/api/v1/materials/${id}`}
      activatePath={(id) => `/api/v1/materials/${id}/activate`}
      deactivatePath={(id) => `/api/v1/materials/${id}/deactivate`}
      emptyTitle={t('noMaterials')}
      activeField="isActive"
      columns={[
        { key: 'sku', header: t('sku'), render: (r) => <span dir="ltr">{r.sku}</span> },
        { key: 'name', header: t('name'), render: (r) => localizedName(locale, r) },
        { key: 'category', header: t('category'), render: (r) => categoryLabel(r.category) },
        { key: 'color', header: t('color'), render: (r) => r.color ?? '—' },
        {
          key: 'min',
          header: t('minStock'),
          render: (r) => <span dir="ltr">{String(r.minStock)}</span>,
        },
        {
          key: 'active',
          header: t('active'),
          render: (r) => (r.isActive ? tCommon('yes') : tCommon('no')),
        },
      ]}
      fields={[
        { name: 'sku', label: t('sku'), required: true },
        { name: 'nameEn', label: t('nameEn'), required: true },
        { name: 'nameAr', label: t('nameAr'), required: true },
        {
          name: 'category',
          label: t('category'),
          type: 'select',
          options: CATEGORIES.map((c) => ({ value: c, label: categoryLabel(c) })),
        },
        {
          name: 'color',
          label: t('color'),
          type: 'select',
          options: colorOptions,
        },
        { name: 'minStock', label: t('minStock'), type: 'number' },
        { name: 'isActive', label: t('active'), type: 'checkbox' },
      ]}
      mapRowToForm={(r) => ({
        sku: r.sku,
        nameEn: r.nameEn,
        nameAr: r.nameAr,
        category: r.category,
        color: r.color ?? '',
        minStock: Number(r.minStock),
        isActive: r.isActive,
      })}
      buildPayload={(form) => ({
        sku: String(form.sku).trim(),
        nameEn: String(form.nameEn).trim(),
        nameAr: String(form.nameAr).trim(),
        category: String(form.category || 'OTHER'),
        unit: 'pcs',
        color: String(form.color ?? '').trim() || undefined,
        minStock: Number(form.minStock),
        isActive: Boolean(form.isActive),
      })}
    />
  );
}
