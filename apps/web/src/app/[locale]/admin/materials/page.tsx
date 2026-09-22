'use client';

import { MasterCrudPage } from '@/components/admin/master-crud-page';
import { apiFetch } from '@/lib/api-client';
import { localizedName } from '@maher/i18n';
import { Ltr, Stamp } from '@maher/ui';
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
      description={t('materialsHint')}
      queryKey="materials"
      listPath="/api/v1/materials"
      createPath="/api/v1/materials"
      patchPath={(id) => `/api/v1/materials/${id}`}
      activatePath={(id) => `/api/v1/materials/${id}/activate`}
      deactivatePath={(id) => `/api/v1/materials/${id}/deactivate`}
      emptyTitle={t('noMaterials')}
      emptyDescription={t('materialsHint')}
      activeField="isActive"
      activeFilter
      chips={[
        { id: 'fabric', label: t('categoryFabric'), params: { categoryGroup: 'fabric' } },
        { id: 'foam', label: t('categoryFoam'), params: { categoryGroup: 'foam' } },
        { id: 'wood', label: t('categoryWood'), params: { categoryGroup: 'wood' } },
        { id: 'accessories', label: t('categoryAccessories'), params: { categoryGroup: 'accessories' } },
      ]}
      columns={[
        { key: 'sku', header: t('sku'), width: '140px', render: (r) => <Ltr className="text-[var(--maher-text-tertiary)]">{r.sku}</Ltr> },
        { key: 'name', header: t('name'), render: (r) => <span className="font-semibold text-[var(--maher-text-primary)]">{localizedName(locale, r)}</span> },
        { key: 'category', header: t('category'), hideBelow: 'md', render: (r) => <Stamp tone="neutral" size="sm">{categoryLabel(r.category)}</Stamp> },
        { key: 'color', header: t('color'), hideBelow: 'lg', render: (r) => r.color ?? '—' },
        { key: 'min', header: t('minStock'), numeric: true, hideBelow: 'lg', render: (r) => String(r.minStock) },
      ]}
      mobileRow={(r) => ({ title: localizedName(locale, r), meta: `${r.sku} · ${categoryLabel(r.category)}` })}
      fields={[
        { name: 'sku', label: t('sku'), required: true, dir: 'ltr', half: true },
        { name: 'category', label: t('category'), type: 'select', half: true, options: CATEGORIES.map((c) => ({ value: c, label: categoryLabel(c) })) },
        { name: 'nameAr', label: t('nameAr'), required: true, dir: 'rtl', half: true },
        { name: 'nameEn', label: t('nameEn'), required: true, dir: 'ltr', half: true },
        { name: 'color', label: t('color'), type: 'select', half: true, options: colorOptions },
        { name: 'minStock', label: t('minStock'), type: 'number', half: true },
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
