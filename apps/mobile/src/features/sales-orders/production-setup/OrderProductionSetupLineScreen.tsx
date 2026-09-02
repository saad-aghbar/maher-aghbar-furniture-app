import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Linking,
  type LayoutChangeEvent,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { localizedName } from '@maher/i18n';
import { can } from '@maher/permissions';
import type { WorkflowListItem } from '@/api/modules/workflow';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { BackButton } from '@/components/BackButton';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { useToast } from '@/components/feedback/Toast';
import { AppTextInput } from '@/components/forms/AppTextInput';
import { InfoRow } from '@/components/forms/InfoRow';
import { AppScreen } from '@/components/layout/AppScreen';
import { FloatingActionDock } from '@/components/layout/FloatingActionDock';
import { BomFloorRow } from '@/features/catalog/components/BomFloorRow';
import { BomMaterialPickerSheet } from '@/features/catalog/components/BomMaterialPickerSheet';
import { resolveDocumentUrl } from '@/api/modules/uploads';
import { OrderCardMedia } from '../components/OrderCardMedia';
import { haptics, ListItemEnter } from '@/motion';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import type {
  OrderProductionSetupLine,
  SetupMaterialRequirement,
  SetupValidationIssue,
} from '../api';
import {
  OrderBoardCard,
  OrderSectionHeader,
} from '../components/OrderBoardCard';
import { stickyCtaBottomInset } from '../components/journey/stickyCtaInset';
import { SetupEstimatedCostSummary } from './components/SetupEstimatedCostSummary';
import { SetupFabricSection } from './components/SetupFabricSection';
import { WorkflowPickerSheet } from './components/WorkflowPickerSheet';
import {
  categoryGroupKey,
  complexityBadgeKey,
  dealerDisplayName,
  formatDim,
  lineDisplayName,
} from './labels';
import {
  useOrderProductionSetupActions,
  useOrderProductionSetupQuery,
} from './query';

type SectionKey = 'spec' | 'materials' | 'path' | 'packaging' | 'refs' | 'notes';

type DraftMaterial = {
  key: string;
  inventoryItemId: string | null;
  sku: string | null;
  displayName: string | null;
  category: string | null;
  unit: string;
  expectedQty: number;
  source: 'CATALOG' | 'FACTORY_MODIFIED' | 'CUSTOM';
  needsReview: boolean;
  notes: string | null;
  requestedFabricLabel: string | null;
  imageUrl: string | null;
};

type Props = {
  salesOrderId: string;
  lineId: string;
  /**
   * Sheet / in-plan editor: close without popping a route.
   * When set, back uses this instead of router.back().
   */
  onClose?: () => void;
  /** Hide full-screen chrome when hosted inside Production Plan sheet. */
  embedded?: boolean;
};

function toDraft(m: SetupMaterialRequirement): DraftMaterial {
  const source = String(m.source ?? 'FACTORY_MODIFIED').toUpperCase();
  return {
    key: m.id,
    inventoryItemId: m.inventoryItemId,
    sku: m.sku,
    displayName: m.displayName,
    category: m.category,
    unit: m.unit || 'pcs',
    expectedQty: m.expectedQty,
    source:
      source === 'CATALOG' || source === 'CUSTOM' || source === 'FACTORY_MODIFIED'
        ? source
        : 'FACTORY_MODIFIED',
    needsReview: m.needsReview,
    notes: m.notes ?? null,
    requestedFabricLabel: m.requestedFabricLabel ?? null,
    imageUrl: m.inventoryItem?.imageUrl ?? null,
  };
}

