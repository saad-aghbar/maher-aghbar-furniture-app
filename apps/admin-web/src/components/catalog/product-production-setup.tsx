'use client';

import { apiFetch, ApiClientError } from '@/lib/api-client';
import { InventoryItemThumb } from '@/components/admin/inventory-item-thumb';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import { formatProductionPreviewStep, localizedName } from '@maher/i18n';
import {
  Alert,
  Button,
  Card,
  Input,
  Select,
  Skeleton,
  StatusBadge,
} from '@maher/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';

type Behavior =
  | 'NONE'
  | 'USES_MATERIALS'
  | 'PRODUCES_SEMI_FINISHED'
  | 'USES_SEMI_FINISHED'
  | 'USES_AND_PRODUCES'
  | 'PRODUCES_FINISHED';

type SetupStage = {
  workflowNodeId: string;
  nodeKey: string;
  stageDefinitionId: string;
  stageCode?: string | null;
  nameEn: string;
  nameAr: string;
  nameHe?: string | null;
  requiresInspection: boolean;
  sortOrder: number;
  behavior: Behavior;
  consumesRawMaterials: boolean;
  consumesSemiFinished: boolean;
  consumeOutputIds: string[];
  materialInputs?: Array<{
    sku: string;
    qtyPerUnit: number;
    unit?: string;
    required?: boolean;
    imageUrl?: string | null;
    nameEn?: string | null;
    nameAr?: string | null;
  }>;
  output: {
    id: string | null;
    nameEn: string | null;
    nameAr: string | null;
    nameHe?: string | null;
    qtyPerUnit: number | null;
    unit: string | null;
    defaultWarehouseId: string | null;
    expectedPieceCount?: number | null;
    pieceLabels?: Array<{ nameEn: string; nameAr?: string | null; nameHe?: string | null }> | null;
  } | null;
};

type SetupResponse = {
  status: 'READY' | 'NEEDS_SETUP' | 'INVALID';
  issues: Array<{ code: string; message: string; workflowNodeId?: string | null }>;
  workflow: { id: string; nameEn: string; nameAr: string; published: boolean } | null;
  bomLines: Array<{
    sku: string;
    qty: number;
    exists: boolean;
    imageUrl?: string | null;
    nameEn?: string | null;
    nameAr?: string | null;
    nameHe?: string | null;
  }>;
  stages: SetupStage[];
  edges: Array<{ fromNodeKey: string; toNodeKey: string }>;
  warehouses: Array<{
    id: string;
    code: string;
    nameEn: string;
    nameAr: string;
    nameHe?: string | null;
    type: string;
    isDefault: boolean;
  }>;
  outputs: Array<{
    id: string;
    workflowNodeId: string | null;
    nameEn: string;
    nameAr: string;
    nameHe?: string | null;
  }>;
};

type PreviewResponse = {
  steps: Array<{
    stageNameEn: string;
    stageNameAr: string;
    stageNameHe?: string | null;
    behavior: Behavior;
    consumesMaterials: boolean;
    consumes: string[];
    consumeOutputs?: Array<{ nameEn: string; nameAr: string; nameHe?: string | null }>;
    produces: {
      nameEn: string | null;
      nameAr: string | null;
      nameHe?: string | null;
      qtyPerUnit: number | null;
    } | null;
  }>;
};

type Draft = {
  behavior: Behavior;
  consumesRawMaterials: boolean;
  consumesSemiFinished: boolean;
  outputNameEn: string;
  outputNameAr: string;
  outputNameHe: string;
  outputQtyPerUnit: string;
  expectedPieceCount: string;
  pieceLabels: Array<{ nameEn: string; nameAr: string; nameHe: string }>;
  defaultWarehouseId: string;
  consumeOutputIds: string[];
  materialInputs: Array<{ sku: string; qtyPerUnit: string }>;
};

