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
} from '@maher/ui';
import { localizedName } from '@maher/i18n';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { GitBranch, Plus } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

interface WorkflowRow {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  nameHe?: string | null;
  status: string;
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

  const listQuery = useQuery({
    queryKey: ['production-workflows'],
    queryFn: () => apiFetch<WorkflowRow[]>('/api/v1/production-workflows'),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      apiFetch<WorkflowRow>('/api/v1/production-workflows', {
        method: 'POST',
        body: JSON.stringify({ code: code.trim(), nameEn: nameEn.trim(), nameAr: nameAr.trim() }),
      }),
    onSuccess: async () => {
      setCreateOpen(false);
      setCode('');
      setNameEn('');
      setNameAr('');
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
        description={t('workflow.subtitle')}
        tone="soft"
        actions={
          <Button leadingIcon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>
            {t('workflow.newWorkflow')}
          </Button>
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
        <EmptyState title={t('workflow.emptyWorkflow')} description={t('workflow.subtitle')} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((row) => {
            const name = localizedName(locale, row, row.code);
            const active = row.activeVersion;
            const stageCount = active?._count?.nodes ?? 0;
            return (
              <Link key={row.id} href={`/production/workflow/${row.id}`} className="group block">
                <Card className="h-full transition group-hover:border-brand/40 group-hover:shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-text-primary">{name}</p>
                      <p className="mt-1 text-xs text-text-tertiary" dir="ltr">
                        {row.code}
                      </p>
                    </div>
                    <GitBranch className="h-5 w-5 shrink-0 text-brand/70" aria-hidden />
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Badge variant="default">{row.status}</Badge>
                    {active ? (
                      <Badge variant="success">
                        {t('workflow.activeVersion')} v{active.versionNumber}
                      </Badge>
                    ) : (
                      <Badge variant="warning">{t('workflow.draftVersion')}</Badge>
                    )}
                    <span className="text-xs text-text-secondary">
                      {stageCount} {tNav('productionStages').toLowerCase()}
                    </span>
                  </div>
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
        </div>
      </Modal>
    </div>
  );
}
