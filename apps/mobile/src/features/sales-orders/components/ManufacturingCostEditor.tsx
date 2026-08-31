import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  inventoryItemUnitCost,
  type InventoryCategoryGroup,
  type InventoryItem,
} from '@/api/modules/inventory';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { AppTextInput } from '@/components/forms/AppTextInput';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics, softFadeDown, useReducedMotion } from '@/motion';
import { useTheme } from '@/theme';
import Animated from 'react-native-reanimated';
import type { OrderCostMaterial, OrderCostMaterialLine } from '../selectOrderDetail';
import { MaterialPickerSheet } from './MaterialPickerSheet';
import { OrderBoardCard, OrderSectionHeader } from './OrderBoardCard';

export type CostBreakdownEdit = {
  fabricQty: string;
  fabricCost: string;
  woodQty: string;
  woodCost: string;
  foamQty: string;
  foamCost: string;
  accessoriesQty: string;
  accessoriesCost: string;
};

export type CostMaterialLine = {
  id: string;
  inventoryItemId: string;
  sku: string;
  name: string;
  category: CostKey;
  qty: number;
  unitCost: number;
  lineCost: number;
};

export type CostKey = 'fabric' | 'wood' | 'foam' | 'accessories';

const KEYS: CostKey[] = ['fabric', 'wood', 'foam', 'accessories'];

const LABEL_KEY: Record<CostKey, string> = {
  fabric: 'mobile.orderDetail.fabricCost',
  wood: 'mobile.orderDetail.woodCost',
  foam: 'mobile.orderDetail.foamCost',
  accessories: 'mobile.orderDetail.accessoriesCost',
};

const ICON: Record<CostKey, keyof typeof Ionicons.glyphMap> = {
  fabric: 'color-palette-outline',
  wood: 'leaf-outline',
  foam: 'layers-outline',
  accessories: 'construct-outline',
};

