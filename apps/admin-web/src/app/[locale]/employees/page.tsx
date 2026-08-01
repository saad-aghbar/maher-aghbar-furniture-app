'use client';

import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { PageHeader } from '@/components/admin/page-header';
import { Link } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api-client';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import {
  Alert,
  Button,
  EmptyState,
  ErrorState,
  Input,
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
  roles?: Array<{ role: { id: string; code: string; nameEn: string; nameAr?: string } }>;
}

interface RoleRow {
  id: string;
  code: string;
  nameEn: string;
  nameAr: string;
}

/** Operational staff roles (no separate Employee table). */
const EMPLOYEE_ROLE_CODES = new Set([
  'SALES_REPRESENTATIVE',
  'SALES_MANAGER',
  'PURCHASING_EMPLOYEE',
  'PURCHASING_MANAGER',
  'WAREHOUSE_EMPLOYEE',
  'WAREHOUSE_MANAGER',
  'PRODUCTION_WORKER',
  'PRODUCTION_SUPERVISOR',
  'QUALITY_INSPECTOR',
  'DELIVERY_EMPLOYEE',
  'ACCOUNTANT',
  'FINANCE_MANAGER',
  'GENERAL_MANAGER',
]);

export default function EmployeesPage() {
  const locale = useLocale();
  const t = useTranslations('users');
  const tNav = useTranslations('navigation');
  const tc = useTranslations('catalog');
  const tCommon = useTranslations('common');
  const queryClient = useQueryClient();

  const [q, setQ] = useState('');
  const [roleCode, setRoleCode] = useState('');
  const [isActive, setIsActive] = useState('');
  const [page, setPage] = useState(1);
  const [banner, setBanner] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ type: 'activate' | 'deactivate'; user: UserRow } | null>(
    null,
  );
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const listParams = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: '20' });
    if (q.trim()) params.set('q', q.trim());
    if (roleCode) params.set('roleCode', roleCode);
    if (isActive) params.set('isActive', isActive);
    return params.toString();
  }, [q, roleCode, isActive, page]);

  const usersQuery = useQuery({
    queryKey: ['employees', listParams],
    queryFn: () =>
      apiFetch<{ data: UserRow[]; meta: { page: number; totalPages: number; totalItems: number } }>(
        `/api/v1/users?${listParams}`,
      ),
  });

  const rolesQuery = useQuery({
    queryKey: ['roles'],
    queryFn: () => apiFetch<RoleRow[]>('/api/v1/roles'),
  });

  const actionMutation = useMutation({
    mutationFn: async () => {
      if (!confirm) return;
      await apiFetch(
        `/api/v1/users/${confirm.user.id}/${confirm.type === 'activate' ? 'activate' : 'deactivate'}`,
        { method: 'POST' },
      );
    },
    onSuccess: async () => {
      setConfirmError(null);
      await queryClient.invalidateQueries({ queryKey: ['employees'] });
      setBanner(confirm?.type === 'activate' ? t('activated') : t('deactivated'));
      setConfirm(null);
    },
    onError: (err) => setConfirmError(mutationErrorMessage(err)),
  });

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
        title={tNav('employees')}
        description={tCommon('loadFailed')}
        onRetry={() => usersQuery.refetch()}
        retryLabel={tCommon('retry')}
      />
    );
  }

  const employeeRoles = (rolesQuery.data ?? []).filter((r) => EMPLOYEE_ROLE_CODES.has(r.code));
  const rows = (usersQuery.data?.data ?? []).filter((row) => {
    if (roleCode) return true;
    return (row.roles ?? []).some((ur) => EMPLOYEE_ROLE_CODES.has(ur.role.code));
  });
  const meta = usersQuery.data?.meta;

  return (
    <div className="space-y-6">
      <PageHeader
        title={tNav('employees')}
        description={tc('employeesDescription')}
        actions={
          <Link href="/users">
            <Button variant="secondary">{tc('manageUsers')}</Button>
          </Link>
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
          {employeeRoles.map((role) => (
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
        <EmptyState title={tc('noEmployees')} />
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
                  {(row.roles ?? [])
                    .map((ur) => localizedName(locale, ur.role))
                    .join(', ') || '—'}
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
                    <Link href="/users">
                      <Button size="sm" variant="secondary">
                        {tCommon('edit')}
                      </Button>
                    </Link>
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

      <ConfirmDialog
        open={!!confirm}
        title={confirm?.type === 'activate' ? t('activate') : t('deactivate')}
        description={
          confirm?.type === 'activate' ? t('confirmActivate') : t('confirmDeactivate')
        }
        danger={confirm?.type === 'deactivate'}
        loading={actionMutation.isPending}
        error={confirmError}
        onClose={() => !actionMutation.isPending && setConfirm(null)}
        onConfirm={() => actionMutation.mutate()}
      />
    </div>
  );
}
