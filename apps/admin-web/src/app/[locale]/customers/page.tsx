'use client';

import { Link } from '@/i18n/navigation';
import { apiFetch, ApiClientError } from '@/lib/api-client';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import {
  Alert,
  Button,
  EmptyState,
  ErrorState,
  Input,
  Ltr,
  Modal,
  PageHero,
  Select,
  Skeleton,
} from '@maher/ui';
import { localizedName } from '@maher/i18n';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Phone, Plus, Printer } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

const PHONE_E164 = /^\+[1-9]\d{7,14}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface CustomerRow {
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
  waitingOrdersCount?: number;
  inWorkOrdersCount?: number;
  doneOrdersCount?: number;
  paidTotal?: number;
  outstandingTotal?: number;
  invoicedTotal?: number;
}

interface CustomerForm {
  nameAr: string;
  nameEn: string;
  nameHe: string;
  customerType: string;
  companyName: string;
  phone: string;
  fax: string;
  email: string;
  preferredLanguage: string;
  notes: string;
  addressLabel: string;
  address: string;
}

const emptyForm = (): CustomerForm => ({
  nameAr: '',
  nameEn: '',
  nameHe: '',
  customerType: 'COMPANY',
  companyName: '',
  phone: '',
  fax: '',
  email: '',
  preferredLanguage: 'ar',
  notes: '',
  addressLabel: 'Main',
  address: '',
});

function money(value: number | undefined, currency: string) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return `0.00 ${currency}`;
  return `${n.toFixed(2)} ${currency}`;
}