function num(s: string): number {
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

export function emptyCostBreakdownEdit(): CostBreakdownEdit {
  return {
    fabricQty: '0',
    fabricCost: '0',
    woodQty: '0',
    woodCost: '0',
    foamQty: '0',
    foamCost: '0',
    accessoriesQty: '0',
    accessoriesCost: '0',
  };
}

export function costEditFromMaterials(materials: OrderCostMaterial[]): CostBreakdownEdit {
  const base = emptyCostBreakdownEdit();
  for (const m of materials) {
    if (m.key === 'fabric') {
      base.fabricQty = String(m.qty ?? 0);
      base.fabricCost = String(m.cost ?? 0);
    } else if (m.key === 'wood') {
      base.woodQty = String(m.qty ?? 0);
      base.woodCost = String(m.cost ?? 0);
    } else if (m.key === 'foam') {
      base.foamQty = String(m.qty ?? 0);
      base.foamCost = String(m.cost ?? 0);
    } else if (m.key === 'accessories') {
      base.accessoriesQty = String(m.qty ?? 0);
      base.accessoriesCost = String(m.cost ?? 0);
    }
  }
  return base;
}

export function totalFromCostEdit(edit: CostBreakdownEdit): number {
  return (
    num(edit.fabricCost) +
    num(edit.woodCost) +
    num(edit.foamCost) +
    num(edit.accessoriesCost)
  );
}

export function costEditToPayload(edit: CostBreakdownEdit): {
  manufacturingCost: number;
  costBreakdown: Record<string, number>;
} {
  const costBreakdown = {
    fabricQty: num(edit.fabricQty),
    fabricCost: num(edit.fabricCost),
    woodQty: num(edit.woodQty),
    woodCost: num(edit.woodCost),
    foamQty: num(edit.foamQty),
    foamCost: num(edit.foamCost),
    accessoriesQty: num(edit.accessoriesQty),
    accessoriesCost: num(edit.accessoriesCost),
  };
  return {
    manufacturingCost: totalFromCostEdit(edit),
    costBreakdown,
  };
}

export function seedLinesFromOrder(
  seed: OrderCostMaterialLine[] | null | undefined,
): CostMaterialLine[] {
  if (!seed?.length) return [];
  return seed.map((line, index) => ({
    id: `seed-${line.category}-${line.sku}-${index}`,
    inventoryItemId: line.inventoryItemId ?? '',
    sku: line.sku,
    name: line.name || line.sku,
    category: line.category,
    qty: line.qty,
    unitCost: line.unitCost,
    lineCost: line.lineCost,
  }));
}

function categoryToKey(item: InventoryItem): CostKey {
  const raw = (item.category || item.materialType || '').toUpperCase();
  if (raw.includes('FABRIC') || raw.includes('FAB')) return 'fabric';
  if (raw.includes('WOOD') || raw.includes('TIMBER')) return 'wood';
  if (raw.includes('FOAM')) return 'foam';
  return 'accessories';
}

/** Map inventory category group → cost bucket. */
export function inventoryGroupToCostKey(
  group: InventoryCategoryGroup | string,
): CostKey {
  if (group === 'fabric') return 'fabric';
  if (group === 'wood') return 'wood';
  if (group === 'foam') return 'foam';
  return 'accessories';
}

type Props = {
  edit: CostBreakdownEdit;
  onChange: (next: CostBreakdownEdit) => void;
  editable: boolean;
  formatCurrency: (n: number) => string;
  /** Plan / catalog BOM lines — hydrates “Chosen materials”. */
  seedLines?: OrderCostMaterialLine[] | null;
};

/**
 * Manufacturing cost board — hero total + inset category ledger (floor aesthetic).
 */
export function ManufacturingCostEditor({
  edit,
  onChange,
  editable,
  formatCurrency,
  seedLines,
}: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const reduce = useReducedMotion();
  const [activeKey, setActiveKey] = useState<CostKey | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerFor, setPickerFor] = useState<CostKey>('fabric');
  const [lines, setLines] = useState<CostMaterialLine[]>(() => seedLinesFromOrder(seedLines));
  const [localOnly, setLocalOnly] = useState(false);

  const seedKey = useMemo(
    () =>
      (seedLines ?? [])
        .map((l) => `${l.category}:${l.sku}:${l.qty}:${l.lineCost}`)
        .join('|'),
    [seedLines],
  );

  useEffect(() => {
    if (localOnly) return;
    setLines(seedLinesFromOrder(seedLines));
  }, [seedKey, localOnly, seedLines]);

  const total = totalFromCostEdit(edit);
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  const tiles = useMemo(
    () =>
      KEYS.map((key) => {
        const qty = num(edit[`${key}Qty` as keyof CostBreakdownEdit]);
        const cost = num(edit[`${key}Cost` as keyof CostBreakdownEdit]);
        const materialCount = lines.filter((l) => l.category === key).length;
        return { key, qty, cost, materialCount };
      }),
    [edit, lines],
  );

  function setField(key: CostKey, field: 'qty' | 'cost', value: string) {
    const qtyKey = `${key}Qty` as keyof CostBreakdownEdit;
    const costKey = `${key}Cost` as keyof CostBreakdownEdit;
    onChange({
      ...edit,
      [field === 'qty' ? qtyKey : costKey]: value,
    });
  }

  function applyPicked(payload: {
    item: InventoryItem;
    categoryGroup: InventoryCategoryGroup;
    qty: number;
  }) {
    setLocalOnly(true);
    const key =
      inventoryGroupToCostKey(payload.categoryGroup) || categoryToKey(payload.item);
    const unit = inventoryItemUnitCost(payload.item);
    const addCost = Number((payload.qty * unit).toFixed(2));
    const qtyKey = `${key}Qty` as keyof CostBreakdownEdit;
    const costKey = `${key}Cost` as keyof CostBreakdownEdit;
    onChange({
      ...edit,
      [qtyKey]: String(num(edit[qtyKey]) + payload.qty),
      [costKey]: String(Number((num(edit[costKey]) + addCost).toFixed(2))),
    });
    const name =
      payload.item.nameEn ||
      payload.item.nameAr ||
      payload.item.nameHe ||
      payload.item.sku ||
      'Material';
    setLines((prev) => [
      ...prev,
      {
        id: `${payload.item.id}-${Date.now()}`,
        inventoryItemId: payload.item.id,
        sku: payload.item.sku,
        name,
        category: key,
        qty: payload.qty,
        unitCost: unit,
        lineCost: addCost,
      },
    ]);
  }

  function removeLine(lineId: string) {
    const line = lines.find((l) => l.id === lineId);
    if (!line) return;
    setLocalOnly(true);
    const qtyKey = `${line.category}Qty` as keyof CostBreakdownEdit;
    const costKey = `${line.category}Cost` as keyof CostBreakdownEdit;
    onChange({
      ...edit,
      [qtyKey]: String(Math.max(0, num(edit[qtyKey]) - line.qty)),
      [costKey]: String(Math.max(0, Number((num(edit[costKey]) - line.lineCost).toFixed(2)))),
    });
    setLines((prev) => prev.filter((l) => l.id !== lineId));
  }

  const activeLines = activeKey ? lines.filter((l) => l.category === activeKey) : [];
  const activeCost = activeKey
    ? num(edit[`${activeKey}Cost` as keyof CostBreakdownEdit])
    : 0;
  const activeQty = activeKey
    ? num(edit[`${activeKey}Qty` as keyof CostBreakdownEdit])
    : 0;

  return (
    <OrderBoardCard
      header={
        <OrderSectionHeader
          icon="hammer-outline"
          label={t('mobile.orderDetail.manufacturingCost')}
          accent={colors.brand}
          trailing={
            editable ? (
              <AnimatedPressable
                variant="button"
                accessibilityRole="button"
                accessibilityLabel={t('mobile.orderDetail.addMaterial')}
                onPress={() => {
                  void haptics.selection();
                  setPickerFor('fabric');
                  setPickerOpen(true);
                }}
                style={{
                  minHeight: 36,
                  paddingHorizontal: theme.spacing.md,
                  borderRadius: theme.radius.lg,
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.brand,
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Ionicons name="add" size={16} color={colors.brand} />
                <AppText variant="caption" weight={titleWeight} color="brand">
                  {t('mobile.orderDetail.addMaterial')}
                </AppText>
              </AnimatedPressable>
            ) : null
          }
        />
      }
    >
      <AppText variant="caption" color="muted" style={{ textAlign: isRTL ? 'right' : 'left' }}>
        {(() => {
          const v = t('sales.fromInventoryCosts');
          return v === 'sales.fromInventoryCosts'
            ? 'Auto from inventory material prices'
            : v;
        })()}
      </AppText>

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
        <AppText variant="caption" color="muted" style={{ textAlign: isRTL ? 'right' : 'left' }}>
          {t('mobile.orderDetail.manufacturingCostTotal')}
        </AppText>
        <AppText
          variant="heading"
          weight={titleWeight}
          color="brand"
          dir="ltr"
          style={{ textAlign: isRTL ? 'right' : 'left' }}
        >
          {formatCurrency(total)}
        </AppText>
      </View>

      <View
        style={{
          borderRadius: theme.radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surfaceSecondary,
          overflow: 'hidden',
        }}
      >
        {tiles.map((tile, index) => {
          const last = index === tiles.length - 1;
          const TileWrap = reduce || index > 3 ? View : Animated.View;
          const enter = reduce || index > 3 ? {} : { entering: softFadeDown(40 + index * 35) };
          return (
            <TileWrap key={tile.key} {...enter}>
              <AnimatedPressable
                variant="button"
                accessibilityRole="button"
                accessibilityLabel={`${t(LABEL_KEY[tile.key])} ${formatCurrency(tile.cost)}`}
                onPress={() => {
                  void haptics.selection();
                  setActiveKey(tile.key);
                }}
                style={{
                  minHeight: theme.sizes.touch.min,
                  paddingHorizontal: theme.spacing.md,
                  paddingVertical: theme.spacing.sm + 2,
                  borderBottomWidth: last ? 0 : 1,
                  borderBottomColor: colors.border,
                  gap: 6,
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
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: colors.surface,
                      borderWidth: 1,
                      borderColor: colors.borderStrong,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name={ICON[tile.key]} size={16} color={colors.brand} />
                  </View>
                  <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
                    <AppText
                      variant="label"
                      weight={titleWeight}
                      style={{ textAlign: isRTL ? 'right' : 'left' }}
                      numberOfLines={1}
                    >
                      {t(LABEL_KEY[tile.key])}
                    </AppText>
                    <AppText
                      variant="caption"
                      color="muted"
                      style={{ textAlign: isRTL ? 'right' : 'left' }}
                    >
                      {tile.materialCount > 0
                        ? t('mobile.orderDetail.materialLines', {
                            count: tile.materialCount,
                          })
                        : `${t('mobile.orderDetail.qty')} ${tile.qty}`}
                    </AppText>
                  </View>
                  <AppText
                    variant="label"
                    weight={titleWeight}
                    dir="ltr"
                    style={{ fontVariant: ['tabular-nums'] }}
                  >
                    {formatCurrency(tile.cost)}
                  </AppText>
                  <Ionicons
                    name={isRTL ? 'chevron-back' : 'chevron-forward'}
                    size={16}
                    color={colors.textMuted}
                  />
                </View>
              </AnimatedPressable>
            </TileWrap>
          );
        })}
      </View>

      {editable ? (
        <AppText variant="caption" color="muted" style={{ textAlign: isRTL ? 'right' : 'left' }}>
          {t('mobile.orderDetail.materialsTapHint')}
        </AppText>
      ) : null}

      <BottomSheet
        open={activeKey != null}
        onClose={() => setActiveKey(null)}
        title={activeKey ? t(LABEL_KEY[activeKey]) : undefined}
        fitContent
        maxHeight={620}
      >
        {activeKey ? (
          <View style={{ gap: theme.spacing.md }}>
            <OrderBoardCard
              header={
                <OrderSectionHeader
                  icon={ICON[activeKey]}
                  label={t(LABEL_KEY[activeKey])}
                  accent={colors.brand}
                />
              }
            >
              <View
                style={{
                  borderRadius: theme.radius.lg,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.surfaceSecondary,
                  overflow: 'hidden',
                }}
              >
                <MetaMoneyRow
                  label={t('mobile.orderDetail.costAmount')}
                  value={
                    editable
                      ? edit[`${activeKey}Cost` as keyof CostBreakdownEdit]
                      : formatCurrency(activeCost)
                  }
                  editable={editable}
                  onChangeText={(v) => setField(activeKey, 'cost', v)}
                  titleWeight={titleWeight}
                />
                <MetaMoneyRow
                  label={t('mobile.orderDetail.qty')}
                  value={String(activeQty)}
                  editable={editable}
                  onChangeText={(v) => setField(activeKey, 'qty', v)}
                  titleWeight={titleWeight}
                  last
                />
              </View>
            </OrderBoardCard>

            <OrderBoardCard
              header={
                <OrderSectionHeader
                  icon="cube-outline"
                  label={t('mobile.orderDetail.chosenMaterials')}
                  trailing={
                    editable ? (
                      <AnimatedPressable
                        variant="button"
                        accessibilityRole="button"
                        accessibilityLabel={t('mobile.orderDetail.addMaterial')}
                        onPress={() => {
                          void haptics.selection();
                          setPickerFor(activeKey);
                          setPickerOpen(true);
                        }}
                        style={{
                          minHeight: 36,
                          paddingHorizontal: theme.spacing.md,
                          borderRadius: theme.radius.lg,
                          backgroundColor: colors.surface,
                          borderWidth: 1,
                          borderColor: colors.brand,
                          flexDirection: isRTL ? 'row-reverse' : 'row',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <Ionicons name="add" size={16} color={colors.brand} />
                        <AppText variant="caption" weight={titleWeight} color="brand">
                          {t('mobile.orderDetail.addMaterial')}
                        </AppText>
                      </AnimatedPressable>
                    ) : null
                  }
                />
              }
            >
              {activeLines.length === 0 ? (
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
                    variant="bodySecondary"
                    color="secondary"
                    style={{ textAlign: isRTL ? 'right' : 'left' }}
                  >
                    {activeCost > 0
                      ? t('mobile.orderDetail.rollupOnlyHint')
                      : t('mobile.orderDetail.noMaterialsYet')}
                  </AppText>
                </View>
              ) : (
                <View
                  style={{
                    borderRadius: theme.radius.lg,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.surfaceSecondary,
                    overflow: 'hidden',
                  }}
                >
                  {activeLines.map((line, index) => {
                    const last = index === activeLines.length - 1;
                    return (
                      <View
                        key={line.id}
                        style={{
                          paddingHorizontal: theme.spacing.md,
                          paddingVertical: theme.spacing.sm + 2,
                          borderBottomWidth: last ? 0 : 1,
                          borderBottomColor: colors.border,
                          gap: 6,
                        }}
                      >
                        <View
                          style={{
                            flexDirection: isRTL ? 'row-reverse' : 'row',
                            alignItems: 'flex-start',
                            gap: theme.spacing.sm,
                          }}
                        >
                          <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
                            <AppText
                              variant="label"
                              weight={titleWeight}
                              numberOfLines={2}
                              style={{ textAlign: isRTL ? 'right' : 'left' }}
                            >
                              {line.name}
                            </AppText>
                            <AppText variant="caption" color="muted" dir="ltr">
                              {line.sku}
                            </AppText>
                          </View>
                          {editable && !line.id.startsWith('seed-') ? (
                            <AnimatedPressable
                              variant="button"
                              accessibilityRole="button"
                              accessibilityLabel={t('common.delete')}
                              onPress={() => {
                                void haptics.selection();
                                removeLine(line.id);
                              }}
                              style={{ padding: 4 }}
                            >
                              <Ionicons name="trash-outline" size={18} color={colors.error} />
                            </AnimatedPressable>
                          ) : null}
                        </View>
                        <View
                          style={{
                            flexDirection: isRTL ? 'row-reverse' : 'row',
                            justifyContent: 'space-between',
                            gap: theme.spacing.sm,
                          }}
                        >
                          <AppText variant="caption" color="secondary">
                            {t('mobile.orderDetail.qty')} {line.qty} ·{' '}
                            {formatCurrency(line.unitCost)}
                          </AppText>
                          <AppText
                            variant="label"
                            weight={titleWeight}
                            dir="ltr"
                            color="brand"
                            style={{ fontVariant: ['tabular-nums'] }}
                          >
                            {formatCurrency(line.lineCost)}
                          </AppText>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </OrderBoardCard>

            <PrimaryButton
              label={t('mobile.orderDetail.categoryDone')}
              onPress={() => setActiveKey(null)}
              style={{ borderRadius: theme.radius.xl }}
            />
          </View>
        ) : null}
      </BottomSheet>

      <MaterialPickerSheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={(picked) => {
          applyPicked(picked);
          setPickerOpen(false);
        }}
        formatCurrency={formatCurrency}
        overlay={activeKey != null}
        initialCategory={pickerFor}
      />
    </OrderBoardCard>
  );
}

function MetaMoneyRow({
  label,
  value,
  editable,
  onChangeText,
  titleWeight,
  last,
}: {
  label: string;
  value: string;
  editable: boolean;
  onChangeText: (v: string) => void;
  titleWeight: 'medium' | 'semibold';
  last?: boolean;
}) {
  const { colors, theme } = useTheme();
  const { isRTL } = useLocale();
  return (
    <View
      style={{
        minHeight: theme.sizes.touch.min,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.border,
        gap: 4,
      }}
    >
      <AppText variant="caption" color="muted" style={{ textAlign: isRTL ? 'right' : 'left' }}>
        {label}
      </AppText>
      {editable ? (
        <AppTextInput
          value={value}
          onChangeText={onChangeText}
          keyboardType="decimal-pad"
          placeholderTextColor={colors.textMuted}
          style={{
            minHeight: 44,
            borderWidth: 1,
            borderColor: colors.borderStrong,
            borderRadius: theme.radius.md,
            paddingHorizontal: theme.spacing.md,
            color: colors.textPrimary,
            backgroundColor: colors.surface,
            textAlign: isRTL ? 'right' : 'left',
          }}
        />
      ) : (
        <AppText
          variant="label"
          weight={titleWeight}
          dir="ltr"
          style={{ textAlign: isRTL ? 'right' : 'left', fontVariant: ['tabular-nums'] }}
        >
          {value}
        </AppText>
      )}
    </View>
  );
}
