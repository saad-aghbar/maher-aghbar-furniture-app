'use client';

import { PageHeader } from '@/components/admin/page-header';
import { Link } from '@/i18n/navigation';
import { apiFetch, ApiClientError } from '@/lib/api-client';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import {
  Alert,
  Button,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  Select,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  TableSkeleton,
} from '@maher/ui';
import { localizedName } from '@maher/i18n';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
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
  activeOrdersCount?: number;
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
});

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
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!form.nameAr.trim() && !form.nameEn.trim() && !form.nameHe.trim()) {
        throw new ApiClientError(t('nameRequired'), 400);
      }
      if (form.phone.trim() && !PHONE_E164.test(form.phone.trim())) {
        throw new ApiClientError(t('invalidPhone'), 400);
      }
      if (form.fax.trim() && !PHONE_E164.test(form.fax.trim())) {
        throw new ApiClientError(t('invalidFax'), 400);
      }
      if (form.email.trim() && !EMAIL_RE.test(form.email.trim())) {
        throw new ApiClientError(t('invalidEmail'), 400);
      }
      return apiFetch<CustomerRow>('/api/v1/customers', {
        method: 'POST',
        body: JSON.stringify({
          nameAr: form.nameAr.trim() || undefined,
          nameEn: form.nameEn.trim() || undefined,
          nameHe: form.nameHe.trim() || undefined,
          customerType: form.customerType,
          companyName: form.companyName.trim() || undefined,
          phone: form.phone.trim() || undefined,
          fax: form.fax.trim() || undefined,
          email: form.email.trim() || undefined,
          preferredLanguage: form.preferredLanguage,
          notes: form.notes.trim() || undefined,
        }),
      });
    },
    onSuccess: async () => {
      setFormError(null);
      await queryClient.invalidateQueries({ queryKey: ['customers'] });
      setFormOpen(false);
      setBanner(t('created'));
    },
    onError: (err) => setFormError(mutationErrorMessage(err)),
  });

  if (customersQuery.isLoading) {
    return (
      <div className="space-y-6">
        <div className="border-b border-border pb-5">
          <Skeleton className="h-8 w-52" />
        </div>
        <TableSkeleton columns={5} />
      </div>
    );
  }

  if (customersQuery.isError) {
    return (
      <ErrorState
        title={t('title')}
        description={tCommon('loadFailed')}
        onRetry={() => customersQuery.refetch()}
        retryLabel={tCommon('retry')}
      />
    );
  }

  const rows = customersQuery.data?.data ?? [];
  const meta = customersQuery.data?.meta;
  const entityNameLabel =
    form.customerType === 'INDIVIDUAL' ? t('individualName') : t('companyName');

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
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

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[240px] flex-1">
          <Input
            value={q}
            onChange={(e) => {
              setPage(1);
              setQ(e.target.value);
            }}
            placeholder={t('searchPlaceholder')}
            leadingIcon={<Search className="h-4 w-4" />}
          />
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState title={t('empty')} />
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>{t('code')}</TableHeaderCell>
              <TableHeaderCell>{t('name')}</TableHeaderCell>
              <TableHeaderCell>{t('phone')}</TableHeaderCell>
              <TableHeaderCell>{t('fax')}</TableHeaderCell>
              <TableHeaderCell>{t('activeOrders')}</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell dir="ltr">{row.code}</TableCell>
                <TableCell>
                  <Link href={`/customers/${row.id}`} className="font-medium text-brand hover:underline">
                    {localizedName(locale, row)}
                  </Link>
                </TableCell>
                <TableCell dir="ltr">{row.phone ?? '—'}</TableCell>
                <TableCell dir="ltr">{row.fax ?? '—'}</TableCell>
                <TableCell dir="ltr">{row.activeOrdersCount ?? 0}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {meta && meta.totalPages > 1 ? (
        <div className="flex items-center justify-end gap-2">
          <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            {tCommon('previous')}
          </Button>
          <span className="text-sm text-[var(--maher-text-secondary)]" dir="ltr">
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
            <Button variant="ghost" disabled={createMutation.isPending} onClick={() => setFormOpen(false)}>
              {tCommon('cancel')}
            </Button>
            <Button loading={createMutation.isPending} onClick={() => createMutation.mutate()}>
              {tCommon('save')}
            </Button>
          </>
        }
      >
        <div className="grid gap-3">
          {formError ? <Alert variant="error">{formError}</Alert> : null}
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
          <Select
            label={t('type')}
            value={form.customerType}
            onChange={(e) => setForm((f) => ({ ...f, customerType: e.target.value }))}
          >
            <option value="COMPANY">{t('company')}</option>
            <option value="INDIVIDUAL">{t('individual')}</option>
          </Select>
          <Input
            label={entityNameLabel}
            value={form.companyName}
            onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
          />
          <Input
            label={t('phone')}
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            placeholder="+970599123456"
            hint={t('phoneHint')}
            dir="ltr"
          />
          <Input
            label={t('fax')}
            value={form.fax}
            onChange={(e) => setForm((f) => ({ ...f, fax: e.target.value }))}
            placeholder="+97022991234"
            dir="ltr"
          />
          <Input
            label={t('email')}
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            dir="ltr"
          />
          <Select
            label={t('language')}
            value={form.preferredLanguage}
            onChange={(e) => setForm((f) => ({ ...f, preferredLanguage: e.target.value }))}
          >
            <option value="ar">العربية</option>
            <option value="en">English</option>
            <option value="he">עברית</option>
          </Select>
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