function materialsEqual(a: DraftMaterial[], b: DraftMaterial[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((row, i) => {
    const other = b[i]!;
    return (
      row.inventoryItemId === other.inventoryItemId &&
      row.sku === other.sku &&
      row.expectedQty === other.expectedQty &&
      row.needsReview === other.needsReview &&
      row.notes === other.notes
    );
  });
}

export function OrderProductionSetupLineScreen({
  salesOrderId,
  lineId,
  onClose,
  embedded = false,
}: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const scrollRef = useRef<ScrollView>(null);
  const sectionY = useRef<Partial<Record<SectionKey, number>>>({});
  const goBack = onClose ?? (() => router.back());

  const canView = can(user, 'production.setup.view');
  const canEdit = can(user, 'production.setup.edit');

  const query = useOrderProductionSetupQuery(salesOrderId, canView);
  const actions = useOrderProductionSetupActions(salesOrderId);

  const line = useMemo(
    () =>
      query.data?.lines.find((l) => l.id === lineId || l.salesOrderLineId === lineId) ??
      null,
    [query.data, lineId],
  );
  const factoryLocked = Boolean(query.data?.factoryReleased);
  const planEditable = query.data?.planEditable !== false && !factoryLocked;
  const editable = canEdit && planEditable;

  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [depth, setDepth] = useState('');
  const [seatHeight, setSeatHeight] = useState('');
  const [pieceCount, setPieceCount] = useState('1');
  const [pieceLabelsText, setPieceLabelsText] = useState('');
  const [materials, setMaterials] = useState<DraftMaterial[]>([]);
  const [baselineMaterials, setBaselineMaterials] = useState<DraftMaterial[]>([]);
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const [workflowConfirmed, setWorkflowConfirmed] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [fabricPickerOpen, setFabricPickerOpen] = useState(false);
  const [workflowOpen, setWorkflowOpen] = useState(false);
  const [hydratedId, setHydratedId] = useState<string | null>(null);

  const hydrate = useCallback((next: OrderProductionSetupLine) => {
    setName(next.manufacturingName ?? '');
    setNotes(next.factoryNotes ?? '');
    setWidth(formatDim(next.orderDimensions?.width).replace('—', ''));
    setHeight(formatDim(next.orderDimensions?.height).replace('—', ''));
    setDepth(formatDim(next.orderDimensions?.depth).replace('—', ''));
    setSeatHeight(formatDim(next.orderDimensions?.seatHeight).replace('—', ''));
    const pkg = next.packagingExpectation;
    setPieceCount(String(pkg?.expectedPieceCount ?? pkg?.pieceLabels?.length ?? 1));
    setPieceLabelsText(
      (pkg?.pieceLabels ?? [])
        .map((p) => p.nameEn || p.label || '')
        .filter(Boolean)
        .join('\n'),
    );
    const draft = next.materials.map(toDraft);
    setMaterials(draft);
    setBaselineMaterials(draft);
    setWorkflowId(next.workflowId);
    setWorkflowConfirmed(Boolean(next.workflowConfirmedAt));
    setHydratedId(next.id);
  }, []);

  useEffect(() => {
    if (!line) return;
    if (hydratedId === line.id) return;
    hydrate(line);
  }, [line, hydratedId, hydrate]);

  const serverSnapshot = useMemo(() => {
    if (!line) return null;
    return {
      name: line.manufacturingName ?? '',
      notes: line.factoryNotes ?? '',
      width: formatDim(line.orderDimensions?.width).replace('—', ''),
      height: formatDim(line.orderDimensions?.height).replace('—', ''),
      depth: formatDim(line.orderDimensions?.depth).replace('—', ''),
      seatHeight: formatDim(line.orderDimensions?.seatHeight).replace('—', ''),
      pieceCount: String(
        line.packagingExpectation?.expectedPieceCount ??
          line.packagingExpectation?.pieceLabels?.length ??
          1,
      ),
      pieceLabelsText: (line.packagingExpectation?.pieceLabels ?? [])
        .map((p) => p.nameEn || p.label || '')
        .filter(Boolean)
        .join('\n'),
      workflowId: line.workflowId,
      workflowConfirmed: Boolean(line.workflowConfirmedAt),
    };
  }, [line]);

  const dirty = useMemo(() => {
    if (!serverSnapshot || hydratedId == null) return false;
    if (name !== serverSnapshot.name) return true;
    if (notes !== serverSnapshot.notes) return true;
    if (width !== serverSnapshot.width) return true;
    if (height !== serverSnapshot.height) return true;
    if (depth !== serverSnapshot.depth) return true;
    if (seatHeight !== serverSnapshot.seatHeight) return true;
    if (pieceCount !== serverSnapshot.pieceCount) return true;
    if (pieceLabelsText !== serverSnapshot.pieceLabelsText) return true;
    if (workflowId !== serverSnapshot.workflowId) return true;
    if (workflowConfirmed !== serverSnapshot.workflowConfirmed) return true;
    return !materialsEqual(materials, baselineMaterials);
  }, [
    serverSnapshot,
    hydratedId,
    name,
    notes,
    width,
    height,
    depth,
    seatHeight,
    pieceCount,
    pieceLabelsText,
    workflowId,
    workflowConfirmed,
    materials,
    baselineMaterials,
  ]);

  useEffect(() => {
    if (!line || hydratedId !== line.id || dirty) return;
    hydrate(line);
  }, [query.dataUpdatedAt, line, hydratedId, dirty, hydrate]);

  const stickyPad =
    stickyCtaBottomInset(insets.bottom, theme.spacing.md) + (editable ? 96 : 24);

  function onSectionLayout(key: SectionKey, e: LayoutChangeEvent) {
    sectionY.current[key] = e.nativeEvent.layout.y;
  }

  function jumpToIssue(issue: SetupValidationIssue) {
    const section: SectionKey =
      issue.section === 'workflow'
        ? 'path'
        : issue.section === 'materials'
          ? 'materials'
          : issue.section === 'packaging'
            ? 'packaging'
            : 'spec';
    const y = sectionY.current[section] ?? 0;
    scrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
  }

  function parseNum(raw: string): number | null {
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }

  function saveAll() {
    if (!line || !editable) return;
    const labels = pieceLabelsText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((nameEn) => ({ nameEn, nameAr: nameEn, nameHe: nameEn }));
    const count = Math.max(1, Math.floor(Number(pieceCount) || labels.length || 1));
    const materialsDirty = !materialsEqual(materials, baselineMaterials);

    const finishOk = () => {
      void haptics.confirmMedium();
      showToast({ variant: 'success', message: t('mobile.productionSetup.saveSuccess') });
      if (onClose) onClose();
    };
    const finishErr = () =>
      showToast({ variant: 'error', message: t('mobile.productionSetup.actionFailed') });

    actions.patchLine.mutate(
      {
        lineId: line.id,
        body: {
          manufacturingName: name.trim() || line.manufacturingName || 'Piece',
          factoryNotes: notes.trim() || null,
          orderDimensions: {
            width: parseNum(width),
            height: parseNum(height),
            depth: parseNum(depth),
            seatHeight: parseNum(seatHeight),
          },
          packagingExpectation: {
            expectedPieceCount: count,
            pieceLabels: labels.length
              ? labels
              : Array.from({ length: count }, (_, i) => ({
                  nameEn: `Piece ${i + 1}`,
                  nameAr: `قطعة ${i + 1}`,
                  nameHe: `חלק ${i + 1}`,
                })),
          },
          workflowId,
          confirmWorkflow: Boolean(workflowId && workflowConfirmed),
          materialsReviewed: materials.every((m) => !m.needsReview),
        },
      },
      {
        onSuccess: () => {
          if (!materialsDirty) {
            finishOk();
            return;
          }
          actions.putMaterials.mutate(
            {
              lineId: line.id,
              body: {
                materials: materials.map((m) => ({
                  inventoryItemId: m.inventoryItemId,
                  sku: m.sku,
                  displayName: m.displayName,
                  category: m.category,
                  unit: m.unit,
                  expectedQty: m.expectedQty,
                  source: m.source,
                  needsReview: m.needsReview,
                  notes: m.notes,
                  requestedFabricLabel: m.requestedFabricLabel,
                })),
              },
            },
            { onSuccess: finishOk, onError: finishErr },
          );
        },
        onError: finishErr,
      },
    );
  }

  if (!canView) {
    return (
      <AppScreen>
        <LineNav onBack={goBack} title={t('mobile.productionSetup.lineTitle')} />
        <EmptyState title={t('mobile.noModules')} description={t('mobile.noModulesHint')} />
      </AppScreen>
    );
  }

  if (query.isLoading && !line) {
    return (
      <AppScreen edges={{ top: true, bottom: false }} style={{ paddingHorizontal: 0 }}>
        <LineNav onBack={goBack} title={t('mobile.productionSetup.lineTitle')} />
        <View style={{ padding: theme.spacing.lg }}>
          <AppText variant="caption" color="muted">
            {t('mobile.productionSetup.loading')}
          </AppText>
        </View>
      </AppScreen>
    );
  }

  if ((query.isError && !line) || (!query.isLoading && !line)) {
    return (
      <AppScreen>
        <LineNav onBack={goBack} title={t('mobile.productionSetup.lineTitle')} />
        <ErrorState
          title={t('mobile.productionSetup.errorTitle')}
          description={t('mobile.productionSetup.errorBody')}
          retryLabel={t('mobile.orderDetail.retry')}
          onRetry={() => void query.refetch()}
        />
      </AppScreen>
    );
  }

  if (!line) return null;

  const title = lineDisplayName(line, locale);
  const complexity = complexityBadgeKey(line.manufacturingComplexity);
  const issues = line.issues ?? [];
  const grouped = groupMaterials(materials);
  const existingSkus = materials.map((m) => m.sku).filter(Boolean) as string[];
  const workflowName = line.workflow
    ? localizedName(locale, line.workflow, line.workflow.code)
    : null;
  let sectionIdx = 0;
  const nextIndex = () => sectionIdx++;

  const fieldStyle = {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: theme.radius.lg,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    color: colors.textPrimary,
    backgroundColor: colors.surfaceSecondary,
    textAlign: (isRTL ? 'right' : 'left') as 'left' | 'right',
  };

  const body = (
    <>
      <LineNav
        onBack={goBack}
        title={
          embedded
            ? t('mobile.orders.journey.editLineTitle')
            : t('mobile.productionSetup.lineTitle')
        }
        dirty={dirty}
      />

      <ScrollView
        ref={scrollRef}
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching}
            onRefresh={() => void query.refetch()}
            tintColor={colors.brand}
          />
        }
        contentContainerStyle={{
          paddingHorizontal: theme.spacing.lg,
          paddingTop: theme.spacing.md,
          paddingBottom: stickyPad,
          gap: theme.spacing.md,
        }}
      >
        <ListItemEnter index={nextIndex()}>
          <OrderBoardCard accent={colors.brand}>
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                gap: theme.spacing.md,
                alignItems: 'center',
              }}
            >
              <OrderCardMedia imageUrl={line.product?.imageUrl ?? null} size={88} />
              <View style={{ flex: 1, gap: theme.spacing.xs }}>
                <AppText variant="title" weight="semibold" numberOfLines={2}>
                  {title}
                </AppText>
                <AppText variant="caption" color="secondary">
                  {query.data?.salesOrder.number}
                  {query.data?.salesOrder.customer
                    ? ` · ${dealerDisplayName(query.data.salesOrder.customer, locale)}`
                    : ''}
                </AppText>
                <AppText variant="caption" color="muted" dir="ltr">
                  {t('mobile.productionSetup.quantity')}: {line.quantity}
                </AppText>
                <View
                  style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    flexWrap: 'wrap',
                    gap: theme.spacing.xs,
                  }}
                >
                  <View
                    style={{
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                      borderRadius: theme.radius.sm,
                      borderWidth: 1,
                      borderColor: colors.brand,
                      backgroundColor: colors.brandSoft,
                    }}
                  >
                    <AppText
                      variant="caption"
                      weight="semibold"
                      style={{ color: colors.brand }}
                    >
                      {t(`mobile.productionSetup.complexity.${complexity}`)}
                    </AppText>
                  </View>
                  <StatusBadge status={String(line.status)} />
                </View>
                {complexity === 'custom' && line.product ? (
                  <AppText variant="caption" color="muted">
                    {t('mobile.productionSetup.basedOnProduct', {
                      name: localizedName(locale, line.product, line.product.nameEn),
                    })}
                  </AppText>
                ) : null}
              </View>
            </View>
          </OrderBoardCard>
        </ListItemEnter>

        {issues.length > 0 ? (
          <ListItemEnter index={nextIndex()}>
            <OrderBoardCard accent={colors.warning} style={{ backgroundColor: colors.warningSoft }}>
              <OrderSectionHeader
                icon="alert-circle-outline"
                label={t('mobile.productionSetup.issuesTitle')}
                accent={colors.warning}
              />
              {issues.map((issue, idx) => (
                <Pressable
                  key={`${issue.code}-${idx}`}
                  onPress={() => jumpToIssue(issue)}
                  style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    alignItems: 'center',
                    gap: theme.spacing.sm,
                    paddingVertical: 4,
                  }}
                >
                  <Ionicons name="chevron-forward" size={16} color={colors.warning} />
                  <AppText variant="caption" style={{ flex: 1 }}>
                    {issue.message}
                  </AppText>
                </Pressable>
              ))}
            </OrderBoardCard>
          </ListItemEnter>
        ) : null}

        <View onLayout={(e) => onSectionLayout('spec', e)}>
          <ListItemEnter index={nextIndex()}>
            <OrderBoardCard accent={colors.brand}>
              <OrderSectionHeader
                icon="resize-outline"
                label={t('mobile.productionSetup.sections.spec')}
                accent={colors.brand}
              />
              {editable ? (
                <>
                  <AppText variant="caption" color="muted">
                    {t('mobile.productionSetup.manufacturingName')}
                  </AppText>
                  <AppTextInput
                    value={name}
                    onChangeText={setName}
                    editable
                    style={fieldStyle}
                  />
                </>
              ) : (
                <InfoRow
                  label={t('mobile.productionSetup.manufacturingName')}
                  value={name}
                />
              )}
              <InfoRow
                label={`${t('mobile.productionSetup.quantity')} (${t('mobile.productionSetup.readOnly')})`}
                value={line.quantity}
                ltr
              />
              <DimCompare
                label={t('mobile.productionSetup.dims.width')}
                catalog={line.catalogDimensions?.width}
                value={width}
                onChange={setWidth}
                editable={editable}
                showCatalog={Boolean(line.product)}
                fieldStyle={fieldStyle}
              />
              <DimCompare
                label={t('mobile.productionSetup.dims.height')}
                catalog={line.catalogDimensions?.height}
                value={height}
                onChange={setHeight}
                editable={editable}
                showCatalog={Boolean(line.product)}
                fieldStyle={fieldStyle}
              />
              <DimCompare
                label={t('mobile.productionSetup.dims.depth')}
                catalog={line.catalogDimensions?.depth}
                value={depth}
                onChange={setDepth}
                editable={editable}
                showCatalog={Boolean(line.product)}
                fieldStyle={fieldStyle}
              />
              <DimCompare
                label={t('mobile.productionSetup.dims.seatHeight')}
                catalog={line.catalogDimensions?.seatHeight}
                value={seatHeight}
                onChange={setSeatHeight}
                editable={editable}
                showCatalog={Boolean(line.product) && complexity !== 'custom'}
                fieldStyle={fieldStyle}
              />
              {(line.measurements ?? []).length > 0 ? (
                <View style={{ gap: theme.spacing.xs, marginTop: theme.spacing.sm }}>
                  {(line.measurements ?? []).map((m) => (
                    <View key={m.key} style={{ gap: 2 }}>
                      <AppText variant="caption" color="muted">
                        {m.label}
                        {m.unit ? ` (${m.unit})` : ''}
                      </AppText>
                      <AppText variant="label" weight="semibold" dir="ltr">
                        {m.catalogValue != null ? `${m.catalogValue} → ` : ''}
                        {m.value ?? '—'}
                      </AppText>
                    </View>
                  ))}
                </View>
              ) : null}
            </OrderBoardCard>
          </ListItemEnter>
        </View>

        {complexity === 'modified' || (line.changesFromCatalog ?? line.changes ?? []).length > 0 ? (
          <ListItemEnter index={nextIndex()}>
            <OrderBoardCard accent={colors.info}>
              <OrderSectionHeader
                icon="git-compare-outline"
                label={t('mobile.productionSetup.sections.changes')}
                accent={colors.info}
              />
              {(line.changesFromCatalog ?? line.changes ?? []).length === 0 ? (
                <AppText variant="caption" color="muted">
                  {t('mobile.productionSetup.noCatalogChanges')}
                </AppText>
              ) : (
                (line.changesFromCatalog ?? line.changes).map((c) => (
                  <View
                    key={`${c.field}-${String(c.from)}-${String(c.to)}`}
                    style={{
                      flexDirection: isRTL ? 'row-reverse' : 'row',
                      justifyContent: 'space-between',
                      gap: theme.spacing.sm,
                      paddingVertical: 4,
                    }}
                  >
                    <AppText variant="caption" color="secondary" style={{ flex: 1 }}>
                      {c.label ?? c.field}
                    </AppText>
                    <AppText variant="caption" weight="semibold" dir="ltr">
                      {c.from == null ? '—' : String(c.from)} →{' '}
                      {c.to == null ? '—' : String(c.to)}
                    </AppText>
                  </View>
                ))
              )}
            </OrderBoardCard>
          </ListItemEnter>
        ) : null}

        <ListItemEnter index={nextIndex()}>
          <SetupFabricSection
            fabric={line.fabric}
            requestedFabricLabel={line.requestedFabricLabel}
            editable={editable}
            onPickFabric={() => setFabricPickerOpen(true)}
          />
        </ListItemEnter>

        <View onLayout={(e) => onSectionLayout('materials', e)}>
          <ListItemEnter index={nextIndex()}>
            <OrderBoardCard accent={colors.info}>
              <OrderSectionHeader
                icon="layers-outline"
                label={t('mobile.productionSetup.sections.materials')}
                accent={colors.info}
                trailing={
                  editable ? (
                    <Pressable onPress={() => setPickerOpen(true)}>
                      <AppText variant="caption" weight="semibold" style={{ color: colors.brand }}>
                        {t('mobile.orderDetail.addMaterial')}
                      </AppText>
                    </Pressable>
                  ) : null
                }
              />
              {editable && complexity !== 'custom' ? (
                <View
                  style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    flexWrap: 'wrap',
                    gap: theme.spacing.sm,
                  }}
                >
                  <SecondaryButton
                    label={
                      complexity === 'standard'
                        ? t('mobile.productionSetup.useCatalogSpec')
                        : t('mobile.productionSetup.seedFromCatalog')
                    }
                    onPress={() =>
                      actions.seedFromCatalog.mutate(line.id, {
                        onSuccess: () =>
                          showToast({
                            variant: 'success',
                            message: t('mobile.productionSetup.seedSuccess'),
                          }),
                        onError: () =>
                          showToast({
                            variant: 'error',
                            message: t('mobile.productionSetup.actionFailed'),
                          }),
                      })
                    }
                    loading={actions.seedFromCatalog.isPending}
                  />
                  {materials.some((m) => m.needsReview) ? (
                    <SecondaryButton
                      label={t('mobile.productionSetup.markMaterialsReviewed')}
                      onPress={() =>
                        setMaterials((prev) => prev.map((m) => ({ ...m, needsReview: false })))
                      }
                    />
                  ) : null}
                </View>
              ) : editable && materials.some((m) => m.needsReview) ? (
                <SecondaryButton
                  label={t('mobile.productionSetup.markMaterialsReviewed')}
                  onPress={() =>
                    setMaterials((prev) => prev.map((m) => ({ ...m, needsReview: false })))
                  }
                />
              ) : null}
              {grouped.length === 0 ? (
                <AppText variant="caption" color="muted">
                  {t('mobile.productionSetup.noMaterials')}
                </AppText>
              ) : (
                grouped.map((group) => (
                  <View key={group.key} style={{ gap: theme.spacing.xs }}>
                    <AppText variant="caption" weight="semibold" color="muted">
                      {t(`mobile.inventory.groups.${group.key}`)}
                    </AppText>
                    {group.items.map((m, idx) => (
                      <BomFloorRow
                        key={m.key}
                        index={idx}
                        name={m.displayName || m.sku || '—'}
                        sku={m.sku || ''}
                        unitCostLabel=""
                        lineTotalLabel=""
                        qty={String(m.expectedQty)}
                        imageUrl={m.imageUrl}
                        showCosts={false}
                        onQtyChange={(v) => {
                          const qty = Number(v);
                          if (!Number.isFinite(qty)) return;
                          setMaterials((prev) =>
                            prev.map((row) =>
                              row.key === m.key ? { ...row, expectedQty: qty } : row,
                            ),
                          );
                        }}
                        onRemove={() =>
                          setMaterials((prev) => prev.filter((row) => row.key !== m.key))
                        }
                      />
                    ))}
                  </View>
                ))
              )}
            </OrderBoardCard>
          </ListItemEnter>
        </View>

        <View onLayout={(e) => onSectionLayout('path', e)}>
          <ListItemEnter index={nextIndex()}>
            <OrderBoardCard accent={colors.brand}>
              <OrderSectionHeader
                icon="git-branch-outline"
                label={t('mobile.productionSetup.sections.path')}
                accent={colors.brand}
              />
              <AppText variant="label" weight="semibold">
                {workflowName ?? t('mobile.productionSetup.noWorkflowSelected')}
              </AppText>
              {line.workflow?.stagePath?.length ? (
                <AppText variant="caption" color="secondary">
                  {line.workflow.stagePath
                    .map((s) => localizedName(locale, s, s.stageCode))
                    .join(isRTL ? ' ← ' : ' → ')}
                </AppText>
              ) : null}
              {editable ? (
                <View
                  style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    gap: theme.spacing.sm,
                    flexWrap: 'wrap',
                    alignItems: 'center',
                  }}
                >
                  <SecondaryButton
                    label={t('mobile.productionSetup.pickWorkflow')}
                    onPress={() => setWorkflowOpen(true)}
                  />
                  {workflowId && !workflowConfirmed ? (
                    <PrimaryButton
                      label={t('mobile.productionSetup.confirmWorkflow')}
                      onPress={() => setWorkflowConfirmed(true)}
                    />
                  ) : null}
                  {workflowConfirmed ? (
                    <AppText variant="caption" style={{ color: colors.success }}>
                      {t('mobile.productionSetup.workflowConfirmed')}
                    </AppText>
                  ) : null}
                </View>
              ) : null}
            </OrderBoardCard>
          </ListItemEnter>
        </View>

        <View onLayout={(e) => onSectionLayout('packaging', e)}>
          <ListItemEnter index={nextIndex()}>
            <OrderBoardCard accent={colors.info}>
              <OrderSectionHeader
                icon="cube-outline"
                label={t('mobile.productionSetup.sections.packaging')}
                accent={colors.info}
              />
              <AppText variant="caption" color="muted">
                {t('mobile.productionSetup.pieceCount')}
              </AppText>
              <AppTextInput
                value={pieceCount}
                onChangeText={setPieceCount}
                editable={editable}
                keyboardType="number-pad"
                style={fieldStyle}
              />
              <AppText variant="caption" color="muted">
                {t('mobile.productionSetup.pieceLabelsHint')}
              </AppText>
              <AppTextInput
                value={pieceLabelsText}
                onChangeText={setPieceLabelsText}
                editable={editable}
                multiline
                style={[fieldStyle, { minHeight: 88, textAlignVertical: 'top' }]}
              />
            </OrderBoardCard>
          </ListItemEnter>
        </View>

        <View onLayout={(e) => onSectionLayout('refs', e)}>
          <ListItemEnter index={nextIndex()}>
            <OrderBoardCard accent={colors.brand}>
              <OrderSectionHeader
                icon="attach-outline"
                label={t('mobile.productionSetup.sections.refs')}
                accent={colors.brand}
              />
              {line.attachments && line.attachments.length > 0 ? (
                line.attachments.map((doc) => (
                  <Pressable
                    key={doc.id}
                    onPress={() => {
                      void resolveDocumentUrl(doc.id).then((url) => Linking.openURL(url));
                    }}
                    style={{
                      flexDirection: isRTL ? 'row-reverse' : 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: theme.spacing.sm,
                      paddingVertical: 6,
                    }}
                  >
                    <View style={{ flex: 1, gap: 2 }}>
                      <AppText variant="label" weight="semibold" numberOfLines={1}>
                        {doc.fileName}
                      </AppText>
                      <AppText variant="caption" color="muted" dir="ltr">
                        {doc.mimeType}
                      </AppText>
                    </View>
                    <AppText variant="caption" weight="semibold" style={{ color: colors.brand }}>
                      {t('mobile.productionSetup.openAttachment')}
                    </AppText>
                  </Pressable>
                ))
              ) : Array.isArray(line.referenceDocumentIds) &&
                (line.referenceDocumentIds as string[]).length > 0 ? (
                (line.referenceDocumentIds as string[]).map((id) => (
                  <AppText key={id} variant="caption" color="secondary" dir="ltr">
                    {id}
                  </AppText>
                ))
              ) : (
                <AppText variant="caption" color="muted">
                  {t('mobile.productionSetup.noRefs')}
                </AppText>
              )}
            </OrderBoardCard>
          </ListItemEnter>
        </View>

        {line.estimatedCostSummary || line.actualCostSummary ? (
          <ListItemEnter index={nextIndex()}>
            <SetupEstimatedCostSummary
              summary={line.estimatedCostSummary}
              actual={line.actualCostSummary}
            />
          </ListItemEnter>
        ) : null}

        <View onLayout={(e) => onSectionLayout('notes', e)}>
          <ListItemEnter index={nextIndex()}>
            <OrderBoardCard accent={colors.brand}>
              <OrderSectionHeader
                icon="create-outline"
                label={t('mobile.productionSetup.sections.notes')}
                accent={colors.brand}
              />
              {editable ? (
                <AppTextInput
                  value={notes}
                  onChangeText={setNotes}
                  editable
                  multiline
                  placeholder={t('mobile.productionSetup.factoryNotesPlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  style={[fieldStyle, { minHeight: 100, textAlignVertical: 'top' }]}
                />
              ) : (
                <AppText variant="body" color={notes.trim() ? 'primary' : 'muted'}>
                  {notes.trim() ? notes : '—'}
                </AppText>
              )}
            </OrderBoardCard>
          </ListItemEnter>
        </View>
      </ScrollView>

      {editable ? (
        <FloatingActionDock floating>
          <View style={{ gap: 6, width: '100%' }}>
            <PrimaryButton
              label={
                dirty
                  ? t('mobile.productionSetup.saveChanges')
                  : t('mobile.productionSetup.saved')
              }
              onPress={saveAll}
              loading={actions.patchLine.isPending || actions.putMaterials.isPending}
              disabled={!dirty}
              style={{ alignSelf: 'stretch', width: '100%' }}
            />
            {!dirty ? (
              <AppText variant="caption" color="muted" style={{ textAlign: 'center' }}>
                {t('mobile.productionSetup.saveDisabledNoChanges')}
              </AppText>
            ) : null}
          </View>
        </FloatingActionDock>
      ) : null}

      <BomMaterialPickerSheet
        open={pickerOpen || fabricPickerOpen}
        onClose={() => {
          setPickerOpen(false);
          setFabricPickerOpen(false);
        }}
        existingSkus={existingSkus}
        onPick={(picked) => {
          if (fabricPickerOpen) {
            setMaterials((prev) => {
              const withoutFabric = prev.filter(
                (m) => !String(m.category ?? '').toUpperCase().includes('FABRIC'),
              );
              return [
                ...withoutFabric,
                {
                  key: `fabric-${picked.sku}-${Date.now()}`,
                  inventoryItemId: picked.inventoryItemId ?? null,
                  sku: picked.sku,
                  displayName: picked.nameEn,
                  category: picked.category ?? 'FABRIC',
                  unit: 'pcs',
                  expectedQty: picked.qty,
                  source: 'FACTORY_MODIFIED',
                  needsReview: false,
                  notes: null,
                  requestedFabricLabel: line.requestedFabricLabel ?? null,
                  imageUrl: picked.imageUrl ?? null,
                },
              ];
            });
            setFabricPickerOpen(false);
            return;
          }
          setMaterials((prev) => [
            ...prev,
            {
              key: `new-${picked.sku}-${Date.now()}`,
              inventoryItemId: picked.inventoryItemId ?? null,
              sku: picked.sku,
              displayName: picked.nameEn,
              category: picked.category ?? null,
              unit: 'pcs',
              expectedQty: picked.qty,
              source: 'FACTORY_MODIFIED',
              needsReview: false,
              notes: null,
              requestedFabricLabel: null,
              imageUrl: picked.imageUrl ?? null,
            },
          ]);
        }}
      />

      <WorkflowPickerSheet
        open={workflowOpen}
        onClose={() => setWorkflowOpen(false)}
        selectedId={workflowId}
        onPick={(wf: WorkflowListItem) => {
          setWorkflowId(wf.id);
          setWorkflowConfirmed(false);
        }}
      />
    </>
  );

  if (embedded) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>{body}</View>
    );
  }

  return (
    <AppScreen edges={{ top: true, bottom: false }} style={{ paddingHorizontal: 0 }}>
      {body}
    </AppScreen>
  );
}

