'use client';

import { Link } from '@/i18n/navigation';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import { apiFetch } from '@/lib/api-client';
import { localizedName } from '@maher/i18n';
import { Alert, Board, BoardSkeleton, Button, ErrorBoard, Figure, Input, Ltr, Meter, Ribbon, SegmentedControl, Sheet, Stamp, useToast, type BoardTone } from '@maher/ui';
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
  scope?: 'STANDARD' | 'RETURN' | null;
  updatedAt?: string;
  versions?: Array<{ id: string; versionNumber: number; status: string; revision?: number; createdAt?: string }>;
  activeVersion?: { id: string; versionNumber: number; status: string; _count?: { nodes: number; edges: number } } | null;
  _count?: { versions: number; products?: number; productionOrders?: number };
}

const statusTone = (s: string): BoardTone => (s === 'PUBLISHED' || s === 'ACTIVE' ? 'success' : s === 'DRAFT' ? 'warning' : s === 'ARCHIVED' ? 'neutral' : 'info');

export default function WorkflowListPage() {
  const t = useTranslations('production');
  const tCommon = useTranslations('common');
  const tStatus = useTranslations('statuses');
  const locale = useLocale();
  const qc = useQueryClient();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [nameEn, setNameEn] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [nameHe, setNameHe] = useState('');
  const [createScope, setCreateScope] = useState<'STANDARD' | 'RETURN'>('STANDARD');

  const list = useQuery({ queryKey: ['production-workflows'], queryFn: () => apiFetch<WorkflowRow[]>('/api/v1/production-workflows') });
  const library = useQuery({ queryKey: ['production-stage-library'], queryFn: () => apiFetch<Array<{ id: string }>>('/api/v1/production-stage-library'), staleTime: 60_000 });

  const create = useMutation({
    mutationFn: async () => {
      const created = await apiFetch<WorkflowRow>('/api/v1/production-workflows', { method: 'POST', body: JSON.stringify({ nameEn: nameEn.trim(), nameAr: nameAr.trim(), nameHe: nameHe.trim() || undefined, scope: createScope }) });
      const versionId = created.versions?.[0]?.id;
      if (versionId) {
        let revision: number | undefined;
        if (createScope === 'STANDARD') {
          const opened = await apiFetch<{ revision: number }>(`/api/v1/production-workflows/${created.id}/versions/${versionId}/ensure-opening-chain`, { method: 'POST', body: JSON.stringify({}) });
          revision = opened.revision;
        }
        await apiFetch(`/api/v1/production-workflows/${created.id}/versions/${versionId}/ensure-terminal-chain`, { method: 'POST', body: JSON.stringify(revision != null ? { expectedRevision: revision } : {}) });
      }
      return created;
    },
    onSuccess: async () => {
      setCreateOpen(false);
      setNameEn('');
      setNameAr('');
      setNameHe('');
      setCreateScope('STANDARD');
      setError(null);
      toast.success(tCommon('saved'));
      await qc.invalidateQueries({ queryKey: ['production-workflows'] });
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  const rows = list.data ?? [];
  const published = rows.filter((r) => r.activeVersion?.status === 'PUBLISHED').length;
  const drafts = rows.length - published;
  const returns = rows.filter((r) => r.scope === 'RETURN').length;
  const maxStages = Math.max(1, ...rows.map((r) => r.activeVersion?._count?.nodes ?? 0));
  const label = (s: string) => (tStatus.has(s) ? tStatus(s as never) : s.replace(/_/g, ' '));

  return (
    <div className="maher-stagger space-y-5">
      <Board tone="brand" wash="top" as="section">
        <div className="grid gap-5 px-5 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-center">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-[24px] font-semibold leading-8 tracking-[-0.02em] text-[var(--maher-text-primary)] sm:text-[28px] sm:leading-9 rtl:tracking-normal">{t('workflow.title')}</h1>
              <p className="mt-1 max-w-[56ch] text-[14px] leading-5 text-[var(--maher-text-secondary)]">{t('workflow.simpleSubtitle')}</p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button variant="secondary" leadingIcon={<Layers className="h-4 w-4" />} onClick={() => (window.location.href = `/${locale}/admin/production/workflow/stages`)}>
                {t('workflow.manageStages')}
              </Button>
              <Button leadingIcon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>
                {t('workflow.newWorkflow')}
              </Button>
            </div>
          </div>
          <div className="min-w-0">
            <Ribbon
              size="sm"
              segments={[
                { key: 'published', label: label('PUBLISHED'), value: published, tone: 'success' },
                { key: 'draft', label: t('workflow.draftVersion'), value: drafts, tone: 'warning' },
              ]}
            />
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
              <Figure size="sm" value={rows.length} label={t('workflow.title')} />
              <Figure size="sm" value={published} label={t('workflow.activeVersion')} tone="success" />
              <Figure size="sm" value={returns} label={t('workflow.scopeReturn')} tone="warning" />
              <Figure size="sm" value={library.data?.length ?? 0} label={t('workflow.manageStages')} tone="info" />
            </div>
          </div>
        </div>
      </Board>

      {error ? <Alert variant="error">{error}</Alert> : null}

      {list.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <BoardSkeleton key={i} rows={3} />
          ))}
        </div>
      ) : list.isError ? (
        <ErrorBoard title={t('workflow.loadError')} description={mutationErrorMessage(list.error)} onRetry={() => void list.refetch()} />
      ) : rows.length === 0 ? (
        <Board tone="neutral">
          <Board.Empty
            title={t('workflow.emptyWorkflow')}
            description={t('workflow.emptyWorkflowHint')}
            action={
              <span className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => setCreateOpen(true)}>
                  {t('workflow.newWorkflow')}
                </Button>
                <Button size="sm" variant="secondary" onClick={() => (window.location.href = `/${locale}/admin/production/workflow/stages`)}>
                  {t('workflow.manageStages')}
                </Button>
              </span>
            }
          />
        </Board>
      ) : (
        <div className="maher-stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => {
            const active = row.activeVersion;
            const stageCount = active?._count?.nodes ?? 0;
            const edgeCount = active?._count?.edges ?? 0;
            const status = active?.status === 'PUBLISHED' ? 'PUBLISHED' : row.status;
            return (
              <Board key={row.id} href={`/admin/production/workflow/${row.id}`} LinkComponent={Link} tone={row.scope === 'RETURN' ? 'warning' : statusTone(status)} as="article" className="h-full">
                <Board.Header
                  title={localizedName(locale, row)}
                  description={<Ltr>{row.code}</Ltr>}
                  meta={
                    <span className="flex items-center gap-1.5">
                      <Stamp tone={statusTone(status)} size="sm">
                        {label(status)}
                      </Stamp>
                      {row.scope === 'RETURN' ? <Stamp tone="warning" size="sm">{t('workflow.scopeReturn')}</Stamp> : null}
                    </span>
                  }
                />
                <Board.Body className="space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <Figure size="sm" value={active?.versionNumber ?? 1} label={t('workflow.activeVersion')} tone={active ? 'success' : 'warning'} />
                    <Figure size="sm" value={stageCount} label={t('workflow.stages')} />
                    <Figure size="sm" value={edgeCount} label={t('workflow.dependencies')} tone="neutral" />
                  </div>
                  <Meter value={stageCount} max={maxStages} size="sm" showValue={false} tone={statusTone(status)} />
                  <p className="text-[12px] text-[var(--maher-text-tertiary)]">{t('workflow.cardMeta', { version: active?.versionNumber ?? 1, stages: stageCount })}</p>
                </Board.Body>
                <Board.Footer>
                  <span className="inline-flex items-center gap-1.5 text-[12px] text-[var(--maher-text-secondary)]">
                    <GitBranch className="h-3.5 w-3.5" aria-hidden />
                    {`${t('workflow.versions')}: ${row._count?.versions ?? row.versions?.length ?? 1}`}
                  </span>
                  <span className="text-[12px] text-[var(--maher-text-tertiary)]">{t('workflow.terminalEndsWith')}</span>
                </Board.Footer>
              </Board>
            );
          })}
        </div>
      )}

      <Sheet
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title={t('workflow.newWorkflow')}
        description={t('workflow.newWorkflowHint')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              {tCommon('cancel')}
            </Button>
            <Button loading={create.isPending} disabled={!nameEn.trim() || !nameAr.trim()} onClick={() => create.mutate()}>
              {t('workflow.createWorkflow')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label={t('workflow.nameAr')} value={nameAr} onChange={(e) => setNameAr(e.target.value)} dir="rtl" />
          <Input label={t('workflow.nameEn')} value={nameEn} onChange={(e) => setNameEn(e.target.value)} dir="ltr" />
          <Input label={`${t('workflow.nameHe')} (${t('workflow.hebrewOptional')})`} value={nameHe} onChange={(e) => setNameHe(e.target.value)} dir="rtl" />
          <div>
            <span className="mb-1.5 block text-[13px] font-medium text-[var(--maher-text-primary)]">{t('workflow.scopeSection')}</span>
            <SegmentedControl
              aria-label={t('workflow.scopeSection')}
              value={createScope}
              onChange={(v) => setCreateScope(v as 'STANDARD' | 'RETURN')}
              options={[
                { value: 'STANDARD', label: t('workflow.scopeStandard') },
                { value: 'RETURN', label: t('workflow.scopeReturn') },
              ]}
            />
            <p className="mt-1.5 text-[12px] text-[var(--maher-text-tertiary)]">{t('workflow.scopeHint')}</p>
          </div>
        </div>
      </Sheet>
    </div>
  );
}
