'use client';

import { Link } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api-client';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import {
  Alert,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  PageHero,
  Skeleton,
  StatusBadge,
} from '@maher/ui';
import { localizedName } from '@maher/i18n';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

interface StageRow {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  nameHe?: string | null;
  sortOrder: number;
  estimatedHours?: number | null;
  requiresInspection: boolean;
  requiresPhotos: boolean;
  responsibleDepartment?: string | null;
  isActive: boolean;
}

export default function WorkflowStageLibraryPage() {
  const t = useTranslations('production');
  const tc = useTranslations('catalog');
  const tNav = useTranslations('navigation');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [code, setCode] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [sortOrder, setSortOrder] = useState('1');

  const listQuery = useQuery({
    queryKey: ['production-stage-library'],
    queryFn: () => apiFetch<StageRow[]>('/api/v1/production-stage-library'),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      apiFetch('/api/v1/production-stage-library', {
        method: 'POST',
        body: JSON.stringify({
          code: code.trim(),
          nameEn: nameEn.trim(),
          nameAr: nameAr.trim(),
          sortOrder: Number(sortOrder) || 1,
        }),
      }),
    onSuccess: async () => {
      setCreateOpen(false);
      setCode('');
      setNameEn('');
      setNameAr('');
      setError(null);
      await qc.invalidateQueries({ queryKey: ['production-stage-library'] });
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  const rows = listQuery.data ?? [];

  return (
    <div className="space-y-6">
      <PageHero
        title={t('workflow.stageLibrary')}
        description={t('workflow.subtitle')}
        tone="soft"
        actions={
          <div className="flex gap-2">
            <Link href="/production/workflow">
              <Button variant="ghost">{t('workflow.title')}</Button>
            </Link>
            <Button leadingIcon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>
              {t('workflow.createStage')}
            </Button>
          </div>
        }
      />

      {error ? <Alert variant="error">{error}</Alert> : null}

      {listQuery.isLoading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : listQuery.isError ? (
        <ErrorState
          title={t('workflow.loadError')}
          retryLabel={t('workflow.retry')}
          onRetry={() => void listQuery.refetch()}
        />
      ) : rows.length === 0 ? (
        <EmptyState title={t('workflow.emptyStages')} />
      ) : (
        <Card title={tNav('productionStages')}>
          <div className="divide-y divide-border">
            {rows.map((row) => (
              <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-medium text-text-primary">{localizedName(locale, row)}</p>
                  <p className="text-xs text-text-tertiary" dir="ltr">
                    {row.code} · #{row.sortOrder}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {row.requiresInspection ? (
                    <StatusBadge status="REQUIRES_INSPECTION" label={t('workflow.requiresInspection')} />
                  ) : null}
                  {row.requiresPhotos ? (
                    <StatusBadge status="REQUIRES_PHOTOS" label={t('workflow.requiresPhotos')} />
                  ) : null}
                  <StatusBadge status={row.isActive ? 'ACTIVE' : 'INACTIVE'} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title={t('workflow.createStage')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              {tCommon('cancel')}
            </Button>
            <Button
              loading={createMutation.isPending}
              disabled={!code.trim() || !nameEn.trim() || !nameAr.trim()}
              onClick={() => createMutation.mutate()}
            >
              {tCommon('create')}
            </Button>
          </>
        }
      >
        <div className="grid gap-3">
          <Input label="Code" value={code} onChange={(e) => setCode(e.target.value)} dir="ltr" />
          <Input label={tc('nameEn')} value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
          <Input label={tc('nameAr')} value={nameAr} onChange={(e) => setNameAr(e.target.value)} />
          <Input
            label={tc('sortOrder')}
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            dir="ltr"
          />
        </div>
      </Modal>
    </div>
  );
}
