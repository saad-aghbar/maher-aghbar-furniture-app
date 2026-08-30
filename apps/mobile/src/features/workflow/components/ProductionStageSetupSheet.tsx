import { useEffect, useState } from 'react';
import { Dimensions, Pressable, ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { localizedName } from '@maher/i18n';
import type { ProductionSetupStage } from '@/api/modules/workflow';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { TextField } from '@/components/forms/TextField';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { InventorySkuThumb } from '@/features/inventory/components/InventorySkuThumb';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import {
  coerceSetupProduceKind,
  deriveSetupBehavior,
  produceKindFromBehavior,
  setupProduces,
  terminalSetupMode,
} from '../productionSetupBehavior';
import { StageToggleRow } from './StageEditorFields';

type Props = {
  open: boolean;
  stage: ProductionSetupStage | null;
  product?: {
    id: string;
    nameEn: string;
    nameAr: string;
    nameHe?: string | null;
    sku?: string | null;
  } | null;
  /** @deprecated Prefer stage.upstreamOutputs (DAG predecessors only). Kept for callers. */
  outputs?: Array<{
    id: string;
    workflowNodeId: string | null;
    nameEn: string;
    nameAr: string;
    nameHe?: string | null;
  }>;
  warehouses: Array<{
    id: string;
    nameEn: string;
    nameAr: string;
    nameHe?: string | null;
    type: string;
    isDefault: boolean;
  }>;
  bomLines?: Array<{
    sku: string;
    qty: number;
    exists: boolean;
    imageUrl?: string | null;
    nameEn?: string | null;
    nameAr?: string | null;
    nameHe?: string | null;
    unit?: string | null;
  }>;
  /** Material claims on other stages (live drafts) for remaining-pool math. */
  siblingMaterialClaims?: Array<{ sku: string; qtyPerUnit: number }>;
  /**
   * True when earlier stages produce SEMI, even if this stage’s Takes-in list is
   * empty because those pieces are already claimed exclusively elsewhere.
   */
  earlierSemiProducersExist?: boolean;
  /** Packaging’s packages-per-unit — shown read-only on Delivery setup. */
  packagingPackageCount?: number | null;
  /** Named packages from Packaging (sibling draft) for Delivery preview. */
  packagingPackageLabels?: Array<{ nameEn: string; nameAr?: string | null; nameHe?: string | null }>;
  onClose: () => void;
  onSave: (stage: ProductionSetupStage) => void;
};

type PieceDraft = {
  key: string;
  nameEn: string;
  nameAr: string;
  nameHe: string;
};

/** Nested radio row — same language as StageToggleRow inside Takes/Makes boards. */
function ChoiceCard({
  active,
  icon,
  title,
  hint,
  onPress,
}: {
  active: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  hint: string;
  onPress: () => void;
}) {
  const { isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  return (
    <AnimatedPressable
      variant="card"
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      onPress={() => {
        void haptics.selection();
        onPress();
      }}
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        padding: theme.spacing.md,
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: active ? colors.brand : colors.border,
        backgroundColor: active ? colors.brandSoft : colors.surfaceSecondary,
        ...(active ? orderBoardShadow(colorScheme) : null),
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: active ? colors.brand : colors.border,
        }}
      >
        <Ionicons name={icon} size={16} color={active ? colors.brand : colors.textSecondary} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText
          variant="label"
          weight="semibold"
          style={{ textAlign: isRTL ? 'right' : 'left' }}
        >
          {title}
        </AppText>
        <AppText
          variant="caption"
          color="muted"
          style={{ textAlign: isRTL ? 'right' : 'left' }}
        >
          {hint}
        </AppText>
      </View>
      <Ionicons
        name={active ? 'radio-button-on' : 'radio-button-off'}
        size={20}
        color={active ? colors.brand : colors.textMuted}
      />
    </AnimatedPressable>
  );
}

function BoardSectionHeader({
  icon,
  title,
  hint,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  hint: string;
}) {
  const { isRTL } = useLocale();
  const { colors, theme } = useTheme();
  return (
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
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
        }}
      >
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.brandSoft,
          }}
        >
          <Ionicons name={icon} size={16} color={colors.brand} />
        </View>
        <View style={{ flex: 1 }}>
          <AppText
            variant="label"
            weight="semibold"
            style={{ textAlign: isRTL ? 'right' : 'left' }}
          >
            {title}
          </AppText>
          <AppText
            variant="caption"
            color="muted"
            style={{ textAlign: isRTL ? 'right' : 'left' }}
          >
            {hint}
          </AppText>
        </View>
      </View>
    </View>
  );
}

function resizePieceDrafts(rows: PieceDraft[], count: number): PieceDraft[] {
  const n = Math.max(1, Math.min(20, count));
  if (rows.length === n) return rows;
  if (rows.length < n) {
    return [
      ...rows,
      ...Array.from({ length: n - rows.length }, (_, i) => ({
        key: `pack-${Date.now()}-${rows.length + i}`,
        nameEn: '',
        nameAr: '',
        nameHe: '',
      })),
    ];
  }
  return rows.slice(0, n);
}

