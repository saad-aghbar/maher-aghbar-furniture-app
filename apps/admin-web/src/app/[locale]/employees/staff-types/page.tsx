'use client';

import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { useRouter } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api-client';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import {
  Alert,
  Button,
  Card,
  EmptyState,
  ErrorState,
  PageHero,
  Skeleton,
  StatusBadge,
} from '@maher/ui';
import { localizedName } from '@maher/i18n';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

export type StaffTypeRow = {
  id: string;
  code: string;
  nameEn: string;
  nameAr: string;
  nameHe?: string | null;
  kind: string;
  isSystem: boolean;
  isActive: boolean;
  iconKey?: string | null;
  descriptionEn?: string | null;
  descriptionAr?: string | null;
  descriptionHe?: string | null;
  _count?: { users?: number; permissions?: number };
  permissions?: Array<{ permission: { code: string } }>;
};

export default function StaffTypesPage() {
  const locale = useLocale();
  const t = useTranslations('users');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const queryClient = useQueryClient();
  const [banner, setBanner] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ type: 'deactivate' | 'delete'; id: string } | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: ['staff-types'],
    queryFn: () => apiFetch<StaffTypeRow[]>('/api/v1/staff-types'),
  });

  const duplicateMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch<StaffTypeRow>(`/api/v1/staff-types/${id}/duplicate`, { method: 'POST', body: '{}' }),
    onSuccess: async (row) => {
      await queryClient.invalidateQueries({ queryKey: ['staff-types'] });
      setErrorBanner(null);
      setBanner(t('staffTypeDuplicated'));
      router.push(`/employees/staff-types/${row.id}`);
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch<StaffTypeRow>(`/api/v1/staff-types/${id}/deactivate`, { method: 'POST', body: '{}' }),
    onSuccess: async () => {
      setConfirmError(null);
      await queryClient.invalidateQueries({ queryKey: ['staff-types'] });
      setErrorBanner(null);
      setBanner(t('staffTypeDeactivated'));
      setConfirm(null);
    },
    onError: (err) => setConfirmError(mutationErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ ok: true }>(`/api/v1/staff-types/${id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      setConfirmError(null);
      await queryClient.invalidateQueries({ queryKey: ['staff-types'] });
      setErrorBanner(null);
      setBanner(t('staffTypeDeleted'));
      setConfirm(null);
    },
    onError: (err) => setConfirmError(mutationErrorMessage(err)),
  });

  if (listQuery.isLoading && !listQuery.data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (listQuery.isError && !listQuery.data) {
    return (
      <ErrorState
        title={t('staffTypesTitle')}
        description={tCommon('loadFailed')}
        onRetry={() => listQuery.refetch()}
        retryLabel={tCommon('retry')}
      />
    );
  }

  const rows = listQuery.data ?? [];

  return (
    <div className="space-y-6">
      <PageHero
        title={t('staffTypesTitle')}
        description={t('staffTypesDescription')}
        tone="soft"
        actions={
          <Button onClick={() => router.push('/employees/staff-types/new')}>{t('newStaffType')}</Button>
        }
      />

      {errorBanner ? <Alert variant="error">{errorBanner}</Alert> : null}
      {banner ? <Alert variant="success">{banner}</Alert> : null}

      {rows.length === 0 ? (
        <EmptyState title={t('emptyStaffTypes')} />
      ) : (
        <div className="maher-stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => {
            const users = row._count?.users ?? 0;
            const perms = row._count?.permissions ?? row.permissions?.length ?? 0;
            return (
              <Card
                key={row.id}
                className="maher-list-card"
                title={localizedName(locale, row)}
                description={
                  locale === 'ar'
                    ? row.descriptionAr
                    : locale === 'he'
                      ? row.descriptionHe
                      : row.descriptionEn
                }
                actions={
                  <StatusBadge
                    status={row.isActive ? 'ACTIVE' : 'INACTIVE'}
                    label={row.isActive ? t('active') : t('inactive')}
                  />
                }
                footer={
                  <div className="flex flex-wrap gap-1">
                    <Button size="sm" variant="secondary" onClick={() => router.push(`/employees/staff-types/${row.id}`)}>
                      {t('view')}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => router.push(`/employees/staff-types/${row.id}`)}>
                      {tCommon('edit')}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => duplicateMutation.mutate(row.id)}
                      loading={duplicateMutation.isPending && duplicateMutation.variables === row.id}
                    >
                      {t('duplicate')}
                    </Button>
                    {row.isActive && !row.isSystem ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setConfirmError(null);
                          setConfirm({ type: 'deactivate', id: row.id });
                        }}
                      >
                        {tCommon('deactivate')}
                      </Button>
                    ) : null}
                    {!row.isSystem ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        leadingIcon={<Trash2 className="h-3.5 w-3.5" />}
                        className="text-[var(--maher-error)] hover:bg-[var(--maher-error-soft)] hover:text-[var(--maher-error)]"
                        aria-label={tCommon('delete')}
                        onClick={() => {
                          setConfirmError(null);
                          setErrorBanner(null);
                          if ((row._count?.users ?? 0) > 0) {
                            setBanner(null);
                            setErrorBanner(t('cannotDeleteAssigned'));
                            return;
                          }
                          setConfirm({ type: 'delete', id: row.id });
                        }}
                      />
                    ) : null}
                  </div>
                }
              >
                <dl className="grid gap-2.5 text-sm text-start">
                  <div>
                    <dt className="text-text-tertiary">{t('usersAssignedCount', { n: users })}</dt>
                    <dd className="mt-0.5 text-text-primary">
                      {t('permissionCount', { n: perms })}
                      {' · '}
                      {row.isSystem ? t('systemPreset') : t('custom')}
                    </dd>
                  </div>
                </dl>
              </Card>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.type === 'delete' ? tCommon('delete') : tCommon('deactivate')}
        description={
          confirm?.type === 'delete' ? t('confirmDeleteStaffType') : t('confirmDeactivateStaffType')
        }
        confirmLabel={confirm?.type === 'delete' ? tCommon('delete') : tCommon('deactivate')}
        danger
        loading={deactivateMutation.isPending || deleteMutation.isPending}
        error={confirmError}
        onClose={() =>
          !deactivateMutation.isPending && !deleteMutation.isPending && setConfirm(null)
        }
        onConfirm={() => {
          if (!confirm) return;
          if (confirm.type === 'delete') {
            deleteMutation.mutate(confirm.id);
            return;
          }
          deactivateMutation.mutate(confirm.id);
        }}
      />
    </div>
  );
}
