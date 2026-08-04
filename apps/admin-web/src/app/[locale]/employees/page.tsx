'use client';

import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { apiFetch, ApiClientError } from '@/lib/api-client';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import {
  Alert,
  Button,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  PageHero,
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
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';

interface UserRow {
  id: string;
  username: string | null;
  email: string | null;
  phone: string | null;
  firstName: string;
  lastName: string;
  preferredLanguage: string;
  isActive: boolean;
  lastLoginAt: string | null;
  customerId: string | null;
  departmentId?: string | null;
  department?: {
    id: string;
    code: string;
    nameAr?: string | null;
    nameEn?: string | null;
  } | null;
  roles?: Array<{ role: { id: string; code: string; nameEn: string; nameAr?: string } }>;
}

interface RoleRow {
  id: string;
  code: string;
  nameEn: string;
  nameAr: string;
}

interface DepartmentRow {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
}

interface UserFormState {
  username: string;
  firstName: string;
  lastName: string;
  password: string;
  isActive: boolean;
  roleId: string;
  departmentId: string;
}

type Segment = 'staff' | 'customers' | 'all';

/** Operational staff + system admin (not portal customers). */
const STAFF_ROLE_CODES = ['SYSTEM_ADMINISTRATOR', 'PRODUCTION_WORKER'] as const;

function namesFromUsername(username: string): { firstName: string; lastName: string } {
  const normalized = username.trim().toLowerCase();
  const parts = normalized.split(/[._-]+/).filter(Boolean);
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  if (parts.length >= 2) {
    return {
      firstName: cap(parts[0] ?? normalized),
      lastName: cap(parts.slice(1).join(' ')),
    };
  }
  const single = cap(normalized);
  return { firstName: single, lastName: single };
}

const emptyForm = (): UserFormState => ({
  username: '',
  firstName: '',
  lastName: '',
  password: '',
  isActive: true,
  roleId: '',
  departmentId: '',
});

export default function EmployeesPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-12 w-full max-w-xl" />
          <Skeleton className="h-64 w-full" />
        </div>
      }
    >
      <EmployeesHub />
    </Suspense>
  );
}