function PackPiecesStepper({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const { t, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const n = Math.max(1, Math.min(20, Math.floor(Number(value) || 1)));

  function step(delta: number) {
    const next = Math.max(1, Math.min(20, n + delta));
    void haptics.selection();
    onChange(String(next));
  }

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <AppText
        variant="label"
        weight="semibold"
        style={{ textAlign: isRTL ? 'right' : 'left' }}
      >
        {t('production.setup.packPiecesTitle')}
      </AppText>
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: theme.spacing.lg,
        }}
      >
        <AnimatedPressable
          variant="button"
          disabled={n <= 1}
          accessibilityRole="button"
          accessibilityLabel={`${t('production.setup.packPiecesTitle')} −`}
          onPress={() => step(-1)}
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: n <= 1 ? colors.border : colors.brand,
            backgroundColor: n <= 1 ? colors.surfaceSecondary : colors.brandSoft,
            opacity: n <= 1 ? 0.5 : 1,
          }}
        >
          <Ionicons name="remove" size={20} color={n <= 1 ? colors.textMuted : colors.brand} />
        </AnimatedPressable>
        <AppText variant="title" weight="semibold" style={{ minWidth: 36, textAlign: 'center' }}>
          {n}
        </AppText>
        <AnimatedPressable
          variant="button"
          disabled={n >= 20}
          accessibilityRole="button"
          accessibilityLabel={`${t('production.setup.packPiecesTitle')} +`}
          onPress={() => step(1)}
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: n >= 20 ? colors.border : colors.brand,
            backgroundColor: n >= 20 ? colors.surfaceSecondary : colors.brandSoft,
            opacity: n >= 20 ? 0.5 : 1,
          }}
        >
          <Ionicons name="add" size={20} color={n >= 20 ? colors.textMuted : colors.brand} />
        </AnimatedPressable>
      </View>
      <AppText variant="caption" color="muted" style={{ textAlign: isRTL ? 'right' : 'left' }}>
        {t('production.setup.packPiecesHint')}
      </AppText>
    </View>
  );
}

