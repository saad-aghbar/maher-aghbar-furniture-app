'use client';

import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import { apiFetch } from '@/lib/api-client';
import { useKitCopy } from '@/lib/kit-copy';
import { isQcFailResult, type TaskQualityKind } from '@/lib/task-quality-kind';
import { localizedName } from '@maher/i18n';
import { Alert, Board, BoardSkeleton, Button, Checkbox, Combobox, KeyFacts, Meter, NumberField, SegmentedControl, Sheet, Stamp, TextArea, useToast } from '@maher/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, XCircle } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';

interface ChecklistItem {
  id: string;
  checklistCode: string;
  label: string;
  result?: string | null;
  note?: string | null;
  kitLabel?: string | null;
  kitLabelAr?: string | null;
  kitLabelHe?: string | null;
}
interface Inspection {
  id: string;
  number: string;
  result?: string | null;
  notes?: string | null;
  inspectedAt?: string | null;
  items?: ChecklistItem[];
  defects?: Array<{ id: string; description: string; severity?: string | null; stageCode?: string | null }>;
  inspector?: { fullName?: string | null; username?: string | null } | null;
}
interface FloorContext {
  productionOrderId: string;
  productionOrderNumber: string;
  quantity: number;
  itemUnderInspection?: { stageCode: string; stageNameEn: string; stageNameAr?: string | null; stageNameHe?: string | null; completedAt?: string | null; workerName?: string | null } | null;
  manufacturingSpec?: Record<string, unknown> | null;
  latestInspection: Inspection | null;
  inspections: Inspection[];
  openRework: { id: string; number: string; status: string; description?: string | null; reentryStageInstance?: { stageDefinition?: { code?: string; nameEn?: string; nameAr?: string | null } | null } | null } | null;
  expectedPackages: Array<{ code: string; labelEn: string; labelAr?: string | null; labelHe?: string | null }>;
  packagingUnlocked: boolean;
  pieceChecklist?: ChecklistItem[];
  inspectionProgress?: { passed: number; failed: number; pending: number; total: number };
  lightAnalytics?: { inspectionAttempts: number; reworkCount: number; failureCategories: string[] };
}
interface ReworkStages {
  recommended: { stageInstanceId: string; code: string; nameEn: string; nameAr?: string | null } | null;
  eligible: Array<{ stageInstanceId: string; code: string; nameEn: string; nameAr?: string | null }>;
}

const CATEGORIES = ['CARPENTRY', 'ASSEMBLY', 'UPHOLSTERY', 'PAINT_FINISH', 'DIMENSIONS', 'FABRIC', 'HARDWARE', 'DAMAGE', 'WRONG_SPEC', 'MISSING_COMPONENT', 'OTHER'] as const;
const SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

export function useQualityFloor(productionOrderId: string | null | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['quality-floor-context', productionOrderId],
    enabled: enabled && Boolean(productionOrderId),
    queryFn: () => apiFetch<FloorContext>(`/api/v1/quality-inspections/orders/${productionOrderId}/context`),
    staleTime: 10_000,
  });
}

/**
 * QualityGatePanel — the inspector / packer floor (port of the mobile QC section).
 * Inspection: checklist per piece, pass or report a problem (with rework stage).
 * Packaging: confirm every expected package before the task can finish.
 */
