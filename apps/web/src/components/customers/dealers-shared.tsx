'use client';

import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { Alert, Button, Combobox, Input, SegmentedControl, TextArea, useToast, type BoardTone } from '@maher/ui';
import { useMutation } from '@tanstack/react-query';
import { Sparkles } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo } from 'react';

export const PHONE_E164 = /^\+[1-9]\d{7,14}$/;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type CustomerStatus = 'LEAD' | 'PROSPECT' | 'ACTIVE' | 'INACTIVE' | 'BLOCKED';
export const CUSTOMER_STATUSES: CustomerStatus[] = ['ACTIVE', 'PROSPECT', 'LEAD', 'INACTIVE', 'BLOCKED'];

export function statusTone(status?: string | null): BoardTone {
  switch (status) {
    case 'ACTIVE':
      return 'success';
    case 'PROSPECT':
    case 'LEAD':
      return 'info';
    case 'BLOCKED':
      return 'error';
    default:
      return 'neutral';
  }
}

export interface CustomerRow {
  id: string;
  code: string;
  name: string;
  nameAr?: string | null;
  nameEn?: string | null;
  nameHe?: string | null;
  phone?: string | null;
  fax?: string | null;
  email?: string | null;
  customerType: string;
  companyName?: string | null;
  status?: CustomerStatus;
  preferredLanguage?: string | null;
  notes?: string | null;
  createdAt?: string;
  activeOrdersCount?: number;
  waitingOrdersCount?: number;
  inWorkOrdersCount?: number;
  doneOrdersCount?: number;
  paidTotal?: number;
  outstandingTotal?: number;
  invoicedTotal?: number;
  availableCredit?: number;
}

export function useDealerCopy() {
  const locale = useLocale();
  const t = useTranslations('customers');
  const tCommon = useTranslations('common');
  return useMemo(() => {
    const money = (value: unknown, currency = 'ILS') => {
      const n = Number(value ?? 0);
      if (!Number.isFinite(n)) return '—';
      try {
        return new Intl.NumberFormat(locale === 'ar' ? 'ar-JO' : locale === 'he' ? 'he-IL' : 'en-JO', { style: 'currency', currency, maximumFractionDigits: 2, minimumFractionDigits: Number.isInteger(n) ? 0 : 2 }).format(n);
      } catch {
        return `${n.toFixed(2)} ${currency}`;
      }
    };
    const date = (iso?: string | null, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }) => {
      if (!iso) return '—';
      const d = new Date(iso);
      return Number.isNaN(d.getTime()) ? '—' : new Intl.DateTimeFormat(locale, opts).format(d);
    };
    const statusLabel = (status?: string | null) => {
      switch (status) {
        case 'ACTIVE':
          return t('statusActive');
        case 'PROSPECT':
          return t('statusProspect');
        case 'LEAD':
          return t('statusLead');
        case 'BLOCKED':
          return t('statusBlocked');
        case 'INACTIVE':
          return t('statusInactive');
        default:
          return status ?? '—';
      }
    };
    const typeLabel = (type?: string | null) => (type === 'SHOWROOM' ? t('showroom') : type === 'INDIVIDUAL' ? t('individual') : t('company'));
    return { locale, t, tCommon, money, date, statusLabel, typeLabel };
  }, [locale, t, tCommon]);
}

/* ── Create / edit form ─────────────────────────────────────────────────── */

export interface DealerForm {
  nameAr: string;
  nameEn: string;
  nameHe: string;
  customerType: string;
  companyName: string;
  phone: string;
  fax: string;
  email: string;
  preferredLanguage: string;
  status: CustomerStatus;
  notes: string;
  addressLabel: string;
  address: string;
  portalUsername: string;
  portalPassword: string;
  portalPasswordConfirm: string;
}

export const emptyDealerForm = (): DealerForm => ({
  nameAr: '',
  nameEn: '',
  nameHe: '',
  customerType: 'COMPANY',
  companyName: '',
  phone: '',
  fax: '',
  email: '',
  preferredLanguage: 'ar',
  status: 'ACTIVE',
  notes: '',
  addressLabel: 'Main',
  address: '',
  portalUsername: '',
  portalPassword: '',
  portalPasswordConfirm: '',
});

