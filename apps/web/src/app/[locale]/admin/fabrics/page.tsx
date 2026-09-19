'use client';

import { MasterCrudPage } from '@/components/admin/master-crud-page';
import { apiFetch } from '@/lib/api-client';
import { localizedName } from '@maher/i18n';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';

interface Fabric {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  color?: string | null;
  supplier?: string | null;
  isActive: boolean;
}

interface ColorRef {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
}

interface Supplier {
  id: string;
  code: string;
  name: string;
  nameAr?: string | null;
  nameEn?: string | null;
}

export default function FabricsPage() {
  const t = useTranslations('catalog');
  const tCommon = useTranslations('common');
  const locale = useLocale();

  const colorsQuery = useQuery({
    queryKey: ['colors-pick'],
    queryFn: () =>
      apiFetch<{ data: ColorRef[] }>('/api/v1/colors?pageSize=100').then((r) => r.data),
  });

  const suppliersQuery = useQuery({
    queryKey: ['suppliers-pick-fabrics'],
    queryFn: () =>
      apiFetch<{ data: Supplier[] }>('/api/v1/suppliers?pageSize=100&status=ACTIVE').then(
        (r) => r.data,
      ),
  });

  const colorOptions = [
    { value: '', label: t('noneOption') },
    ...(colorsQuery.data ?? []).map((c) => ({
      value: c.code,
      label: `${c.code} — ${localizedName(locale, c)}`,
    })),
  ];

  const supplierOptions = [
    { value: '', label: t('noneOption') },
    ...(suppliersQuery.data ?? []).map((s) => {
      const label =
        s.nameAr || s.nameEn ? localizedName(locale, s, s.name) : s.name;
      return { value: s.code, label: `${s.code} — ${label}` };
    }),
  ];

  return (
    <MasterCrudPage<Fabric>
      title={t('fabrics')}
      queryKey="fabrics"
      listPath="/api/v1/fabrics"
      createPath="/api/v1/fabrics"
      patchPath={(id) => `/api/v1/fabrics/${id}`}
      activatePath={(id) => `/api/v1/fabrics/${id}/activate`}
      deactivatePath={(id) => `/api/v1/fabrics/${id}/deactivate`}
      emptyTitle={t('noFabrics')}
      activeField="isActive"
      columns={[
        { key: 'code', header: t('code'), render: (r) => <span dir="ltr">{r.code}</span> },
        { key: 'name', header: t('name'), render: (r) => localizedName(locale, r) },
        { key: 'color', header: t('color'), render: (r) => r.color ?? '—' },
        { key: 'supplier', header: t('supplier'), render: (r) => r.supplier ?? '—' },
        {
          key: 'active',
          header: t('active'),
          render: (r) => (r.isActive ? tCommon('yes') : tCommon('no')),
        },
      ]}
      fields={[
        { name: 'code', label: t('code'), required: true },
        { name: 'nameEn', label: t('nameEn'), required: true },
        { name: 'nameAr', label: t('nameAr'), required: true },
        { name: 'color', label: t('color'), type: 'select', options: colorOptions },
        { name: 'supplier', label: t('supplier'), type: 'select', options: supplierOptions },
        { name: 'isActive', label: t('active'), type: 'checkbox' },
      ]}
      mapRowToForm={(r) => ({
        code: r.code,
        nameEn: r.nameEn,
        nameAr: r.nameAr,
        color: r.color ?? '',
        supplier: r.supplier ?? '',
        isActive: r.isActive,
      })}
      buildPayload={(form) => ({
        code: String(form.code).trim(),
        nameEn: String(form.nameEn).trim(),
        nameAr: String(form.nameAr).trim(),
        color: String(form.color ?? '').trim() || undefined,
        supplier: String(form.supplier ?? '').trim() || undefined,
        isActive: Boolean(form.isActive),
      })}
    />
  );
}