export function ProductionStageSetupSheet({
  open,
  stage,
  product = null,
  warehouses,
  bomLines = [],
  siblingMaterialClaims = [],
  earlierSemiProducersExist = false,
  packagingPackageCount = null,
  packagingPackageLabels = [],
  onClose,
  onSave,
}: Props) {
  const { t, locale, isRTL } = useLocale();
  const { theme, colors, colorScheme } = useTheme();
  const [consumeRaw, setConsumeRaw] = useState(false);
  const [consumeSemi, setConsumeSemi] = useState(false);
  const [produce, setProduce] = useState(coerceSetupProduceKind('none'));
  const [nameEn, setNameEn] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [nameHe, setNameHe] = useState('');
  const [qty, setQty] = useState('1');
  const [packPieces, setPackPieces] = useState('1');
  const [pieces, setPieces] = useState<PieceDraft[]>([
    { key: 'p0', nameEn: '', nameAr: '', nameHe: '' },
  ]);
  const [warehouseId, setWarehouseId] = useState('');
  const [consumeIds, setConsumeIds] = useState<string[]>([]);
  const [materialInputs, setMaterialInputs] = useState<Array<{ sku: string; qtyPerUnit: number }>>(
    [],
  );

  const setupMode = terminalSetupMode(stage?.stageCode);
  const isPackaging = setupMode === 'packaging';
  const isInspection = setupMode === 'inspection';
  const isDelivery = setupMode === 'delivery';
  const hideMaterials = isInspection || isDelivery;
  const lockMakesNothing = isInspection || isDelivery;

  useEffect(() => {
    if (!open || !stage) return;
    const mode = terminalSetupMode(stage.stageCode);
    let kind = coerceSetupProduceKind(
      produceKindFromBehavior(stage.behavior),
      stage.stageCode,
    );
    const canTakeSemi = (stage.upstreamOutputs?.length ?? 0) > 0;
    setProduce(kind);
    const wantMaterials =
      mode === 'production' &&
      (Boolean(stage.consumesRawMaterials) || stage.behavior === 'USES_MATERIALS');
    setConsumeRaw(wantMaterials);
    const wantSemi =
      mode === 'delivery'
        ? false
        : canTakeSemi &&
          (mode === 'inspection' ||
            mode === 'packaging' ||
            Boolean(stage.consumesSemiFinished) ||
            stage.behavior === 'USES_SEMI_FINISHED' ||
            stage.behavior === 'USES_AND_PRODUCES');
    setConsumeSemi(wantSemi);
    setNameEn(stage.output?.nameEn ?? '');
    setNameAr(stage.output?.nameAr ?? '');
    setNameHe(stage.output?.nameHe ?? '');
    setQty(String(stage.output?.qtyPerUnit ?? 1));
    const labels = stage.output?.pieceLabels ?? [];
    const packCount = Math.max(
      1,
      Math.min(
        20,
        Math.floor(Number(stage.output?.expectedPieceCount) || labels.length || 1),
      ),
    );
    setPackPieces(String(packCount));
    const seeded = labels.length
      ? labels.map((row, i) => ({
          key: `p${i}-${row.nameEn || i}`,
          nameEn: row.nameEn ?? '',
          nameAr: row.nameAr ?? '',
          nameHe: row.nameHe ?? '',
        }))
      : [{ key: 'p0', nameEn: '', nameAr: '', nameHe: '' }];
    setPieces(resizePieceDrafts(seeded, packCount));
    setWarehouseId(stage.output?.defaultWarehouseId ?? '');
    const allowedIds = new Set((stage.upstreamOutputs ?? []).map((o) => o.id));
    for (const row of stage.upstreamOutputs ?? []) {
      if (row.workflowNodeId) allowedIds.add(`node:${row.workflowNodeId}`);
    }
    const prior = [
      ...(stage.consumeOutputIds ?? []),
      ...((stage.consumeWorkflowNodeIds ?? []).map((id) => `node:${id}`)),
    ];
    setConsumeIds(
      prior.filter((id) => {
        if (allowedIds.has(id)) return true;
        if (id.startsWith('node:')) {
          return (stage.upstreamOutputs ?? []).some(
            (o) => o.workflowNodeId === id.slice('node:'.length),
          );
        }
        return (stage.upstreamOutputs ?? []).some((o) => o.id === id);
      }),
    );
    // Clamp this stage's claims against siblings so we never open over-BOM.
    const claimedElsewhere = new Map<string, number>();
    for (const row of siblingMaterialClaims) {
      const sku = String(row.sku ?? '').trim();
      if (!sku) continue;
      claimedElsewhere.set(sku, (claimedElsewhere.get(sku) ?? 0) + (Number(row.qtyPerUnit) || 0));
    }
    setMaterialInputs(
      (stage.materialInputs ?? [])
        .map((row) => {
          const bom = bomLines.find((l) => l.sku === row.sku);
          const bomQty = Number(bom?.qty) || 0;
          const others = claimedElsewhere.get(row.sku) ?? 0;
          const max = Math.max(0, bomQty - others);
          const qty = Math.min(Math.max(0, Number(row.qtyPerUnit) || 0), max);
          return { ...row, qtyPerUnit: qty };
        })
        .filter((row) => row.qtyPerUnit > 0),
    );
    // Re-init only when opening / switching stage — not when sibling array identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [open, stage?.workflowNodeId]);

  const upstream = stage?.upstreamOutputs ?? [];
  const canTakeSemi = upstream.length > 0;

  if (!stage) return null;

  const warehouseType = produce === 'finished' ? 'FINISHED_GOODS' : 'SEMI_FINISHED';
  const makesSomething = produce !== 'none';
  const sheetMaxHeight = Math.round(Dimensions.get('window').height * 0.92);
  const effectiveConsumeSemi = canTakeSemi && consumeSemi;
  const productLabel = product
    ? localizedName(locale, product)
    : localizedName(locale, {
        nameEn: stage.output?.nameEn,
        nameAr: stage.output?.nameAr,
        nameHe: stage.output?.nameHe,
      });
  const typedWarehouses = warehouses.filter((w) => w.type === warehouseType);

  const claimedElsewhere = new Map<string, number>();
  for (const row of siblingMaterialClaims) {
    const sku = String(row.sku ?? '').trim();
    if (!sku) continue;
    claimedElsewhere.set(sku, (claimedElsewhere.get(sku) ?? 0) + (Number(row.qtyPerUnit) || 0));
  }

  const materialPool = bomLines
    .map((line) => {
      const sku = line.sku;
      const bomQty = Number(line.qty) || 0;
      const mine = materialInputs.find((r) => r.sku === sku);
      const mineQty = mine ? Number(mine.qtyPerUnit) || 0 : 0;
      const others = claimedElsewhere.get(sku) ?? 0;
      const remaining = Math.max(0, bomQty - others);
      const maxForStage = Math.max(0, remaining);
      return { line, mine, mineQty, others, remaining: maxForStage, bomQty };
    })
    .filter((row) => row.mine || row.remaining > 1e-9);

  const bumpMaterialQty = (sku: string, nextQty: number, maxQty: number) => {
    const capped = Math.min(Math.max(0, nextQty), maxQty);
    void haptics.selection();
    setMaterialInputs((rows) => {
      const without = rows.filter((r) => r.sku !== sku);
      if (!(capped > 0)) return without;
      return [...without, { sku, qtyPerUnit: capped }];
    });
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('mobile.production.workflow.setupStage')}
      sheetHeight={sheetMaxHeight}
      maxHeight={sheetMaxHeight}
    >
      <View style={{ flex: 1 }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            gap: theme.spacing.md,
            paddingBottom: theme.spacing.xl,
          }}
          keyboardShouldPersistTaps="handled"
        >
        <View
          style={{
            borderRadius: theme.radius.xl,
            borderWidth: 1,
            borderColor: colors.borderStrong,
            backgroundColor: colors.surfaceSecondary,
            padding: theme.spacing.md,
            gap: 6,
            ...orderBoardShadow(colorScheme),
          }}
        >
          <AppText variant="caption" color="muted" style={{ textAlign: isRTL ? 'right' : 'left' }}>
            {isInspection
              ? t('production.setup.inspectionIoCaption')
              : isPackaging
                ? t('production.setup.packagingIoCaption')
                : isDelivery
                  ? t('production.setup.deliveryIoCaption')
                  : t('production.setup.stageIoCaption')}
          </AppText>
          <AppText
            variant="heading"
            weight="semibold"
            style={{ textAlign: isRTL ? 'right' : 'left' }}
          >
            {localizedName(locale, stage)}
          </AppText>
        </View>

        {/* MATERIALS — assigned BOM slice for this stage (not Inspection / Delivery) */}
        {!hideMaterials ? (
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
          <BoardSectionHeader
            icon="cube-outline"
            title={t('production.setup.materialsBoardTitle')}
            hint={t('production.setup.materialsBoardHint')}
          />
          <View style={{ padding: theme.spacing.md, gap: theme.spacing.sm }}>
            <StageToggleRow
              icon="cube-outline"
              label={t('production.setup.takeMaterials')}
              hint={t('production.setup.takeMaterialsHint')}
              value={consumeRaw}
              onChange={(next) => {
                setConsumeRaw(next);
                if (!next) setMaterialInputs([]);
              }}
            />

            {consumeRaw ? (
              bomLines.length === 0 ? (
                <AppText
                  variant="caption"
                  color="muted"
                  style={{ textAlign: isRTL ? 'right' : 'left' }}
                >
                  {t('production.setup.materialsBoardBomEmpty')}
                </AppText>
              ) : materialPool.length === 0 ? (
                <AppText
                  variant="caption"
                  color="muted"
                  style={{ textAlign: isRTL ? 'right' : 'left' }}
                >
                  {t('production.setup.materialsBoardPoolEmpty')}
                </AppText>
              ) : (
                <View
                  style={{
                    borderRadius: theme.radius.lg,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.surfaceSecondary,
                    padding: theme.spacing.sm,
                    gap: theme.spacing.sm,
                  }}
                >
                  {materialPool.map(({ line, mine, mineQty, remaining, bomQty }) => {
                    const selected = Boolean(mine);
                    const name = localizedName(
                      locale,
                      { nameEn: line.nameEn, nameAr: line.nameAr, nameHe: line.nameHe },
                      line.sku,
                    );
                    const leftForOthers = Math.max(0, remaining - mineQty);
                    const step = 1;
                    const atMax = mineQty >= remaining - 1e-9;
                    return (
                      <View
                        key={line.sku}
                        style={{
                          borderRadius: theme.radius.lg,
                          borderWidth: 1.5,
                          borderColor: selected ? colors.brand : colors.borderStrong,
                          backgroundColor: selected ? colors.brandSoft : colors.surface,
                          overflow: 'hidden',
                          ...(selected ? orderBoardShadow(colorScheme) : null),
                        }}
                      >
                        <Pressable
                          onPress={() => {
                            if (selected) {
                              bumpMaterialQty(line.sku, 0, remaining);
                            } else {
                              bumpMaterialQty(
                                line.sku,
                                Math.min(bomQty, remaining) || remaining,
                                remaining,
                              );
                            }
                          }}
                          style={{
                            flexDirection: isRTL ? 'row-reverse' : 'row',
                            alignItems: 'center',
                            gap: theme.spacing.md,
                            padding: theme.spacing.md,
                          }}
                        >
                          <View
                            style={{
                              borderRadius: theme.radius.md,
                              borderWidth: 1.5,
                              borderColor: selected ? colors.brand : colors.border,
                              padding: 2,
                              backgroundColor: colors.surface,
                            }}
                          >
                            <InventorySkuThumb uri={line.imageUrl} size={52} rounded="lg" />
                          </View>
                          <View style={{ flex: 1, gap: 4 }}>
                            <AppText
                              variant="body"
                              weight="semibold"
                              style={{ textAlign: isRTL ? 'right' : 'left' }}
                              numberOfLines={2}
                            >
                              {name}
                            </AppText>
                            <AppText
                              variant="caption"
                              color="muted"
                              dir="ltr"
                              style={{ textAlign: isRTL ? 'right' : 'left' }}
                            >
                              {line.sku}
                            </AppText>
                            <View
                              style={{
                                alignSelf: isRTL ? 'flex-end' : 'flex-start',
                                paddingHorizontal: theme.spacing.sm,
                                paddingVertical: 3,
                                borderRadius: theme.radius.full,
                                backgroundColor: selected
                                  ? colors.surface
                                  : colors.surfaceSecondary,
                                borderWidth: 1,
                                borderColor: selected ? colors.brand : colors.border,
                              }}
                            >
                              <AppText
                                variant="caption"
                                weight="medium"
                                style={{
                                  color: selected ? colors.brand : colors.textSecondary,
                                  fontSize: 11,
                                }}
                              >
                                {t('production.setup.materialsRemaining', {
                                  remaining: String(leftForOthers),
                                  bom: String(bomQty),
                                })}
                              </AppText>
                            </View>
                          </View>
                          <View
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: 16,
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: selected ? colors.brand : colors.surfaceSecondary,
                              borderWidth: 1.5,
                              borderColor: selected ? colors.brand : colors.borderStrong,
                              ...(selected ? orderBoardShadow(colorScheme) : null),
                            }}
                          >
                            {selected ? (
                              <Ionicons name="checkmark" size={18} color={colors.onBrand} />
                            ) : (
                              <Ionicons name="add" size={16} color={colors.textMuted} />
                            )}
                          </View>
                        </Pressable>

                        {selected ? (
                          <View
                            style={{
                              marginHorizontal: theme.spacing.md,
                              marginBottom: theme.spacing.md,
                              paddingHorizontal: theme.spacing.md,
                              paddingVertical: theme.spacing.sm + 2,
                              borderRadius: theme.radius.md,
                              backgroundColor: colors.surface,
                              borderWidth: 1,
                              borderColor: colors.border,
                              flexDirection: isRTL ? 'row-reverse' : 'row',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: theme.spacing.sm,
                              ...orderBoardShadow(colorScheme),
                            }}
                          >
                            <View style={{ gap: 2, flex: 1 }}>
                              <AppText
                                variant="caption"
                                color="muted"
                                style={{ textAlign: isRTL ? 'right' : 'left' }}
                              >
                                {t('production.setup.materialQtyLabel')}
                              </AppText>
                              <View
                                style={{
                                  flexDirection: isRTL ? 'row-reverse' : 'row',
                                  alignItems: 'baseline',
                                  gap: 6,
                                }}
                              >
                                <AppText variant="heading" weight="semibold" dir="ltr">
                                  {mineQty}
                                </AppText>
                                <AppText variant="body" weight="medium" color="muted" dir="ltr">
                                  {line.unit?.trim() || 'pcs'}
                                </AppText>
                              </View>
                            </View>
                            <View
                              style={{
                                flexDirection: isRTL ? 'row-reverse' : 'row',
                                alignItems: 'center',
                                gap: theme.spacing.sm,
                                padding: 4,
                                borderRadius: theme.radius.full,
                                backgroundColor: colors.surfaceSecondary,
                                borderWidth: 1,
                                borderColor: colors.border,
                              }}
                            >
                              <AnimatedPressable
                                variant="button"
                                onPress={() =>
                                  bumpMaterialQty(line.sku, mineQty - step, remaining)
                                }
                                style={{
                                  width: 40,
                                  height: 40,
                                  borderRadius: 20,
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  backgroundColor: colors.surface,
                                  borderWidth: 1,
                                  borderColor: colors.borderStrong,
                                }}
                              >
                                <Ionicons name="remove" size={18} color={colors.textPrimary} />
                              </AnimatedPressable>
                              <AnimatedPressable
                                variant="button"
                                onPress={() =>
                                  bumpMaterialQty(line.sku, mineQty + step, remaining)
                                }
                                disabled={atMax}
                                style={{
                                  width: 40,
                                  height: 40,
                                  borderRadius: 20,
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  backgroundColor: atMax ? colors.surfaceSecondary : colors.brand,
                                  borderWidth: 1,
                                  borderColor: atMax ? colors.border : colors.brand,
                                  opacity: atMax ? 0.45 : 1,
                                }}
                              >
                                <Ionicons
                                  name="add"
                                  size={18}
                                  color={atMax ? colors.textMuted : colors.onBrand}
                                />
                              </AnimatedPressable>
                            </View>
                          </View>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              )
            ) : null}
          </View>
        </View>
        ) : null}

        {/* TAKES IN — Delivery: packages from Packaging; else SEMI / WIP */}
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
          <BoardSectionHeader
            icon="download-outline"
            title={t('production.setup.takesInTitle')}
            hint={
              isDelivery
                ? t('production.setup.deliveryTakesInHint')
                : isInspection
                  ? t('production.setup.inspectionTakesInHint')
                  : t('production.setup.takesInSemiOnlyHint')
            }
          />

          <View style={{ padding: theme.spacing.md, gap: theme.spacing.sm }}>
            {isDelivery ? (
              <View
                style={{
                  borderRadius: theme.radius.lg,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.surfaceSecondary,
                  padding: theme.spacing.md,
                  gap: theme.spacing.sm,
                }}
              >
                <View
                  style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    alignItems: 'center',
                    gap: theme.spacing.md,
                  }}
                >
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: colors.brandSoft,
                      borderWidth: 1,
                      borderColor: colors.brand,
                    }}
                  >
                    <Ionicons name="cube-outline" size={20} color={colors.brand} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <AppText
                      variant="body"
                      weight="semibold"
                      style={{ textAlign: isRTL ? 'right' : 'left' }}
                    >
                      {t('production.setup.deliveryPackagesTitle')}
                    </AppText>
                    <AppText
                      variant="caption"
                      color="muted"
                      style={{ textAlign: isRTL ? 'right' : 'left' }}
                    >
                      {packagingPackageCount != null && packagingPackageCount > 0
                        ? t('production.setup.deliveryPackagesCount', {
                            count: packagingPackageCount,
                          })
                        : t('production.setup.deliveryPackagesMissing')}
                    </AppText>
                  </View>
                </View>
                {packagingPackageLabels.length > 0 ? (
                  <View style={{ gap: theme.spacing.xs }}>
                    {packagingPackageLabels.map((row, i) => (
                      <AppText
                        key={`pack-label-${i}-${row.nameEn}`}
                        variant="caption"
                        weight="semibold"
                        style={{ textAlign: isRTL ? 'right' : 'left' }}
                      >
                        {t('production.setup.packPieceN', { n: String(i + 1) })}
                        {': '}
                        {localizedName(locale, row, row.nameEn)}
                      </AppText>
                    ))}
                  </View>
                ) : null}
                <AppText
                  variant="caption"
                  color="muted"
                  style={{ textAlign: isRTL ? 'right' : 'left' }}
                >
                  {t('production.setup.deliveryPackagesLoadHint')}
                </AppText>
              </View>
            ) : canTakeSemi ? (
              <>
                {isInspection || isPackaging ? (
                  <AppText
                    variant="caption"
                    color="muted"
                    style={{ textAlign: isRTL ? 'right' : 'left' }}
                  >
                    {isInspection
                      ? t('production.setup.inspectionTakesInHint')
                      : t('production.setup.packagingTakesInHint')}
                  </AppText>
                ) : (
                  <StageToggleRow
                    icon="git-branch-outline"
                    label={t('production.setup.takeSemi')}
                    hint={t('production.setup.takeSemiHint')}
                    value={effectiveConsumeSemi}
                    onChange={setConsumeSemi}
                  />
                )}

                {effectiveConsumeSemi || isInspection || isPackaging ? (
                  <View
                    style={{
                      borderRadius: theme.radius.lg,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.surfaceSecondary,
                      padding: theme.spacing.sm,
                      gap: theme.spacing.sm,
                    }}
                  >
                    <AppText
                      variant="caption"
                      weight="semibold"
                      style={{ textAlign: isRTL ? 'right' : 'left' }}
                    >
                      {t('production.setup.consumeInputs')}
                    </AppText>
                    <AppText
                      variant="caption"
                      color="muted"
                      style={{ textAlign: isRTL ? 'right' : 'left' }}
                    >
                      {t('production.setup.consumeInputsHint')}
                    </AppText>
                    {upstream.map((out) => {
                      const on = consumeIds.includes(out.id);
                      return (
                        <Pressable
                          key={out.id}
                          onPress={() => {
                            void haptics.selection();
                            setConsumeIds((ids) =>
                              on ? ids.filter((id) => id !== out.id) : [...ids, out.id],
                            );
                          }}
                          style={{
                            flexDirection: isRTL ? 'row-reverse' : 'row',
                            alignItems: 'center',
                            gap: theme.spacing.md,
                            minHeight: 56,
                            padding: theme.spacing.sm,
                            borderRadius: theme.radius.lg,
                            borderWidth: 1.5,
                            borderColor: on ? colors.brand : colors.border,
                            backgroundColor: on ? colors.brandSoft : colors.surface,
                          }}
                        >
                          <View
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: 20,
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: colors.surfaceSecondary,
                              borderWidth: 1,
                              borderColor: colors.border,
                            }}
                          >
                            <Ionicons name="layers-outline" size={18} color={colors.brand} />
                          </View>
                          <AppText
                            variant="body"
                            weight="semibold"
                            style={{ flex: 1, textAlign: isRTL ? 'right' : 'left' }}
                            numberOfLines={2}
                          >
                            {localizedName(locale, out)}
                          </AppText>
                          <View
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 14,
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: on ? colors.brand : colors.surfaceSecondary,
                              borderWidth: 1,
                              borderColor: on ? colors.brand : colors.border,
                            }}
                          >
                            {on ? (
                              <Ionicons name="checkmark" size={16} color={colors.onBrand} />
                            ) : null}
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : null}
              </>
            ) : (
              <View
                style={{
                  borderRadius: theme.radius.lg,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.surfaceSecondary,
                  padding: theme.spacing.md,
                  gap: 4,
                }}
              >
                <AppText
                  variant="caption"
                  weight="semibold"
                  style={{ textAlign: isRTL ? 'right' : 'left' }}
                >
                  {earlierSemiProducersExist
                    ? t('production.setup.takeSemiAllClaimedTitle')
                    : t('production.setup.takeSemiUnavailableTitle')}
                </AppText>
                <AppText
                  variant="caption"
                  color="muted"
                  style={{ textAlign: isRTL ? 'right' : 'left' }}
                >
                  {earlierSemiProducersExist
                    ? t('production.setup.takeSemiAllClaimedHint')
                    : t('production.setup.takeSemiUnavailableHint')}
                </AppText>
              </View>
            )}
          </View>
        </View>

        {/* MAKES — same board language as Takes in */}
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
          <BoardSectionHeader
            icon="construct-outline"
            title={t('production.setup.makesTitle')}
            hint={
              isInspection
                ? t('production.setup.inspectionMakesHint')
                : isDelivery
                  ? t('production.setup.deliveryMakesHint')
                  : isPackaging
                    ? t('production.setup.packagingMakesHint')
                    : t('production.setup.makesHint')
            }
          />

          <View style={{ padding: theme.spacing.md, gap: theme.spacing.sm }}>
            {lockMakesNothing ? (
              <ChoiceCard
                active
                icon="shield-checkmark-outline"
                title={
                  isInspection
                    ? t('production.setup.inspectionConfirmOnly')
                    : t('production.setup.deliveryConfirmOnly')
                }
                hint={
                  isInspection
                    ? t('production.setup.inspectionConfirmOnlyHint')
                    : t('production.setup.deliveryConfirmOnlyHint')
                }
                onPress={() => setProduce('none')}
              />
            ) : (
              <>
                {!isPackaging ? (
                  <ChoiceCard
                    active={produce === 'none'}
                    icon="remove-circle-outline"
                    title={t('production.setup.makeNothing')}
                    hint={t('production.setup.makeNothingHint')}
                    onPress={() => setProduce('none')}
                  />
                ) : null}
                {!isPackaging ? (
                  <ChoiceCard
                    active={produce === 'semi'}
                    icon="layers-outline"
                    title={t('production.setup.makeSemi')}
                    hint={t('production.setup.makeSemiHint')}
                    onPress={() => setProduce('semi')}
                  />
                ) : null}
                {isPackaging ? (
                  <ChoiceCard
                    active={produce === 'finished'}
                    icon="cube"
                    title={t('production.setup.makeFinished')}
                    hint={t('production.setup.makeFinishedHint')}
                    onPress={() => setProduce('finished')}
                  />
                ) : null}
              </>
            )}

            {!lockMakesNothing && produce === 'semi' ? (
              <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.xs }}>
                <View
                  style={{
                    borderRadius: theme.radius.lg,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.surfaceSecondary,
                    padding: theme.spacing.md,
                    gap: theme.spacing.md,
                  }}
                >
                  <AppText
                    variant="label"
                    weight="semibold"
                    style={{ textAlign: isRTL ? 'right' : 'left' }}
                  >
                    {t('production.setup.semiOutputTitle')}
                  </AppText>
                  <AppText
                    variant="caption"
                    color="muted"
                    style={{ textAlign: isRTL ? 'right' : 'left' }}
                  >
                    {t('production.setup.kitNameHint')}
                  </AppText>
                  <TextField
                    label={t('production.setup.outputNameEn')}
                    value={nameEn}
                    onChangeText={setNameEn}
                  />
                  <TextField
                    label={t('production.setup.outputNameAr')}
                    value={nameAr}
                    onChangeText={setNameAr}
                  />
                  <TextField
                    label={t('production.setup.outputNameHe')}
                    value={nameHe}
                    onChangeText={setNameHe}
                  />
                  <TextField
                    label={t('production.setup.outputQty')}
                    value={qty}
                    onChangeText={setQty}
                    keyboardType="decimal-pad"
                  />
                </View>

                <View
                  style={{
                    borderRadius: theme.radius.lg,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.surfaceSecondary,
                    padding: theme.spacing.md,
                    gap: theme.spacing.sm,
                  }}
                >
                  <AppText
                    variant="label"
                    weight="semibold"
                    style={{ textAlign: isRTL ? 'right' : 'left' }}
                  >
                    {t('production.setup.piecesTitle')}
                  </AppText>
                  <AppText
                    variant="caption"
                    color="muted"
                    style={{ textAlign: isRTL ? 'right' : 'left' }}
                  >
                    {t('production.setup.piecesHint')}
                  </AppText>
                  {pieces.map((piece, index) => (
                    <View
                      key={piece.key}
                      style={{
                        borderRadius: theme.radius.lg,
                        borderWidth: 1,
                        borderColor: colors.border,
                        backgroundColor: colors.surface,
                        padding: theme.spacing.sm,
                        gap: theme.spacing.sm,
                      }}
                    >
                      <View
                        style={{
                          flexDirection: isRTL ? 'row-reverse' : 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <AppText variant="caption" weight="semibold">
                          {t('production.setup.pieceN', { n: String(index + 1) })}
                        </AppText>
                        {pieces.length > 1 ? (
                          <Pressable
                            onPress={() => {
                              void haptics.selection();
                              setPieces((rows) => rows.filter((r) => r.key !== piece.key));
                            }}
                            hitSlop={8}
                          >
                            <AppText variant="caption" weight="semibold" color="brand">
                              {t('production.setup.removePiece')}
                            </AppText>
                          </Pressable>
                        ) : null}
                      </View>
                      <TextField
                        label={t('production.setup.pieceNameEn')}
                        value={piece.nameEn}
                        onChangeText={(v) =>
                          setPieces((rows) =>
                            rows.map((r) => (r.key === piece.key ? { ...r, nameEn: v } : r)),
                          )
                        }
                      />
                      <TextField
                        label={t('production.setup.pieceNameAr')}
                        value={piece.nameAr}
                        onChangeText={(v) =>
                          setPieces((rows) =>
                            rows.map((r) => (r.key === piece.key ? { ...r, nameAr: v } : r)),
                          )
                        }
                      />
                      <TextField
                        label={t('production.setup.pieceNameHe')}
                        value={piece.nameHe}
                        onChangeText={(v) =>
                          setPieces((rows) =>
                            rows.map((r) => (r.key === piece.key ? { ...r, nameHe: v } : r)),
                          )
                        }
                      />
                    </View>
                  ))}
                  <Pressable
                    onPress={() => {
                      void haptics.selection();
                      setPieces((rows) => [
                        ...rows,
                        { key: `p${Date.now()}`, nameEn: '', nameAr: '', nameHe: '' },
                      ]);
                    }}
                    style={{
                      minHeight: 44,
                      borderRadius: theme.radius.lg,
                      borderWidth: 1,
                      borderColor: colors.brand,
                      backgroundColor: colors.brandSoft,
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexDirection: isRTL ? 'row-reverse' : 'row',
                      gap: theme.spacing.xs,
                    }}
                  >
                    <Ionicons name="add" size={18} color={colors.brand} />
                    <AppText variant="body" weight="semibold" color="brand">
                      {t('production.setup.addPiece')}
                    </AppText>
                  </Pressable>
                </View>
              </View>
            ) : null}

            {!lockMakesNothing && produce === 'finished' ? (
              <View
                style={{
                  marginTop: theme.spacing.xs,
                  borderRadius: theme.radius.lg,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.surfaceSecondary,
                  padding: theme.spacing.md,
                  gap: theme.spacing.md,
                }}
              >
                <AppText
                  variant="label"
                  weight="semibold"
                  style={{ textAlign: isRTL ? 'right' : 'left' }}
                >
                  {t('production.setup.finishedOutputTitle')}
                </AppText>
                <AppText
                  variant="caption"
                  color="muted"
                  style={{ textAlign: isRTL ? 'right' : 'left' }}
                >
                  {t('production.setup.finishedUsesProductName')}
                </AppText>
                <View
                  style={{
                    borderRadius: theme.radius.lg,
                    borderWidth: 1,
                    borderColor: colors.borderStrong,
                    backgroundColor: colors.surface,
                    padding: theme.spacing.md,
                    gap: 4,
                  }}
                >
                  <AppText
                    variant="heading"
                    weight="semibold"
                    style={{ textAlign: isRTL ? 'right' : 'left' }}
                  >
                    {productLabel || '—'}
                  </AppText>
                </View>
                <PackPiecesStepper
                  value={packPieces}
                  onChange={(next) => {
                    setPackPieces(next);
                    const n = Math.max(1, Math.min(20, Math.floor(Number(next) || 1)));
                    setPieces((rows) => resizePieceDrafts(rows, n));
                  }}
                />
                <AppText
                  variant="caption"
                  color="muted"
                  style={{ textAlign: isRTL ? 'right' : 'left' }}
                >
                  {t('production.setup.packPieceNamesHint')}
                </AppText>
                {pieces.map((piece, index) => (
                  <View
                    key={piece.key}
                    style={{
                      borderRadius: theme.radius.lg,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.surface,
                      padding: theme.spacing.sm,
                      gap: theme.spacing.sm,
                    }}
                  >
                    <AppText variant="caption" weight="semibold">
                      {t('production.setup.packPieceN', { n: String(index + 1) })}
                    </AppText>
                    <TextField
                      label={t('production.setup.pieceNameEn')}
                      value={piece.nameEn}
                      onChangeText={(v) =>
                        setPieces((rows) =>
                          rows.map((r) => (r.key === piece.key ? { ...r, nameEn: v } : r)),
                        )
                      }
                      placeholder={t('production.setup.packPieceNamePlaceholder')}
                    />
                    <TextField
                      label={t('production.setup.pieceNameAr')}
                      value={piece.nameAr}
                      onChangeText={(v) =>
                        setPieces((rows) =>
                          rows.map((r) => (r.key === piece.key ? { ...r, nameAr: v } : r)),
                        )
                      }
                    />
                    <TextField
                      label={t('production.setup.pieceNameHe')}
                      value={piece.nameHe}
                      onChangeText={(v) =>
                        setPieces((rows) =>
                          rows.map((r) => (r.key === piece.key ? { ...r, nameHe: v } : r)),
                        )
                      }
                    />
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        </View>

        {makesSomething ? (
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
            <BoardSectionHeader
              icon="business-outline"
              title={t('production.setup.warehouseBoardTitle')}
              hint={t('production.setup.warehouseBoardHint')}
            />
            <View style={{ padding: theme.spacing.md, gap: theme.spacing.sm }}>
              <ChoiceCard
                active={!warehouseId}
                icon="flash-outline"
                title={t('production.setup.warehouseAutomatic')}
                hint={t('production.setup.warehouseAutomaticHint')}
                onPress={() => setWarehouseId('')}
              />
              <ScrollView
                nestedScrollEnabled
                style={{ maxHeight: 260 }}
                contentContainerStyle={{ gap: theme.spacing.sm }}
                keyboardShouldPersistTaps="handled"
              >
                {typedWarehouses.map((w) => (
                  <ChoiceCard
                    key={w.id}
                    active={warehouseId === w.id}
                    icon="home-outline"
                    title={`${localizedName(locale, w)}${w.isDefault ? ' ★' : ''}`}
                    hint={w.type.replace(/_/g, ' ')}
                    onPress={() => setWarehouseId(w.id)}
                  />
                ))}
              </ScrollView>
            </View>
          </View>
        ) : null}
        </ScrollView>

        <View
          style={{
            marginTop: theme.spacing.sm,
            borderRadius: 26,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor:
              colorScheme === 'dark' ? 'rgba(42,36,37,0.96)' : 'rgba(255,255,255,0.96)',
            padding: 6,
            ...orderBoardShadow(colorScheme),
          }}
        >
          <PrimaryButton
            label={t('mobile.production.workflow.setupSave')}
            onPress={() => {
              const mode = terminalSetupMode(stage.stageCode);
              const nextProduce = coerceSetupProduceKind(produce, stage.stageCode);
              const nextConsumeRaw = mode === 'inspection' || mode === 'delivery' ? false : consumeRaw;
              // Inspection / Packaging: when upstream SEMI exists, force take-in on.
              const forceSemi =
                mode === 'delivery'
                  ? false
                  : (mode === 'inspection' || mode === 'packaging') && canTakeSemi
                    ? true
                    : canTakeSemi && consumeSemi;
              const nextBehavior = deriveSetupBehavior({
                consumeRaw: nextConsumeRaw,
                consumeSemi: forceSemi,
                produce: nextProduce,
              });
              const packCount = Math.max(1, Math.floor(Number(packPieces) || 1));
              const pieceLabels =
                nextProduce === 'semi'
                  ? pieces
                      .filter((p) => p.nameEn.trim())
                      .map((p) => ({
                        nameEn: p.nameEn.trim(),
                        nameAr: p.nameAr.trim() || p.nameEn.trim(),
                        nameHe: p.nameHe.trim() || null,
                      }))
                  : nextProduce === 'finished'
                    ? pieces.slice(0, packCount).map((p) => ({
                        nameEn: p.nameEn.trim(),
                        nameAr: p.nameAr.trim() || p.nameEn.trim(),
                        nameHe: p.nameHe.trim() || null,
                      }))
                    : null;
              const namedPackLabels =
                nextProduce === 'finished'
                  ? (pieceLabels ?? []).filter((p) => p.nameEn)
                  : null;
              const effectivePackCount =
                nextProduce === 'finished'
                  ? Math.max(1, namedPackLabels?.length || packCount)
                  : packCount;
              const effectiveSemi = canTakeSemi && forceSemi;
              const selectedConsume = effectiveSemi ? consumeIds : [];
              const consumeOutputIds = selectedConsume.filter((id) => !id.startsWith('node:'));
              const consumeWorkflowNodeIds = selectedConsume
                .filter((id) => id.startsWith('node:'))
                .map((id) => id.slice('node:'.length));
              // Prefer node refs for live sibling drafts that also have a real output id.
              for (const row of upstream) {
                if (!selectedConsume.includes(row.id)) continue;
                if (row.workflowNodeId && !consumeWorkflowNodeIds.includes(row.workflowNodeId)) {
                  consumeWorkflowNodeIds.push(row.workflowNodeId);
                }
              }
              // Auto-select all upstream when Inspection/Packaging force SEMI and none picked.
              if (
                effectiveSemi &&
                consumeOutputIds.length === 0 &&
                consumeWorkflowNodeIds.length === 0 &&
                upstream.length
              ) {
                for (const row of upstream) {
                  if (row.workflowNodeId) consumeWorkflowNodeIds.push(row.workflowNodeId);
                  else consumeOutputIds.push(row.id);
                }
              }
              const claimedElsewhereSave = new Map<string, number>();
              for (const row of siblingMaterialClaims) {
                const sku = String(row.sku ?? '').trim();
                if (!sku) continue;
                claimedElsewhereSave.set(
                  sku,
                  (claimedElsewhereSave.get(sku) ?? 0) + (Number(row.qtyPerUnit) || 0),
                );
              }
              const safeMaterials =
                nextConsumeRaw
                  ? materialInputs
                      .map((row) => {
                        const bom = bomLines.find((l) => l.sku === row.sku);
                        const bomQty = Number(bom?.qty) || 0;
                        const others = claimedElsewhereSave.get(row.sku) ?? 0;
                        const max = Math.max(0, bomQty - others);
                        return {
                          ...row,
                          qtyPerUnit: Math.min(Math.max(0, Number(row.qtyPerUnit) || 0), max),
                        };
                      })
                      .filter((row) => row.qtyPerUnit > 0)
                  : [];
              onSave({
                ...stage,
                behavior: nextBehavior,
                consumesRawMaterials: nextConsumeRaw || nextBehavior === 'USES_MATERIALS',
                consumesSemiFinished: effectiveSemi,
                consumeOutputIds,
                consumeWorkflowNodeIds,
                materialInputs: safeMaterials,
                output: setupProduces(nextBehavior)
                  ? {
                      id: stage.output?.id ?? null,
                      nameEn:
                        nextProduce === 'finished'
                          ? product?.nameEn ?? nameEn
                          : nameEn,
                      nameAr:
                        nextProduce === 'finished'
                          ? product?.nameAr ?? nameAr
                          : nameAr,
                      nameHe:
                        nextProduce === 'finished'
                          ? product?.nameHe ?? nameHe
                          : nameHe,
                      qtyPerUnit: Number(qty) || 1,
                      expectedPieceCount:
                        nextProduce === 'finished'
                          ? effectivePackCount
                          : Math.max(1, pieceLabels?.length ?? 1),
                      pieceLabels:
                        nextProduce === 'finished' ? namedPackLabels : pieceLabels,
                      defaultWarehouseId: warehouseId || null,
                    }
                  : null,
              });
            }}
          />
        </View>
      </View>
    </BottomSheet>
  );
}
