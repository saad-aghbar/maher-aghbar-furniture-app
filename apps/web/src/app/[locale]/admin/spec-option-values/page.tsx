'use client';

import { MasterCrudPage } from '@/components/admin/master-crud-page';
import { apiFetch } from '@/lib/api-client';
import { localizedName } from '@maher/i18n';
import { Ltr, Stamp } from '@maher/ui';
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
    label: localizedName(locale, g),
    description: g.code,
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
      description={t('specOptionValuesHint')}
      queryKey="spec-option-values"
      listPath="/api/v1/spec-option-values?includeInactive=true"
      createPath="/api/v1/spec-option-values"
      patchPath={(id) => `/api/v1/spec-option-values/${id}`}
      activatePath={(id) => `/api/v1/spec-option-values/${id}/activate`}
      deactivatePath={(id) => `/api/v1/spec-option-values/${id}/deactivate`}
      emptyTitle={t('noSpecOptionValues')}
      emptyDescription={t('specOptionValuesHint')}
      activeField="isActive"
      tone="info"
      chips={(groupsQuery.data ?? []).map((g) => ({ id: g.id, label: localizedName(locale, g), params: { groupId: g.id } }))}
      columns={[
        {
          key: 'swatch',
          header: '',
          width: '44px',
          render: (r) => <Swatch hex={r.hex} />,
        },
        { key: 'code', header: t('code'), width: '140px', render: (r) => <Ltr className="text-[var(--maher-text-tertiary)]">{r.code}</Ltr> },
        { key: 'name', header: t('name'), render: (r) => <span className="font-semibold text-[var(--maher-text-primary)]">{localizedName(locale, r)}</span> },
        { key: 'group', header: t('specOptionGroups'), hideBelow: 'md', render: (r) => <Stamp tone="info" size="sm">{groupLabel(r.groupId)}</Stamp> },
        { key: 'value', header: t('numericValue'), numeric: true, hideBelow: 'lg', render: (r) => (r.numericValue == null ? '—' : `${r.numericValue}${r.unit ? ` ${r.unit}` : ''}`) },
      ]}
      mobileRow={(r) => ({ leading: <Swatch hex={r.hex} />, title: localizedName(locale, r), meta: `${r.code} · ${groupLabel(r.groupId)}` })}
      fields={[
        { name: 'groupId', label: t('specOptionGroups'), type: 'select', required: true, options: groupOptions },
        { name: 'code', label: t('code'), required: true, dir: 'ltr', half: true },
        { name: 'hex', label: t('hex'), dir: 'ltr', half: true, hint: '#RRGGBB' },
        { name: 'nameAr', label: t('nameAr'), required: true, dir: 'rtl', half: true },
        { name: 'nameEn', label: t('nameEn'), required: true, dir: 'ltr', half: true },
        { name: 'nameHe', label: t('nameHe'), dir: 'rtl' },
        { name: 'numericValue', label: t('numericValue'), type: 'number', half: true },
        { name: 'unit', label: t('unit'), half: true },
        { name: 'colorReferenceId', label: t('colorReference'), type: 'select', options: colorOptions },
        { name: 'inventoryItemId', label: t('inventoryItem'), type: 'select', options: itemOptions },
        { name: 'sortOrder', label: t('sortOrder'), type: 'number', half: true },
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

function Swatch({ hex }: { hex?: string | null }) {
  const ok = hex && /^#?[0-9a-f]{6}$/i.test(hex);
  return (
    <span
      aria-hidden
      className="block h-7 w-7 rounded-[8px] border border-[var(--maher-border)]"
      style={ok ? { backgroundColor: hex.startsWith('#') ? hex : `#${hex}` } : { backgroundImage: 'repeating-linear-gradient(45deg, var(--maher-surface-muted) 0 4px, transparent 4px 8px)' }}
    />
  );
}