function resizePackLabels(
  labels: Array<{ nameEn: string; nameAr: string; nameHe: string }>,
  count: number,
): Array<{ nameEn: string; nameAr: string; nameHe: string }> {
  const n = Math.max(1, Math.min(20, Math.floor(count) || 1));
  if (labels.length === n) return labels;
  if (labels.length < n) {
    return [
      ...labels,
      ...Array.from({ length: n - labels.length }, () => ({
        nameEn: '',
        nameAr: '',
        nameHe: '',
      })),
    ];
  }
  return labels.slice(0, n);
}

function produces(behavior: Behavior) {
  return (
    behavior === 'PRODUCES_SEMI_FINISHED' ||
    behavior === 'USES_AND_PRODUCES' ||
    behavior === 'PRODUCES_FINISHED'
  );
}

function usesSemi(behavior: Behavior) {
  return behavior === 'USES_SEMI_FINISHED' || behavior === 'USES_AND_PRODUCES';
}

function isPackagingStage(code?: string | null) {
  const c = String(code ?? '').toUpperCase();
  return c === 'PACKAGING' || c === 'PACK';
}

function isInspectionStage(code?: string | null) {
  return String(code ?? '').toUpperCase() === 'INSPECTION';
}

function isDeliveryStage(code?: string | null) {
  return String(code ?? '').toUpperCase() === 'DELIVERY';
}

function behaviorOptionsForStage(
  stageCode: string | null | undefined,
  all: Array<{ value: Behavior; label: string }>,
) {
  if (isInspectionStage(stageCode)) {
    return all.filter((o) => o.value === 'NONE' || o.value === 'USES_SEMI_FINISHED');
  }
  if (isDeliveryStage(stageCode)) {
    return all.filter((o) => o.value === 'NONE');
  }
  if (isPackagingStage(stageCode)) {
    return all.filter((o) => o.value === 'PRODUCES_FINISHED');
  }
  return all.filter((o) => o.value !== 'PRODUCES_FINISHED');
}

/** BOM qty still available for `stageId` after other stages' claims. */
function remainingBomQtyForStage(
  sku: string,
  stageId: string,
  bomQty: number,
  drafts: Record<string, Draft>,
): number {
  let usedElsewhere = 0;
  for (const [nodeId, draft] of Object.entries(drafts)) {
    if (nodeId === stageId) continue;
    const row = draft.materialInputs.find((r) => r.sku === sku);
    if (row) usedElsewhere += Number(row.qtyPerUnit) || 0;
  }
  return Math.max(0, bomQty - usedElsewhere);
}

/** True when another stage already takes this SEMI output. */
function semiOutputClaimedElsewhere(
  outputId: string,
  stageId: string,
  drafts: Record<string, Draft>,
): boolean {
  for (const [nodeId, draft] of Object.entries(drafts)) {
    if (nodeId === stageId) continue;
    if (draft.consumeOutputIds.includes(outputId)) return true;
  }
  return false;
}

/** Cap each stage's material claims so Σ across stages never exceeds BOM qty. */
function clampDraftMaterialsToBom(
  drafts: Record<string, Draft>,
  bomLines: Array<{ sku: string; qty: number }>,
): Record<string, Draft> {
  const remaining = new Map<string, number>();
  for (const line of bomLines) {
    const sku = String(line.sku ?? '').trim();
    if (!sku) continue;
    remaining.set(sku, Math.max(0, Number(line.qty) || 0));
  }
  const next: Record<string, Draft> = {};
  for (const [nodeId, draft] of Object.entries(drafts)) {
    const materialInputs: Draft['materialInputs'] = [];
    for (const row of draft.materialInputs) {
      const sku = String(row.sku ?? '').trim();
      if (!sku || !remaining.has(sku)) continue;
      const want = Math.max(0, Number(row.qtyPerUnit) || 0);
      const left = remaining.get(sku) ?? 0;
      const take = Math.min(want, left);
      remaining.set(sku, Math.max(0, left - take));
      if (take > 0) materialInputs.push({ sku, qtyPerUnit: String(take) });
    }
    next[nodeId] = { ...draft, materialInputs };
  }
  return next;
}

