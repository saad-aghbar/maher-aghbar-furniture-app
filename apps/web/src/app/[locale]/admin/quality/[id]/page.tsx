'use client';

import { Link } from '@/i18n/navigation';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import { API_URL, apiFetch, apiUpload } from '@/lib/api-client';
import { useKitCopy } from '@/lib/kit-copy';
import { CHECKLIST_ITEM_RESULTS, QUALITY_RESULTS } from '@/lib/status-options';
import { localizedName } from '@maher/i18n';
import { ActionDock, Alert, Board, BoardSkeleton, Button, Combobox, DetailHero, ErrorBoard, Figure, Input, KeyFacts, Ltr, Meter, PhotoAttachField, Ribbon, SegmentedControl, Sheet, Stamp, TextArea, Ticket, useToast, type BoardTone } from '@maher/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Wrench } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

interface InspectionDetail {
  id: string;
  number: string;
  result?: string | null;
  notes?: string | null;
  stageCode?: string | null;
  inspectedAt?: string | null;
  createdAt?: string;
  productionOrderId?: string;
  productionOrder?: { id: string; number: string; productDescription?: string | null; status?: string } | null;
  items?: Array<{ id: string; checklistCode: string; label: string; result?: string | null; note?: string | null }>;
  defects?: Array<{ id: string; description: string; severity?: string | null }>;
  rework?: Array<{ id: string; number: string; status: string; description?: string | null; reentryStageInstanceId?: string | null }>;
  photoDocumentIds?: string[];
}

type ReworkStage = { id?: string; stageInstanceId?: string; stageCode: string; nameEn: string; nameAr: string; nameHe?: string | null; executionKind?: string | null };

const resultTone = (r?: string | null): BoardTone => (r === 'PASSED' || r === 'PASS' ? 'success' : r === 'PASSED_WITH_NOTES' ? 'info' : r === 'FAILED_REWORK_REQUIRED' || r === 'FAIL' ? 'error' : r === 'BLOCKED' ? 'warning' : r === 'NOT_APPLICABLE' ? 'neutral' : 'info');