export function dealerFormFromRow(row: CustomerRow): DealerForm {
  return {
    ...emptyDealerForm(),
    nameAr: row.nameAr ?? '',
    nameEn: row.nameEn ?? '',
    nameHe: row.nameHe ?? '',
    customerType: row.customerType,
    companyName: row.companyName ?? '',
    phone: row.phone ?? '',
    fax: row.fax ?? '',
    email: row.email ?? '',
    preferredLanguage: row.preferredLanguage ?? 'ar',
    status: row.status ?? 'ACTIVE',
    notes: row.notes ?? '',
  };
}

/** Throws ApiClientError(400) with a translated message on the first invalid field. */
export function validateDealerForm(form: DealerForm, t: ReturnType<typeof useTranslations<'customers'>>, mode: 'create' | 'edit') {
  if (!form.nameAr.trim() && !form.nameEn.trim() && !form.nameHe.trim()) throw new ApiClientError(t('nameRequired'), 400);
  if (mode === 'create' && !form.phone.trim()) throw new ApiClientError(t('phoneRequired'), 400);
  if (form.phone.trim() && !PHONE_E164.test(form.phone.trim())) throw new ApiClientError(t('invalidPhone'), 400);
  if (form.fax.trim() && !PHONE_E164.test(form.fax.trim())) throw new ApiClientError(t('invalidFax'), 400);
  if (form.email.trim() && !EMAIL_RE.test(form.email.trim())) throw new ApiClientError(t('invalidEmail'), 400);
  if (mode === 'create') {
    if (!form.address.trim() || !form.addressLabel.trim()) throw new ApiClientError(t('addressRequired'), 400);
    if (form.portalUsername.trim().toLowerCase().length < 2) throw new ApiClientError(t('portalUsernameRequired'), 400);
    if (!form.portalPassword) throw new ApiClientError(t('portalPasswordRequired'), 400);
    if (form.portalPassword !== form.portalPasswordConfirm) throw new ApiClientError(t('portalPasswordMismatch'), 400);
  }
}