export function ProductProductionSetup({ productId }: { productId: string }) {
  const t = useTranslations('production');
  const tErr = useTranslations('errors');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const qc = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [banner, setBanner] = useState<string | null>(null);

  const setupQuery = useQuery({
    queryKey: ['product-production-setup', productId],
    queryFn: () => apiFetch<SetupResponse>(`/api/v1/products/${productId}/production-setup`),
  });
  const previewQuery = useQuery({
    queryKey: ['product-production-setup-preview', productId],
    queryFn: () =>
      apiFetch<PreviewResponse>(`/api/v1/products/${productId}/production-setup/preview`),
  });

  useEffect(() => {
    if (!setupQuery.data) return;
    const next: Record<string, Draft> = {};
    for (const stage of setupQuery.data.stages) {
      next[stage.workflowNodeId] = {
        behavior: stage.behavior,
        consumesRawMaterials: stage.consumesRawMaterials,
        consumesSemiFinished: stage.consumesSemiFinished,
        outputNameEn: stage.output?.nameEn ?? '',
        outputNameAr: stage.output?.nameAr ?? '',
        outputNameHe: stage.output?.nameHe ?? '',
        outputQtyPerUnit: String(stage.output?.qtyPerUnit ?? 1),
        expectedPieceCount: String(
          (stage.output as { expectedPieceCount?: number } | null)?.expectedPieceCount ?? 1,
        ),
        pieceLabels: resizePackLabels(
          (stage.output?.pieceLabels ?? []).map((row) => ({
            nameEn: row.nameEn ?? '',
            nameAr: row.nameAr ?? '',
            nameHe: row.nameHe ?? '',
          })),
          Number(
            (stage.output as { expectedPieceCount?: number } | null)?.expectedPieceCount ??
              stage.output?.pieceLabels?.length ??
              1,
          ),
        ),
        defaultWarehouseId: stage.output?.defaultWarehouseId ?? '',
        consumeOutputIds: stage.consumeOutputIds ?? [],
        materialInputs: (stage.materialInputs ?? []).map((row) => ({
          sku: row.sku,
          qtyPerUnit: String(row.qtyPerUnit),
        })),
      };
    }
    setDrafts(next);
  }, [setupQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const bomLines = setupQuery.data?.bomLines ?? [];
      const clampedDrafts = clampDraftMaterialsToBom(drafts, bomLines);
      // Exclusive SEMI handoff: first stage in list keeps a claim; later duplicates drop.
      const claimedOutputs = new Set<string>();
      const exclusiveDrafts: Record<string, Draft> = {};
      for (const stage of setupQuery.data?.stages ?? []) {
        const d = clampedDrafts[stage.workflowNodeId];
        if (!d) continue;
        const keep: string[] = [];
        for (const id of d.consumeOutputIds) {
          if (claimedOutputs.has(id)) continue;
          claimedOutputs.add(id);
          keep.push(id);
        }
        exclusiveDrafts[stage.workflowNodeId] = { ...d, consumeOutputIds: keep };
      }
      setDrafts({ ...clampedDrafts, ...exclusiveDrafts });
      const stages = (setupQuery.data?.stages ?? []).map((stage) => {
        const d = exclusiveDrafts[stage.workflowNodeId] ?? clampedDrafts[stage.workflowNodeId];
        return {
          workflowNodeId: stage.workflowNodeId,
          stageDefinitionId: stage.stageDefinitionId,
          behavior: d?.behavior ?? 'NONE',
          consumesRawMaterials: d?.consumesRawMaterials ?? false,
          consumesSemiFinished:
            d?.behavior === 'PRODUCES_FINISHED'
              ? Boolean(d.consumesSemiFinished)
              : usesSemi(d?.behavior ?? 'NONE'),
          outputNameEn: d?.outputNameEn || null,
          outputNameAr: d?.outputNameAr || null,
          outputNameHe: d?.outputNameHe || null,
          outputQtyPerUnit: Number(d?.outputQtyPerUnit || 1),
          expectedPieceCount: Number(d?.expectedPieceCount || 1),
          pieceLabels:
            d?.behavior === 'PRODUCES_FINISHED'
              ? (d.pieceLabels ?? [])
                  .map((row) => ({
                    nameEn: row.nameEn.trim(),
                    nameAr: row.nameAr.trim() || row.nameEn.trim(),
                    nameHe: row.nameHe.trim() || null,
                  }))
                  .filter((row) => row.nameEn)
              : undefined,
          defaultWarehouseId: d?.defaultWarehouseId || null,
          consumeOutputIds: d?.consumeOutputIds ?? [],
          materialInputs: (d?.materialInputs ?? [])
            .filter((row) => row.sku && Number(row.qtyPerUnit) > 0)
            .map((row) => ({ sku: row.sku, qtyPerUnit: Number(row.qtyPerUnit) })),
        };
      });
      return apiFetch(`/api/v1/products/${productId}/production-setup`, {
        method: 'PUT',
        body: JSON.stringify({ stages }),
      });
    },
    onSuccess: async () => {
      setBanner(t('setup.saved'));
      await qc.invalidateQueries({ queryKey: ['product-production-setup', productId] });
      await qc.invalidateQueries({ queryKey: ['product-production-setup-preview', productId] });
    },
  });

  const behaviorOptions = useMemo(
    () => [
      { value: 'NONE', label: t('setup.behaviorNone') },
      { value: 'USES_MATERIALS', label: t('setup.behaviorUsesMaterials') },
      { value: 'PRODUCES_SEMI_FINISHED', label: t('setup.behaviorProducesSemi') },
      { value: 'USES_SEMI_FINISHED', label: t('setup.behaviorUsesSemi') },
      { value: 'USES_AND_PRODUCES', label: t('setup.behaviorUsesAndProduces') },
      { value: 'PRODUCES_FINISHED', label: t('setup.behaviorProducesFinished') },
    ],
    [t],
  );

  if (setupQuery.isLoading) {
    return (
      <Card title={t('setup.title')} description={t('setup.subtitle')}>
        <Skeleton className="h-40 w-full" />
      </Card>
    );
  }
  if (setupQuery.error) {
    return (
      <Card title={t('setup.title')} description={t('setup.subtitle')}>
        <Alert variant="error">{mutationErrorMessage(setupQuery.error)}</Alert>
      </Card>
    );
  }
  const setup = setupQuery.data;
  if (!setup) return null;
  const savedOutputs = setup.outputs;

  return (
    <Card
      title={t('setup.title')}
      description={t('setup.subtitle')}
      actions={
        <div className="flex items-center gap-2">
          <StatusBadge
            status={
              setup.status === 'READY'
                ? 'READY'
                : setup.status === 'INVALID'
                  ? 'FAILED'
                  : 'NEEDS_REVIEW'
            }
            label={
              setup.status === 'READY'
                ? t('setup.statusReady')
                : setup.status === 'INVALID'
                  ? t('setup.statusInvalid')
                  : t('setup.statusNeedsSetup')
            }
          />
          <Button
            size="sm"
            loading={saveMutation.isPending}
            disabled={!setup.workflow}
            onClick={() => saveMutation.mutate()}
          >
            {t('setup.saveSetup')}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-text-secondary">{t('setup.newOrdersOnly')}</p>
        {banner ? <Alert variant="success">{banner}</Alert> : null}
        {saveMutation.error ? (
          <Alert variant="error">
            {saveMutation.error instanceof ApiClientError
              ? mutationErrorMessage(saveMutation.error)
              : tCommon('error')}
          </Alert>
        ) : null}

        {setup.issues.length ? (
          <div className="rounded-xl border border-border p-3">
            <p className="mb-2 text-sm font-semibold">{t('setup.issues')}</p>
            <ul className="space-y-1 text-sm text-text-secondary">
              {setup.issues.map((issue, i) => (
                <li key={`${issue.code}-${i}`}>
                  {tErr(issue.code)}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="rounded-xl border border-border p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">{t('setup.bomTitle')}</p>
            <a
              href="#product-bom"
              className="text-sm font-medium text-brand underline-offset-2 hover:underline"
            >
              {t('setup.editBom')}
            </a>
          </div>
          {(setup.bomLines ?? []).length === 0 ? (
            <p className="text-sm text-text-tertiary">{t('setup.bomEmpty')}</p>
          ) : (
            <ul className="space-y-1 text-sm text-text-secondary">
              {(setup.bomLines ?? []).map((line) => (
                <li key={line.sku} className="flex items-center gap-2" dir="ltr">
                  <InventoryItemThumb src={line.imageUrl} alt="" size={28} />
                  <span>
                    {t('setup.bomLine', {
                      name: localizedName(locale, line, line.sku),
                      qty: line.qty,
                    })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {!setup.workflow ? (
          <p className="text-sm text-text-tertiary">{tErr('SETUP_WORKFLOW_REQUIRED')}</p>
        ) : (
          <>
            <div>
              <p className="mb-2 text-sm font-semibold">{t('setup.flowMap')}</p>
              <div className="flex flex-wrap gap-2">
                {setup.stages.map((stage) => {
                  const d = drafts[stage.workflowNodeId];
                  return (
                    <span
                      key={stage.workflowNodeId}
                      className="rounded-full border border-border px-3 py-1 text-xs"
                    >
                      {localizedName(locale, stage)}
                      {d && produces(d.behavior) ? ` · ${t('setup.producesBadge')}` : ''}
                      {d && usesSemi(d.behavior) ? ` · ${t('setup.usesBadge')}` : ''}
                    </span>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-3">
              {setup.stages.map((stage) => {
                const d = drafts[stage.workflowNodeId] ?? {
                  behavior: 'NONE' as Behavior,
                  consumesRawMaterials: false,
                  consumesSemiFinished: false,
                  outputNameEn: '',
                  outputNameAr: '',
                  outputNameHe: '',
                  outputQtyPerUnit: '1',
                  expectedPieceCount: '1',
                  pieceLabels: [{ nameEn: '', nameAr: '', nameHe: '' }],
                  defaultWarehouseId: '',
                  consumeOutputIds: [],
                  materialInputs: [],
                };
                const upstream = savedOutputs.filter((o) => {
                  if (!o.workflowNodeId || o.workflowNodeId === stage.workflowNodeId) {
                    return false;
                  }
                  if (d.consumeOutputIds.includes(o.id)) return true;
                  return !semiOutputClaimedElsewhere(o.id, stage.workflowNodeId, drafts);
                });
                const earlierSemiExists = savedOutputs.some(
                  (o) => o.workflowNodeId && o.workflowNodeId !== stage.workflowNodeId,
                );
                const warehouseType =
                  d.behavior === 'PRODUCES_FINISHED' ? 'FINISHED_GOODS' : 'SEMI_FINISHED';
                return (
                  <div
                    key={stage.workflowNodeId}
                    id={`setup-stage-${stage.workflowNodeId}`}
                    className="rounded-2xl border border-border p-4 space-y-3"
                  >
                    <p className="font-semibold">{localizedName(locale, stage)}</p>
                    <Select
                      label={t('setup.stageBehavior')}
                      value={d.behavior}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [stage.workflowNodeId]: {
                            ...d,
                            behavior: e.target.value as Behavior,
                          },
                        }))
                      }
                      options={behaviorOptionsForStage(stage.stageCode, behaviorOptions)}
                    />
                    {produces(d.behavior) ? (
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={d.consumesRawMaterials}
                          onChange={(e) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [stage.workflowNodeId]: {
                                ...d,
                                consumesRawMaterials: e.target.checked,
                              },
                            }))
                          }
                        />
                        {t('setup.alsoUsesMaterials')}
                      </label>
                    ) : null}
                    {d.behavior === 'PRODUCES_FINISHED' ? (
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={d.consumesSemiFinished}
                          onChange={(e) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [stage.workflowNodeId]: {
                                ...d,
                                consumesSemiFinished: e.target.checked,
                              },
                            }))
                          }
                        />
                        {t('setup.alsoUsesSemi')}
                      </label>
                    ) : null}
                    {produces(d.behavior) ? (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Input
                          label={t('setup.outputNameEn')}
                          value={d.outputNameEn}
                          onChange={(e) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [stage.workflowNodeId]: { ...d, outputNameEn: e.target.value },
                            }))
                          }
                        />
                        <Input
                          label={t('setup.outputNameAr')}
                          value={d.outputNameAr}
                          onChange={(e) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [stage.workflowNodeId]: { ...d, outputNameAr: e.target.value },
                            }))
                          }
                        />
                        <Input
                          label={t('setup.outputNameHe')}
                          value={d.outputNameHe}
                          onChange={(e) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [stage.workflowNodeId]: { ...d, outputNameHe: e.target.value },
                            }))
                          }
                        />
                        <Input
                          label={t('setup.outputQty')}
                          type="number"
                          min={0.001}
                          step="0.001"
                          value={d.outputQtyPerUnit}
                          onChange={(e) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [stage.workflowNodeId]: { ...d, outputQtyPerUnit: e.target.value },
                            }))
                          }
                        />
                        <Input
                          label={t('setup.expectedPieces')}
                          type="number"
                          min={1}
                          step="1"
                          value={d.expectedPieceCount}
                          onChange={(e) => {
                            const nextCount = e.target.value;
                            setDrafts((prev) => ({
                              ...prev,
                              [stage.workflowNodeId]: {
                                ...d,
                                expectedPieceCount: nextCount,
                                pieceLabels: resizePackLabels(
                                  d.pieceLabels,
                                  Number(nextCount) || 1,
                                ),
                              },
                            }));
                          }}
                        />
                        {d.behavior === 'PRODUCES_FINISHED' ? (
                          <div className="sm:col-span-2 space-y-2 rounded-xl border border-border p-3">
                            <p className="text-sm font-semibold">{t('setup.packPiecesTitle')}</p>
                            <p className="text-xs text-text-secondary">
                              {t('setup.packPieceNamesHint')}
                            </p>
                            {(d.pieceLabels ?? []).map((row, index) => (
                              <div
                                key={`pack-${stage.workflowNodeId}-${index}`}
                                className="grid gap-2 sm:grid-cols-3"
                              >
                                <Input
                                  label={t('setup.packPieceN', { n: String(index + 1) })}
                                  value={row.nameEn}
                                  placeholder={t('setup.packPieceNamePlaceholder')}
                                  onChange={(e) =>
                                    setDrafts((prev) => ({
                                      ...prev,
                                      [stage.workflowNodeId]: {
                                        ...d,
                                        pieceLabels: d.pieceLabels.map((r, i) =>
                                          i === index ? { ...r, nameEn: e.target.value } : r,
                                        ),
                                      },
                                    }))
                                  }
                                />
                                <Input
                                  label={t('setup.pieceNameAr')}
                                  value={row.nameAr}
                                  onChange={(e) =>
                                    setDrafts((prev) => ({
                                      ...prev,
                                      [stage.workflowNodeId]: {
                                        ...d,
                                        pieceLabels: d.pieceLabels.map((r, i) =>
                                          i === index ? { ...r, nameAr: e.target.value } : r,
                                        ),
                                      },
                                    }))
                                  }
                                />
                                <Input
                                  label={t('setup.pieceNameHe')}
                                  value={row.nameHe}
                                  onChange={(e) =>
                                    setDrafts((prev) => ({
                                      ...prev,
                                      [stage.workflowNodeId]: {
                                        ...d,
                                        pieceLabels: d.pieceLabels.map((r, i) =>
                                          i === index ? { ...r, nameHe: e.target.value } : r,
                                        ),
                                      },
                                    }))
                                  }
                                />
                              </div>
                            ))}
                          </div>
                        ) : null}
                        <Select
                          label={t('setup.destinationWarehouse')}
                          value={d.defaultWarehouseId}
                          onChange={(e) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [stage.workflowNodeId]: {
                                ...d,
                                defaultWarehouseId: e.target.value,
                              },
                            }))
                          }
                          options={[
                            { value: '', label: t('setup.warehouseAutomatic') },
                            ...setup.warehouses
                              .filter((w) => w.type === warehouseType)
                              .map((w) => ({
                                value: w.id,
                                label: `${localizedName(locale, w)}${w.isDefault ? ' ★' : ''}`,
                              })),
                          ]}
                        />
                      </div>
                    ) : null}
                    <div>
                      <p className="mb-2 text-sm font-medium">{t('setup.rawMaterialsTitle')}</p>
                      {(setup.bomLines ?? []).length === 0 ? (
                        <p className="text-sm text-text-tertiary">{t('setup.bomEmpty')}</p>
                      ) : (
                        <div className="grid gap-2">
                          {(setup.bomLines ?? [])
                            .map((line) => {
                              const mapped = d.materialInputs.find((row) => row.sku === line.sku);
                              const available = remainingBomQtyForStage(
                                line.sku,
                                stage.workflowNodeId,
                                line.qty,
                                drafts,
                              );
                              return { line, mapped, available };
                            })
                            .filter(({ mapped, available }) => Boolean(mapped) || available > 0)
                            .map(({ line, mapped, available }) => {
                              const currentQty = mapped ? Number(mapped.qtyPerUnit) || 0 : 0;
                              const leftForOthers = Math.max(0, available - currentQty);
                              return (
                                <label
                                  key={line.sku}
                                  className="flex flex-wrap items-center gap-2 text-sm"
                                >
                                  <input
                                    type="checkbox"
                                    checked={Boolean(mapped)}
                                    onChange={(e) => {
                                      const next = e.target.checked
                                        ? [
                                            ...d.materialInputs.filter(
                                              (row) => row.sku !== line.sku,
                                            ),
                                            {
                                              sku: line.sku,
                                              qtyPerUnit: String(
                                                Math.min(line.qty || 1, available || line.qty || 1),
                                              ),
                                            },
                                          ]
                                        : d.materialInputs.filter((row) => row.sku !== line.sku);
                                      setDrafts((prev) => ({
                                        ...prev,
                                        [stage.workflowNodeId]: { ...d, materialInputs: next },
                                      }));
                                    }}
                                  />
                                  <InventoryItemThumb src={line.imageUrl} alt="" size={28} />
                                  <span>{localizedName(locale, line, line.sku)}</span>
                                  {mapped ? (
                                    <>
                                      <Input
                                        className="w-24"
                                        type="number"
                                        min={0.001}
                                        max={available > 0 ? available : undefined}
                                        step="0.001"
                                        value={mapped.qtyPerUnit}
                                        onChange={(e) => {
                                          const raw = e.target.value;
                                          const parsed = Number(raw);
                                          const capped =
                                            Number.isFinite(parsed) && available > 0
                                              ? Math.min(parsed, available)
                                              : raw;
                                          const qty =
                                            typeof capped === 'number' ? String(capped) : capped;
                                          setDrafts((prev) => ({
                                            ...prev,
                                            [stage.workflowNodeId]: {
                                              ...d,
                                              materialInputs: d.materialInputs.map((row) =>
                                                row.sku === line.sku
                                                  ? { ...row, qtyPerUnit: qty }
                                                  : row,
                                              ),
                                            },
                                          }));
                                        }}
                                      />
                                      <span className="text-xs text-text-tertiary" dir="ltr">
                                        {t('setup.materialsRemaining', {
                                          remaining: leftForOthers,
                                          bom: line.qty,
                                        })}
                                      </span>
                                    </>
                                  ) : (
                                    <span className="text-xs text-text-tertiary" dir="ltr">
                                      {t('setup.materialsRemaining', {
                                        remaining: available,
                                        bom: line.qty,
                                      })}
                                    </span>
                                  )}
                                </label>
                              );
                            })}
                          {(setup.bomLines ?? []).every((line) => {
                            const mapped = d.materialInputs.find((row) => row.sku === line.sku);
                            const available = remainingBomQtyForStage(
                              line.sku,
                              stage.workflowNodeId,
                              line.qty,
                              drafts,
                            );
                            return !mapped && available <= 0;
                          }) && (setup.bomLines ?? []).length > 0 ? (
                            <p className="text-sm text-text-tertiary">
                              {t('setup.materialsBoardPoolEmpty')}
                            </p>
                          ) : null}
                        </div>
                      )}
                    </div>
                    {usesSemi(d.behavior) || d.consumesSemiFinished ? (
                      <div>
                        <p className="mb-2 text-sm font-medium">{t('setup.consumeInputs')}</p>
                        <p className="mb-2 text-xs text-text-tertiary">
                          {t('setup.consumeInputsHint')}
                        </p>
                        {upstream.length === 0 ? (
                          <p className="text-sm text-text-tertiary">
                            {earlierSemiExists
                              ? t('setup.takeSemiAllClaimedHint')
                              : t('setup.noUpstream')}
                          </p>
                        ) : (
                          <div className="grid gap-2">
                            {upstream.map((out) => (
                              <label key={out.id} className="flex items-center gap-2 text-sm">
                                <input
                                  type="checkbox"
                                  checked={d.consumeOutputIds.includes(out.id)}
                                  onChange={(e) => {
                                    const exclusiveNext = e.target.checked
                                      ? semiOutputClaimedElsewhere(
                                          out.id,
                                          stage.workflowNodeId,
                                          drafts,
                                        )
                                        ? d.consumeOutputIds
                                        : [
                                            ...d.consumeOutputIds.filter((id) => id !== out.id),
                                            out.id,
                                          ]
                                      : d.consumeOutputIds.filter((id) => id !== out.id);
                                    setDrafts((prev) => ({
                                      ...prev,
                                      [stage.workflowNodeId]: {
                                        ...d,
                                        consumeOutputIds: exclusiveNext,
                                      },
                                    }));
                                  }}
                                />
                                {localizedName(locale, out)}
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <div className="rounded-2xl border border-border p-4">
              <p className="mb-2 text-sm font-semibold">{t('setup.preview')}</p>
              {(previewQuery.data?.steps ?? []).length === 0 ? (
                <p className="text-sm text-text-tertiary">{t('setup.previewEmpty')}</p>
              ) : (
                <ol className="space-y-2 text-sm">
                  {(previewQuery.data?.steps ?? []).map((step, i) => {
                    const consumeLabel = (step.consumeOutputs ?? [])
                      .map((o) => localizedName(locale, o))
                      .filter(Boolean)
                      .join(', ');
                    return (
                      <li key={`${step.stageNameEn}-${i}`}>
                        <span className="font-medium">
                          {formatProductionPreviewStep(locale, step)}
                        </span>
                        {consumeLabel || step.consumes.length
                          ? ` · ${t('setup.usesBadge')}: ${consumeLabel || step.consumes.join(', ')}`
                          : ''}
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
