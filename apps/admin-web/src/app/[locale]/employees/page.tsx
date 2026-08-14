'use client';

import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { type DepartmentOption } from '@/components/admin/department-search-picker';
import { useRouter } from '@/i18n/navigation';
import { apiFetch, ApiClientError } from '@/lib/api-client';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import { useAuthMe } from '@/hooks/use-auth-me';
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
import {
  applyEmployeeTypeChange,
  applyIdentityChange,
  can,
  emptyUserIdentityForm,
  hydrateUserIdentityForm,
  IDENTITY_ROLE_CODES,
  isIdentityRoleCode,
  submittedRoleId,
  submittedStageDefinitionIds,
  type IdentityRoleCode,
  type UserIdentityForm,
} from '@maher/permissions';
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
  stageDefinitionIds?: string[];
  roles?: Array<{
    role: {
      id: string;
      code: string;
      nameEn: string;
      nameAr?: string;
      nameHe?: string | null;
      kind?: string | null;
    };
  }>;
}

interface RoleRow {
  id: string;
  code: string;
  nameEn: string;
  nameAr: string;
  nameHe?: string | null;
  kind?: string | null;
  isSystem?: boolean;
  isActive?: boolean;
  descriptionEn?: string | null;
  descriptionAr?: string | null;
  descriptionHe?: string | null;
}

interface StageDefinitionRow {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  nameHe?: string | null;
  isActive: boolean;
}

type DepartmentRow = DepartmentOption;

interface UserFormState {
  username: string;
  firstName: string;
  lastName: string;
  password: string;
  isActive: boolean;
  identity: UserIdentityForm;
  departmentId: string;
}

type Segment = 'workers' | 'staff' | 'customers' | 'admins' | 'all';

const SEGMENT_ROLE_KIND: Record<Exclude<Segment, 'all'>, string> = {
  workers: 'PRODUCTION_WORKER',
  staff: 'STAFF',
  customers: 'CUSTOMER',
  admins: 'ADMIN',
};

function identityFromSegment(seg: Segment): UserIdentityForm {
  if (seg === 'workers') {
    return { identityRoleCode: 'PRODUCTION_WORKER', employeeType: 'WORKER', staffTypeId: '', stageDefinitionIds: [] };
  }
  if (seg === 'staff') {
    return { identityRoleCode: 'PRODUCTION_WORKER', employeeType: 'STAFF', staffTypeId: '', stageDefinitionIds: [] };
  }
  if (seg === 'customers') {
    return { ...emptyUserIdentityForm(), identityRoleCode: 'CUSTOMER' };
  }
  if (seg === 'admins') {
    return { ...emptyUserIdentityForm(), identityRoleCode: 'SYSTEM_ADMINISTRATOR' };
  }
  return emptyUserIdentityForm();
}

function roleUsesDepartment(kind: string | undefined | null, roleCode?: string): boolean {
  if (kind === 'CUSTOMER' || kind === 'PRODUCTION_WORKER' || kind === 'ADMIN' || kind === 'STAFF') {
    return false;
  }
  if (
    roleCode === 'CUSTOMER' ||
    roleCode === 'PRODUCTION_WORKER' ||
    roleCode === 'SYSTEM_ADMINISTRATOR'
  ) {
    return false;
  }
  return Boolean(kind || roleCode);
}

function userShowsDepartment(user: UserRow): boolean {
  const roles = user.roles ?? [];
  if (!roles.length) return false;
  return roles.some((r) => roleUsesDepartment(r.role.kind, r.role.code));
}

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

