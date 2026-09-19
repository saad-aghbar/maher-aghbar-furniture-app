'use client';

import { MasterCrudPage } from '@/components/admin/master-crud-page';
import { apiFetch } from '@/lib/api-client';
import { localizedName } from '@maher/i18n';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';

interface SpecOptionGroup {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  nameHe?: string | null;
}

interface SpecOptionValue {
  id: string;
  groupId: string;
  code: string;
  nameAr: string;
  nameEn: string;
  nameHe?: string | null;
  hex?: string | null;
  numericValue?: string | number | null;
  unit?: string | null;
  colorReferenceId?: string | null;
  inventoryItemId?: string | null;
  isActive: boolean;
  sortOrder: number;
}

interface ColorRef {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
}

interface InventoryItem {
  id: string;
  sku: string;
  nameAr: string;
  nameEn: string;
}

export default function SpecOptionValuesPage() {
  const t = useTranslations('catalog');
  const tCommon = useTranslations('common');
  const locale = useLocale();

  const groupsQuery = useQuery({
    queryKey: ['spec-option-groups-pick'],
    queryFn: () =>
      apiFetch<{ data: SpecOptionGroup[] }>(
        '/api/v1/spec-option-groups?includeInactive=true&pageSize=100',
      ).then((r) => r.data),
  });

  const colorsQuery = useQuery({
    queryKey: ['colors-pick'],
    queryFn: () =>
      apiFetch<{ data: ColorRef[] }>('/api/v1/colors?pageSize=100').then((r) => r.data),
  });

  const itemsQuery = useQuery({
    queryKey: ['inventory-items-pick-spec'],
    queryFn: () =>
      apiFetch<{ data: InventoryItem[] }>('/api/v1/inventory/items?pageSize=100').then((r) => r.data),
  });

  const groupOptions = (groupsQuery.data ?? []).map((g) => ({
    value: g.id,
    label: `${g.code} — ${localizedName(locale, g)}`,
  }));

  const colorOptions = [
    { value: '', label: t('noneOption') },
    ...(colorsQuery.data ?? []).map((c) => ({
      value: c.id,
      label: `${c.code} — ${localizedName(locale, c)}`,
    })),
  ];

  const itemOptions = [
    { value: '', label: t('noneOption') },
    ...(itemsQuery.data ?? []).map((i) => ({
      value: i.id,
      label: `${i.sku} — ${localizedName(locale, i)}`,
    })),
  ];

  const groupLabel = (groupId: string) =>
    groupOptions.find((g) => g.value === groupId)?.label ?? groupId;

  return (
    <MasterCrudPage<SpecOptionValue>
      title={t('specOptionValues')}
      queryKey="spec-option-values"
      listPath="/api/v1/spec-option-values?includeInactive=true"
      createPath="/api/v1/spec-option-values"
      patchPath={(id) => `/api/v1/spec-option-values/${id}`}
      activatePath={(id) => `/api/v1/spec-option-values/${id}/activate`}
      deactivatePath={(id) => `/api/v1/spec-option-values/${id}/deactivate`}
      emptyTitle={t('noSpecOptionValues')}
      activeField="isActive"
      columns={[
        { key: 'code', header: t('code'), render: (r) => <span dir="ltr">{r.code}</span> },
        { key: 'name', header: t('name'), render: (r) => localizedName(locale, r) },
        { key: 'group', header: t('specOptionGroups'), render: (r) => groupLabel(r.groupId) },
        { key: 'hex', header: t('hex'), render: (r) => r.hex ?? '—' },
        {
          key: 'active',
          header: t('active'),
          render: (r) => (r.isActive ? tCommon('yes') : tCommon('no')),
        },
      ]}
      fields={[
        {
          name: 'groupId',
          label: t('specOptionGroups'),
          type: 'select',
          required: true,
          options: groupOptions,
        },
        { name: 'code', label: t('code'), required: true },
        { name: 'nameEn', label: t('nameEn'), required: true },
        { name: 'nameAr', label: t('nameAr'), required: true },
        { name: 'nameHe', label: t('nameHe') },
        { name: 'hex', label: t('hex') },
        { name: 'numericValue', label: t('numericValue'), type: 'number' },
        { name: 'unit', label: t('unit') },
        {
          name: 'colorReferenceId',
          label: t('colorReference'),
          type: 'select',
          options: colorOptions,
        },
        {
          name: 'inventoryItemId',
          label: t('inventoryItem'),
          type: 'select',
          options: itemOptions,
        },
        { name: 'sortOrder', label: t('sortOrder'), type: 'number' },
        { name: 'isActive', label: t('active'), type: 'checkbox' },
      ]}
      mapRowToForm={(r) => ({
        groupId: r.groupId,
        code: r.code,
        nameEn: r.nameEn,
        nameAr: r.nameAr,
        nameHe: r.nameHe ?? '',
        hex: r.hex ?? '',
        numericValue: r.numericValue == null ? 0 : Number(r.numericValue),
        unit: r.unit ?? '',
        colorReferenceId: r.colorReferenceId ?? '',
        inventoryItemId: r.inventoryItemId ?? '',
        sortOrder: r.sortOrder,
        isActive: r.isActive,
      })}
      buildPayload={(form) => ({
        groupId: String(form.groupId),
        code: String(form.code).trim(),
        nameEn: String(form.nameEn).trim(),
        nameAr: String(form.nameAr).trim(),
        nameHe: String(form.nameHe ?? '').trim() || undefined,
        hex: String(form.hex ?? '').trim() || undefined,
        numericValue: Number(form.numericValue) || undefined,
        unit: String(form.unit ?? '').trim() || undefined,
        colorReferenceId: String(form.colorReferenceId ?? '').trim() || null,
        inventoryItemId: String(form.inventoryItemId ?? '').trim() || null,
        sortOrder: Number(form.sortOrder) || 0,
        isActive: Boolean(form.isActive),
      })}
    />
  );
}