function groupMaterials(materials: DraftMaterial[]) {
  const order = ['fabric', 'foam', 'wood', 'accessories'] as const;
  const map = new Map<string, DraftMaterial[]>();
  for (const m of materials) {
    const key = categoryGroupKey(m.category);
    const list = map.get(key) ?? [];
    list.push(m);
    map.set(key, list);
  }
  return order
    .filter((key) => (map.get(key)?.length ?? 0) > 0)
    .map((key) => ({ key, items: map.get(key)! }));
}

function DimCompare({
  label,
  catalog,
  value,
  onChange,
  editable,
  showCatalog = true,
  fieldStyle,
}: {
  label: string;
  catalog: number | null | undefined;
  value: string;
  onChange: (v: string) => void;
  editable: boolean;
  showCatalog?: boolean;
  fieldStyle: object;
}) {
  const { t, isRTL } = useLocale();
  const catalogHint = showCatalog
    ? `${t('mobile.productionSetup.catalog')}: ${formatDim(catalog)}`
    : null;

  if (!editable) {
    return (
      <View style={{ gap: 4 }}>
        <InfoRow label={label} value={value || '—'} ltr />
        {catalogHint ? (
          <AppText
            variant="caption"
            color="secondary"
            dir="ltr"
            style={{ textAlign: isRTL ? 'left' : 'right' }}
          >
            {catalogHint}
          </AppText>
        ) : null}
      </View>
    );
  }

  return (
    <View style={{ gap: 4 }}>
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          justifyContent: 'space-between',
        }}
      >
        <AppText variant="caption" color="muted">
          {label}
        </AppText>
        {catalogHint ? (
          <AppText variant="caption" color="secondary" dir="ltr">
            {catalogHint}
          </AppText>
        ) : null}
      </View>
      <AppTextInput
        value={value}
        onChangeText={onChange}
        editable
        keyboardType="decimal-pad"
        style={fieldStyle}
      />
    </View>
  );
}

function LineNav({
  onBack,
  title,
  dirty,
}: {
  onBack: () => void;
  title: string;
  dirty?: boolean;
}) {
  const { isRTL, t } = useLocale();
  const { colors, theme } = useTheme();
  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: theme.spacing.lg,
        paddingVertical: theme.spacing.sm,
        gap: theme.spacing.sm,
      }}
    >
      <BackButton onPress={onBack} />
      <AppText variant="label" weight="semibold" style={{ flex: 1 }} numberOfLines={1}>
        {title}
      </AppText>
      {dirty ? (
        <AppText variant="caption" style={{ color: colors.warning }}>
          {t('mobile.productionSetup.unsaved')}
        </AppText>
      ) : (
        <View style={{ width: 32 }} />
      )}
    </View>
  );
}
