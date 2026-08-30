'use client';

import {
  OrderSetupMaterialsEditor,
  type OrderSetupMaterialRow,
} from '@/components/sales-orders/order-setup-materials-editor';
import {
  type OrderSetupLine,
  type PatchOrderSetupLineBody,
  patchOrderSetupLine,
  putOrderSetupMaterials,
  seedOrderSetupLineFromCatalog,
} from '@/lib/api-client';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import { manufacturingComplexityDisplayKey } from '@maher/types';
import { localizedName } from '@maher/i18n';
import {
  Alert,
  Button,
  Card,
  Input,
  Select,
  StatusBadge,
} from '@maher/ui';
import { useMutation } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useId, useState } from 'react';

type WorkflowOption = {
  id: string;
  code: string;
  nameEn: string;
  nameAr?: string | null;
  nameHe?: string | null;
  status: string;
  activeVersionId?: string | null;
};

type PieceLabelDraft = { nameEn: string; nameAr: string; nameHe: string };

function resizeLabels(labels: PieceLabelDraft[], count: number): PieceLabelDraft[] {
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

function dimValue(v: number | null | undefined) {
  return v == null || Number.isNaN(Number(v)) ? '' : String(v);
}

function materialsFromLine(line: OrderSetupLine, idBase: string): OrderSetupMaterialRow[] {
  return (line.materials ?? []).map((m, i) => ({
    key: m.id ?? `${idBase}-m-${i}-${m.sku ?? i}`,
    inventoryItemId: m.inventoryItemId ?? m.inventoryItem?.id ?? '',
    sku: m.sku ?? m.inventoryItem?.sku ?? '',
    nameEn: m.displayName ?? m.inventoryItem?.nameEn ?? m.sku ?? '',
    nameAr: m.inventoryItem?.nameAr ?? m.displayName ?? '',
    nameHe: m.inventoryItem?.nameHe ?? undefined,
    category: m.category ?? m.inventoryItem?.category ?? undefined,
    unit: m.unit || m.inventoryItem?.unit || 'pcs',
    expectedQty: String(m.expectedQty ?? 1),
    source: m.source,
    needsReview: Boolean(m.needsReview),
    imageUrl: m.inventoryItem?.imageUrl ?? null,
    availabilityStatus: m.availability?.status ?? null,
    shortQty: m.availability?.short ?? null,
  }));
}

type Props = {
  salesOrderId: string;
  line: OrderSetupLine;
  workflows: WorkflowOption[];
  readOnly: boolean;
  expanded: boolean;
  onToggle: () => void;
  onUpdated: () => void;
};

export function OrderLineSetupPanel({
  salesOrderId,
  line,
  workflows,
  readOnly,
  expanded,
  onToggle,
  onUpdated,
}: Props) {
  const locale = useLocale();
  const t = useTranslations('sales');
  const tCommon = useTranslations('common');
  const tCatalog = useTranslations('catalog');
  const tp = useTranslations('production');
  const idBase = useId();
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  const [name, setName] = useState(line.manufacturingName ?? '');
  const [notes, setNotes] = useState(line.factoryNotes ?? '');
  const [width, setWidth] = useState(dimValue(line.orderDimensions?.width));
  const [height, setHeight] = useState(dimValue(line.orderDimensions?.height));
  const [depth, setDepth] = useState(dimValue(line.orderDimensions?.depth));
  const [seatHeight, setSeatHeight] = useState(dimValue(line.orderDimensions?.seatHeight));
  const [workflowId, setWorkflowId] = useState(line.workflowId ?? '');
  const [confirmWorkflow, setConfirmWorkflow] = useState(Boolean(line.workflowConfirmedAt));
  const [pieceCount, setPieceCount] = useState(
    String(line.packagingExpectation?.expectedPieceCount ?? line.packagingExpectation?.pieceLabels?.length ?? 1),
  );
  const [pieceLabels, setPieceLabels] = useState<PieceLabelDraft[]>(() =>
    resizeLabels(
      (line.packagingExpectation?.pieceLabels ?? []).map((p) => ({
        nameEn: p.nameEn ?? p.label ?? '',
        nameAr: p.nameAr ?? '',
        nameHe: p.nameHe ?? '',
      })),
      Number(line.packagingExpectation?.expectedPieceCount ?? line.packagingExpectation?.pieceLabels?.length ?? 1) || 1,
    ),
  );
  const [materials, setMaterials] = useState<OrderSetupMaterialRow[]>(() =>
    materialsFromLine(line, idBase),
  );

  useEffect(() => {
    setName(line.manufacturingName ?? '');
    setNotes(line.factoryNotes ?? '');
    setWidth(dimValue(line.orderDimensions?.width));
    setHeight(dimValue(line.orderDimensions?.height));
    setDepth(dimValue(line.orderDimensions?.depth));
    setSeatHeight(dimValue(line.orderDimensions?.seatHeight));
    setWorkflowId(line.workflowId ?? '');
    setConfirmWorkflow(Boolean(line.workflowConfirmedAt));
    const count =
      Number(line.packagingExpectation?.expectedPieceCount ?? line.packagingExpectation?.pieceLabels?.length ?? 1) ||
      1;
    setPieceCount(String(count));
    setPieceLabels(
      resizeLabels(
        (line.packagingExpectation?.pieceLabels ?? []).map((p) => ({
          nameEn: p.nameEn ?? p.label ?? '',
          nameAr: p.nameAr ?? '',
          nameHe: p.nameHe ?? '',
        })),
        count,
      ),
    );
    setMaterials(materialsFromLine(line, idBase));
    setError(null);
  }, [line, idBase]);

  const productLabel = line.product
    ? localizedName(locale, line.product, line.product.nameEn ?? line.description ?? '')
    : line.description ?? line.manufacturingName ?? '—';

  const complexityKey = manufacturingComplexityDisplayKey(line.manufacturingComplexity);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const patch: PatchOrderSetupLineBody = {
        manufacturingName: name.trim(),
        factoryNotes: notes.trim() || null,
        orderDimensions: {
          width: width === '' ? null : Number(width),
          height: height === '' ? null : Number(height),
          depth: depth === '' ? null : Number(depth),
          seatHeight: seatHeight === '' ? null : Number(seatHeight),
        },
        packagingExpectation: {
          expectedPieceCount: Number(pieceCount) || 1,
          pieceLabels: pieceLabels.map((p, i) => ({
            nameEn: p.nameEn.trim() || `Piece ${i + 1}`,
            nameAr: p.nameAr.trim() || undefined,
            nameHe: p.nameHe.trim() || undefined,
          })),
        },
        workflowId: workflowId || null,
        confirmWorkflow: Boolean(workflowId && confirmWorkflow),
        materialsReviewed: materials.every((m) => m.inventoryItemId) && materials.length > 0,
      };
      await patchOrderSetupLine(salesOrderId, line.id, patch);
      await putOrderSetupMaterials(salesOrderId, line.id, {
        materials: materials
          .filter((m) => m.inventoryItemId)
          .map((m) => ({
            inventoryItemId: m.inventoryItemId,
            sku: m.sku,
            displayName: m.nameEn || m.sku,
            category: m.category,
            unit: m.unit || 'pcs',
            expectedQty: Number(m.expectedQty) || 0,
            source:
              m.source === 'CATALOG' || m.source === 'FACTORY_MODIFIED' || m.source === 'CUSTOM'
                ? m.source
                : 'CUSTOM',
            needsReview: Boolean(m.needsReview),
          })),
      });
    },
    onSuccess: () => {
      setError(null);
      setBanner(t('orderSetup.lineSaved'));
      onUpdated();
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  const seedMutation = useMutation({
    mutationFn: () => seedOrderSetupLineFromCatalog(salesOrderId, line.id),
    onSuccess: () => {
      setError(null);
      setBanner(t('orderSetup.seededFromCatalog'));
      onUpdated();
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  const section = line.sectionProgress;
  const catalog = line.catalogDimensions;

  return (
    <Card className="overflow-hidden p-0">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full flex-wrap items-start justify-between gap-3 p-4 text-start hover:bg-[var(--maher-surface-muted)]/40"
      >
        <div className="min-w-0 space-y-1">
          <p className="font-semibold text-text-primary">
            {line.manufacturingName || productLabel}
          </p>
          <p className="text-sm text-text-secondary">
            {productLabel}
            <span className="mx-1.5 text-text-tertiary">·</span>
            <span dir="ltr">× {line.quantity}</span>
          </p>
          <div className="flex flex-wrap gap-1.5 pt-1">
            <StatusBadge status={line.status} />
            {line.materialStatus ? <StatusBadge status={line.materialStatus} /> : null}
            <span className="rounded-full bg-[var(--maher-surface-muted)] px-2 py-0.5 text-[11px] text-text-secondary">
              {t(`orderSetup.complexity.${complexityKey}`)}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 text-[11px] text-text-tertiary">
          {(
            [
              ['spec', section?.spec],
              ['materials', section?.materials],
              ['workflow', section?.workflow],
              ['packaging', section?.packaging],
            ] as const
          ).map(([key, done]) => (
            <span
              key={key}
              className={
                done
                  ? 'rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-emerald-700'
                  : 'rounded-md bg-amber-500/10 px-1.5 py-0.5 text-amber-800'
              }
            >
              {t(`orderSetup.section.${key}`)}
            </span>
          ))}
        </div>
      </button>

      {expanded ? (
        <div className="space-y-5 border-t border-border p-4">
          {banner ? <Alert variant="success">{banner}</Alert> : null}
          {error ? <Alert variant="error">{error}</Alert> : null}
          {(line.issues?.length ?? 0) > 0 ? (
            <Alert variant="warning">
              <ul className="list-disc space-y-1 ps-4 text-sm">
                {line.issues!.map((issue) => (
                  <li key={`${issue.code}-${issue.message}`}>{issue.message}</li>
                ))}
              </ul>
            </Alert>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label={t('orderSetup.manufacturingName')}
              value={name}
              disabled={readOnly}
              onChange={(e) => setName(e.target.value)}
            />
            <div>
              <p className="mb-1 text-xs text-text-secondary">{t('orderSetup.complexityLabel')}</p>
              <p className="text-sm font-medium">{t(`orderSetup.complexity.${complexityKey}`)}</p>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold">{t('orderSetup.dimensions')}</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-xl border border-border p-3 text-sm">
                <p className="mb-2 text-xs font-medium text-text-tertiary">
                  {t('orderSetup.catalogDimensions')}
                </p>
                <p dir="ltr" className="tabular-nums text-text-secondary">
                  {[catalog?.width, catalog?.height, catalog?.depth]
                    .map((v) => (v != null ? String(v) : '—'))
                    .join(' × ')}
                  {catalog?.seatHeight != null ? ` · SH ${catalog.seatHeight}` : ''}
                </p>
              </div>
              <div className="rounded-xl border border-border p-3">
                <p className="mb-2 text-xs font-medium text-text-tertiary">
                  {t('orderSetup.orderDimensions')}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    label={tCatalog('width')}
                    type="number"
                    value={width}
                    disabled={readOnly}
                    onChange={(e) => setWidth(e.target.value)}
                    dir="ltr"
                  />
                  <Input
                    label={tCatalog('height')}
                    type="number"
                    value={height}
                    disabled={readOnly}
                    onChange={(e) => setHeight(e.target.value)}
                    dir="ltr"
                  />
                  <Input
                    label={tCatalog('depth')}
                    type="number"
                    value={depth}
                    disabled={readOnly}
                    onChange={(e) => setDepth(e.target.value)}
                    dir="ltr"
                  />
                  <Input
                    label={tCatalog('seatHeight')}
                    type="number"
                    value={seatHeight}
                    disabled={readOnly}
                    onChange={(e) => setSeatHeight(e.target.value)}
                    dir="ltr"
                  />
                </div>
              </div>
            </div>
            {(line.changes?.length ?? 0) > 0 ? (
              <ul className="space-y-1 text-xs text-text-secondary">
                {line.changes!.map((c) => (
                  <li key={c.field} dir="ltr">
                    {c.field}: {String(c.from ?? '—')} → {String(c.to ?? '—')}
                  </li>
                ))}
              </ul>
            ) : null}
            {line.requestedFabricLabel ? (
              <p className="text-sm text-text-secondary">
                {t('fabric')}: {line.requestedFabricLabel}
              </p>
            ) : null}
          </div>

          <OrderSetupMaterialsEditor
            rows={materials}
            onChange={setMaterials}
            readOnly={readOnly}
          />

          <div className="space-y-3">
            <h3 className="text-sm font-semibold">{t('orderSetup.workflow')}</h3>
            <Select
              label={tp('workflow.title')}
              value={workflowId}
              disabled={readOnly}
              onChange={(e) => {
                setWorkflowId(e.target.value);
                setConfirmWorkflow(false);
              }}
              options={[
                { value: '', label: tCatalog('select') },
                ...workflows
                  .filter((w) => w.status !== 'ARCHIVED')
                  .map((w) => ({
                    value: w.id,
                    label: `${localizedName(locale, w, w.code)} (${w.code})`,
                  })),
              ]}
            />
            {workflowId ? (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={confirmWorkflow}
                  disabled={readOnly}
                  onChange={(e) => setConfirmWorkflow(e.target.checked)}
                />
                {t('orderSetup.confirmWorkflow')}
              </label>
            ) : null}
            {line.workflow?.stagePath?.length ? (
              <p className="text-xs text-text-tertiary">
                {line.workflow.stagePath
                  .map((s) => localizedName(locale, s, s.nameEn))
                  .join(' → ')}
              </p>
            ) : null}
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold">{t('orderSetup.packaging')}</h3>
            <Input
              label={tp('setup.expectedPieces')}
              type="number"
              min={1}
              step={1}
              value={pieceCount}
              disabled={readOnly}
              onChange={(e) => {
                const next = e.target.value;
                setPieceCount(next);
                setPieceLabels(resizeLabels(pieceLabels, Number(next) || 1));
              }}
              dir="ltr"
            />
            <div className="space-y-2 rounded-xl border border-border p-3">
              <p className="text-xs text-text-secondary">{tp('setup.packPieceNamesHint')}</p>
              {pieceLabels.map((row, index) => (
                <div key={`pack-${index}`} className="grid gap-2 sm:grid-cols-3">
                  <Input
                    label={tp('setup.packPieceN', { n: String(index + 1) })}
                    value={row.nameEn}
                    disabled={readOnly}
                    onChange={(e) =>
                      setPieceLabels((prev) =>
                        prev.map((r, i) => (i === index ? { ...r, nameEn: e.target.value } : r)),
                      )
                    }
                  />
                  <Input
                    label={tp('setup.pieceNameAr')}
                    value={row.nameAr}
                    disabled={readOnly}
                    onChange={(e) =>
                      setPieceLabels((prev) =>
                        prev.map((r, i) => (i === index ? { ...r, nameAr: e.target.value } : r)),
                      )
                    }
                  />
                  <Input
                    label={tp('setup.pieceNameHe')}
                    value={row.nameHe}
                    disabled={readOnly}
                    onChange={(e) =>
                      setPieceLabels((prev) =>
                        prev.map((r, i) => (i === index ? { ...r, nameHe: e.target.value } : r)),
                      )
                    }
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <Input
              label={t('orderSetup.factoryNotes')}
              value={notes}
              disabled={readOnly}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {!readOnly ? (
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => saveMutation.mutate()}
                loading={saveMutation.isPending}
              >
                {tCommon('save')}
              </Button>
              <Button
                variant="secondary"
                onClick={() => seedMutation.mutate()}
                loading={seedMutation.isPending}
              >
                {t('orderSetup.seedFromCatalog')}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
