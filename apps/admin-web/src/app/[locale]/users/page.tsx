'use client';

import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { PageHeader } from '@/components/admin/page-header';
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
} from '@maher/ui';
import { localizedName } from '@maher/i18n';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

interface UserRow {
  id: string;
  email: string | null;
  phone: string | null;
  firstName: string;
  lastName: string;
  preferredLanguage: string;
  isActive: boolean;
  lastLoginAt: string | null;
  customerId: string | null;
  roles?: Array<{ role: { id: string; code: string; nameEn: string; nameAr?: string } }>;
}

interface RoleRow {
  id: string;
  code: string;
  nameEn: string;
  nameAr: string;
}

interface CustomerOption {
  id: string;
  code: string;
  name: string;
  nameAr?: string | null;
  nameEn?: string | null;
  nameHe?: string | null;
}

interface UserFormState {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  preferredLanguage: string;
  password: string;
  customerId: string;
  isActive: boolean;
  roleIds: string[];
}

const emptyForm = (): UserFormState => ({
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  preferredLanguage: 'ar',
  password: '',
  customerId: '',
  isActive: true,
  roleIds: [],
});

export default function UsersPage() {
  const locale = useLocale();
  const t = useTranslations('users');
  const tCommon = useTranslations('common');
  const queryClient = useQueryClient();

  const [q, setQ] = useState('');
  const [roleCode, setRoleCode] = useState('');
  const [isActive, setIsActive] = useState('');
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [form, setForm] = useState<UserFormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<
    | { type: 'activate' | 'deactivate' | 'reset'; user: UserRow }
    | null
  >(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const listParams = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: '20' });
    if (q.trim()) params.set('q', q.trim());
    if (roleCode) params.set('roleCode', roleCode);
    if (isActive) params.set('isActive', isActive);
    return params.toString();
  }, [q, roleCode, isActive, page]);

  const usersQuery = useQuery({
    queryKey: ['users', listParams],
    queryFn: () =>
      apiFetch<{ data: UserRow[]; meta: { page: number; totalPages: number; totalItems: number } }>(
        `/api/v1/users?${listParams}`,
      ),
  });

  const rolesQuery = useQuery({
    queryKey: ['roles'],
    queryFn: () => apiFetch<RoleRow[]>('/api/v1/roles'),
  });

  const customersQuery = useQuery({
    queryKey: ['customers-for-user-link'],
    queryFn: () =>
      apiFetch<{ data: CustomerOption[] }>('/api/v1/customers?pageSize=100').then((r) => r.data),
    enabled: formOpen,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const firstName = form.firstName.trim();
      const lastName = form.lastName.trim();
      const email = form.email.trim();
      if (!firstName || !lastName || !email) {
        throw new ApiClientError('First name, last name, and email are required.', 400);
      }

      if (editing) {
        return apiFetch<UserRow>(`/api/v1/users/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            firstName,
            lastName,
            email,
            phone: form.phone.trim() || undefined,
            preferredLanguage: form.preferredLanguage,
            customerId: form.customerId.trim() ? form.customerId.trim() : null,
            isActive: form.isActive,
            roleIds: form.roleIds,
          }),
        });
      }

      return apiFetch<UserRow & { temporaryPassword?: string }>('/api/v1/users', {
        method: 'POST',
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          phone: form.phone.trim() || undefined,
          preferredLanguage: form.preferredLanguage,
          customerId: form.customerId.trim() || undefined,
          isActive: form.isActive,
          roleIds: form.roleIds,
          ...(form.password.trim() ? { password: form.password } : {}),
        }),
      });
    },
    onSuccess: async (data) => {
      setFormError(null);
      await queryClient.invalidateQueries({ queryKey: ['users'] });
      setFormOpen(false);
      setEditing(null);
      const temp =
        'temporaryPassword' in data && data.temporaryPassword
          ? ` ${t('tempPassword')} ${data.temporaryPassword}`
          : '';
      setBanner((editing ? t('updated') : t('created')) + temp);
    },
    onError: (err) => setFormError(mutationErrorMessage(err)),
  });

  const actionMutation = useMutation({
    mutationFn: async (): Promise<{ temporaryPassword?: string } | null> => {
      if (!confirm) return null;
      if (confirm.type === 'reset') {
        return apiFetch<{ temporaryPassword: string }>(
          `/api/v1/users/${confirm.user.id}/reset-password`,
          { method: 'POST' },
        );
      }
      await apiFetch(
        `/api/v1/users/${confirm.user.id}/${confirm.type === 'activate' ? 'activate' : 'deactivate'}`,
        { method: 'POST' },
      );
      return null;
    },
    onSuccess: async (data) => {
      setConfirmError(null);
      await queryClient.invalidateQueries({ queryKey: ['users'] });
      if (confirm?.type === 'reset' && data?.temporaryPassword) {
        setBanner(`${t('passwordReset')} ${data.temporaryPassword}`);
      } else if (confirm?.type === 'activate') {
        setBanner(t('activated'));
      } else if (confirm?.type === 'deactivate') {
        setBanner(t('deactivated'));
      }
      setConfirm(null);
    },
    onError: (err) => setConfirmError(mutationErrorMessage(err)),
  });

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(user: UserRow) {
    setEditing(user);
    setForm({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email ?? '',
      phone: user.phone ?? '',
      preferredLanguage: user.preferredLanguage || 'ar',
      password: '',
      customerId: user.customerId ?? '',
      isActive: user.isActive,
      roleIds: (user.roles ?? []).map((r) => r.role.id),
    });
    setFormError(null);
    setFormOpen(true);
  }

  function toggleRole(roleId: string) {
    setForm((prev) => ({
      ...prev,
      roleIds: prev.roleIds.includes(roleId)
        ? prev.roleIds.filter((id) => id !== roleId)
        : [...prev.roleIds, roleId],
    }));
  }

  if (usersQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (usersQuery.isError) {
    return (
      <ErrorState
        title={t('title')}
        description={tCommon('loadFailed')}
        onRetry={() => usersQuery.refetch()}
        retryLabel={tCommon('retry')}
      />
    );
  }

  const rows = usersQuery.data?.data ?? [];
  const meta = usersQuery.data?.meta;
  const roles = rolesQuery.data ?? [];
  const customers = customersQuery.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        description={t('description')}
        actions={
          <Button onClick={openCreate}>{t('add')}</Button>
        }
      />

      {banner ? <Alert variant="success">{banner}</Alert> : null}

      <div className="flex flex-wrap gap-3">
        <Input
          value={q}
          onChange={(e) => {
            setPage(1);
            setQ(e.target.value);
          }}
          placeholder={t('searchPlaceholder')}
          className="min-w-[220px] flex-1"
        />
        <Select
          value={roleCode}
          onChange={(e) => {
            setPage(1);
            setRoleCode(e.target.value);
          }}
          aria-label={t('filterRole')}
        >
          <option value="">{tCommon('all')}</option>
          {roles.map((role) => (
            <option key={role.id} value={role.code}>
              {localizedName(locale, role)}
            </option>
          ))}
        </Select>
        <Select
          value={isActive}
          onChange={(e) => {
            setPage(1);
            setIsActive(e.target.value);
          }}
          aria-label={t('filterStatus')}
        >
          <option value="">{tCommon('all')}</option>
          <option value="true">{t('active')}</option>
          <option value="false">{t('inactive')}</option>
        </Select>
      </div>

      {rows.length === 0 ? (
        <EmptyState title={t('empty')} />
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>{t('name')}</TableHeaderCell>
              <TableHeaderCell>{t('email')}</TableHeaderCell>
              <TableHeaderCell>{t('roles')}</TableHeaderCell>
              <TableHeaderCell>{t('status')}</TableHeaderCell>
              <TableHeaderCell>{t('lastLogin')}</TableHeaderCell>
              <TableHeaderCell>{tCommon('actions')}</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  {row.firstName} {row.lastName}
                </TableCell>
                <TableCell>{row.email ?? '—'}</TableCell>
                <TableCell>
                  {(row.roles ?? []).map((ur) => ur.role.code).join(', ') || '—'}
                </TableCell>
                <TableCell>{row.isActive ? t('active') : t('inactive')}</TableCell>
                <TableCell>
                  {row.lastLoginAt
                    ? new Date(row.lastLoginAt).toLocaleString()
                    : t('never')}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    <Button size="sm" variant="secondary" onClick={() => openEdit(row)}>
                      {tCommon('edit')}
                    </Button>
                    {row.isActive ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setConfirmError(null);
                          setConfirm({ type: 'deactivate', user: row });
                        }}
                      >
                        {t('deactivate')}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setConfirmError(null);
                          setConfirm({ type: 'activate', user: row });
                        }}
                      >
                        {t('activate')}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setConfirmError(null);
                        setConfirm({ type: 'reset', user: row });
                      }}
                    >
                      {t('resetPassword')}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
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
          <span className="text-sm text-[var(--maher-text-secondary)]">
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
        onClose={() => !saveMutation.isPending && setFormOpen(false)}
        title={editing ? t('edit') : t('add')}
        className="max-w-xl"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setFormOpen(false)}
              disabled={saveMutation.isPending}
            >
              {tCommon('cancel')}
            </Button>
            <Button loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
              {tCommon('save')}
            </Button>
          </>
        }
      >
        <div className="grid max-h-[60vh] gap-3 overflow-y-auto">
          {formError ? <Alert variant="error">{formError}</Alert> : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label={`${t('firstName')} *`}
              value={form.firstName}
              onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
              required
            />
            <Input
              label={`${t('lastName')} *`}
              value={form.lastName}
              onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
              required
            />
          </div>
          <Input
            label={`${t('email')} *`}
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            required
          />
          <Input
            label={t('phone')}
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          />
          {!editing ? (
            <Input
              label={t('password')}
              type="password"
              value={form.password}
              hint={t('passwordHint')}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            />
          ) : null}
          <Select
            label={t('language')}
            value={form.preferredLanguage}
            onChange={(e) => setForm((f) => ({ ...f, preferredLanguage: e.target.value }))}
          >
            <option value="ar">العربية</option>
            <option value="en">English</option>
            <option value="he">עברית</option>
          </Select>
          <Select
            label={t('linkedCustomer')}
            value={form.customerId}
            hint={t('linkedCustomerHint')}
            onChange={(e) => setForm((f) => ({ ...f, customerId: e.target.value }))}
          >
            <option value="">{t('noCustomerLink')}</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {localizedName(locale, c)}
              </option>
            ))}
          </Select>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
            />
            {t('active')}
          </label>
          <fieldset>
            <legend className="mb-2 text-sm font-medium">{t('roles')}</legend>
            <div className="grid max-h-40 gap-1 overflow-y-auto rounded border border-[var(--maher-border)] p-2">
              {roles.map((role) => (
                <label key={role.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.roleIds.includes(role.id)}
                    onChange={() => toggleRole(role.id)}
                  />
                  {localizedName(locale, role)}
                  <span className="text-[var(--maher-text-secondary)]">({role.code})</span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirm}
        title={
          confirm?.type === 'reset'
            ? t('resetPassword')
            : confirm?.type === 'activate'
              ? t('activate')
              : t('deactivate')
        }
        description={
          confirm?.type === 'reset'
            ? t('confirmReset')
            : confirm?.type === 'activate'
              ? t('confirmActivate')
              : t('confirmDeactivate')
        }
        danger={confirm?.type === 'deactivate' || confirm?.type === 'reset'}
        loading={actionMutation.isPending}
        error={confirmError}
        onClose={() => !actionMutation.isPending && setConfirm(null)}
        onConfirm={() => actionMutation.mutate()}
      />
    </div>
  );
}