const emptyForm = (segment: Segment = 'workers'): UserFormState => ({
  username: '',
  firstName: '',
  lastName: '',
  password: '',
  isActive: true,
  identity: identityFromSegment(segment),
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
  const me = useAuthMe();
  const canManageStaffTypes = can(me.data, 'role.manage');
  const router = useRouter();

  const [segment, setSegment] = useState<Segment>('workers');
  const [q, setQ] = useState('');
  const [roleCode, setRoleCode] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [staffTypeId, setStaffTypeId] = useState('');
  const [isActive, setIsActive] = useState('');
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [form, setForm] = useState<UserFormState>(() => emptyForm('workers'));
  const [formError, setFormError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<
    { type: 'activate' | 'deactivate' | 'reset'; user: UserRow } | null
  >(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [editDeepLinkHandled, setEditDeepLinkHandled] = useState(false);

  const showRoleFilter = segment === 'all';
  const showStaffTypeFilter = segment === 'staff';
  const showDepartmentFilter = segment === 'all';
  const showDepartmentColumn = segment === 'all';

  const listParams = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: '20' });
    if (q.trim()) params.set('q', q.trim());
    if (showRoleFilter && roleCode) {
      params.set('roleCode', roleCode);
    } else if (showStaffTypeFilter && staffTypeId) {
      params.set('staffTypeId', staffTypeId);
    } else if (segment !== 'all') {
      params.set('roleKind', SEGMENT_ROLE_KIND[segment]);
    }
    if (showDepartmentFilter && departmentId) {
      params.set('departmentId', departmentId);
    }
    if (isActive) params.set('isActive', isActive);
    return params.toString();
  }, [
    q,
    roleCode,
    departmentId,
    isActive,
    page,
    segment,
    showRoleFilter,
    showDepartmentFilter,
    showStaffTypeFilter,
    staffTypeId,
  ]);

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
    enabled: showDepartmentFilter || formOpen,
  });

  const staffTypesQuery = useQuery({
    queryKey: ['staff-types', 'assign'],
    queryFn: () => apiFetch<RoleRow[]>('/api/v1/staff-types'),
    enabled: formOpen || showStaffTypeFilter,
  });

  const stagesQuery = useQuery({
    queryKey: ['production-stage-library'],
    queryFn: () => apiFetch<StageDefinitionRow[]>('/api/v1/production-stage-library'),
    enabled: formOpen,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const username = form.username.trim().toLowerCase();
      if (!username) {
        throw new ApiClientError(tVal('usernameRequired'), 400);
      }
      if (form.identity.identityRoleCode === 'PRODUCTION_WORKER' && !form.identity.employeeType) {
        throw new ApiClientError(tVal('employeeTypeRequired'), 400);
      }
      if (
        form.identity.identityRoleCode === 'PRODUCTION_WORKER' &&
        form.identity.employeeType === 'STAFF' &&
        !form.identity.staffTypeId
      ) {
        throw new ApiClientError(tVal('staffTypeRequired'), 400);
      }

      const lookup = [...(rolesQuery.data ?? []), ...(staffTypesQuery.data ?? [])];
      const roleId = submittedRoleId(form.identity, lookup);
      if (!roleId) {
        throw new ApiClientError(tVal('roleRequired'), 400);
      }
      const usesDepartment = false;
      const stageIds = submittedStageDefinitionIds(form.identity);

      if (editing) {
        const firstName = form.firstName.trim();
        const lastName = form.lastName.trim();
        if (!firstName || !lastName) {
          throw new ApiClientError(tVal('nameRequired'), 400);
        }
        return apiFetch<UserRow>(`/api/v1/users/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            username,
            firstName,
            lastName,
            isActive: form.isActive,
            departmentId: usesDepartment ? form.departmentId || null : null,
            roleIds: [roleId],
            ...(form.password.trim() ? { password: form.password.trim() } : {}),
            stageDefinitionIds: stageIds,
          }),
        });
      }

      const { firstName, lastName } = namesFromUsername(username);

      return apiFetch<UserRow & { temporaryPassword?: string }>('/api/v1/users', {
        method: 'POST',
        body: JSON.stringify({
          username,
          firstName,
          lastName,
          roleIds: [roleId],
          ...(form.password.trim() ? { password: form.password } : {}),
          stageDefinitionIds: stageIds,
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
    setForm(emptyForm(segment));
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(user: UserRow) {
    const assigned = (user.roles ?? [])[0]?.role;
    const identity = assigned
      ? {
          ...hydrateUserIdentityForm(assigned),
          stageDefinitionIds:
            assigned.kind === 'PRODUCTION_WORKER' || assigned.code === 'PRODUCTION_WORKER'
              ? (user.stageDefinitionIds ?? [])
              : [],
        }
      : emptyUserIdentityForm();
    setEditing(user);
    setForm({
      username: user.username ?? '',
      firstName: user.firstName,
      lastName: user.lastName,
      password: '',
      isActive: user.isActive,
      identity,
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
  const staffTypes = staffTypesQuery.data ?? [];
  const departments = departmentsQuery.data ?? [];
  const identityRoles = IDENTITY_ROLE_CODES.map((code) => roles.find((r) => r.code === code)).filter(
    (r): r is RoleRow => Boolean(r),
  );
  const isWorkerIdentity = form.identity.identityRoleCode === 'PRODUCTION_WORKER';
  const showFormStageSkills = isWorkerIdentity && form.identity.employeeType === 'WORKER';
  const showFormStaffType = isWorkerIdentity && form.identity.employeeType === 'STAFF';
  const assignableStaffTypes = staffTypes.filter(
    (type) => type.isActive !== false || type.id === form.identity.staffTypeId,
  );
  const activeStages = (stagesQuery.data ?? []).filter((s) => s.isActive);

  const segments: Array<{ key: Segment; label: string }> = [
    { key: 'workers', label: t('segmentWorkers') },
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
        actions={
          <div className="flex flex-wrap gap-2">
            {canManageStaffTypes ? (
              <Button variant="secondary" onClick={() => router.push('/employees/staff-types')}>
                {t('staffTypes')}
              </Button>
            ) : null}
            <Button onClick={openCreate}>{t('add')}</Button>
          </div>
        }
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
              setStaffTypeId('');
              if (s.key !== 'all') setDepartmentId('');
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
        {showStaffTypeFilter ? (
          <Select
            value={staffTypeId}
            onChange={(e) => {
              setPage(1);
              setStaffTypeId(e.target.value);
            }}
            aria-label={t('staffType')}
            className="w-52 shrink-0"
          >
            <option value="">{t('staffTypeFilterAll')}</option>
            {staffTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {localizedName(locale, type)}
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
                  {showDepartmentColumn && userShowsDepartment(row) ? (
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
            value={identityRoles.find((r) => r.code === form.identity.identityRoleCode)?.id ?? ''}
            onChange={(e) => {
              const nextCode = identityRoles.find((r) => r.id === e.target.value)?.code;
              if (!nextCode || !isIdentityRoleCode(nextCode)) return;
              setForm((f) => ({
                ...f,
                identity: applyIdentityChange(f.identity, nextCode as IdentityRoleCode),
                departmentId: '',
              }));
            }}
            required
          >
            <option value="">—</option>
            {identityRoles.map((role) => (
              <option key={role.id} value={role.id}>
                {localizedName(locale, role)}
              </option>
            ))}
          </Select>
          {isWorkerIdentity ? (
            <Select
              label={`${t('employeeType')} *`}
              value={form.identity.employeeType || 'WORKER'}
              onChange={(e) => {
                const next = e.target.value === 'STAFF' ? 'STAFF' : 'WORKER';
                setForm((f) => ({
                  ...f,
                  identity: applyEmployeeTypeChange(f.identity, next),
                }));
              }}
              required
            >
              <option value="WORKER">{t('employeeTypeWorker')}</option>
              <option value="STAFF">{t('employeeTypeStaff')}</option>
            </Select>
          ) : null}
          {showFormStaffType ? (
            <div className="grid gap-2">
              <Select
                label={`${t('staffType')} *`}
                value={form.identity.staffTypeId}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    identity: { ...f.identity, staffTypeId: e.target.value },
                  }))
                }
                required
              >
                <option value="">—</option>
                {assignableStaffTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {localizedName(locale, type)}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-text-tertiary">{t('staffTypeHint')}</p>
            </div>
          ) : null}
          {showFormStageSkills ? (
            <fieldset className="grid gap-2">
              <legend className="text-sm font-medium text-text-primary">{t('stageSkills')}</legend>
              <p className="text-xs text-text-tertiary">{t('stageSkillsHint')}</p>
              {stagesQuery.isLoading ? (
                <p className="text-sm text-text-tertiary">{tCommon('loading')}</p>
              ) : activeStages.length === 0 ? (
                <p className="text-sm text-text-tertiary">{t('noStagesYet')}</p>
              ) : (
                <div className="grid gap-1.5">
                  {activeStages.map((stage) => {
                    const checked = form.identity.stageDefinitionIds.includes(stage.id);
                    return (
                      <label
                        key={stage.id}
                        className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:border-brand/40"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setForm((f) => ({
                              ...f,
                              identity: {
                                ...f.identity,
                                stageDefinitionIds: checked
                                  ? f.identity.stageDefinitionIds.filter((id) => id !== stage.id)
                                  : [...f.identity.stageDefinitionIds, stage.id],
                              },
                            }))
                          }
                        />
                        <span>{localizedName(locale, stage, stage.code)}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </fieldset>
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
