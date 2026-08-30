import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { localizedName } from '@maher/i18n';
import { isApiError } from '@/api/errors';
import { toastMessageForError } from '@/api/queryClient';
import {
  patchAdminProduct,
  type AdminBomLine,
} from '@/api/modules/catalogAdmin';
import { queryKeys } from '@/api/queryKeys';
import type { ProductionSetupStage } from '@/api/modules/workflow';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { useToast } from '@/components/feedback/Toast';
import { AppScreen } from '@/components/layout/AppScreen';
import { FloatingActionDock } from '@/components/layout/FloatingActionDock';
import { BomFloorRow } from '@/features/catalog/components/BomFloorRow';
import { BomMaterialPickerSheet } from '@/features/catalog/components/BomMaterialPickerSheet';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { haptics } from '@/motion';
import { SURFACE_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import { useTheme } from '@/theme';
import {
  useProductProductionSetupQuery,
  usePutProductProductionSetupMutation,
} from '@/features/workflow/query';
import {
  isPackagingSetupStage,
  produceKindFromBehavior,
  terminalSetupMode,
  setupProduces,
  setupUsesSemi,
} from './productionSetupBehavior';
import { ProductionStageSetupSheet } from './components/ProductionStageSetupSheet';
import { WorkflowPageHeader, WorkflowStatusPill } from './components/WorkflowPageHeader';

type Props = {
  productId: string;
  backFallback?: Href;
};

function stageHasSemiOutput(stage: ProductionSetupStage): boolean {
  if (!(stage.output?.nameEn?.trim() || stage.output?.nameAr?.trim())) return false;
  return (
    stage.behavior === 'PRODUCES_SEMI_FINISHED' ||
    stage.behavior === 'USES_AND_PRODUCES' ||
    Boolean(stage.output?.pieceLabels?.length)
  );
}

/** True if `stage` already takes this producer’s SEMI (by output id or node id). */
function stageConsumesSemi(
  stage: ProductionSetupStage,
  producer: { workflowNodeId?: string | null; id?: string | null },
  allStages: ProductionSetupStage[] = [],
): boolean {
  const outId = producer.id ? String(producer.id) : '';
  const nodeId = producer.workflowNodeId ? String(producer.workflowNodeId) : '';
  const outIds = new Set((stage.consumeOutputIds ?? []).map(String));
  const nodeIds = new Set((stage.consumeWorkflowNodeIds ?? []).map(String));

  if (outId && (outIds.has(outId) || outIds.has(`node:${outId}`))) return true;
  if (nodeId) {
    if (outIds.has(`node:${nodeId}`) || outIds.has(nodeId)) return true;
    if (nodeIds.has(nodeId)) return true;
  }
  if (outId.startsWith('node:') && nodeIds.has(outId.slice('node:'.length))) return true;

  // Cross-resolve uuid ↔ workflow node so draft `node:` refs match saved output ids.
  const resolvedNode =
    nodeId ||
    (outId.startsWith('node:')
      ? outId.slice('node:'.length)
      : allStages.find((s) => s.output?.id === outId)?.workflowNodeId);
  if (resolvedNode) {
    if (nodeIds.has(resolvedNode) || outIds.has(`node:${resolvedNode}`)) return true;
    const realOut = allStages.find((s) => s.workflowNodeId === resolvedNode)?.output?.id;
    if (realOut && outIds.has(realOut)) return true;
  }
  if (outId && !outId.startsWith('node:')) {
    const producerNode = allStages.find((s) => s.output?.id === outId)?.workflowNodeId;
    if (producerNode && nodeIds.has(producerNode)) return true;
  }
  return false;
}

function semiClaimedByOtherStage(
  allStages: ProductionSetupStage[],
  excludeWorkflowNodeId: string,
  producer: { workflowNodeId?: string | null; id?: string | null },
): boolean {
  for (const other of allStages) {
    if (other.workflowNodeId === excludeWorkflowNodeId) continue;
    if (stageConsumesSemi(other, producer, allStages)) return true;
  }
  return false;
}

/**
 * Live Takes-in candidates: DAG predecessors (from server) plus earlier/same-step
 * stages that already make a semi kit in the current drafts — so Painting can take
 * Carpentry’s kit even when they share a parallel step, and unsaved Makes still show.
 *
 * Exclusive chain: once another stage takes a SEMI in, it is gone from everyone else
 * (carpentry → assembly → next), matching furniture handoff.
 */
function enrichUpstreamOutputs(
  stage: ProductionSetupStage,
  allStages: ProductionSetupStage[],
): ProductionSetupStage {
  const predNodeIds = new Set(
    (stage.upstreamOutputs ?? [])
      .map((o) => o.workflowNodeId)
      .filter((id): id is string => Boolean(id)),
  );
  const myStep = stage.flowStep ?? Number.POSITIVE_INFINITY;
  const seen = new Set<string>();
  const upstreamOutputs: NonNullable<ProductionSetupStage['upstreamOutputs']> = [];

  for (const other of allStages) {
    if (other.workflowNodeId === stage.workflowNodeId) continue;
    if (!stageHasSemiOutput(other)) continue;
    const otherStep = other.flowStep ?? Number.POSITIVE_INFINITY;
    const isPred = predNodeIds.has(other.workflowNodeId);
    const isEarlierOrPeer = otherStep <= myStep;
    if (!isPred && !isEarlierOrPeer) continue;
    if (seen.has(other.workflowNodeId)) continue;
    seen.add(other.workflowNodeId);
    upstreamOutputs.push({
      id: other.output?.id || `node:${other.workflowNodeId}`,
      workflowNodeId: other.workflowNodeId,
      nameEn: other.output?.nameEn || other.nameEn,
      nameAr: other.output?.nameAr || other.nameAr,
      nameHe: other.output?.nameHe ?? other.nameHe,
    });
  }

  // Keep any server upstream rows whose producer isn’t in drafts yet.
  for (const row of stage.upstreamOutputs ?? []) {
    const key = row.workflowNodeId || row.id;
    if (seen.has(key)) continue;
    seen.add(key);
    upstreamOutputs.push(row);
  }

  const exclusive = upstreamOutputs.filter((out) => {
    if (stageConsumesSemi(stage, out, allStages)) return true;
    return !semiClaimedByOtherStage(allStages, stage.workflowNodeId, out);
  });

  return { ...stage, upstreamOutputs: exclusive };
}

/** Drop duplicate SEMI takes so each output is claimed by at most one stage (flow order). */
function enforceExclusiveSemiConsumes(
  allStages: ProductionSetupStage[],
): ProductionSetupStage[] {
  const claimedNodes = new Set<string>();
  const claimedOutIds = new Set<string>();
  const outputIdByNode = new Map<string, string>();
  const nodeByOutputId = new Map<string, string>();
  for (const s of allStages) {
    const outId = s.output?.id;
    if (outId) {
      outputIdByNode.set(s.workflowNodeId, outId);
      nodeByOutputId.set(outId, s.workflowNodeId);
    }
  }

  const markClaim = (nodeId: string | null | undefined, outId: string | null | undefined) => {
    if (nodeId) {
      claimedNodes.add(nodeId);
      const mapped = outputIdByNode.get(nodeId);
      if (mapped) claimedOutIds.add(mapped);
    }
    if (outId) {
      claimedOutIds.add(outId);
      const mapped = nodeByOutputId.get(outId);
      if (mapped) claimedNodes.add(mapped);
    }
  };

  const isClaimed = (nodeId: string | null | undefined, outId: string | null | undefined) => {
    if (nodeId && claimedNodes.has(nodeId)) return true;
    if (outId && claimedOutIds.has(outId)) return true;
    if (outId && nodeByOutputId.has(outId) && claimedNodes.has(nodeByOutputId.get(outId)!)) {
      return true;
    }
    return false;
  };

  const ordered = [...allStages].sort(
    (a, b) => (a.flowStep ?? 999) - (b.flowStep ?? 999),
  );
  const kept = new Map<string, ProductionSetupStage>();

  for (const stage of ordered) {
    const nextOut: string[] = [];
    const nextNodes: string[] = [];

    for (const raw of stage.consumeOutputIds ?? []) {
      const id = String(raw);
      if (id.startsWith('node:')) {
        const nodeId = id.slice('node:'.length);
        if (isClaimed(nodeId, outputIdByNode.get(nodeId))) continue;
        markClaim(nodeId, outputIdByNode.get(nodeId));
        if (!nextNodes.includes(nodeId)) nextNodes.push(nodeId);
        continue;
      }
      if (isClaimed(nodeByOutputId.get(id), id)) continue;
      markClaim(nodeByOutputId.get(id), id);
      nextOut.push(id);
    }
    for (const raw of stage.consumeWorkflowNodeIds ?? []) {
      const nodeId = String(raw);
      if (isClaimed(nodeId, outputIdByNode.get(nodeId))) continue;
      markClaim(nodeId, outputIdByNode.get(nodeId));
      if (!nextNodes.includes(nodeId)) nextNodes.push(nodeId);
    }

    kept.set(stage.workflowNodeId, {
      ...stage,
      consumeOutputIds: nextOut,
      consumeWorkflowNodeIds: nextNodes,
    });
  }

  return allStages.map((s) => kept.get(s.workflowNodeId) ?? s);
}

/** Cap each stage's material claims so Σ across stages never exceeds BOM qty. */
function clampStageMaterialsToBom(
  allStages: ProductionSetupStage[],
  bomLines: Array<{ sku: string; qty: number }>,
): ProductionSetupStage[] {
  const remaining = new Map<string, number>();
  for (const line of bomLines) {
    const sku = String(line.sku ?? '').trim();
    if (!sku) continue;
    remaining.set(sku, Math.max(0, Number(line.qty) || 0));
  }
  return allStages.map((stage) => {
    const nextInputs: NonNullable<ProductionSetupStage['materialInputs']> = [];
    for (const row of stage.materialInputs ?? []) {
      const sku = String(row.sku ?? '').trim();
      if (!sku) continue;
      if (!remaining.has(sku)) continue;
      const want = Math.max(0, Number(row.qtyPerUnit) || 0);
      const left = remaining.get(sku) ?? 0;
      const take = Math.min(want, left);
      remaining.set(sku, Math.max(0, left - take));
      if (take > 0) nextInputs.push({ ...row, sku, qtyPerUnit: take });
    }
    return { ...stage, materialInputs: nextInputs };
  });
}

type SetupBomLine = {
  sku: string;
  qty: number;
  exists: boolean;
  imageUrl?: string | null;
  nameEn?: string | null;
  nameAr?: string | null;
  nameHe?: string | null;
  unitCost?: number;
  category?: string | null;
};

function fromAdminBomLine(line: AdminBomLine): SetupBomLine {
  return {
    sku: line.sku,
    qty: line.qty,
    exists: true,
    imageUrl: line.imageUrl ?? null,
    nameEn: line.nameEn,
    nameAr: line.nameAr,
    unitCost: line.unitCost,
    category: line.category ?? null,
  };
}

function statusLabel(status: string, t: (key: string) => string) {
  if (status === 'READY') return t('mobile.production.workflow.setupReady');
  if (status === 'INVALID') return t('mobile.production.workflow.setupInvalid');
  return t('mobile.production.workflow.setupNeedsSetup');
}

function Chip({
  label,
  tone = 'muted',
}: {
  label: string;
  tone?: 'muted' | 'brand' | 'success';
}) {
  const { colors, theme } = useTheme();
  const bg =
    tone === 'brand'
      ? colors.brandSoft
      : tone === 'success'
        ? colors.successSoft
        : colors.surfaceSecondary;
  const fg =
    tone === 'brand'
      ? colors.brand
      : tone === 'success'
        ? colors.success
        : colors.textSecondary;
  return (
    <View
      style={{
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: 5,
        borderRadius: theme.radius.md,
        backgroundColor: bg,
        borderWidth: StyleSheet.hairlineWidth * 2,
        borderColor: tone === 'muted' ? colors.border : colors.borderStrong,
      }}
    >
      <AppText variant="caption" weight="semibold" style={{ color: fg }}>
        {label}
      </AppText>
    </View>
  );
}

function StageSetupRow({
  stage,
  stepLabel,
  parallel,
  isLast,
  packagingPackageCount,
  onPress,
}: {
  stage: ProductionSetupStage;
  stepLabel: string;
  parallel: boolean;
  isLast: boolean;
  packagingPackageCount?: number | null;
  onPress: () => void;
}) {
  const { t, locale, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const mode = terminalSetupMode(stage.stageCode);
  const produce = produceKindFromBehavior(stage.behavior);
  const takesRaw =
    mode === 'inspection' || mode === 'delivery'
      ? false
      : stage.consumesRawMaterials ||
        stage.behavior === 'USES_MATERIALS' ||
        (stage.materialInputs?.length ?? 0) > 0;
  const takesSemi =
    mode === 'delivery'
      ? false
      : setupUsesSemi(stage.behavior) ||
        stage.consumesSemiFinished ||
        (stage.consumeOutputIds?.length ?? 0) > 0 ||
        (stage.consumeWorkflowNodeIds?.length ?? 0) > 0;
  const takesPackages = mode === 'delivery';
  const makes = mode === 'inspection' || mode === 'delivery' ? false : setupProduces(stage.behavior);
  const hasOutputName = Boolean(
    stage.output?.nameEn?.trim() ||
      stage.output?.nameAr?.trim() ||
      stage.output?.nameHe?.trim(),
  );
  const outputName = hasOutputName
    ? localizedName(locale, {
        nameEn: stage.output?.nameEn,
        nameAr: stage.output?.nameAr,
        nameHe: stage.output?.nameHe,
      })
    : '';
  const packCount =
    mode === 'packaging'
      ? Math.max(1, Math.floor(Number(stage.output?.expectedPieceCount) || 1))
      : null;
  const configured =
    takesRaw || takesSemi || takesPackages || makes || mode === 'inspection';

  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        gap: theme.spacing.sm,
        alignItems: 'stretch',
      }}
    >
      <View style={{ width: 28, alignItems: 'center' }}>
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: configured ? colors.brandSoft : colors.surfaceSecondary,
            borderWidth: 1.5,
            borderColor: configured ? colors.brand : colors.borderStrong,
          }}
        >
          <AppText variant="caption" weight="semibold" style={{ color: colors.brand }}>
            {stepLabel}
          </AppText>
        </View>
        {!isLast ? (
          <View
            style={{
              width: 2,
              flex: 1,
              minHeight: 12,
              marginTop: 4,
              backgroundColor: colors.brand,
              opacity: 0.35,
            }}
          />
        ) : null}
      </View>

      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        style={{
          flex: 1,
          borderRadius: theme.radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surfaceSecondary,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            paddingHorizontal: theme.spacing.sm,
            paddingVertical: theme.spacing.sm,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.border,
            backgroundColor: colors.surface,
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: theme.spacing.sm,
          }}
        >
          <View style={{ flex: 1, gap: 2 }}>
            <AppText
              variant="label"
              weight="semibold"
              numberOfLines={2}
              style={{ textAlign: isRTL ? 'right' : 'left' }}
            >
              {localizedName(locale, stage)}
            </AppText>
            {parallel ? (
              <AppText
                variant="caption"
                color="muted"
                style={{ textAlign: isRTL ? 'right' : 'left' }}
              >
                {t('production.setup.parallelWithSiblings')}
              </AppText>
            ) : null}
          </View>
          <Ionicons
            name={isRTL ? 'chevron-back' : 'chevron-forward'}
            size={18}
            color={colors.textMuted}
          />
        </View>

        <View style={{ padding: theme.spacing.sm, gap: theme.spacing.sm }}>
          <View style={{ gap: 6 }}>
            <AppText
              variant="caption"
              color="muted"
              weight="semibold"
              style={{ textAlign: isRTL ? 'right' : 'left' }}
            >
              {t('production.setup.takesInTitle')}
            </AppText>
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                flexWrap: 'wrap',
                gap: 6,
              }}
            >
              {takesPackages ? (
                <Chip
                  label={
                    packagingPackageCount != null && packagingPackageCount > 0
                      ? t('production.setup.chipPackagesIn', {
                          count: packagingPackageCount,
                        })
                      : t('production.setup.chipPackagesInMissing')
                  }
                  tone="brand"
                />
              ) : null}
              {(stage.materialInputs ?? []).length > 0
                ? (stage.materialInputs ?? []).slice(0, 4).map((row) => (
                    <Chip
                      key={row.sku}
                      label={`${row.sku} × ${row.qtyPerUnit}`}
                      tone="brand"
                    />
                  ))
                : null}
              {(stage.materialInputs?.length ?? 0) > 4 ? (
                <Chip
                  label={`+${(stage.materialInputs?.length ?? 0) - 4}`}
                  tone="brand"
                />
              ) : null}
              {takesRaw && !(stage.materialInputs?.length) ? (
                <Chip label={t('production.setup.chipMaterials')} tone="brand" />
              ) : null}
              {takesSemi ? <Chip label={t('production.setup.chipSemiIn')} tone="brand" /> : null}
              {!takesRaw && !takesSemi && !takesPackages ? (
                <Chip label={t('production.setup.chipTakesNothing')} />
              ) : null}
            </View>
          </View>

          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: theme.spacing.xs,
              opacity: 0.7,
            }}
          >
            <View
              style={{
                flex: 1,
                height: StyleSheet.hairlineWidth * 2,
                backgroundColor: colors.borderStrong,
              }}
            />
            <Ionicons
              name={isRTL ? 'arrow-back' : 'arrow-forward'}
              size={14}
              color={colors.textMuted}
            />
            <View
              style={{
                flex: 1,
                height: StyleSheet.hairlineWidth * 2,
                backgroundColor: colors.borderStrong,
              }}
            />
          </View>

          <View style={{ gap: 6 }}>
            <AppText
              variant="caption"
              color="muted"
              weight="semibold"
              style={{ textAlign: isRTL ? 'right' : 'left' }}
            >
              {t('production.setup.makesTitle')}
            </AppText>
            {makes ? (
              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  flexWrap: 'wrap',
                  gap: 6,
                  alignItems: 'center',
                }}
              >
                <Chip
                  label={
                    produce === 'finished'
                      ? packCount != null
                        ? t('production.setup.chipFinishedPackages', { count: packCount })
                        : t('production.setup.chipFinished')
                      : t('production.setup.chipSemiOut')
                  }
                  tone="success"
                />
                {outputName ? (
                  <AppText variant="caption" weight="semibold" style={{ flexShrink: 1 }}>
                    {outputName}
                  </AppText>
                ) : (
                  <AppText variant="caption" color="muted">
                    {t('production.setup.outputNameMissing')}
                  </AppText>
                )}
              </View>
            ) : mode === 'inspection' ? (
              <Chip label={t('production.setup.chipConfirmOnly')} />
            ) : (
              <Chip label={t('production.setup.chipMakesNothing')} />
            )}
          </View>
        </View>
      </Pressable>
    </View>
  );
}