export default function CustomersPage() {
  const locale = useLocale();
  const t = useTranslations('customers');
  const tCommon = useTranslations('common');
  const queryClient = useQueryClient();

  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<CustomerForm>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<{
    username: string;
    temporaryPassword: string;
  } | null>(null);

  const listParams = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: '20' });
    if (q.trim()) params.set('q', q.trim());
    return params.toString();
  }, [q, page]);

  const customersQuery = useQuery({
    queryKey: ['customers', listParams],
    queryFn: () =>
      apiFetch<{
        data: CustomerRow[];
        meta: { page: number; totalPages: number };
      }>(`/api/v1/customers?${listParams}`),
    placeholderData: keepPreviousData,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!form.nameAr.trim() && !form.nameEn.trim() && !form.nameHe.trim()) {
        throw new ApiClientError(t('nameRequired'), 400);
      }
      if (!form.phone.trim()) {
        throw new ApiClientError(t('phoneRequired'), 400);
      }
      if (!PHONE_E164.test(form.phone.trim())) {
        throw new ApiClientError(t('invalidPhone'), 400);
      }
      if (!form.address.trim() || !form.addressLabel.trim()) {
        throw new ApiClientError(t('addressRequired'), 400);
      }
      if (form.fax.trim() && !PHONE_E164.test(form.fax.trim())) {
        throw new ApiClientError(t('invalidFax'), 400);
      }
      if (form.email.trim() && !EMAIL_RE.test(form.email.trim())) {
        throw new ApiClientError(t('invalidEmail'), 400);
      }
      return apiFetch<{
        id: string;
        portalUser?: { username: string; temporaryPassword: string };
      }>('/api/v1/customers', {
        method: 'POST',
        body: JSON.stringify({
          nameAr: form.nameAr.trim() || undefined,
          nameEn: form.nameEn.trim() || undefined,
          nameHe: form.nameHe.trim() || undefined,
          customerType: form.customerType,
          companyName:
            form.customerType === 'COMPANY' || form.customerType === 'SHOWROOM'
              ? form.companyName.trim() || form.nameEn.trim() || form.nameAr.trim()
              : undefined,
          phone: form.phone.trim(),
          fax: form.fax.trim() || undefined,
          email: form.email.trim() || undefined,
          preferredLanguage: form.preferredLanguage,
          notes: form.notes.trim() || undefined,
          addresses: [
            {
              label: form.addressLabel.trim(),
              city: form.address.trim(),
              isDefaultBilling: true,
              isDefaultDelivery: true,
            },
          ],
        }),
      });
    },
    onSuccess: async (created) => {
      setFormOpen(false);
      setBanner(created.portalUser ? t('createdWithPortal') : t('created'));
      setCredentials(
        created.portalUser
          ? {
              username: created.portalUser.username,
              temporaryPassword: created.portalUser.temporaryPassword,
            }
          : null,
      );
      await queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (err) => setFormError(mutationErrorMessage(err)),
  });

  const rows = customersQuery.data?.data ?? [];
  const meta = customersQuery.data?.meta;
  const entityNameLabel =
    form.customerType === 'SHOWROOM'
      ? t('showroomName')
      : form.customerType === 'INDIVIDUAL'
        ? t('individualName')
        : t('companyName');
  const currency = tCommon('currency');
  const initialLoading = customersQuery.isLoading && !customersQuery.data;

  return (
    <div className="space-y-6">
      <PageHero
        title={t('title')}
        description={t('listHint')}
        tone="soft"
        actions={
          <Button
            leadingIcon={<Plus className="h-4 w-4" />}
            onClick={() => {
              setForm(emptyForm());
              setFormError(null);
              setFormOpen(true);
            }}
          >
            {t('add')}
          </Button>
        }
      />

      {banner ? <Alert variant="success">{banner}</Alert> : null}
      {credentials ? (
        <Alert variant="info">
          <p className="font-medium">{t('portalCredentials')}</p>
          <p className="mt-1 text-sm" dir="ltr">
            {t('portalUsername')}: {credentials.username}
          </p>
          <p className="text-sm" dir="ltr">
            {t('portalPassword')}: {credentials.temporaryPassword}
          </p>
          <p className="mt-2 text-xs text-text-secondary">{t('portalCredentialsOnce')}</p>
        </Alert>
      ) : null}

      <label className="relative block max-w-md">
        <Input
        withSearchIcon
          value={q}
          onChange={(e) => {
            setPage(1);
            setQ(e.target.value);
          }}
          placeholder={t('searchPlaceholder')}
        />
      </label>

      {customersQuery.isError && !customersQuery.data ? (
        <ErrorState
          title={t('title')}
          description={tCommon('loadFailed')}
          onRetry={() => customersQuery.refetch()}
          retryLabel={tCommon('retry')}
        />
      ) : initialLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-52 rounded-2xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState title={t('empty')} />
      ) : (
        <div
          className={`maher-stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-3 ${
            customersQuery.isFetching ? 'opacity-70 transition-opacity' : ''
          }`}
        >
          {rows.map((row) => {
            const name = localizedName(locale, row);
            const waiting = row.waitingOrdersCount ?? 0;
            const inWork = row.inWorkOrdersCount ?? 0;
            const done = row.doneOrdersCount ?? 0;
            const paid = Number(row.paidTotal ?? 0);
            const left = Number(row.outstandingTotal ?? 0);

            return (
              <Link
                key={row.id}
                href={`/customers/${row.id}`}
                className="maher-list-card group flex flex-col rounded-2xl border border-border bg-surface p-6 transition duration-200 hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-[var(--maher-shadow-md)]"
              >
                <div className="min-w-0">
                  <h2 className="truncate text-xl font-semibold tracking-tight text-text-primary transition-colors group-hover:text-brand">
                    {name}
                  </h2>
                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-text-secondary">
                    <p className="flex items-center gap-2" dir="ltr">
                      <Phone className="h-3.5 w-3.5 shrink-0 text-text-tertiary" />
                      <span>{row.phone || '—'}</span>
                    </p>
                    <p className="flex items-center gap-2" dir="ltr">
                      <Printer className="h-3.5 w-3.5 shrink-0 text-text-tertiary" />
                      <span>{row.fax || '—'}</span>
                    </p>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-3 maher-card-rule-divide maher-card-rule-y py-3">
                  <div className="px-2 text-center first:ps-0 last:pe-0">
                    <p className="text-[11px] text-text-tertiary">{t('ordersWaiting')}</p>
                    <p className="mt-1 text-xl font-semibold tracking-tight text-text-primary">
                      <Ltr>{waiting}</Ltr>
                    </p>
                  </div>
                  <div className="px-2 text-center">
                    <p className="text-[11px] text-text-tertiary">{t('ordersInWork')}</p>
                    <p className="mt-1 text-xl font-semibold tracking-tight text-text-primary">
                      <Ltr>{inWork}</Ltr>
                    </p>
                  </div>
                  <div className="px-2 text-center">
                    <p className="text-[11px] text-text-tertiary">{t('ordersDone')}</p>
                    <p className="mt-1 text-xl font-semibold tracking-tight text-text-primary">
                      <Ltr>{done}</Ltr>
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex items-end justify-between gap-4">
                  <div className="text-start">
                    <p className="text-[11px] text-text-tertiary">{t('amountPaid')}</p>
                    <p className="mt-0.5 text-sm font-medium text-text-primary">
                      <Ltr>{money(paid, currency)}</Ltr>
                    </p>
                  </div>
                  <div className="text-start">
                    <p className="text-[11px] text-text-tertiary">{t('amountLeft')}</p>
                    <p className="mt-0.5 text-sm font-medium text-text-primary">
                      <Ltr>{money(left, currency)}</Ltr>
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {meta && meta.totalPages > 1 ? (
        <div className="flex items-center justify-end gap-2">
          <Button
            size="sm"
            variant="secondary"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            {tCommon('previous')}
          </Button>
          <span className="text-sm text-text-secondary" dir="ltr">
            {meta.page} / {meta.totalPages}
          </span>
          <Button
            size="sm"
            variant="secondary"
            disabled={page >= meta.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            {tCommon('next')}
          </Button>
        </div>
      ) : null}

      <Modal
        open={formOpen}
        onClose={() => !createMutation.isPending && setFormOpen(false)}
        title={t('add')}
        footer={
          <>
            <Button
              variant="ghost"
              disabled={createMutation.isPending}
              onClick={() => setFormOpen(false)}
            >
              {tCommon('cancel')}
            </Button>
            <Button loading={createMutation.isPending} onClick={() => createMutation.mutate()}>
              {tCommon('save')}
            </Button>
          </>
        }
      >
        <div className="maher-form-section grid gap-3">
          {formError ? <Alert variant="error">{formError}</Alert> : null}
          <Select
            label={t('type')}
            value={form.customerType}
            onChange={(e) => setForm((f) => ({ ...f, customerType: e.target.value }))}
            options={[
              { value: 'COMPANY', label: t('company') },
              { value: 'SHOWROOM', label: t('showroom') },
            ]}
          />
          <Input
            label={t('nameAr')}
            value={form.nameAr}
            onChange={(e) => setForm((f) => ({ ...f, nameAr: e.target.value }))}
          />
          <Input
            label={t('nameEn')}
            value={form.nameEn}
            onChange={(e) => setForm((f) => ({ ...f, nameEn: e.target.value }))}
          />
          <Input
            label={t('nameHe')}
            value={form.nameHe}
            onChange={(e) => setForm((f) => ({ ...f, nameHe: e.target.value }))}
          />
          <Input
            label={entityNameLabel}
            value={form.companyName}
            onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
          />
          <Input
            label={t('phone')}
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            hint={t('phoneHint')}
            dir="ltr"
          />
          <Input
            label={t('fax')}
            value={form.fax}
            onChange={(e) => setForm((f) => ({ ...f, fax: e.target.value }))}
            dir="ltr"
          />
          <Input
            label={t('email')}
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            dir="ltr"
          />
          <Select
            label={t('language')}
            value={form.preferredLanguage}
            onChange={(e) => setForm((f) => ({ ...f, preferredLanguage: e.target.value }))}
            options={[
              { value: 'ar', label: 'العربية' },
              { value: 'en', label: 'English' },
              { value: 'he', label: 'עברית' },
            ]}
          />
          <Input
            label={t('addressLabel')}
            value={form.addressLabel}
            onChange={(e) => setForm((f) => ({ ...f, addressLabel: e.target.value }))}
          />
          <Input
            label={tCommon('address')}
            value={form.address}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
          />
          <Input
            label={t('notes')}
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
        </div>
      </Modal>
    </div>
  );
}
