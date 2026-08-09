import { useMemo, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import type { InventoryCategoryGroup, InventoryItem } from '@/api/modules/inventory';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { AnimatedPressable } from '@/motion';
import { useTheme } from '@/theme';
import type { OrderCostMaterial } from '../selectOrderDetail';
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

const KEYS = ['fabric', 'wood', 'foam', 'accessories'] as const;

const LABEL_KEY: Record<(typeof KEYS)[number], string> = {
  fabric: 'mobile.orderDetail.fabricCost',
  wood: 'mobile.orderDetail.woodCost',
  foam: 'mobile.orderDetail.foamCost',
  accessories: 'mobile.orderDetail.accessoriesCost',
};

/** How many material rows stay visible before the list scrolls. */
const VISIBLE_MATERIAL_ROWS = 2.5;
const EDITABLE_ROW_ESTIMATE = 118;
const READONLY_ROW_ESTIMATE = 72;

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

export function costEditFromMaterials(
  materials: OrderCostMaterial[],
): CostBreakdownEdit {
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

function categoryToKey(item: InventoryItem): (typeof KEYS)[number] {
  const raw = (item.category || item.materialType || '').toUpperCase();
  if (raw.includes('FABRIC') || raw.includes('FAB')) return 'fabric';
  if (raw.includes('WOOD') || raw.includes('TIMBER')) return 'wood';
  if (raw.includes('FOAM')) return 'foam';
  return 'accessories';
}

/** Map inventory category group → cost bucket. */
export function inventoryGroupToCostKey(
  group: InventoryCategoryGroup | string,
): (typeof KEYS)[number] {
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
};

export function ManufacturingCostEditor({
  edit,
  onChange,
  editable,
  formatCurrency,
}: Props) {
  const { t, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const [pickerOpen, setPickerOpen] = useState(false);

  const total = totalFromCostEdit(edit);

  const rows = useMemo(
    () =>
      KEYS.map((key) => ({
        key,
        qty: edit[`${key}Qty` as keyof CostBreakdownEdit],
        cost: edit[`${key}Cost` as keyof CostBreakdownEdit],
      })),
    [edit],
  );

  const listMaxHeight =
    VISIBLE_MATERIAL_ROWS *
      (editable ? EDITABLE_ROW_ESTIMATE : READONLY_ROW_ESTIMATE) +
    theme.spacing.sm * Math.ceil(VISIBLE_MATERIAL_ROWS);

  function setField(key: (typeof KEYS)[number], field: 'qty' | 'cost', value: string) {
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
      inventoryGroupToCostKey(payload.categoryGroup) ||
      categoryToKey(payload.item);
    const unit = Number(payload.item.standardCost ?? 0) || 0;
    const addCost = payload.qty * unit;
    const qtyKey = `${key}Qty` as keyof CostBreakdownEdit;
    const costKey = `${key}Cost` as keyof CostBreakdownEdit;
    onChange({
      ...edit,
      [qtyKey]: String(num(edit[qtyKey]) + payload.qty),
      [costKey]: String(Number((num(edit[costKey]) + addCost).toFixed(2))),
    });
  }

  return (
    <OrderBoardCard accent={colors.brand}>
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
              onPress={() => setPickerOpen(true)}
              style={{
                paddingHorizontal: theme.spacing.md,
                paddingVertical: theme.spacing.sm,
                borderRadius: theme.radius.lg,
                backgroundColor: colors.brandSoft,
                borderWidth: 1,
                borderColor: colors.brand,
                minHeight: theme.sizes.touch.min,
                justifyContent: 'center',
              }}
            >
              <AppText variant="label" weight="semibold" color="brand">
                {t('mobile.orderDetail.addMaterial')}
              </AppText>
            </AnimatedPressable>
          ) : undefined
        }
      />

      <AppText variant="caption" color="muted">
        {(() => {
          const v = t('sales.fromInventoryCosts');
          return v === 'sales.fromInventoryCosts'
            ? 'Auto from inventory material prices'
            : v;
        })()}
      </AppText>

      <AppText variant="title" weight="semibold" dir="ltr">
        {formatCurrency(total)}
      </AppText>

      <ScrollView
        nestedScrollEnabled
        showsVerticalScrollIndicator
        keyboardShouldPersistTaps="handled"
        style={{ maxHeight: listMaxHeight }}
        contentContainerStyle={{ gap: theme.spacing.sm, paddingBottom: 2 }}
      >
        {rows.map((row) => (
          <View
            key={row.key}
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: theme.radius.lg,
              padding: theme.spacing.md,
              gap: theme.spacing.sm,
              backgroundColor: colors.surfaceSecondary,
            }}
          >
            <AppText variant="caption" color="muted" style={{ textTransform: 'uppercase', letterSpacing: 0.4, fontSize: 11 }}>
              {t(LABEL_KEY[row.key])}
            </AppText>
            {editable ? (
              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  gap: theme.spacing.sm,
                }}
              >
                <FieldInline
                  label={t('mobile.orderDetail.costAmount')}
                  value={row.cost}
                  onChangeText={(v) => setField(row.key, 'cost', v)}
                  style={{ flex: 1.2 }}
                />
                <FieldInline
                  label={t('mobile.orderDetail.qty')}
                  value={row.qty}
                  onChangeText={(v) => setField(row.key, 'qty', v)}
                  style={{ flex: 0.8 }}
                />
              </View>
            ) : (
              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: theme.spacing.sm,
                }}
              >
                <AppText variant="label" weight="semibold" dir="ltr">
                  {formatCurrency(num(row.cost))}
                </AppText>
                <AppText variant="caption" color="muted">
                  {t('mobile.orderDetail.qty')} {row.qty}
                </AppText>
              </View>
            )}
          </View>
        ))}
      </ScrollView>

      {editable ? (
        <AppText variant="caption" color="muted">
          {t('mobile.orderDetail.materialsEditHint')}
        </AppText>
      ) : null}

      <MaterialPickerSheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={applyPicked}
        formatCurrency={formatCurrency}
      />
    </OrderBoardCard>
  );
}

function FieldInline({
  label,
  value,
  onChangeText,
  style,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  style?: object;
}) {
  const { colors, theme } = useTheme();
  const { isRTL } = useLocale();
  return (
    <View style={[{ gap: 2 }, style]}>
      <AppText variant="caption" color="muted">
        {label}
      </AppText>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType="decimal-pad"
        placeholderTextColor={colors.textMuted}
        style={{
          minHeight: 40,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: theme.radius.sm,
          paddingHorizontal: theme.spacing.sm,
          color: colors.textPrimary,
          backgroundColor: colors.surface,
          textAlign: isRTL ? 'right' : 'left',
        }}
      />
    </View>
  );
}