export function ProductionSetupScreen({
  productId,
  backFallback = '/(app)/(admin)/products',
}: Props) {
  const { t, locale, isRTL } = useLocale();
  const { theme, colors, colorScheme } = useTheme();
  const dark = colorScheme === 'dark';
  const { showToast } = useToast();
  const qc = useQueryClient();
  const setupQuery = useProductProductionSetupQuery(productId);
  const saveMutation = usePutProductProductionSetupMutation(productId);
  const [editing, setEditing] = useState<ProductionSetupStage | null>(null);
  const [drafts, setDrafts] = useState<Record<string, ProductionSetupStage>>({});
  const [bomDraft, setBomDraft] = useState<SetupBomLine[] | null>(null);
  const [materialSheet, setMaterialSheet] = useState(false);
  const [bomSaving, setBomSaving] = useState(false);

  const stages = useMemo(() => {
    const merged = (setupQuery.data?.stages ?? []).map(
      (s) => drafts[s.workflowNodeId] ?? s,
    );
    return merged.map((s) => enrichUpstreamOutputs(s, merged));
  }, [drafts, setupQuery.data?.stages]);

  const savedBom = setupQuery.data?.bomLines ?? [];
  const bomLines = bomDraft ?? savedBom;

  function updateBom(updater: (rows: SetupBomLine[]) => SetupBomLine[]) {
    setBomDraft((prev) => updater(prev ?? savedBom));
  }

  /** Extra scroll room for FloatingActionDock. */
  const stickyPad = SURFACE_TAB_BAR_CLEARANCE + theme.spacing.lg + 108;

  async function saveAll() {
    if (bomDraft) {
      setBomSaving(true);
      try {
        await patchAdminProduct(productId, {
          bomDefaults: {
            materials: bomDraft
              .filter((line) => line.sku && line.qty > 0)
              .map((line) => ({
                sku: line.sku,
                qty: line.qty,
                unitCost: line.unitCost,
                category: line.category ?? undefined,
              })),
          },
        });
        await qc.invalidateQueries({ queryKey: queryKeys.catalog.adminDetail(productId) });
        await qc.invalidateQueries({ queryKey: queryKeys.catalog.detail(productId) });
      } catch (err) {
        void haptics.error();
        showToast({
          variant: 'error',
          message: isApiError(err)
            ? toastMessageForError(err)
            : t('mobile.production.workflow.loadError'),
        });
        setBomSaving(false);
        return;
      }
      setBomSaving(false);
    }

    const exclusive = enforceExclusiveSemiConsumes(stages);
    const clamped = clampStageMaterialsToBom(exclusive, bomLines);
    // Keep drafts in sync if anything was trimmed.
    setDrafts((prev) => {
      const next = { ...prev };
      for (const stage of clamped) {
        next[stage.workflowNodeId] = stage;
      }
      return next;
    });

    saveMutation.mutate(
      {
        stages: clamped.map((s) => ({
          workflowNodeId: s.workflowNodeId,
          stageDefinitionId: s.stageDefinitionId,
          behavior: s.behavior,
          consumesRawMaterials: s.consumesRawMaterials,
          consumesSemiFinished: s.consumesSemiFinished,
          outputNameEn: s.output?.nameEn ?? null,
          outputNameAr: s.output?.nameAr ?? null,
          outputNameHe: s.output?.nameHe ?? null,
          outputQtyPerUnit: s.output?.qtyPerUnit ?? 1,
          expectedPieceCount: s.output?.expectedPieceCount ?? 1,
          pieceLabels: s.output?.pieceLabels ?? null,
          defaultWarehouseId: s.output?.defaultWarehouseId ?? null,
          consumeOutputIds: s.consumeOutputIds?.filter((id) => !id.startsWith('node:')) ?? [],
          consumeWorkflowNodeIds: [
            ...(s.consumeWorkflowNodeIds ?? []),
            ...(s.consumeOutputIds ?? [])
              .filter((id) => id.startsWith('node:'))
              .map((id) => id.slice('node:'.length)),
          ],
          materialInputs: (s.materialInputs ?? [])
            .filter((row) => row.sku && row.qtyPerUnit > 0)
            .filter((row) => bomLines.some((line) => line.sku === row.sku))
            .map((row) => ({ sku: row.sku, qtyPerUnit: row.qtyPerUnit })),
        })),
      },
      {
        onSuccess: () => {
          void haptics.confirmMedium();
          setDrafts({});
          setBomDraft(null);
          showToast({
            variant: 'success',
            message: t('mobile.production.workflow.setupSaved'),
          });
        },
        onError: (err) => {
          void haptics.error();
          showToast({
            variant: 'error',
            message: isApiError(err)
              ? toastMessageForError(err)
              : t('mobile.production.workflow.loadError'),
          });
        },
      },
    );
  }

  if (setupQuery.isError && !setupQuery.data) {
    return (
      <AppScreen>
        <WorkflowPageHeader
          fallback={backFallback}
          title={t('mobile.production.workflow.setupTitle')}
        />
        <ErrorState
          title={t('mobile.production.workflow.loadError')}
          onRetry={() => void setupQuery.refetch()}
        />
      </AppScreen>
    );
  }

  const setup = setupQuery.data;

  return (
    <AppScreen edges={{ top: true, bottom: false }} style={{ paddingHorizontal: 0 }}>
      <View style={{ paddingHorizontal: theme.spacing.lg }}>
        <WorkflowPageHeader
          fallback={backFallback}
          title={t('mobile.production.workflow.setupTitle')}
          status={
            setup ? (
              <View style={{ alignItems: 'center' }}>
                <WorkflowStatusPill
                  label={statusLabel(setup.status, t)}
                  active={setup.status === 'READY'}
                />
              </View>
            ) : undefined
          }
        />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingHorizontal: theme.spacing.lg,
          paddingTop: theme.spacing.md,
          gap: theme.spacing.lg,
          paddingBottom: stickyPad,
        }}
        refreshControl={
          <RefreshControl
            refreshing={setupQuery.isRefetching}
            onRefresh={() => void setupQuery.refetch()}
          />
        }
      >
        <View
          style={{
            borderRadius: theme.radius.xl,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surfaceSecondary,
            padding: theme.spacing.md,
          }}
        >
          <AppText
            variant="body"
            color="secondary"
            style={{ textAlign: isRTL ? 'right' : 'left', lineHeight: 22 }}
          >
            {t('production.setup.screenHint')}
          </AppText>
        </View>

        {setupQuery.isPending && !setup ? (
          <ActivityIndicator color={colors.brand} />
        ) : null}

        {(setup?.issues ?? []).length ? (
          <View
            style={{
              borderRadius: theme.radius.xl,
              borderWidth: 1,
              borderColor: colors.warning,
              backgroundColor: colors.surfaceSecondary,
              padding: theme.spacing.md,
              gap: theme.spacing.xs,
              ...orderBoardShadow(colorScheme),
            }}
          >
            <AppText variant="label" weight="semibold">
              {t('production.setup.issues')}
            </AppText>
            {(setup?.issues ?? []).map((issue, index) => (
              <AppText
                key={`${issue.code}-${index}`}
                variant="caption"
                color="secondary"
              >
                {t(`errors.${issue.code}`) === `errors.${issue.code}`
                  ? issue.message
                  : t(`errors.${issue.code}`)}
              </AppText>
            ))}
          </View>
        ) : null}

        {/* Materials board */}
        <View
          style={{
            borderRadius: theme.radius.xl,
            borderWidth: 1,
            borderColor: colors.borderStrong,
            backgroundColor: colors.surface,
            overflow: 'hidden',
            ...orderBoardShadow(colorScheme),
          }}
        >
          <View
            style={{
              paddingHorizontal: theme.spacing.md,
              paddingVertical: theme.spacing.sm + 2,
              backgroundColor: colors.surfaceSecondary,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: theme.spacing.sm,
            }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.brandSoft,
              }}
            >
              <Ionicons name="cube-outline" size={18} color={colors.brand} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <AppText
                variant="heading"
                weight="semibold"
                style={{ textAlign: isRTL ? 'right' : 'left' }}
              >
                {t('production.setup.bomTitle')}
              </AppText>
              <AppText
                variant="caption"
                color="muted"
                style={{ textAlign: isRTL ? 'right' : 'left' }}
              >
                {t('production.setup.bomSharedHint')}
              </AppText>
            </View>
          </View>
          <View style={{ padding: theme.spacing.md, gap: theme.spacing.md }}>
            {bomLines.length === 0 ? (
              <View
                style={{
                  borderRadius: theme.radius.xl,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.surfaceSecondary,
                  paddingVertical: theme.spacing.xl,
                  paddingHorizontal: theme.spacing.lg,
                  alignItems: 'center',
                  gap: theme.spacing.sm,
                }}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Ionicons name="cube-outline" size={20} color={colors.textMuted} />
                </View>
                <AppText variant="caption" color="muted" style={{ textAlign: 'center' }}>
                  {t('production.setup.bomEmpty')}
                </AppText>
              </View>
            ) : (
              bomLines.map((line, idx) => {
                const name = localizedName(
                  locale,
                  { nameEn: line.nameEn, nameAr: line.nameAr, nameHe: line.nameHe },
                  line.sku,
                );
                return (
                  <BomFloorRow
                    key={`${line.sku}-${idx}`}
                    index={idx}
                    name={name}
                    sku={line.sku}
                    imageUrl={line.imageUrl}
                    unitCostLabel=""
                    lineTotalLabel=""
                    showCosts={false}
                    qty={String(line.qty)}
                    onQtyChange={(v) => {
                      const q = Math.max(0, Number(v) || 0);
                      updateBom((rows) =>
                        rows.map((row, i) => (i === idx ? { ...row, qty: q } : row)),
                      );
                    }}
                    onRemove={() => {
                      updateBom((rows) => rows.filter((_, i) => i !== idx));
                    }}
                  />
                );
              })
            )}
            <Pressable
              onPress={() => {
                void haptics.selection();
                setMaterialSheet(true);
              }}
              accessibilityRole="button"
              style={{
                minHeight: 48,
                justifyContent: 'center',
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                gap: theme.spacing.sm,
                borderRadius: theme.radius.lg,
                borderWidth: 1,
                borderColor: colors.brand,
                backgroundColor: colors.brandSoft,
                paddingHorizontal: theme.spacing.md,
              }}
            >
              <Ionicons name="add" size={18} color={colors.brand} />
              <AppText variant="body" weight="semibold" color="brand">
                {t('production.setup.editBom')}
              </AppText>
            </Pressable>
          </View>
        </View>

        {setup && stages.length === 0 ? (
          <EmptyState title={t('production.setup.previewEmpty')} />
        ) : null}

        {/* Stages — one board */}
        {stages.length ? (
          <View
            style={{
              borderRadius: theme.radius.xl,
              borderWidth: 1,
              borderColor: colors.borderStrong,
              backgroundColor: colors.surface,
              overflow: 'hidden',
              ...orderBoardShadow(colorScheme),
            }}
          >
            <View
              style={{
                paddingHorizontal: theme.spacing.md,
                paddingVertical: theme.spacing.sm + 2,
                backgroundColor: colors.surfaceSecondary,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
                gap: 2,
              }}
            >
              <AppText
                variant="heading"
                weight="semibold"
                style={{ textAlign: isRTL ? 'right' : 'left' }}
              >
                {t('production.setup.stagesTitle')}
              </AppText>
              <AppText
                variant="caption"
                color="muted"
                style={{ textAlign: isRTL ? 'right' : 'left' }}
              >
                {t('production.setup.stagesHint')}
              </AppText>
            </View>
            <View style={{ padding: theme.spacing.md, gap: theme.spacing.md }}>
              {stages.map((stage, index) => {
                const step = stage.flowStep ?? index + 1;
                const siblings = stages.filter((s) => (s.flowStep ?? -1) === step);
                const parallel = siblings.length > 1;
                const parallelIndex = siblings.findIndex(
                  (s) => s.workflowNodeId === stage.workflowNodeId,
                );
                const stepLabel =
                  parallel && siblings.length <= 26
                    ? `${step}${String.fromCharCode(97 + Math.max(0, parallelIndex))}`
                    : String(step);
                const packagingStage = stages.find((s) => isPackagingSetupStage(s.stageCode));
                const packagingPackageCount = packagingStage?.output?.expectedPieceCount ?? null;
                return (
                  <StageSetupRow
                    key={stage.workflowNodeId}
                    stage={stage}
                    stepLabel={stepLabel}
                    parallel={parallel}
                    isLast={index === stages.length - 1}
                    packagingPackageCount={packagingPackageCount}
                    onPress={() => {
                      void haptics.selection();
                      const live = stages.find(
                        (s) => s.workflowNodeId === stage.workflowNodeId,
                      );
                      setEditing(live ?? stage);
                    }}
                  />
                );
              })}
            </View>
          </View>
        ) : null}
      </ScrollView>

      {/* Floating save — above tab bar */}
      <FloatingActionDock floating>
        <View
          style={{
            borderRadius: 26,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: dark
              ? 'rgba(42,36,37,0.96)'
              : 'rgba(255,255,255,0.96)',
            padding: 6,
            gap: 6,
            ...orderBoardShadow(colorScheme),
          }}
        >
          <PrimaryButton
            label={t('mobile.production.workflow.setupSave')}
            loading={saveMutation.isPending || bomSaving}
            disabled={!setup?.workflow || saveMutation.isPending || bomSaving}
            onPress={saveAll}
          />
          {!setup?.workflow ? (
            <AppText variant="caption" color="muted" style={{ textAlign: 'center', paddingHorizontal: 8 }}>
              {t('mobile.production.workflow.setupSaveDisabledNoWorkflow')}
            </AppText>
          ) : null}
        </View>
      </FloatingActionDock>

      <ProductionStageSetupSheet
        open={Boolean(editing)}
        stage={editing}
        product={setup?.product ?? null}
        outputs={setup?.outputs ?? []}
        warehouses={setup?.warehouses ?? []}
        bomLines={bomLines}
        packagingPackageCount={
          stages.find((s) => isPackagingSetupStage(s.stageCode))?.output?.expectedPieceCount ?? null
        }
        packagingPackageLabels={
          stages.find((s) => isPackagingSetupStage(s.stageCode))?.output?.pieceLabels ?? []
        }
        siblingMaterialClaims={
          editing
            ? stages
                .filter((s) => s.workflowNodeId !== editing.workflowNodeId)
                .flatMap((s) => s.materialInputs ?? [])
            : []
        }
        earlierSemiProducersExist={
          editing
            ? (setupQuery.data?.stages ?? []).some((s) => {
                if (s.workflowNodeId === editing.workflowNodeId) return false;
                const live = stages.find((x) => x.workflowNodeId === s.workflowNodeId) ?? s;
                if (!stageHasSemiOutput(live)) return false;
                const myStep = editing.flowStep ?? Number.POSITIVE_INFINITY;
                const otherStep = live.flowStep ?? Number.POSITIVE_INFINITY;
                return otherStep <= myStep;
              })
            : false
        }
        onClose={() => setEditing(null)}
        onSave={(next: ProductionSetupStage) => {
          // Drop any SEMI this stage selected that another stage already owns.
          const peers = stages.filter((s) => s.workflowNodeId !== next.workflowNodeId);
          const safeOut = (next.consumeOutputIds ?? []).filter((id) => {
            const producer =
              id.startsWith('node:')
                ? { workflowNodeId: id.slice('node:'.length), id }
                : {
                    id,
                    workflowNodeId:
                      stages.find((s) => s.output?.id === id)?.workflowNodeId ?? null,
                  };
            return !semiClaimedByOtherStage(peers, next.workflowNodeId, producer);
          });
          const safeNodes = (next.consumeWorkflowNodeIds ?? []).filter(
            (nodeId) =>
              !semiClaimedByOtherStage(peers, next.workflowNodeId, {
                workflowNodeId: nodeId,
                id: stages.find((s) => s.workflowNodeId === nodeId)?.output?.id ?? null,
              }),
          );
          setDrafts((prev) => ({
            ...prev,
            [next.workflowNodeId]: {
              ...next,
              consumeOutputIds: safeOut,
              consumeWorkflowNodeIds: safeNodes,
            },
          }));
          setEditing(null);
        }}
      />

      <BomMaterialPickerSheet
        open={materialSheet}
        onClose={() => setMaterialSheet(false)}
        existingSkus={bomLines.map((line) => line.sku)}
        onPick={(line) => updateBom((rows) => [...rows, fromAdminBomLine(line)])}
      />
    </AppScreen>
  );
}