export function QualityGatePanel({
  kind,
  productionOrderId,
  stageCode,
  canPerform,
  onPassed,
  onPackagesReady,
}: {
  kind: Exclude<TaskQualityKind, 'production' | 'rework' | 'recovery'>;
  productionOrderId: string;
  stageCode?: string | null;
  canPerform: boolean;
  onPassed: () => void;
  onPackagesReady: (ready: boolean, labels: string[]) => void;
}) {
  const tq = useTranslations('mobile.quality');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const kit = useKitCopy();
  const toast = useToast();
  const qc = useQueryClient();
  const ctx = useQualityFloor(productionOrderId, true);
  const [notes, setNotes] = useState('');
  const [checks, setChecks] = useState<Record<string, 'PASS' | 'FAIL' | null>>({});
  const [failOpen, setFailOpen] = useState<{ pieceCode?: string } | null>(null);
  const [fail, setFail] = useState({ category: 'OTHER', description: '', qty: 1, severity: 'MEDIUM', stageInstanceId: null as string | null });
  const [packages, setPackages] = useState<Record<string, boolean>>({});
  const createKey = useRef(`qc-create-${Math.random().toString(36).slice(2)}`);

  const isGate = kind === 'inspection' || kind === 'reinspection';
  // The open inspection may not be the newest one: closing a rework reopens the failed record.
  const open = ctx.data ? ctx.data.inspections.find((i) => !i.result) ?? (ctx.data.latestInspection && !ctx.data.latestInspection.result ? ctx.data.latestInspection : null) : null;

  // Open an inspection record once when the gate has none.
  const create = useMutation({
    mutationFn: () => apiFetch<Inspection>('/api/v1/quality-inspections', { method: 'POST', body: JSON.stringify({ productionOrderId, stageCode: stageCode ?? 'INSPECTION', idempotencyKey: createKey.current }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quality-floor-context', productionOrderId] }),
    onError: (err) => toast.error(mutationErrorMessage(err)),
  });
  useEffect(() => {
    if (isGate && canPerform && ctx.isSuccess && !open && !create.isPending && !create.isSuccess) create.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGate, canPerform, ctx.isSuccess, open?.id]);

  const checklist = useMemo(() => open?.items?.length ? open.items : ctx.data?.pieceChecklist ?? [], [open, ctx.data?.pieceChecklist]);
  useEffect(() => {
    if (kind === 'packaging' && ctx.data?.expectedPackages) {
      setPackages((prev) => {
        const next = { ...prev };
        for (const p of ctx.data!.expectedPackages) if (next[p.code] == null) next[p.code] = false;
        return next;
      });
    }
  }, [kind, ctx.data]);
  useEffect(() => {
    if (kind !== 'packaging') return;
    const expected = ctx.data?.expectedPackages ?? [];
    const ready = expected.every((p) => packages[p.code]);
    onPackagesReady(ready, expected.filter((p) => packages[p.code]).map((p) => localizedName(locale, { nameEn: p.labelEn, nameAr: p.labelAr ?? null, nameHe: p.labelHe ?? null }, p.labelEn)));
  }, [kind, packages, ctx.data, locale, onPackagesReady]);

  const reworkStages = useQuery({
    queryKey: ['quality-rework-stages', productionOrderId, fail.category],
    enabled: Boolean(failOpen),
    queryFn: () => apiFetch<ReworkStages>(`/api/v1/quality-inspections/orders/${productionOrderId}/rework-stages?category=${encodeURIComponent(fail.category)}`),
  });
  useEffect(() => {
    if (failOpen && reworkStages.data && !fail.stageInstanceId) setFail((f) => ({ ...f, stageInstanceId: reworkStages.data!.recommended?.stageInstanceId ?? reworkStages.data!.eligible[0]?.stageInstanceId ?? null }));
  }, [failOpen, reworkStages.data, fail.stageInstanceId]);

  const submit = useMutation({
    mutationFn: async (result: 'PASSED' | 'FAILED_REWORK_REQUIRED') => {
      if (!open) throw new Error(tq('inspectionNotReady'));
      const checklistResults = checklist.filter((c) => checks[c.checklistCode] || result === 'PASSED').map((c) => ({ checklistCode: c.checklistCode, result: checks[c.checklistCode] ?? 'PASS' }));
      return apiFetch(`/api/v1/quality-inspections/${open.id}/submit`, {
        method: 'POST',
        body: JSON.stringify({
          result,
          notes: notes.trim() || undefined,
          checklistResults: checklistResults.length ? checklistResults : undefined,
          ...(result === 'FAILED_REWORK_REQUIRED'
            ? { defectCategory: fail.category, defectDescription: fail.description.trim(), affectedQty: fail.qty, severity: fail.severity, reentryStageInstanceId: fail.stageInstanceId ?? undefined }
            : {}),
          idempotencyKey: `qc-${result}-${open.id}`,
        }),
      });
    },
    onSuccess: async (_r, result) => {
      toast.success(result === 'PASSED' ? tq('inspectionPassed') : tq('problemFound'));
      setFailOpen(null);
      await Promise.all([qc.invalidateQueries({ queryKey: ['quality-floor-context', productionOrderId] }), qc.invalidateQueries({ queryKey: ['task'] }), qc.invalidateQueries({ queryKey: ['my-tasks'] })]);
      if (result === 'PASSED') onPassed();
    },
    onError: (err) => toast.error(mutationErrorMessage(err)),
  });

  if (ctx.isLoading) return <BoardSkeleton rows={4} />;
  if (ctx.isError || !ctx.data) return <Alert variant="warning">{tq('inspectionNotReady')}</Alert>;
  const data = ctx.data;
  const priorFail = [...data.inspections].reverse().find((i) => isQcFailResult(i.result) || (i.defects?.length ?? 0) > 0);
  const anyFail = Object.values(checks).some((v) => v === 'FAIL');
  const allDecided = checklist.length === 0 || checklist.every((c) => checks[c.checklistCode]);

  if (kind === 'packaging') {
    const expected = data.expectedPackages ?? [];
    const done = expected.filter((p) => packages[p.code]).length;
    return (
      <Board tone={done === expected.length && expected.length > 0 ? 'success' : 'brand'}>
        <Board.Header title={tq('confirmPackages')} description={expected.length ? tq('packagesProgress', { done, total: expected.length }) : tq('noExpectedPackages')} meta={<Stamp tone="brand" size="sm">{tq('stampPackaging')}</Stamp>} />
        <Board.Body className="space-y-3">
          {!data.packagingUnlocked ? <Alert variant="warning">{tq('readyForPackaging')}</Alert> : null}
          {expected.length ? (
            <>
              <Meter value={done} max={expected.length} size="sm" tone={done === expected.length ? 'success' : 'info'} showValue={false} />
              <ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2">
                {expected.map((p) => (
                  <li key={p.code} className="rounded-[12px] border border-[var(--maher-border)] bg-[var(--maher-surface)] px-3 py-2.5">
                    <Checkbox label={localizedName(locale, { nameEn: p.labelEn, nameAr: p.labelAr ?? null, nameHe: p.labelHe ?? null }, p.labelEn)} checked={Boolean(packages[p.code])} onChange={(v) => setPackages((prev) => ({ ...prev, [p.code]: v }))} disabled={!canPerform} />
                  </li>
                ))}
              </ul>
              <p className="m-0 text-[12px] text-[var(--maher-text-tertiary)]">{done === expected.length ? tq('completePackagingHint') : tq('confirmAllPackagesHint')}</p>
            </>
          ) : null}
        </Board.Body>
      </Board>
    );
  }

  return (
    <>
      <Board tone={kind === 'reinspection' ? 'warning' : 'brand'}>
        <Board.Header
          title={tq('whatInspecting')}
          description={kind === 'reinspection' ? tq('reinspectionHint') : tq('usePassNotComplete')}
          meta={
            <Stamp tone={kind === 'reinspection' ? 'warning' : 'brand'} size="sm">
              {kind === 'reinspection' ? tq('readyForReinspection') : tq('stampInspection')}
            </Stamp>
          }
        />
        <Board.Body className="space-y-4">
          <KeyFacts
            columns={2}
            facts={[
              { label: tq('stampInspection'), value: open?.number ?? '—', ltr: true },
              ...(data.itemUnderInspection ? [{ label: tq('madeBy', { name: data.itemUnderInspection.workerName ?? '—' }), value: localizedName(locale, { nameEn: data.itemUnderInspection.stageNameEn, nameAr: data.itemUnderInspection.stageNameAr ?? null, nameHe: data.itemUnderInspection.stageNameHe ?? null }, data.itemUnderInspection.stageCode) }] : []),
              ...(data.inspectionProgress ? [{ label: tq('piecesProgress', { passed: data.inspectionProgress.passed, total: data.inspectionProgress.total }), value: `${data.inspectionProgress.pending}`, ltr: true }] : []),
            ]}
          />
          {priorFail ? (
            <Alert variant="warning">
              <p className="font-medium">{tq('previousFailure')}</p>
              {priorFail.defects?.map((d) => (
                <p key={d.id} className="mt-1 text-sm">
                  {d.description}
                </p>
              ))}
              {data.openRework?.reentryStageInstance?.stageDefinition ? <p className="mt-1 text-[12px] opacity-80">{tq('reworkedBy', { name: data.openRework.reentryStageInstance.stageDefinition.nameEn ?? '' })}</p> : null}
            </Alert>
          ) : null}

          <div>
            <p className="m-0 mb-2 text-[13px] font-semibold text-[var(--maher-text-primary)]">{tq('checklist')}</p>
            {checklist.length === 0 ? (
              <p className="m-0 text-[13px] text-[var(--maher-text-tertiary)]">{tq('checklistEmpty')}</p>
            ) : (
              <ul className="m-0 list-none space-y-2 p-0">
                {checklist.map((c) => {
                  const v = checks[c.checklistCode] ?? null;
                  return (
                    <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-[12px] border border-[var(--maher-border)] bg-[var(--maher-surface)] px-3 py-2.5">
                      <span className="min-w-0">
                        <span className="block text-[14px] font-medium text-[var(--maher-text-primary)]">{c.label}</span>
                        {c.kitLabel ? <span className="block text-[12px] text-[var(--maher-text-tertiary)]">{localizedName(locale, { nameEn: c.kitLabel, nameAr: c.kitLabelAr ?? null, nameHe: c.kitLabelHe ?? null }, c.kitLabel)}</span> : null}
                      </span>
                      <SegmentedControl
                        size="sm"
                        aria-label={tq('tapToInspect')}
                        value={v ?? ''}
                        onChange={(next) => {
                          setChecks((prev) => ({ ...prev, [c.checklistCode]: (next || null) as 'PASS' | 'FAIL' | null }));
                          if (next === 'FAIL') setFailOpen({ pieceCode: c.checklistCode });
                        }}
                        options={[
                          { value: 'PASS', label: tq('passPiece') },
                          { value: 'FAIL', label: tq('failPiece') },
                        ]}
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <TextArea autoGrow rows={2} label={tq('notes')} placeholder={tq('notesPlaceholder')} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={!canPerform} />

          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" leadingIcon={<XCircle className="h-4 w-4" />} disabled={!canPerform || !open} onClick={() => setFailOpen({})}>
              {tq('reportProblem')}
            </Button>
            <Button leadingIcon={<CheckCircle2 className="h-4 w-4" />} loading={submit.isPending} disabled={!canPerform || !open || anyFail || !allDecided} onClick={() => submit.mutate('PASSED')}>
              {tq('passInspection')}
            </Button>
          </div>
          {!allDecided && checklist.length ? <p className="m-0 text-end text-[12px] text-[var(--maher-text-tertiary)]">{tq('passAllPiecesHint')}</p> : null}
        </Board.Body>
      </Board>

      <Sheet
        open={Boolean(failOpen)}
        onClose={() => !submit.isPending && setFailOpen(null)}
        title={tq('reportProblem')}
        description={tq('failHint')}
        tone="error"
        closeLabel={tCommon('close')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setFailOpen(null)} disabled={submit.isPending}>
              {tCommon('cancel')}
            </Button>
            <Button variant="danger" loading={submit.isPending} disabled={!fail.description.trim() || !fail.stageInstanceId} onClick={() => submit.mutate('FAILED_REWORK_REQUIRED')}>
              {tq('confirmProblem')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <span className="mb-1.5 block text-[13px] font-medium text-[var(--maher-text-primary)]">{tq('defectCategory')}</span>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((c) => (
                <button key={c} type="button" onClick={() => setFail((f) => ({ ...f, category: c, stageInstanceId: null }))} className={`maher-press rounded-full border px-3 py-1 text-[12px] ${fail.category === c ? 'border-[var(--maher-brand)] bg-[var(--maher-brand-soft)] text-[var(--maher-text-primary)]' : 'border-[var(--maher-border)] text-[var(--maher-text-secondary)]'}`}>
                  {tq(`category.${c}` as never)}
                </button>
              ))}
            </div>
          </div>
          <TextArea autoGrow rows={3} label={tq('problemDescription')} placeholder={tq('problemDescriptionPlaceholder')} value={fail.description} onChange={(e) => setFail((f) => ({ ...f, description: e.target.value }))} />
          <div className="grid gap-3 sm:grid-cols-2">
            <NumberField label={tq('affectedQty')} value={fail.qty} onChange={(v) => setFail((f) => ({ ...f, qty: v ?? 1 }))} min={1} max={data.quantity || undefined} />
            <div>
              <span className="mb-1.5 block text-[13px] font-medium text-[var(--maher-text-primary)]">{tq('severity')}</span>
              <SegmentedControl size="sm" aria-label={tq('severity')} value={fail.severity} onChange={(v) => setFail((f) => ({ ...f, severity: v }))} options={SEVERITIES.map((s) => ({ value: s, label: tq(`severityLevel.${s}` as never) }))} />
            </div>
          </div>
          <Combobox
            label={tq('recommendedStage')}
            value={fail.stageInstanceId}
            onChange={(v) => setFail((f) => ({ ...f, stageInstanceId: v }))}
            options={(reworkStages.data?.eligible ?? []).map((s) => ({ value: s.stageInstanceId, label: localizedName(locale, s, s.code), description: reworkStages.data?.recommended?.stageInstanceId === s.stageInstanceId ? tq('recommended') : undefined }))}
            emptyText={reworkStages.isLoading ? tq('loadingStages') : tq('noReworkStages')}
            clearLabel={kit.combobox.clear}
          />
        </div>
      </Sheet>
    </>
  );
}
