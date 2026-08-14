'use client';

import { apiFetch, ApiClientError } from '@/lib/api-client';
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
  nameEn: string;
  nameAr: string;
  nameHe?: string | null;
  requiresInspection: boolean;
  sortOrder: number;
  behavior: Behavior;
  consumesRawMaterials: boolean;
  consumesSemiFinished: boolean;
  consumeOutputIds: string[];
  output: {
    id: string | null;
    nameEn: string | null;
    nameAr: string | null;
    nameHe?: string | null;
    qtyPerUnit: number | null;
    unit: string | null;
    defaultWarehouseId: string | null;
  } | null;
};

type SetupResponse = {
  status: 'READY' | 'NEEDS_SETUP' | 'INVALID';
  issues: Array<{ code: string; message: string; workflowNodeId?: string | null }>;
  workflow: { id: string; nameEn: string; nameAr: string; published: boolean } | null;
  bomLines: Array<{ sku: string; qty: number; exists: boolean }>;
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
  defaultWarehouseId: string;
  consumeOutputIds: string[];
};

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
        defaultWarehouseId: stage.output?.defaultWarehouseId ?? '',
        consumeOutputIds: stage.consumeOutputIds ?? [],
      };
    }
    setDrafts(next);
  }, [setupQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const stages = (setupQuery.data?.stages ?? []).map((stage) => {
        const d = drafts[stage.workflowNodeId];
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
          defaultWarehouseId: d?.defaultWarehouseId || null,
          consumeOutputIds: d?.consumeOutputIds ?? [],
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
                <li key={line.sku} dir="ltr">
                  {t('setup.bomLine', { sku: line.sku, qty: line.qty })}
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
                  defaultWarehouseId: '',
                  consumeOutputIds: [],
                };
                const upstream = savedOutputs.filter(
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
                      options={behaviorOptions}
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
                    {usesSemi(d.behavior) || d.consumesSemiFinished ? (
                      <div>
                        <p className="mb-2 text-sm font-medium">{t('setup.consumeInputs')}</p>
                        {upstream.length === 0 ? (
                          <p className="text-sm text-text-tertiary">{t('setup.noUpstream')}</p>
                        ) : (
                          <div className="grid gap-2">
                            {upstream.map((out) => (
                              <label key={out.id} className="flex items-center gap-2 text-sm">
                                <input
                                  type="checkbox"
                                  checked={d.consumeOutputIds.includes(out.id)}
                                  onChange={(e) => {
                                    const next = e.target.checked
                                      ? [...d.consumeOutputIds, out.id]
                                      : d.consumeOutputIds.filter((id) => id !== out.id);
                                    setDrafts((prev) => ({
                                      ...prev,
                                      [stage.workflowNodeId]: { ...d, consumeOutputIds: next },
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
