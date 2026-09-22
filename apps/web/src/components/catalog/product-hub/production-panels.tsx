'use client';

import { BomMaterialPicker, type PickedMaterial } from '@/components/admin/bom-material-picker';
import { InventoryItemThumb } from '@/components/admin/inventory-item-thumb';
import { ProductWorkflowTimes } from '@/components/workflow/product-workflow-times';
import { Link } from '@/i18n/navigation';
import { useKitCopy } from '@/lib/kit-copy';
import { QUANTITY_SCALING_MODES } from '@/lib/scheduling';
import { localizedName } from '@maher/i18n';
import { Board, Button, Combobox, Figure, Ledger, LedgerRow, Ltr, Meter, NumberField, SegmentedControl, Stamp, Switch } from '@maher/ui';
import { ArrowUpRight, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useCatalogCopy } from '../catalog-shared';
import type { Applicability, BomEditLine, ProductDraft } from './use-product-draft';

const clock = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 && m > 0 ? `${h}h ${m}m` : h > 0 ? `${h}h` : `${m}m`;
};

/* ── BOM ─────────────────────────────────────────────────────────────────── */

export function BomPanel({ draft }: { draft: ProductDraft }) {
  const t = useTranslations('catalog');
  const tSales = useTranslations('sales');
  const tCommon = useTranslations('common');
  const copy = useCatalogCopy();
  const { bomLines, setBomLines } = draft.bom;
  const [pickerOpen, setPickerOpen] = useState(false);
  const [replaceIndex, setReplaceIndex] = useState<number | null>(null);
  const apiLines = draft.data?.bomLines ?? [];
  const sell = Number(draft.identity.basePrice);
  const total = draft.liveBomCost > 0 ? draft.liveBomCost : Number(draft.data?.productionCost ?? draft.data?.manufacturingCost ?? 0);
  const grouped = Array.from(
    bomLines.reduce((map, line) => {
      const api = apiLines.find((b) => b.sku === line.sku);
      const key = line.category || api?.category || 'other';
      map.set(key, (map.get(key) ?? 0) + (Number(line.qty) || 0) * (api?.unitCost ?? 0));
      return map;
    }, new Map<string, number>()),
  );

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <Board id="product-bom" tone="brand">
        <Board.Header
          title={t('bomMaterials')}
          actions={
            <Button size="sm" variant="secondary" leadingIcon={<Plus className="h-4 w-4" />} onClick={() => (setReplaceIndex(null), setPickerOpen(true))}>
              {t('addMaterial')}
            </Button>
          }
        />
        {bomLines.length === 0 ? (
          <Board.Empty title={t('noBomMaterials')} action={<Button size="sm" onClick={() => setPickerOpen(true)}>{t('addMaterial')}</Button>} />
        ) : (
          <ul className="divide-y divide-[var(--maher-border)]">
            {bomLines.map((line, index) => {
              const api = apiLines.find((b) => b.sku === line.sku);
              const unitCost = api?.unitCost ?? 0;
              const lineCost = (Number(line.qty) || 0) * unitCost;
              const name = localizedName(copy.locale, { nameEn: line.nameEn ?? api?.nameEn, nameAr: line.nameAr ?? api?.nameAr }) || line.sku;
              return (
                <li key={`${line.sku}-${index}`} className="grid gap-3 px-5 py-3 sm:grid-cols-[minmax(0,1fr)_112px_96px_auto] sm:items-center">
                  <div className="flex min-w-0 items-center gap-3">
                    <InventoryItemThumb src={line.imageUrl ?? api?.imageUrl} alt={name} size={40} />
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-semibold leading-5 text-[var(--maher-text-primary)]">{name}</p>
                      <p className="truncate text-[12px] leading-4 text-[var(--maher-text-tertiary)]">
                        <Ltr>{line.sku}</Ltr>
                        {line.category ? ` · ${line.category}` : ''}
                        {unitCost > 0 ? ` · ${copy.money(unitCost)}` : ''}
                      </p>
                      <button type="button" className="mt-0.5 inline-flex items-center gap-1 text-[12px] font-medium text-[var(--maher-brand)] hover:underline" onClick={() => (setReplaceIndex(index), setPickerOpen(true))}>
                        <RefreshCw className="h-3 w-3" aria-hidden /> {t('changeMaterial')}
                      </button>
                    </div>
                  </div>
                  <NumberField aria-label={t('qty')} value={line.qty === '' ? null : Number(line.qty)} decimals={3} min={0} onChange={(v) => setBomLines((prev) => prev.map((r, i) => (i === index ? { ...r, qty: v == null ? '' : String(v) } : r)))} />
                  <Ltr className="block text-end text-[14px] font-semibold tabular-nums text-[var(--maher-text-primary)]">{lineCost > 0 ? copy.money(lineCost) : '—'}</Ltr>
                  <Button size="sm" variant="ghost" aria-label={tCommon('remove')} onClick={() => setBomLines((prev) => prev.filter((_, i) => i !== index))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
        {bomLines.length ? (
          <Board.Footer>
            <span className="text-[13px] text-[var(--maher-text-secondary)]">{tSales('productionPrice')}</span>
            <Ltr className="text-[15px] font-semibold text-[var(--maher-text-primary)]">{copy.money(total)}</Ltr>
          </Board.Footer>
        ) : null}
      </Board>

      <div className="space-y-5">
        <Board tone={Number.isFinite(sell) && sell > 0 && total > sell ? 'error' : 'success'} wash="top">
          <Board.Header title={t('costs')} />
          <Board.Body className="space-y-4">
            <Figure value={copy.money(total)} label={tSales('productionPrice')} locale={copy.locale} />
            {Number.isFinite(sell) && sell > 0 ? (
              <Meter value={Math.min(total, sell)} max={sell} label={t('basePrice')} valueLabel={`${copy.margin(sell, total) ?? 0}%`} tone={total > sell ? 'error' : (copy.margin(sell, total) ?? 0) < 20 ? 'warning' : 'success'} />
            ) : (
              <p className="text-[13px] text-[var(--maher-text-tertiary)]">{t('basePriceHint')}</p>
            )}
            <p className="text-[12px] leading-4 text-[var(--maher-text-tertiary)]">{t('productionCostHint')}</p>
          </Board.Body>
        </Board>
        {grouped.length ? (
          <Board tone="neutral">
            <Board.Header title={tSales('desk.costByGroup')} />
            <Ledger className="px-5 pb-2">
              {grouped
                .sort((a, b) => b[1] - a[1])
                .map(([group, cost]) => (
                  <LedgerRow key={group} label={group} value={copy.money(cost)} hint={total > 0 ? `${Math.round((cost / total) * 100)}%` : undefined} />
                ))}
            </Ledger>
          </Board>
        ) : null}
      </div>

      <BomMaterialPicker
        open={pickerOpen}
        onClose={() => (setPickerOpen(false), setReplaceIndex(null))}
        excludeSkus={replaceIndex == null ? bomLines.map((l) => l.sku) : bomLines.filter((_, i) => i !== replaceIndex).map((l) => l.sku)}
        onPick={(mat: PickedMaterial) => {
          const next: BomEditLine = { sku: mat.sku, qty: '1', category: mat.category ?? '', nameEn: mat.nameEn, nameAr: mat.nameAr, imageUrl: mat.imageUrl ?? null };
          if (replaceIndex == null) setBomLines((prev) => [...prev, next]);
          else setBomLines((prev) => prev.map((row, i) => (i === replaceIndex ? { ...next, qty: row.qty || '1' } : row)));
          setReplaceIndex(null);
        }}
      />
    </div>
  );
}

/* ── Workflow ────────────────────────────────────────────────────────────── */

export function WorkflowPanel({ draft }: { draft: ProductDraft }) {
  const t = useTranslations('catalog');
  const tp = useTranslations('production');
  const tCommon = useTranslations('common');
  const kit = useKitCopy();
  const copy = useCatalogCopy();
  const { workflowId, setWorkflowId, workflowOverrides, setWorkflowOverrides } = draft.workflow;
  const workflows = draft.queries.workflows.data ?? [];
  const library = draft.queries.stageLibrary.data ?? [];
  const applicability: Array<{ value: Applicability; label: string; tone: 'neutral' | 'brand' | 'info' | 'error' }> = [
    { value: 'INHERIT', label: tp('workflow.parallel'), tone: 'neutral' },
    { value: 'REQUIRED', label: tp('workflow.required'), tone: 'brand' },
    { value: 'OPTIONAL', label: tp('workflow.optional'), tone: 'info' },
    { value: 'EXCLUDED', label: tp('workflow.excluded'), tone: 'error' },
  ];

  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Board tone="info" wash="top">
          <Board.Header
            title={tp('workflow.title')}
            description={tp('workflow.subtitle')}
            actions={
              <Button size="sm" loading={draft.saveWorkflow.isPending} disabled={!workflowId} onClick={() => draft.saveWorkflow.mutate()}>
                {tCommon('save')}
              </Button>
            }
          />
          <Board.Body className="space-y-4">
            <Combobox
              label={tp('workflow.title')}
              value={workflowId || null}
              onChange={(v) => setWorkflowId(v ?? '')}
              options={workflows.map((w) => ({ value: w.id, label: localizedName(copy.locale, w, w.code), description: w.code }))}
              placeholder={t('select')}
              emptyText={kit.combobox.empty}
              clearLabel={kit.combobox.clear}
            />
            {workflowId ? (
              <Link href={`/admin/production/workflow/${workflowId}`} className="inline-flex items-center gap-1 text-[13px] font-medium text-[var(--maher-brand)] hover:underline">
                {t('openAssignedWorkflowChart')} <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            ) : null}
          </Board.Body>
        </Board>

        <Board tone="neutral">
          <Board.Header
            title={tp('workflow.dependencies')}
            actions={
              <Button size="sm" variant="secondary" leadingIcon={<Plus className="h-4 w-4" />} onClick={() => setWorkflowOverrides((prev) => [...prev, { key: `ov-${Date.now()}`, stageDefinitionId: '', applicability: 'INHERIT' }])}>
                {tp('workflow.addStage')}
              </Button>
            }
          />
          {workflowOverrides.length === 0 ? (
            <Board.Empty title={tp('workflow.emptyStages')} />
          ) : (
            <ul className="divide-y divide-[var(--maher-border)]">
              {workflowOverrides.map((row, index) => (
                <li key={row.key} className="grid gap-3 px-5 py-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end">
                  <Combobox
                    label={tp('workflow.stageName')}
                    value={row.stageDefinitionId || null}
                    onChange={(v) => setWorkflowOverrides((prev) => prev.map((r, i) => (i === index ? { ...r, stageDefinitionId: v ?? '' } : r)))}
                    options={library.map((s) => ({ value: s.id, label: localizedName(copy.locale, s, s.code), description: s.code }))}
                    placeholder={t('select')}
                    emptyText={kit.combobox.empty}
                    clearLabel={kit.combobox.clear}
                  />
                  <SegmentedControl
                    size="sm"
                    aria-label={tp('workflow.required')}
                    value={row.applicability}
                    onChange={(v) => setWorkflowOverrides((prev) => prev.map((r, i) => (i === index ? { ...r, applicability: v as Applicability } : r)))}
                    options={applicability.map((a) => ({ value: a.value, label: a.label }))}
                  />
                  <Button size="sm" variant="ghost" onClick={() => setWorkflowOverrides((prev) => prev.filter((_, i) => i !== index))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Board>
      </div>

      {workflowId ? <ProductWorkflowTimes productId={draft.id} workflowId={workflowId} /> : null}
    </div>
  );
}

/* ── Production time ─────────────────────────────────────────────────────── */

export function ProductionTimePanel({ draft }: { draft: ProductDraft }) {
  const t = useTranslations('catalog');
  const tCommon = useTranslations('common');
  const kit = useKitCopy();
  const copy = useCatalogCopy();
  const p = draft.profileDraft;
  const stages = draft.queries.stages.data ?? [];
  const display = draft.computedStageMinutes > 0 ? draft.computedStageMinutes : Number(p.totalStandardMinutes || 0);
  const buffered = display * (1 + (Number(p.profileBufferPercent) || 0) / 100);
  const maxStage = Math.max(1, ...p.stageEstimates.map((r) => (r.quantityScalingMode === 'FIXED' ? Number(r.fixedMinutes) : r.quantityScalingMode === 'LINEAR' ? Number(r.minutesPerUnit) : Number(r.setupMinutes) + Number(r.minutesPerUnit)) || 0));
  const numStr = (v: string) => (v === '' ? null : Number(v));
  const strNum = (v: number | null) => (v == null ? '' : String(v));

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
      <div className="space-y-5">
        <Board tone={p.isSchedulingEnabled ? 'brand' : 'neutral'} wash="top">
          <Board.Header title={t('productionTime')} description={t('productionTimeHint')} />
          <Board.Body className="space-y-4">
            {display > 0 ? (
              <div className="grid grid-cols-2 gap-4">
                <Figure value={clock(display)} label={t('computedTotalProductionTime')} locale={copy.locale} />
                <Figure value={clock(buffered)} label={`${t('bufferPercent')} ${p.profileBufferPercent || 0}%`} tone="neutral" size="sm" locale={copy.locale} />
              </div>
            ) : (
              <p className="text-[13px] text-[var(--maher-text-tertiary)]">{t('computedTotalProductionTimeHint')}</p>
            )}
            {draft.queries.profile.isError ? <p className="text-[12px] text-[var(--maher-text-tertiary)]">{t('productionProfileUnavailableHint')}</p> : null}
            <Switch checked={p.isSchedulingEnabled} onChange={p.setIsSchedulingEnabled} label={t('schedulingEnabled')} />
          </Board.Body>
          <Board.Footer>
            <SegmentedControl
              size="sm"
              aria-label={t('productionTime')}
              value={p.schedulingMode}
              onChange={(v) => p.setSchedulingMode(v as 'basic' | 'advanced')}
              options={[
                { value: 'basic', label: t('productionTimeBasic') },
                { value: 'advanced', label: t('productionTimeAdvanced') },
              ]}
            />
            <Button size="sm" loading={draft.saveProfile.isPending} onClick={() => draft.saveProfile.mutate()}>
              {tCommon('save')}
            </Button>
          </Board.Footer>
        </Board>

        <Board tone="neutral">
          <Board.Header title={p.schedulingMode === 'basic' ? t('productionTimeBasic') : t('productionTimeAdvanced')} />
          <Board.Body className="grid gap-4 sm:grid-cols-2">
            {p.schedulingMode === 'basic' ? (
              <>
                <NumberField label={t('totalStandardMinutes')} hint={t('totalStandardMinutesHint')} unit={t('minutesUnit')} value={numStr(p.totalStandardMinutes)} onChange={(v) => p.setTotalStandardMinutes(strNum(v))} min={0} />
                <NumberField label={t('bufferPercent')} unit="%" value={numStr(p.profileBufferPercent)} onChange={(v) => p.setProfileBufferPercent(strNum(v))} min={0} />
              </>
            ) : (
              <>
                <NumberField label={t('setupMinutes')} unit={t('minutesUnit')} value={numStr(p.profileSetupMinutes)} onChange={(v) => p.setProfileSetupMinutes(strNum(v))} min={0} />
                <NumberField label={t('complexityFactor')} decimals={2} value={numStr(p.complexityFactor)} onChange={(v) => p.setComplexityFactor(strNum(v))} min={0} />
                <NumberField label={t('defaultBatchSize')} value={numStr(p.defaultBatchSize)} onChange={(v) => p.setDefaultBatchSize(strNum(v))} min={1} />
                <NumberField label={t('minimumLeadTimeDays')} value={numStr(p.minimumLeadTimeDays)} onChange={(v) => p.setMinimumLeadTimeDays(strNum(v))} min={0} />
                <NumberField label={t('bufferPercent')} unit="%" value={numStr(p.profileBufferPercent)} onChange={(v) => p.setProfileBufferPercent(strNum(v))} min={0} />
              </>
            )}
          </Board.Body>
        </Board>
      </div>

      {p.schedulingMode === 'advanced' ? (
        <Board tone="info">
          <Board.Header
            title={t('stageEstimates')}
            actions={
              <Button
                size="sm"
                variant="secondary"
                leadingIcon={<Plus className="h-4 w-4" />}
                onClick={() =>
                  p.setStageEstimates((prev) => [
                    ...prev,
                    { key: `est-${Date.now().toString(36)}-${prev.length}`, stageDefinitionId: '', setupMinutes: '0', minutesPerUnit: '0', fixedMinutes: '0', quantityScalingMode: 'SETUP_PLUS_LINEAR', workerCountRequired: '1', isRequired: true },
                  ])
                }
              >
                {t('addStageEstimate')}
              </Button>
            }
          />
          {p.stageEstimates.length === 0 ? (
            <Board.Empty title={t('noStageEstimates')} />
          ) : (
            <ul className="divide-y divide-[var(--maher-border)]">
              {p.stageEstimates.map((row, index) => {
                const minutes = (row.quantityScalingMode === 'FIXED' ? Number(row.fixedMinutes) : row.quantityScalingMode === 'LINEAR' ? Number(row.minutesPerUnit) : Number(row.setupMinutes) + Number(row.minutesPerUnit)) || 0;
                const patch = (next: Partial<typeof row>) => p.setStageEstimates((prev) => prev.map((r, i) => (i === index ? { ...r, ...next } : r)));
                return (
                  <li key={row.key} className="space-y-3 px-5 py-4">
                    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                      <Combobox
                        label={t('stage')}
                        value={row.stageDefinitionId || null}
                        onChange={(v) => patch({ stageDefinitionId: v ?? '' })}
                        options={stages.map((s) => ({ value: s.id, label: localizedName(copy.locale, s, s.code), description: s.code }))}
                        placeholder={t('select')}
                        emptyText={kit.combobox.empty}
                        clearLabel={kit.combobox.clear}
                      />
                      <div className="flex items-center gap-2">
                        <Stamp tone={minutes > 0 ? 'success' : 'warning'} size="sm">
                          {clock(minutes)}
                        </Stamp>
                        <Button size="sm" variant="ghost" onClick={() => p.setStageEstimates((prev) => prev.filter((_, i) => i !== index))}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <SegmentedControl size="sm" aria-label={t('quantityScalingMode')} value={row.quantityScalingMode} onChange={(v) => patch({ quantityScalingMode: v })} options={QUANTITY_SCALING_MODES.map((mode) => ({ value: mode, label: t(`quantityScalingModes.${mode}`) }))} />
                    <div className="grid gap-3 sm:grid-cols-3">
                      {row.quantityScalingMode === 'FIXED' ? (
                        <NumberField label={t('fixedMinutes')} unit={t('minutesUnit')} value={numStr(row.fixedMinutes)} onChange={(v) => patch({ fixedMinutes: strNum(v) })} min={0} />
                      ) : (
                        <>
                          {row.quantityScalingMode !== 'LINEAR' ? <NumberField label={t('setupMinutes')} unit={t('minutesUnit')} value={numStr(row.setupMinutes)} onChange={(v) => patch({ setupMinutes: strNum(v) })} min={0} /> : null}
                          <NumberField label={t('minutesPerUnit')} unit={t('minutesUnit')} value={numStr(row.minutesPerUnit)} onChange={(v) => patch({ minutesPerUnit: strNum(v) })} min={0} />
                        </>
                      )}
                      <NumberField label={t('workerCountRequired')} value={numStr(row.workerCountRequired)} onChange={(v) => patch({ workerCountRequired: strNum(v) })} min={1} />
                    </div>
                    <Meter value={minutes} max={maxStage} size="sm" showValue={false} tone={minutes > 0 ? 'info' : 'neutral'} />
                  </li>
                );
              })}
            </ul>
          )}
        </Board>
      ) : null}
    </div>
  );
}
