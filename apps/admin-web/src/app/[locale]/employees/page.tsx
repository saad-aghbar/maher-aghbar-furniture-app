'use client';

import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import {
  DepartmentSearchPicker,
  type DepartmentOption,
} from '@/components/admin/department-search-picker';
import { apiFetch, ApiClientError } from '@/lib/api-client';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import {
  Alert,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  Ltr,
  Modal,
  PageHero,
  Select,
  Skeleton,
  StatusBadge,
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

type DepartmentRow = DepartmentOption;

interface UserFormState {
  username: string;
  firstName: string;
  lastName: string;
  password: string;
  isActive: boolean;
  roleId: string;
  departmentId: string;
}

type Segment = 'staff' | 'customers' | 'admins' | 'all';

const SEGMENT_ROLE_CODE: Record<Exclude<Segment, 'all'>, string> = {
  staff: 'PRODUCTION_WORKER',
  customers: 'CUSTOMER',
  admins: 'SYSTEM_ADMINISTRATOR',
};

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

export default function UsersPage() {
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
      <UsersHub />
    </Suspense>
  );
}

function UsersHub() {
  const locale = useLocale();
  const t = useTranslations('users');
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

  const showRoleFilter = segment === 'all';
  const showDepartmentFilter = segment !== 'customers';
  const showDepartmentColumn = segment !== 'customers';

  const listParams = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: '20' });
    if (q.trim()) params.set('q', q.trim());
    if (showRoleFilter && roleCode) {
      params.set('roleCode', roleCode);
    } else if (segment !== 'all') {
      params.set('roleCode', SEGMENT_ROLE_CODE[segment]);
    }
    if (showDepartmentFilter && departmentId) {
      params.set('departmentId', departmentId);
    }
    if (isActive) params.set('isActive', isActive);
    return params.toString();
  }, [q, roleCode, departmentId, isActive, page, segment, showRoleFilter, showDepartmentFilter]);

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
            departmentId:
              rolesQuery.data?.find((r) => r.id === form.roleId)?.code === 'CUSTOMER'
                ? null
                : form.departmentId || null,
            roleIds: [form.roleId],
            ...(form.password.trim() ? { password: form.password.trim() } : {}),
          }),
        });
      }

      if (!form.roleId) {
        throw new ApiClientError(tVal('roleRequired'), 400);
      }

      const { firstName, lastName } = namesFromUsername(username);
      const isCustomerRole =
        rolesQuery.data?.find((r) => r.id === form.roleId)?.code === 'CUSTOMER';

      return apiFetch<UserRow & { temporaryPassword?: string }>('/api/v1/users', {
        method: 'POST',
        body: JSON.stringify({
          username,
          firstName,
          lastName,
          roleIds: [form.roleId],
          ...(!isCustomerRole && form.departmentId ? { departmentId: form.departmentId } : {}),
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

  function preferredRoleIdForSegment(seg: Segment): string {
    if (seg === 'all') return '';
    return (rolesQuery.data ?? []).find((r) => r.code === SEGMENT_ROLE_CODE[seg])?.id ?? '';
  }

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm(), roleId: preferredRoleIdForSegment(segment) });
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
  const formRoles = roles;
  const selectedFormRoleCode = roles.find((r) => r.id === form.roleId)?.code;
  const showFormDepartment = selectedFormRoleCode !== 'CUSTOMER';

  const segments: Array<{ key: Segment; label: string }> = [
    { key: 'staff', label: t('segmentStaff') },
    { key: 'customers', label: t('segmentCustomers') },
    { key: 'admins', label: t('segmentAdmins') },
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
        title={t('title')}
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
        title={t('title')}
        description={t('description')}
        tone="soft"
        actions={<Button onClick={openCreate}>{t('add')}</Button>}
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
              if (s.key === 'customers') setDepartmentId('');
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
        <div className="min-w-[min(100%,20rem)] flex-1 basis-[20rem]">
          <Input
            value={q}
            onChange={(e) => {
              setPage(1);
              setQ(e.target.value);
            }}
            placeholder={t('searchPlaceholder')}
            withSearchIcon
          />
        </div>
        {showRoleFilter ? (
          <Select
            value={roleCode}
            onChange={(e) => {
              setPage(1);
              setRoleCode(e.target.value);
            }}
            aria-label={t('filterRole')}
            className="w-44 shrink-0"
          >
            <option value="">{tCommon('all')}</option>
            {roles.map((role) => (
              <option key={role.id} value={role.code}>
                {localizedName(locale, role)}
              </option>
            ))}
          </Select>
        ) : null}
        {showDepartmentFilter ? (
          <Select
            value={departmentId}
            onChange={(e) => {
              setPage(1);
              setDepartmentId(e.target.value);
            }}
            aria-label={t('department')}
            className="w-48 shrink-0"
          >
            <option value="">{t('allDepartments')}</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {localizedName(locale, dept)}
              </option>
            ))}
          </Select>
        ) : null}
        <Select
          value={isActive}
          onChange={(e) => {
            setPage(1);
            setIsActive(e.target.value);
          }}
          aria-label={t('filterStatus')}
          className="w-36 shrink-0"
        >
          <option value="">{tCommon('all')}</option>
          <option value="true">{t('active')}</option>
          <option value="false">{t('inactive')}</option>
        </Select>
      </div>

      {rows.length === 0 ? (
        <EmptyState title={t('empty')} />
      ) : (
        <div className="maher-stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => {
            const roleLabel =
              (row.roles ?? [])
                .map((ur) => localizedName(locale, ur.role))
                .join(', ') || '—';
            return (
              <Card
                key={row.id}
                className="maher-list-card"
                title={`${row.firstName} ${row.lastName}`}
                description={<Ltr>{row.username ?? '—'}</Ltr>}
                actions={
                  <StatusBadge
                    status={row.isActive ? 'ACTIVE' : 'INACTIVE'}
                    label={row.isActive ? t('active') : t('inactive')}
                  />
                }
                footer={
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
                }
              >
                <dl className="grid gap-2.5 text-sm text-start">
                  <div>
                    <dt className="text-text-tertiary">{t('roles')}</dt>
                    <dd className="mt-0.5 text-text-primary">{roleLabel}</dd>
                  </div>
                  {showDepartmentColumn ? (
                    <div>
                      <dt className="text-text-tertiary">{t('department')}</dt>
                      <dd className="mt-0.5 text-text-primary">
                        {row.department ? localizedName(locale, row.department) : '—'}
                      </dd>
                    </div>
                  ) : null}
                  <div>
                    <dt className="text-text-tertiary">{t('lastLogin')}</dt>
                    <dd className="mt-0.5 text-text-primary">
                      {row.lastLoginAt ? (
                        <Ltr>{new Date(row.lastLoginAt).toLocaleString()}</Ltr>
                      ) : (
                        t('never')
                      )}
                    </dd>
                  </div>
                </dl>
              </Card>
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
            onChange={(e) => {
              const nextRoleId = e.target.value;
              const nextCode = roles.find((r) => r.id === nextRoleId)?.code;
              setForm((f) => ({
                ...f,
                roleId: nextRoleId,
                ...(nextCode === 'CUSTOMER' ? { departmentId: '' } : {}),
              }));
            }}
            required
          >
            <option value="">—</option>
            {formRoles.map((role) => (
              <option key={role.id} value={role.id}>
                {localizedName(locale, role)}
              </option>
            ))}
          </Select>
          {showFormDepartment ? (
            <DepartmentSearchPicker
              label={t('department')}
              value={form.departmentId}
              selectedDepartment={
                departments.find((d) => d.id === form.departmentId) ?? null
              }
              onChange={(id) => setForm((f) => ({ ...f, departmentId: id }))}
            />
          ) : null}
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