export function DealerFormFields({ form, setForm, mode, error }: { form: DealerForm; setForm: (next: DealerForm) => void; mode: 'create' | 'edit'; error?: string | null }) {
  const t = useTranslations('customers');
  const tCommon = useTranslations('common');
  const toast = useToast();
  const copy = useDealerCopy();
  const suggest = useMutation({
    mutationFn: (name: string) => apiFetch<{ nameAr?: string; nameEn?: string; nameHe?: string }>('/api/v1/customers/suggest-translations', { method: 'POST', body: JSON.stringify({ name }) }),
    onSuccess: (res) => setForm({ ...form, nameAr: form.nameAr.trim() || res.nameAr || '', nameEn: form.nameEn.trim() || res.nameEn || '', nameHe: form.nameHe.trim() || res.nameHe || '' }),
    onError: (err) => toast.error(mutationErrorMessage(err)),
  });
  const seed = form.nameAr.trim() || form.nameEn.trim() || form.nameHe.trim();
  const entityLabel = form.customerType === 'SHOWROOM' ? t('showroomName') : form.customerType === 'INDIVIDUAL' ? t('individualName') : t('companyName');
  const patch = (next: Partial<DealerForm>) => setForm({ ...form, ...next });

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {error ? (
        <div className="sm:col-span-2">
          <Alert variant="error">{error}</Alert>
        </div>
      ) : null}
      <div className="sm:col-span-2">
        <SegmentedControl
          aria-label={t('type')}
          value={form.customerType}
          onChange={(v) => patch({ customerType: v })}
          options={[
            { value: 'COMPANY', label: t('company') },
            { value: 'SHOWROOM', label: t('showroom') },
            { value: 'INDIVIDUAL', label: t('individual') },
          ]}
        />
      </div>
      <Input label={t('nameAr')} value={form.nameAr} onChange={(e) => patch({ nameAr: e.target.value })} dir="rtl" />
      <Input label={t('nameEn')} value={form.nameEn} onChange={(e) => patch({ nameEn: e.target.value })} dir="ltr" />
      <Input label={t('nameHe')} value={form.nameHe} onChange={(e) => patch({ nameHe: e.target.value })} dir="rtl" />
      <div className="flex items-end">
        <Button variant="secondary" size="sm" leadingIcon={<Sparkles className="h-4 w-4" />} loading={suggest.isPending} disabled={!seed} onClick={() => suggest.mutate(seed)}>
          {t('suggestNames')}
        </Button>
      </div>
      <div className="sm:col-span-2">
        <Input label={entityLabel} value={form.companyName} onChange={(e) => patch({ companyName: e.target.value })} />
      </div>
      <Input label={t('phone')} value={form.phone} onChange={(e) => patch({ phone: e.target.value })} hint={t('phoneHint')} dir="ltr" placeholder="+9627…" />
      <Input label={t('fax')} value={form.fax} onChange={(e) => patch({ fax: e.target.value })} dir="ltr" />
      <Input label={t('email')} value={form.email} onChange={(e) => patch({ email: e.target.value })} dir="ltr" type="email" />
      <Combobox
        label={t('language')}
        value={form.preferredLanguage}
        onChange={(v) => patch({ preferredLanguage: v ?? 'ar' })}
        options={[
          { value: 'ar', label: 'العربية' },
          { value: 'en', label: 'English' },
          { value: 'he', label: 'עברית' },
        ]}
        clearable={false}
      />
      {mode === 'edit' ? (
        <div className="sm:col-span-2">
          <span className="mb-1.5 block text-[13px] font-medium text-[var(--maher-text-primary)]">{t('status')}</span>
          <SegmentedControl aria-label={t('status')} value={form.status} onChange={(v) => patch({ status: v as CustomerStatus })} options={CUSTOMER_STATUSES.map((s) => ({ value: s, label: copy.statusLabel(s) }))} />
        </div>
      ) : null}
      {mode === 'create' ? (
        <>
          <Input label={t('addressLabel')} value={form.addressLabel} onChange={(e) => patch({ addressLabel: e.target.value })} />
          <Input label={tCommon('address')} value={form.address} onChange={(e) => patch({ address: e.target.value })} />
        </>
      ) : null}
      <div className="sm:col-span-2">
        <TextArea autoGrow label={t('notes')} value={form.notes} onChange={(e) => patch({ notes: e.target.value })} rows={3} />
      </div>
      {mode === 'create' ? (
        <div className="sm:col-span-2 grid gap-4 rounded-[14px] border border-[var(--maher-border)] p-4 sm:grid-cols-2">
          <p className="sm:col-span-2 text-[13px] font-semibold text-[var(--maher-text-primary)]">{t('portalCredentials')}</p>
          <div className="sm:col-span-2">
            <Input label={t('portalUsername')} value={form.portalUsername} onChange={(e) => patch({ portalUsername: e.target.value })} autoComplete="off" dir="ltr" />
          </div>
          <Input label={t('portalPassword')} type="password" value={form.portalPassword} onChange={(e) => patch({ portalPassword: e.target.value })} autoComplete="new-password" dir="ltr" />
          <Input label={t('portalPasswordConfirm')} type="password" value={form.portalPasswordConfirm} onChange={(e) => patch({ portalPasswordConfirm: e.target.value })} autoComplete="new-password" dir="ltr" />
        </div>
      ) : null}
    </div>
  );
}

export function dealerCreatePayload(form: DealerForm) {
  return {
    nameAr: form.nameAr.trim() || undefined,
    nameEn: form.nameEn.trim() || undefined,
    nameHe: form.nameHe.trim() || undefined,
    customerType: form.customerType,
    companyName: form.customerType === 'COMPANY' || form.customerType === 'SHOWROOM' ? form.companyName.trim() || form.nameEn.trim() || form.nameAr.trim() : undefined,
    phone: form.phone.trim(),
    fax: form.fax.trim() || undefined,
    email: form.email.trim() || undefined,
    preferredLanguage: form.preferredLanguage,
    notes: form.notes.trim() || undefined,
    portalUsername: form.portalUsername.trim().toLowerCase(),
    portalPassword: form.portalPassword,
    address: { label: form.addressLabel.trim(), city: form.address.trim() },
  };
}

export function dealerUpdatePayload(form: DealerForm) {
  return {
    nameAr: form.nameAr.trim(),
    nameEn: form.nameEn.trim(),
    nameHe: form.nameHe.trim(),
    customerType: form.customerType,
    companyName: form.companyName.trim() || undefined,
    phone: form.phone.trim() || undefined,
    fax: form.fax.trim() || undefined,
    email: form.email.trim() || undefined,
    preferredLanguage: form.preferredLanguage,
    status: form.status,
    notes: form.notes.trim() || undefined,
  };
}