export default function QualityDetailPage({ params }: { params: { id: string } }) {
  const tc = useTranslations('catalog');
  const tp = useTranslations('production');
  const tCommon = useTranslations('common');
  const tNav = useTranslations('navigation');
  const tStatus = useTranslations('statuses');
  const locale = useLocale();
  const kit = useKitCopy();
  const toast = useToast();
  const qc = useQueryClient();

  const [result, setResult] = useState('PASSED');
  const [notes, setNotes] = useState('');
  const [defectDescription, setDefectDescription] = useState('');
  const [itemResults, setItemResults] = useState<Record<string, string>>({});
  const [itemNotes, setItemNotes] = useState<Record<string, string>>({});
  const [photoIds, setPhotoIds] = useState<string[]>([]);
  const [photoNames, setPhotoNames] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reworkFor, setReworkFor] = useState<{ id: string; number: string } | null>(null);
  const [reworkStageId, setReworkStageId] = useState<string | null>(null);
  const [reworkNotes, setReworkNotes] = useState('');

  const detail = useQuery({ queryKey: ['quality-inspection', params.id], queryFn: () => apiFetch<InspectionDetail>(`/api/v1/quality-inspections/${params.id}`) });
  const stages = useQuery({
    queryKey: ['quality-rework-stages', detail.data?.productionOrderId],
    enabled: Boolean(detail.data?.productionOrderId) && Boolean(reworkFor),
    queryFn: () => apiFetch<{ recommended: ReworkStage | null; eligible: ReworkStage[] }>(`/api/v1/quality-inspections/orders/${detail.data!.productionOrderId}/rework-stages`),
  });
  useEffect(() => {
    if (reworkFor && !reworkStageId && stages.data?.recommended) setReworkStageId(stages.data.recommended.stageInstanceId ?? stages.data.recommended.id ?? null);
  }, [reworkFor, reworkStageId, stages.data]);

  useEffect(() => {
    const data = detail.data;
    if (!data) return;
    setNotes(data.notes ?? '');
    if (data.result) setResult(data.result);
    setItemResults(Object.fromEntries((data.items ?? []).map((item) => [item.checklistCode, item.result ?? 'PASS'])));
    setItemNotes(Object.fromEntries((data.items ?? []).map((item) => [item.checklistCode, item.note ?? ''])));
  }, [detail.data]);

  const invalidate = () => Promise.all([qc.invalidateQueries({ queryKey: ['quality-inspection', params.id] }), qc.invalidateQueries({ queryKey: ['quality-inspections'] }), qc.invalidateQueries({ queryKey: ['production-order', detail.data?.productionOrderId] })]);

  const submit = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/quality-inspections/${params.id}/submit`, {
        method: 'POST',
        body: JSON.stringify({
          result,
          notes: notes.trim() || undefined,
          defectDescription: result === 'FAILED_REWORK_REQUIRED' || result === 'BLOCKED' ? defectDescription.trim() || undefined : undefined,
          checklistResults: Object.entries(itemResults).map(([checklistCode, itemResult]) => ({ checklistCode, result: itemResult, note: itemNotes[checklistCode]?.trim() || undefined })),
          photoDocumentIds: photoIds.length ? photoIds : undefined,
          idempotencyKey: `${params.id}:${Date.now()}`,
        }),
      }),
    onSuccess: async () => {
      toast.success(tc('resultSubmitted'));
      setError(null);
      await invalidate();
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });
  const completeRework = useMutation({
    mutationFn: (reworkId: string) => apiFetch(`/api/v1/quality-inspections/rework/${reworkId}/complete`, { method: 'POST' }),
    onSuccess: async () => {
      toast.success(tc('reworkCompleted'));
      await invalidate();
    },
    onError: (err) => toast.error(mutationErrorMessage(err)),
  });
  const startRework = useMutation({
    mutationFn: (args: { reworkId: string; stageInstanceId: string; notes?: string }) => apiFetch(`/api/v1/quality-inspections/rework/${args.reworkId}/start`, { method: 'POST', body: JSON.stringify({ stageInstanceId: args.stageInstanceId, notes: args.notes }) }),
    onSuccess: async () => {
      setReworkFor(null);
      toast.success(tp('reworkStarted'));
      await invalidate();
    },
    onError: (err) => toast.error(mutationErrorMessage(err)),
  });

  async function uploadPhoto(file: File) {
    const form = new FormData();
    form.append('file', file);
    const qs = new URLSearchParams({ category: `QC_PHOTO:${params.id}`, ...(detail.data?.productionOrderId ? { productionOrderId: detail.data.productionOrderId } : {}) });
    const res = await apiUpload<{ document?: { id: string }; id?: string; downloadPath: string }>(`/api/v1/uploads?${qs}`, form);
    const docId = res.document?.id ?? res.id;
    if (docId) {
      setPhotoIds((prev) => [...prev, docId]);
      setPhotoNames((prev) => [...prev, file.name]);
    }
  }

  if (detail.isLoading) return <BoardSkeleton rows={6} />;
  if (detail.isError || !detail.data) return <ErrorBoard title={tNav('quality')} description={mutationErrorMessage(detail.error)} onRetry={() => detail.refetch()} />;

  const inspection = detail.data;
  const items = inspection.items ?? [];
  const pending = !inspection.result;
  const statusLabel = (code?: string | null) => {
    if (!code) return tc('pending');
    try {
      return tStatus(code as never);
    } catch {
      return code.replace(/_/g, ' ');
    }
  };
  const draftPass = items.filter((i) => (itemResults[i.checklistCode] ?? 'PASS') === 'PASS').length;
  const draftFail = items.filter((i) => (itemResults[i.checklistCode] ?? 'PASS') === 'FAIL').length;
  const draftNa = items.length - draftPass - draftFail;
  const savedPass = items.filter((i) => i.result === 'PASS').length;
  const savedFail = items.filter((i) => i.result === 'FAIL').length;
  const tone: BoardTone = pending ? (draftFail ? 'error' : 'info') : resultTone(inspection.result);
  const openRework = (inspection.rework ?? []).filter((rw) => rw.status !== 'COMPLETED');
  const failing = result === 'FAILED_REWORK_REQUIRED' || result === 'BLOCKED';

  return (
    <div className="maher-stagger space-y-5 pb-28 md:pb-0">
      <DetailHero
        back={{ label: tNav('quality'), href: '/admin/quality' }}
        LinkComponent={Link}
        code={inspection.number}
        title={inspection.productionOrder?.productDescription ?? inspection.stageCode ?? tc('inspectionDetail')}
        subtitle={[inspection.productionOrder?.number, inspection.stageCode].filter(Boolean).join(' · ')}
        status={{ label: pending ? tc('pending') : statusLabel(inspection.result), tone }}
        facts={[
          { label: tc('lineItems'), value: String(items.length), ltr: true },
          { label: statusLabel('PASS'), value: String(pending ? draftPass : savedPass), ltr: true, tone: 'success' },
          { label: statusLabel('FAIL'), value: String(pending ? draftFail : savedFail), ltr: true, tone: (pending ? draftFail : savedFail) ? 'error' : undefined },
          { label: tc('rework'), value: String((inspection.rework ?? []).length), ltr: true, tone: openRework.length ? 'warning' : undefined },
          { label: tCommon('date'), value: inspection.inspectedAt ?? inspection.createdAt ? new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(new Date((inspection.inspectedAt ?? inspection.createdAt) as string)) : '—', ltr: true },
        ]}
        primary={inspection.productionOrderId ? <Button variant="secondary" onClick={() => window.location.assign(`/${locale}/admin/production/${inspection.productionOrderId}?tab=quality`)}>{tp('factoryOrderNumber')}</Button> : undefined}
      >
        {items.length ? (
          <Ribbon
            size="sm"
            segments={[
              { key: 'pass', label: statusLabel('PASS'), value: pending ? draftPass : savedPass, tone: 'success' },
              { key: 'fail', label: statusLabel('FAIL'), value: pending ? draftFail : savedFail, tone: 'error' },
              { key: 'na', label: statusLabel('NOT_APPLICABLE'), value: pending ? draftNa : items.length - savedPass - savedFail, tone: 'neutral' },
            ]}
          />
        ) : null}
      </DetailHero>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Board tone={tone}>
          <Board.Header title={tc('lineItems')} description={pending ? tp('qualityChecklistHint') : undefined} meta={items.length ? <Stamp tone={tone} size="sm">{`${pending ? draftPass : savedPass}/${items.length}`}</Stamp> : null} />
          {items.length === 0 ? (
            <Board.Empty title={tc('noInspections')} />
          ) : (
            <ol className="divide-y divide-[var(--maher-border)]">
              {items.map((item, index) => {
                const value = pending ? (itemResults[item.checklistCode] ?? 'PASS') : (item.result ?? 'PASS');
                return (
                  <li key={item.id} className="grid gap-3 px-5 py-4 sm:grid-cols-[28px_minmax(0,1fr)_auto] sm:items-center">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--maher-border)] text-[12px] font-semibold text-[var(--maher-text-secondary)]" dir="ltr">
                      {index + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[14px] font-medium text-[var(--maher-text-primary)]">{item.label}</span>
                      <Ltr className="block text-[12px] text-[var(--maher-text-tertiary)]">{item.checklistCode}</Ltr>
                      {pending && value === 'FAIL' ? <Input className="mt-2" placeholder={tc('defectDescription')} value={itemNotes[item.checklistCode] ?? ''} onChange={(e) => setItemNotes((prev) => ({ ...prev, [item.checklistCode]: e.target.value }))} /> : item.note ? <span className="mt-1 block text-[12px] text-[var(--maher-text-secondary)]">{item.note}</span> : null}
                    </span>
                    {pending ? (
                      <SegmentedControl size="sm" aria-label={item.label} value={value} onChange={(v) => setItemResults((prev) => ({ ...prev, [item.checklistCode]: v }))} options={CHECKLIST_ITEM_RESULTS.map((r) => ({ value: r, label: statusLabel(r) }))} />
                    ) : (
                      <Stamp tone={resultTone(item.result)} size="sm">
                        {statusLabel(item.result)}
                      </Stamp>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </Board>

        <div className="space-y-5">
          {pending ? (
            <Board tone={failing ? 'error' : 'brand'} wash="top">
              <Board.Header title={tc('submitResult')} />
              <Board.Body className="space-y-4">
                {error ? <Alert variant="error">{error}</Alert> : null}
                <div>
                  <span className="mb-1.5 block text-[13px] font-medium text-[var(--maher-text-primary)]">{tc('overallResult')}</span>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {QUALITY_RESULTS.map((r) => (
                      <button key={r} type="button" onClick={() => setResult(r)} className={`maher-press flex items-center gap-2 rounded-[12px] border px-3 py-2.5 text-start text-[13px] font-medium ${result === r ? 'border-[var(--maher-brand)] bg-[var(--maher-brand-soft)] text-[var(--maher-text-primary)]' : 'border-[var(--maher-border)] text-[var(--maher-text-secondary)]'}`}>
                        <Stamp tone={resultTone(r)} />
                        {statusLabel(r)}
                      </button>
                    ))}
                  </div>
                </div>
                {failing ? <Input label={tc('defectDescription')} value={defectDescription} onChange={(e) => setDefectDescription(e.target.value)} required /> : null}
                <TextArea autoGrow label={tc('notes')} value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
                <div>
                  <span className="mb-1.5 block text-[13px] font-medium text-[var(--maher-text-primary)]">{tp('qualityPhotos')}</span>
                  <PhotoAttachField accept="image/jpeg,image/png,image/webp,image/heic" uploadLabel={tp('attachFile')} uploadingLabel={tCommon('uploading')} onUploadFile={uploadPhoto} />
                  {photoNames.length ? (
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {photoNames.map((n, i) => (
                        <li key={`${n}-${i}`}>
                          <Stamp tone="neutral" size="sm">
                            {n.length > 24 ? `${n.slice(0, 22)}…` : n}
                          </Stamp>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </Board.Body>
            </Board>
          ) : (
            <Board tone={tone} wash="top">
              <Board.Header title={tc('overallResult')} />
              <Board.Body className="space-y-4">
                <Figure value={statusLabel(inspection.result)} label={tc('overallResult')} tone={tone} locale={locale} />
                {items.length ? <Meter value={savedPass} max={items.length} label={statusLabel('PASS')} valueLabel={`${savedPass}/${items.length}`} tone={savedFail ? 'error' : 'success'} /> : null}
                <KeyFacts columns={2} facts={[{ label: tc('notes'), value: inspection.notes ?? '—', wide: true, muted: !inspection.notes }]} />
              </Board.Body>
            </Board>
          )}

          {(inspection.defects ?? []).length ? (
            <Board tone="error">
              <Board.Header title={tc('defectDescription')} meta={<Stamp tone="error" size="sm">{(inspection.defects ?? []).length}</Stamp>} />
              <Board.Body className="space-y-2">
                {(inspection.defects ?? []).map((d) => (
                  <Ticket key={d.id} tone={d.severity === 'MAJOR' || d.severity === 'CRITICAL' ? 'error' : 'warning'} title={d.description} why={d.severity ? statusLabel(d.severity) : undefined} />
                ))}
              </Board.Body>
            </Board>
          ) : null}

          {(inspection.rework ?? []).length ? (
            <Board tone={openRework.length ? 'warning' : 'success'}>
              <Board.Header title={tc('rework')} meta={<Stamp tone={openRework.length ? 'warning' : 'success'} size="sm">{`${(inspection.rework ?? []).length - openRework.length}/${(inspection.rework ?? []).length}`}</Stamp>} />
              <ul className="divide-y divide-[var(--maher-border)]">
                {(inspection.rework ?? []).map((rw) => (
                  <li key={rw.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <Ltr className="font-semibold text-[var(--maher-text-primary)]">{rw.number}</Ltr>
                        <Stamp tone={rw.status === 'COMPLETED' ? 'success' : rw.status === 'IN_PROGRESS' ? 'brand' : 'warning'} size="sm">
                          {statusLabel(rw.status)}
                        </Stamp>
                      </span>
                      {rw.description ? <span className="block text-[12px] text-[var(--maher-text-secondary)]">{rw.description}</span> : null}
                    </span>
                    {rw.status !== 'COMPLETED' ? (
                      rw.status === 'AWAITING_STAGE' || rw.status === 'OPEN' ? (
                        <Button size="sm" variant="secondary" leadingIcon={<Wrench className="h-3.5 w-3.5" />} onClick={() => (setReworkFor(rw), setReworkStageId(null), setReworkNotes(''))}>
                          {tp('startRework')}
                        </Button>
                      ) : (
                        <Button size="sm" leadingIcon={<CheckCircle2 className="h-3.5 w-3.5" />} loading={completeRework.isPending} onClick={() => completeRework.mutate(rw.id)}>
                          {tc('completeRework')}
                        </Button>
                      )
                    ) : null}
                  </li>
                ))}
              </ul>
            </Board>
          ) : null}
        </div>
      </div>

      {pending ? (
        <ActionDock note={draftFail ? tp('qualityFailNote', { count: draftFail }) : tp('qualityAllPassNote')}>
          <Button loading={submit.isPending} disabled={failing && !defectDescription.trim()} onClick={() => submit.mutate()}>
            {tc('submitResult')}
          </Button>
        </ActionDock>
      ) : null}

      <Sheet
        open={Boolean(reworkFor)}
        onClose={() => setReworkFor(null)}
        title={tp('startRework')}
        description={reworkFor?.number}
        tone="warning"
        footer={
          <>
            <Button variant="ghost" onClick={() => setReworkFor(null)}>
              {tCommon('cancel')}
            </Button>
            <Button loading={startRework.isPending} disabled={!reworkStageId} onClick={() => reworkFor && reworkStageId && startRework.mutate({ reworkId: reworkFor.id, stageInstanceId: reworkStageId, notes: reworkNotes.trim() || undefined })}>
              {tp('startRework')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Combobox label={tp('chooseReworkStage')} value={reworkStageId} onChange={setReworkStageId} options={(stages.data?.eligible ?? []).map((s) => ({ value: (s.stageInstanceId ?? s.id) as string, label: localizedName(locale, s), description: `${s.stageCode}${stages.data?.recommended && (stages.data.recommended.stageInstanceId ?? stages.data.recommended.id) === (s.stageInstanceId ?? s.id) ? ` · ${tp('recommended')}` : ''}` }))} placeholder={tp('chooseReworkStage')} emptyText={kit.combobox.empty} loadingText={kit.combobox.loading} clearLabel={kit.combobox.clear} />
          <TextArea autoGrow label={tc('notes')} value={reworkNotes} onChange={(e) => setReworkNotes(e.target.value)} rows={3} />
        </div>
      </Sheet>
      <span className="hidden">{API_URL}</span>
    </div>
  );
}
