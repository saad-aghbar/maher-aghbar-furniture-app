'use client';

import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { useRouter } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api-client';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import { Alert, Board, BoardSkeleton, Button, ErrorBoard, Figure, Menu, Meter, Stamp } from '@maher/ui';
import { localizedName } from '@maher/i18n';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, MoreHorizontal, Pencil, Power, Trash2 } from 'lucide-react';
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
      router.push(`/admin/employees/staff-types/${row.id}`);
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
      <div className="space-y-5">
        <BoardSkeleton rows={2} />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <BoardSkeleton rows={3} />
          <BoardSkeleton rows={3} />
          <BoardSkeleton rows={3} />
        </div>
      </div>
    );
  }

  if (listQuery.isError && !listQuery.data) {
    return (
      <ErrorBoard
        title={t('staffTypesTitle')}
        description={tCommon('loadFailed')}
        onRetry={() => listQuery.refetch()}
        retryLabel={tCommon('retry')}
      />
    );
  }

  const rows = listQuery.data ?? [];
  const maxPerms = Math.max(1, ...rows.map((r) => r._count?.permissions ?? r.permissions?.length ?? 0));
  const totalUsers = rows.reduce((acc, r) => acc + (r._count?.users ?? 0), 0);
  const activeCount = rows.filter((r) => r.isActive).length;

  return (
    <div className="maher-stagger space-y-5">
      <Board tone="info" wash="top" as="section">
        <div className="grid gap-5 px-5 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-[24px] font-semibold leading-8 tracking-[-0.02em] text-[var(--maher-text-primary)] sm:text-[28px] sm:leading-9 rtl:tracking-normal">{t('staffTypesTitle')}</h1>
              <p className="mt-1 max-w-[56ch] text-[14px] leading-5 text-[var(--maher-text-secondary)]">{t('staffTypesDescription')}</p>
            </div>
            <Button onClick={() => router.push('/admin/employees/staff-types/new')}>{t('newStaffType')}</Button>
          </div>
          <div className="grid grid-cols-3 gap-5 lg:min-w-[22rem]">
            <Figure size="sm" value={rows.length} label={t('staffTypesTitle')} />
            <Figure size="sm" value={activeCount} label={t('active')} tone="success" />
            <Figure size="sm" value={totalUsers} label={t('title')} tone="info" />
          </div>
        </div>
      </Board>

      {errorBanner ? <Alert variant="error">{errorBanner}</Alert> : null}
      {banner ? <Alert variant="success">{banner}</Alert> : null}

      {rows.length === 0 ? (
        <Board tone="neutral">
          <Board.Empty title={t('emptyStaffTypes')} action={<Button size="sm" onClick={() => router.push('/admin/employees/staff-types/new')}>{t('newStaffType')}</Button>} />
        </Board>
      ) : (
        <ul className="maher-stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => {
            const users = row._count?.users ?? 0;
            const perms = row._count?.permissions ?? row.permissions?.length ?? 0;
            const description = locale === 'ar' ? row.descriptionAr : locale === 'he' ? row.descriptionHe : row.descriptionEn;
            const tone = !row.isActive ? 'neutral' : row.isSystem ? 'brand' : 'info';
            const href = `/admin/employees/staff-types/${row.id}`;
            return (
              <Board key={row.id} as="li" tone={tone} interactive className={row.isActive ? undefined : 'opacity-80'}>
                <Board.Header
                  title={localizedName(locale, row)}
                  description={description || (row.isSystem ? t('systemPreset') : t('custom'))}
                  meta={
                    <span className="flex items-center gap-1">
                      <Stamp tone={row.isActive ? 'success' : 'neutral'} size="sm">{row.isActive ? t('active') : t('inactive')}</Stamp>
                      <Menu
                        aria-label={tCommon('actions')}
                        trigger={<Button size="sm" variant="ghost" aria-label={tCommon('actions')}><MoreHorizontal className="h-4 w-4" /></Button>}
                        items={[
                          { id: 'edit', label: tCommon('edit'), icon: <Pencil className="h-4 w-4" />, onSelect: () => router.push(href) },
                          { id: 'duplicate', label: t('duplicate'), icon: <Copy className="h-4 w-4" />, onSelect: () => duplicateMutation.mutate(row.id) },
                          ...(row.isActive && !row.isSystem
                            ? [{ id: 'deactivate', label: tCommon('deactivate'), icon: <Power className="h-4 w-4" />, separator: true, onSelect: () => (setConfirmError(null), setConfirm({ type: 'deactivate', id: row.id })) }]
                            : []),
                          ...(!row.isSystem
                            ? [{
                                id: 'delete',
                                label: tCommon('delete'),
                                icon: <Trash2 className="h-4 w-4" />,
                                tone: 'error' as const,
                                onSelect: () => {
                                  setConfirmError(null);
                                  setErrorBanner(null);
                                  if (users > 0) {
                                    setBanner(null);
                                    setErrorBanner(t('cannotDeleteAssigned'));
                                    return;
                                  }
                                  setConfirm({ type: 'delete', id: row.id });
                                },
                              }]
                            : []),
                        ]}
                      />
                    </span>
                  }
                />
                <Board.Body className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Figure size="sm" value={perms} label={t('permissions')} tone={tone} />
                    <Figure size="sm" value={users} label={t('usersAssigned')} />
                  </div>
                  <Meter value={perms} max={maxPerms} tone={tone} label={row.isSystem ? t('systemPreset') : t('custom')} valueLabel={`${perms}`} />
                </Board.Body>
                <Board.Footer>
                  <Button size="sm" variant="secondary" onClick={() => router.push(href)}>
                    {t('view')}
                  </Button>
                </Board.Footer>
              </Board>
            );
          })}
        </ul>
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
