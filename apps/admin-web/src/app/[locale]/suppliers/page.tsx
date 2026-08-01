'use client';

import { MasterCrudPage } from '@/components/admin/master-crud-page';
import { StatusBadge } from '@maher/ui';
import { localizedName } from '@maher/i18n';
import { useLocale, useTranslations } from 'next-intl';

interface Supplier {
  id: string;
  code: string;
  name: string;
  nameAr?: string | null;
  nameEn?: string | null;
  phone?: string | null;
  email?: string | null;
  status: string;
  companyName?: string | null;
  paymentTermsDays?: number;
  leadTimeDays?: number;
  notes?: string | null;
  address?: string | null;
}

export default function SuppliersPage() {
  const t = useTranslations('catalog');
  const tNav = useTranslations('navigation');
  const tCommon = useTranslations('common');
  const locale = useLocale();

  return (
    <MasterCrudPage<Supplier>
      title={tNav('suppliers')}
      queryKey="suppliers"
      listPath="/api/v1/suppliers"
      createPath="/api/v1/suppliers"
      patchPath={(id) => `/api/v1/suppliers/${id}`}
      activatePath={(id) => `/api/v1/suppliers/${id}/activate`}
      deactivatePath={(id) => `/api/v1/suppliers/${id}/deactivate`}
      emptyTitle={t('noSuppliers')}
      activeField="status"
      columns={[
        { key: 'code', header: t('code'), render: (r) => <span dir="ltr">{r.code}</span> },
        {
          key: 'name',
          header: t('name'),
          render: (r) =>
            r.nameAr || r.nameEn ? localizedName(locale, r, r.name) : r.name,
        },
        {
          key: 'phone',
          header: t('phone'),
          render: (r) => (r.phone ? <span dir="ltr">{r.phone}</span> : '—'),
        },
        {
          key: 'lead',
          header: t('leadTimeDays'),
          render: (r) =>
            r.leadTimeDays != null ? <span dir="ltr">{r.leadTimeDays}</span> : '—',
        },
        {
          key: 'terms',
          header: t('paymentTermsDays'),
          render: (r) =>
            r.paymentTermsDays != null ? <span dir="ltr">{r.paymentTermsDays}</span> : '—',
        },
        {
          key: 'status',
          header: tCommon('status'),
          render: (r) => <StatusBadge status={r.status} />,
        },
      ]}
      fields={[
        { name: 'nameEn', label: t('nameEn'), required: true },
        { name: 'nameAr', label: t('nameAr'), required: true },
        { name: 'nameHe', label: t('nameHe') },
        { name: 'companyName', label: t('company') },
        { name: 'phone', label: t('phone') },
        { name: 'email', label: t('email') },
        { name: 'address', label: tCommon('address') },
        { name: 'paymentTermsDays', label: t('paymentTermsDays'), type: 'number' },
        { name: 'leadTimeDays', label: t('leadTimeDays'), type: 'number' },
        { name: 'notes', label: t('notes') },
      ]}
      mapRowToForm={(r) => ({
        nameEn: r.nameEn ?? r.name,
        nameAr: r.nameAr ?? r.name,
        nameHe: '',
        companyName: r.companyName ?? '',
        phone: r.phone ?? '',
        email: r.email ?? '',
        address: r.address ?? '',
        paymentTermsDays: r.paymentTermsDays ?? 30,
        leadTimeDays: r.leadTimeDays ?? 7,
        notes: r.notes ?? '',
      })}
      buildPayload={(form) => {
        const nameEn = String(form.nameEn).trim();
        const nameAr = String(form.nameAr).trim();
        return {
          name: nameEn || nameAr,
          nameEn: nameEn || undefined,
          nameAr: nameAr || undefined,
          nameHe: String(form.nameHe ?? '').trim() || undefined,
          companyName: String(form.companyName ?? '').trim() || undefined,
          phone: String(form.phone ?? '').trim() || undefined,
          email: String(form.email ?? '').trim() || undefined,
          address: String(form.address ?? '').trim() || undefined,
          paymentTermsDays: Number(form.paymentTermsDays),
          leadTimeDays: Number(form.leadTimeDays),
          notes: String(form.notes ?? '').trim() || undefined,
        };
      }}
    />
  );
}
