'use client';

import { Link } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api-client';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import {
  Alert,
  Badge,
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
import { GitBranch, Layers, Plus } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

interface WorkflowRow {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  nameHe?: string | null;
  status: string;
  versions?: Array<{ id: string; versionNumber: number; status: string; revision?: number }>;
  activeVersion?: {
    id: string;
    versionNumber: number;
    status: string;
    _count?: { nodes: number; edges: number };
  } | null;
  _count?: { versions: number };
}

export default function WorkflowListPage() {
  const t = useTranslations('production');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [nameEn, setNameEn] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [nameHe, setNameHe] = useState('');

  const listQuery = useQuery({
    queryKey: ['production-workflows'],
    queryFn: () => apiFetch<WorkflowRow[]>('/api/v1/production-workflows'),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const created = await apiFetch<WorkflowRow>('/api/v1/production-workflows', {
        method: 'POST',
        body: JSON.stringify({
          nameEn: nameEn.trim(),
          nameAr: nameAr.trim(),
          nameHe: nameHe.trim() || undefined,
        }),
      });
      const versionId = created.versions?.[0]?.id;
      if (versionId) {
        const opened = await apiFetch<{ revision: number }>(
          `/api/v1/production-workflows/${created.id}/versions/${versionId}/ensure-opening-chain`,
          { method: 'POST', body: JSON.stringify({}) },
        );
        await apiFetch(
          `/api/v1/production-workflows/${created.id}/versions/${versionId}/ensure-terminal-chain`,
          { method: 'POST', body: JSON.stringify({ expectedRevision: opened.revision }) },
        );
      }
      return created;
    },
    onSuccess: async () => {
      setCreateOpen(false);
      setNameEn('');
      setNameAr('');
      setNameHe('');
      setError(null);
      await qc.invalidateQueries({ queryKey: ['production-workflows'] });
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  const rows = listQuery.data ?? [];

  return (
    <div className="space-y-6">
      <PageHero
        title={t('workflow.title')}
        description={t('workflow.simpleSubtitle')}
        tone="soft"
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-56">
            <Button
              className="w-full"
              leadingIcon={<Plus className="h-4 w-4" />}
              onClick={() => setCreateOpen(true)}
            >
              {t('workflow.newWorkflow')}
            </Button>
            <Link href="/production/workflow/stages" className="w-full">
              <Button className="w-full" variant="secondary" leadingIcon={<Layers className="h-4 w-4" />}>
                {t('workflow.manageStages')}
              </Button>
            </Link>
          </div>
        }
      />

      {error ? <Alert variant="error">{error}</Alert> : null}

      {listQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
      ) : listQuery.isError ? (
        <ErrorState
          title={t('workflow.loadError')}
          description={t('workflow.retry')}
          retryLabel={t('workflow.retry')}
          onRetry={() => void listQuery.refetch()}
        />
      ) : rows.length === 0 ? (
        <EmptyState
          title={t('workflow.emptyWorkflow')}
          description={t('workflow.emptyWorkflowHint')}
          action={
            <div className="flex flex-col gap-2">
              <Button onClick={() => setCreateOpen(true)}>{t('workflow.newWorkflow')}</Button>
              <Link href="/production/workflow/stages">
                <Button variant="secondary" className="w-full" leadingIcon={<Layers className="h-4 w-4" />}>
                  {t('workflow.manageStages')}
                </Button>
              </Link>
            </div>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((row) => {
            const name = localizedName(locale, row);
            const active = row.activeVersion;
            const stageCount = active?._count?.nodes ?? 0;
            const pillStatus = active?.status === 'PUBLISHED' ? 'PUBLISHED' : row.status;
            return (
              <Link key={row.id} href={`/production/workflow/${row.id}`} className="group block">
                <Card interactive className="relative h-full overflow-hidden">
                  <span
                    className="pointer-events-none absolute inset-y-4 start-0 w-1 rounded-full bg-brand/70"
                    aria-hidden
                  />
                  <div className="flex items-start justify-between gap-3 ps-3">
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-text-primary">{name}</p>
                      <p className="mt-1 text-xs text-text-secondary">
                        {t('workflow.cardMeta', {
                          version: active?.versionNumber ?? 1,
                          stages: stageCount,
                        })}
                      </p>
                    </div>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--maher-brand-soft)] text-brand">
                      <GitBranch className="h-4 w-4" aria-hidden />
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2 ps-3">
                    <StatusBadge status={pillStatus} />
                    <Badge variant="brand">{stageCount}</Badge>
                    {active ? (
                      <Badge variant="success">{t('workflow.activeVersion')}</Badge>
                    ) : (
                      <Badge variant="warning">{t('workflow.draftVersion')}</Badge>
                    )}
                  </div>
                  <p className="mt-3 ps-3 text-xs text-text-tertiary">{t('workflow.terminalEndsWith')}</p>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title={t('workflow.newWorkflow')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              {tCommon('cancel')}
            </Button>
            <Button
              loading={createMutation.isPending}
              disabled={!nameEn.trim() || !nameAr.trim()}
              onClick={() => createMutation.mutate()}
            >
              {t('workflow.createWorkflow')}
            </Button>
          </>
        }
      >
        <p className="mb-3 text-sm text-text-secondary">{t('workflow.newWorkflowHint')}</p>
        <div className="grid gap-3">
          <Input label={t('workflow.nameEn')} value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
          <Input label={t('workflow.nameAr')} value={nameAr} onChange={(e) => setNameAr(e.target.value)} />
          <Input
            label={`${t('workflow.nameHe')} (${t('workflow.hebrewOptional')})`}
            value={nameHe}
            onChange={(e) => setNameHe(e.target.value)}
          />
        </div>
      </Modal>
    </div>
  );
}