function EmployeesHub() {
  const locale = useLocale();
  const t = useTranslations('users');
  const tNav = useTranslations('navigation');
  const tc = useTranslations('catalog');
  const tCommon = useTranslations('common');
  const tVal = useTranslations('validation');
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();

  const [segment, setSegment] = useState<Segment>('staff');
  const [q, setQ] = useState('');
  const [roleCode, setRoleCode] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [isActive, setIsActive] = useState('');
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [form, setForm] = useState<UserFormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<
    { type: 'activate' | 'deactivate' | 'reset'; user: UserRow } | null
  >(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [editDeepLinkHandled, setEditDeepLinkHandled] = useState(false);

  const listParams = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: '20' });
    if (q.trim()) params.set('q', q.trim());
    if (roleCode) {
      params.set('roleCode', roleCode);
    } else if (segment === 'staff') {
      params.set('roleCodes', STAFF_ROLE_CODES.join(','));
    } else if (segment === 'customers') {
      params.set('roleCode', 'CUSTOMER');
    }
    if (departmentId) params.set('departmentId', departmentId);
    if (isActive) params.set('isActive', isActive);
    return params.toString();
  }, [q, roleCode, departmentId, isActive, page, segment]);

  const usersQuery = useQuery({
    queryKey: ['people', listParams],
    queryFn: () =>
      apiFetch<{ data: UserRow[]; meta: { page: number; totalPages: number; totalItems: number } }>(
        `/api/v1/users?${listParams}`,
      ),
    placeholderData: keepPreviousData,
  });

  const rolesQuery = useQuery({
    queryKey: ['roles'],
    queryFn: () => apiFetch<RoleRow[]>('/api/v1/roles'),
  });

  const departmentsQuery = useQuery({
    queryKey: ['departments-people'],
    queryFn: () =>
      apiFetch<{ data: DepartmentRow[] }>('/api/v1/departments?pageSize=100').then(
        (r) => r.data ?? [],
      ),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const username = form.username.trim().toLowerCase();
      if (!username) {
        throw new ApiClientError(tVal('usernameRequired'), 400);
      }

      if (editing) {
        const firstName = form.firstName.trim();
        const lastName = form.lastName.trim();
        if (!firstName || !lastName) {
          throw new ApiClientError(tVal('nameRequired'), 400);
        }
        if (!form.roleId) {
          throw new ApiClientError(tVal('roleRequired'), 400);
        }
        if (form.password.trim() && form.password.trim().length < 8) {
          throw new ApiClientError(tVal('passwordMin'), 400);
        }
        return apiFetch<UserRow>(`/api/v1/users/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            username,
            firstName,
            lastName,
            isActive: form.isActive,
            departmentId: form.departmentId || null,
            roleIds: [form.roleId],
            ...(form.password.trim() ? { password: form.password.trim() } : {}),
          }),
        });
      }

      if (!form.roleId) {
        throw new ApiClientError(tVal('roleRequired'), 400);
      }

      const { firstName, lastName } = namesFromUsername(username);

      return apiFetch<UserRow & { temporaryPassword?: string }>('/api/v1/users', {
        method: 'POST',
        body: JSON.stringify({
          username,
          firstName,
          lastName,
          roleIds: [form.roleId],
          ...(form.departmentId ? { departmentId: form.departmentId } : {}),
          ...(form.password.trim() ? { password: form.password } : {}),
        }),
      });
    },
    onSuccess: async (data) => {
      setFormError(null);
      await queryClient.invalidateQueries({ queryKey: ['people'] });
      setFormOpen(false);
      const wasEditing = !!editing;
      const passwordSet = wasEditing && !!form.password.trim();
      setEditing(null);
      const temp =
        'temporaryPassword' in data && data.temporaryPassword
          ? ` ${t('tempPassword')} ${data.temporaryPassword}`
          : '';
      const passwordNote = passwordSet ? ` ${t('passwordChanged')}` : '';
      setBanner((wasEditing ? t('updated') : t('created')) + temp + passwordNote);
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
      await queryClient.invalidateQueries({ queryKey: ['people'] });
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
    const preferredRole =
      segment === 'customers'
        ? (rolesQuery.data ?? []).find((r) => r.code === 'CUSTOMER')?.id ?? ''
        : '';
    setForm({ ...emptyForm(), roleId: preferredRole });
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(user: UserRow) {
    setEditing(user);
    setForm({
      username: user.username ?? '',
      firstName: user.firstName,
      lastName: user.lastName,
      password: '',
      isActive: user.isActive,
      roleId: (user.roles ?? [])[0]?.role.id ?? '',
      departmentId: user.departmentId ?? user.department?.id ?? '',
    });
    setFormError(null);
    setFormOpen(true);
  }

  useEffect(() => {
    if (editDeepLinkHandled || usersQuery.isLoading) return;
    const editId = searchParams.get('edit');
    if (!editId) return;
    const row = (usersQuery.data?.data ?? []).find((u) => u.id === editId);
    if (row) {
      openEdit(row);
      setEditDeepLinkHandled(true);
      return;
    }
    // If not on current page, fetch that user directly.
    void apiFetch<UserRow>(`/api/v1/users/${editId}`)
      .then((user) => {
        openEdit(user);
        setEditDeepLinkHandled(true);
      })
      .catch(() => setEditDeepLinkHandled(true));
  }, [editDeepLinkHandled, searchParams, usersQuery.data, usersQuery.isLoading]);

  const roles = rolesQuery.data ?? [];
  const departments = departmentsQuery.data ?? [];
  const filterRoles = useMemo(() => {
    if (segment === 'staff') return roles.filter((r) => STAFF_ROLE_CODES.includes(r.code as (typeof STAFF_ROLE_CODES)[number]));
    if (segment === 'customers') return roles.filter((r) => r.code === 'CUSTOMER');
    return roles;
  }, [roles, segment]);
  const formRoles = useMemo(() => {
    // Full role list so any account type can be created/edited from one place.
    return roles;
  }, [roles]);

  const segments: Array<{ key: Segment; label: string }> = [
    { key: 'staff', label: t('segmentStaff') },
    { key: 'customers', label: t('segmentCustomers') },
    { key: 'all', label: t('segmentAll') },
  ];

  if (usersQuery.isLoading && !usersQuery.data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-12 w-full max-w-xl" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (usersQuery.isError && !usersQuery.data) {
    return (
      <ErrorState
        title={tNav('employees')}
        description={tCommon('loadFailed')}
        onRetry={() => usersQuery.refetch()}
        retryLabel={tCommon('retry')}
      />
    );
  }

  const rows = usersQuery.data?.data ?? [];
  const meta = usersQuery.data?.meta;

  return (
    <div className="space-y-6">
      <PageHero
        title={tNav('employees')}
        description={tc('employeesDescription')}
        tone="soft"
        actions={<Button onClick={openCreate}>{t('addPerson')}</Button>}
      />

      {banner ? <Alert variant="success">{banner}</Alert> : null}

      <div className="flex flex-wrap gap-2">
        {segments.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => {
              setSegment(s.key);
              setRoleCode('');
              setPage(1);
            }}
            className={[
              'rounded-lg border px-3 py-1.5 text-sm font-medium transition',
              segment === s.key
                ? 'border-brand bg-[var(--maher-brand-soft)] text-brand'
                : 'border-border bg-surface text-text-secondary hover:border-brand/40 hover:text-text-primary',
            ].join(' ')}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <Input
          value={q}
          onChange={(e) => {
            setPage(1);
            setQ(e.target.value);
          }}
          placeholder={t('searchPlaceholder')}
          withSearchIcon
          className="min-w-[220px] flex-1"
        />
        <Select
          value={roleCode}
          onChange={(e) => {
            setPage(1);
            setRoleCode(e.target.value);
          }}
          aria-label={t('filterRole')}
          className="min-w-[160px]"
        >
          <option value="">{tCommon('all')}</option>
          {filterRoles.map((role) => (
            <option key={role.id} value={role.code}>
              {localizedName(locale, role)}
            </option>
          ))}
        </Select>
        <Select
          value={departmentId}
          onChange={(e) => {
            setPage(1);
            setDepartmentId(e.target.value);
          }}
          aria-label={t('department')}
          className="min-w-[160px]"
        >
          <option value="">{t('allDepartments')}</option>
          {departments.map((dept) => (
            <option key={dept.id} value={dept.id}>
              {localizedName(locale, dept)}
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
          className="min-w-[140px]"
        >
          <option value="">{tCommon('all')}</option>
          <option value="true">{t('active')}</option>
          <option value="false">{t('inactive')}</option>
        </Select>
      </div>

      {rows.length === 0 ? (
        <EmptyState title={tc('noEmployees')} />
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>{t('name')}</TableHeaderCell>
              <TableHeaderCell>{t('username')}</TableHeaderCell>
              <TableHeaderCell>{t('roles')}</TableHeaderCell>
              <TableHeaderCell>{t('department')}</TableHeaderCell>
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
                <TableCell>
                  <span dir="ltr">{row.username ?? '—'}</span>
                </TableCell>
                <TableCell>
                  {(row.roles ?? [])
                    .map((ur) => localizedName(locale, ur.role))
                    .join(', ') || '—'}
                </TableCell>
                <TableCell>
                  {row.department ? localizedName(locale, row.department) : '—'}
                </TableCell>
                <TableCell>{row.isActive ? t('active') : t('inactive')}</TableCell>
                <TableCell>
                  {row.lastLoginAt ? (
                    <span dir="ltr">{new Date(row.lastLoginAt).toLocaleString()}</span>
                  ) : (
                    t('never')
                  )}
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
        onClose={() => !saveMutation.isPending && setFormOpen(false)}
        title={editing ? t('editPerson') : t('addPerson')}
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
        <div className="maher-form-section grid max-h-[60vh] gap-3 overflow-y-auto">
          {formError ? <Alert variant="error">{formError}</Alert> : null}
          <Input
            label={`${t('username')} *`}
            value={form.username}
            onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
            autoComplete="off"
            hint={editing ? t('usernameUniqueHint') : undefined}
            required
          />
          <Input
            label={editing ? t('newPassword') : t('password')}
            type="password"
            value={form.password}
            hint={editing ? t('newPasswordHint') : t('passwordHint')}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            autoComplete="new-password"
          />
          {editing ? (
            <>
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
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                />
                {t('active')}
              </label>
            </>
          ) : null}
          <Select
            label={`${t('roles')} *`}
            value={form.roleId}
            onChange={(e) => setForm((f) => ({ ...f, roleId: e.target.value }))}
            required
          >
            <option value="">—</option>
            {formRoles.map((role) => (
              <option key={role.id} value={role.id}>
                {localizedName(locale, role)}
              </option>
            ))}
          </Select>
          <Select
            label={t('department')}
            value={form.departmentId}
            onChange={(e) => setForm((f) => ({ ...f, departmentId: e.target.value }))}
          >
            <option value="">{t('noDepartment')}</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {localizedName(locale, dept)}
              </option>
            ))}
          </Select>
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
