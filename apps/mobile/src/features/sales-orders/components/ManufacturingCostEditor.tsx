import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  inventoryItemUnitCost,
  type InventoryCategoryGroup,
  type InventoryItem,
} from '@/api/modules/inventory';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { AppTextInput } from '@/components/forms/AppTextInput';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics, softFadeDown, useReducedMotion } from '@/motion';
import { useTheme } from '@/theme';
import Animated from 'react-native-reanimated';
import type { OrderCostMaterial } from '../selectOrderDetail';
import { MaterialPickerSheet } from './MaterialPickerSheet';
import { OrderBoardCard, OrderSectionHeader } from './OrderBoardCard';
import { orderBoardShadow } from './orderFloorStyle';

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

function accentFor(
  key: CostKey,
  colors: { brand: string; info: string; warning: string; success: string },
): string {
  if (key === 'fabric') return colors.brand;
  if (key === 'wood') return colors.warning;
  if (key === 'foam') return colors.info;
  return colors.success;
}

type Props = {
  edit: CostBreakdownEdit;
  onChange: (next: CostBreakdownEdit) => void;
  editable: boolean;
  formatCurrency: (n: number) => string;
};

/**
 * Compact manufacturing-cost stamp board — 2×2 category tiles; tap opens materials sheet.
 */
export function ManufacturingCostEditor({
  edit,
  onChange,
  editable,
  formatCurrency,
}: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const reduce = useReducedMotion();
  const [activeKey, setActiveKey] = useState<CostKey | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerFor, setPickerFor] = useState<CostKey>('fabric');
  const [lines, setLines] = useState<CostMaterialLine[]>([]);

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

  return (
    <OrderBoardCard accent={colors.brand} style={{ padding: 0, overflow: 'hidden' }}>
      <View
        style={{
          paddingHorizontal: theme.spacing.md,
          paddingTop: theme.spacing.md,
          paddingBottom: theme.spacing.sm,
          backgroundColor: colors.surfaceSecondary,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          gap: theme.spacing.sm,
        }}
      >
        <OrderSectionHeader
          icon="hammer-outline"
          label={t('mobile.orderDetail.manufacturingCost')}
          accent={colors.brand}
        />
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: theme.spacing.md,
          }}
        >
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="caption" color="muted">
              {(() => {
                const v = t('sales.fromInventoryCosts');
                return v === 'sales.fromInventoryCosts'
                  ? 'Auto from inventory material prices'
                  : v;
              })()}
            </AppText>
            <AppText variant="heading" weight="semibold" color="brand" dir="ltr">
              {formatCurrency(total)}
            </AppText>
          </View>
          {editable ? (
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
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: theme.spacing.md,
                paddingVertical: 10,
                borderRadius: theme.radius.full,
                backgroundColor: colors.brandSoft,
                borderWidth: 1,
                borderColor: colors.brand,
              }}
            >
              <Ionicons name="add" size={16} color={colors.brand} />
              <AppText variant="label" weight="semibold" color="brand">
                {t('mobile.orderDetail.addMaterial')}
              </AppText>
            </AnimatedPressable>
          ) : null}
        </View>
      </View>

      <View
        style={{
          padding: theme.spacing.md,
          flexDirection: isRTL ? 'row-reverse' : 'row',
          flexWrap: 'wrap',
          gap: theme.spacing.sm,
        }}
      >
        {tiles.map((tile, index) => {
          const accent = accentFor(tile.key, colors);
          const hot = tile.cost > 0 || tile.qty > 0;
          const Tile = reduce || index > 3 ? View : Animated.View;
          const enter = reduce || index > 3 ? {} : { entering: softFadeDown(40 + index * 35) };
          return (
            <Tile key={tile.key} {...enter} style={{ width: '47%', flexGrow: 1, minWidth: 140 }}>
              <AnimatedPressable
                variant="card"
                accessibilityRole="button"
                accessibilityLabel={`${t(LABEL_KEY[tile.key])} ${formatCurrency(tile.cost)}`}
                onPress={() => {
                  void haptics.selection();
                  setActiveKey(tile.key);
                }}
                style={{
                  borderRadius: theme.radius.lg,
                  borderWidth: 1,
                  borderColor: hot ? accent : colors.borderStrong,
                  backgroundColor: colors.surface,
                  overflow: 'hidden',
                  minHeight: 104,
                  ...orderBoardShadow(colorScheme),
                }}
              >
                <View style={{ height: 4, backgroundColor: accent }} />
                <View style={{ padding: theme.spacing.md, gap: 8 }}>
                  <View
                    style={{
                      flexDirection: isRTL ? 'row-reverse' : 'row',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <View
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 9,
                        backgroundColor: hot ? `${accent}22` : colors.surfaceSecondary,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ionicons name={ICON[tile.key]} size={15} color={accent} />
                    </View>
                    <AppText
                      variant="caption"
                      weight={titleWeight}
                      style={{
                        flex: 1,
                        color: accent,
                        letterSpacing: locale === 'ar' ? 0 : 0.8,
                        textTransform: 'uppercase',
                      }}
                      numberOfLines={1}
                    >
                      {t(LABEL_KEY[tile.key])}
                    </AppText>
                    <Ionicons
                      name={isRTL ? 'chevron-back' : 'chevron-forward'}
                      size={14}
                      color={colors.textMuted}
                    />
                  </View>
                  <AppText variant="title" weight="semibold" dir="ltr" style={{ color: accent }}>
                    {formatCurrency(tile.cost)}
                  </AppText>
                  <View
                    style={{
                      flexDirection: isRTL ? 'row-reverse' : 'row',
                      gap: 6,
                      flexWrap: 'wrap',
                    }}
                  >
                    <MetaChip
                      label={`${t('mobile.orderDetail.qty')} ${tile.qty}`}
                      muted={!hot}
                    />
                    {tile.materialCount > 0 ? (
                      <MetaChip
                        label={t('mobile.orderDetail.materialLines', {
                          count: tile.materialCount,
                        })}
                        muted={false}
                      />
                    ) : null}
                  </View>
                </View>
              </AnimatedPressable>
            </Tile>
          );
        })}
      </View>

      {editable ? (
        <AppText
          variant="caption"
          color="muted"
          style={{
            paddingHorizontal: theme.spacing.md,
            paddingBottom: theme.spacing.md,
          }}
        >
          {t('mobile.orderDetail.materialsTapHint')}
        </AppText>
      ) : null}

      <BottomSheet
        open={activeKey != null}
        onClose={() => setActiveKey(null)}
        title={activeKey ? t(LABEL_KEY[activeKey]) : undefined}
        fitContent
        maxHeight={560}
      >
        {activeKey ? (
          <View style={{ gap: theme.spacing.md }}>
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                gap: theme.spacing.sm,
              }}
            >
              <FieldInline
                label={t('mobile.orderDetail.costAmount')}
                value={edit[`${activeKey}Cost` as keyof CostBreakdownEdit]}
                onChangeText={(v) => setField(activeKey, 'cost', v)}
                editable={editable}
                style={{ flex: 1.2 }}
              />
              <FieldInline
                label={t('mobile.orderDetail.qty')}
                value={edit[`${activeKey}Qty` as keyof CostBreakdownEdit]}
                onChangeText={(v) => setField(activeKey, 'qty', v)}
                editable={editable}
                style={{ flex: 0.8 }}
              />
            </View>

            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: theme.spacing.sm,
              }}
            >
              <AppText variant="label" weight="semibold">
                {t('mobile.orderDetail.chosenMaterials')}
              </AppText>
              {editable ? (
                <SecondaryButton
                  label={t('mobile.orderDetail.addMaterial')}
                  onPress={() => {
                    void haptics.selection();
                    setPickerFor(activeKey);
                    setPickerOpen(true);
                  }}
                  style={{ borderRadius: theme.radius.full }}
                />
              ) : null}
            </View>

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
                <AppText variant="bodySecondary" color="secondary">
                  {num(edit[`${activeKey}Cost` as keyof CostBreakdownEdit]) > 0
                    ? t('mobile.orderDetail.rollupOnlyHint')
                    : t('mobile.orderDetail.noMaterialsYet')}
                </AppText>
              </View>
            ) : (
              <View style={{ gap: theme.spacing.sm }}>
                {activeLines.map((line) => (
                  <View
                    key={line.id}
                    style={{
                      borderRadius: theme.radius.lg,
                      borderWidth: 1,
                      borderColor: colors.borderStrong,
                      backgroundColor: colors.surface,
                      padding: theme.spacing.md,
                      gap: 6,
                      ...orderBoardShadow(colorScheme),
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
                        <AppText variant="label" weight="semibold" numberOfLines={2}>
                          {line.name}
                        </AppText>
                        <AppText variant="caption" color="muted" dir="ltr">
                          {line.sku}
                        </AppText>
                      </View>
                      {editable ? (
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
                        {t('mobile.orderDetail.qty')} {line.qty} · {formatCurrency(line.unitCost)}
                      </AppText>
                      <AppText variant="label" weight="semibold" dir="ltr" color="brand">
                        {formatCurrency(line.lineCost)}
                      </AppText>
                    </View>
                  </View>
                ))}
              </View>
            )}

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

function MetaChip({ label, muted }: { label: string; muted: boolean }) {
  const { colors, theme } = useTheme();
  return (
    <View
      style={{
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: theme.radius.full,
        backgroundColor: muted ? colors.surfaceSecondary : colors.brandSoft,
        borderWidth: 1,
        borderColor: muted ? colors.border : colors.borderStrong,
      }}
    >
      <AppText
        variant="caption"
        style={{ color: muted ? colors.textMuted : colors.brand, fontSize: 11 }}
      >
        {label}
      </AppText>
    </View>
  );
}

function FieldInline({
  label,
  value,
  onChangeText,
  editable,
  style,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  editable: boolean;
  style?: object;
}) {
  const { colors, theme } = useTheme();
  const { isRTL } = useLocale();
  return (
    <View style={[{ gap: 4 }, style]}>
      <AppText variant="caption" color="muted">
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
            backgroundColor: colors.surfaceSecondary,
            textAlign: isRTL ? 'right' : 'left',
          }}
        />
      ) : (
        <AppText variant="label" weight="semibold" dir="ltr">
          {value}
        </AppText>
      )}
    </View>
  );
}
