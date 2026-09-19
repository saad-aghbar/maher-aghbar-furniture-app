import { ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';

export type HoldingLocationOption = {
  id: string;
  warehouseId: string;
  code: string;
  name?: string | null;
  label: string;
  warehouseLabel: string;
};

type Props = {
  locations: HoldingLocationOption[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  canManage?: boolean;
  onAdd?: () => void;
  onEdit?: (row: HoldingLocationOption) => void;
  onRemove?: (row: HoldingLocationOption) => void;
  onAddWarehouse?: () => void;
  hasWarehouse?: boolean;
  listHeight?: number;
};

/**
 * Inventory holding bins — same WarehouseLocation rows the rest of stock uses.
 * Pick one; managers can add, edit, or remove from the box.
 */
export function HoldingLocationBox({
  locations,
  selectedId,
  onSelect,
  canManage = false,
  onAdd,
  onEdit,
  onRemove,
  onAddWarehouse,
  hasWarehouse = true,
  listHeight = 280,
}: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  return (
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
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          width: 3,
          backgroundColor: colors.brand,
          opacity: 0.55,
          ...(isRTL ? { right: 0 } : { left: 0 }),
        }}
      />
      <View
        style={{
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm + 2,
          ...(isRTL
            ? { paddingRight: theme.spacing.md + 4 }
            : { paddingLeft: theme.spacing.md + 4 }),
          backgroundColor: colors.surfaceSecondary,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
        }}
      >
        <Ionicons name="file-tray-outline" size={16} color={colors.brand} />
        <AppText
          variant="caption"
          weight={titleWeight}
          style={{
            flex: 1,
            color: colors.brand,
            textTransform: locale === 'ar' ? 'none' : 'uppercase',
            letterSpacing: locale === 'ar' ? 0 : 0.5,
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {t('mobile.purchasing.fabricHoldingLocation')}
        </AppText>
      </View>

      {!hasWarehouse ? (
        <View style={{ padding: theme.spacing.md, gap: theme.spacing.sm }}>
          <AppText variant="caption" color="muted" style={{ textAlign: isRTL ? 'right' : 'left' }}>
            {t('mobile.purchasing.fabricNeedWarehouse')}
          </AppText>
          {canManage && onAddWarehouse ? (
            <AddRow
              label={t('mobile.inventory.newWarehouse')}
              onPress={onAddWarehouse}
            />
          ) : null}
        </View>
      ) : locations.length === 0 ? (
        <View style={{ padding: theme.spacing.md, gap: theme.spacing.sm }}>
          <AppText variant="caption" color="muted" style={{ textAlign: isRTL ? 'right' : 'left' }}>
            {t('mobile.purchasing.fabricHoldingEmpty')}
          </AppText>
        </View>
      ) : (
        <ScrollView
          style={{ maxHeight: listHeight }}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingVertical: theme.spacing.xs }}
        >
          {locations.map((row) => {
            const active = selectedId === row.id;
            return (
              <View
                key={row.id}
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  minHeight: theme.sizes.touch.min,
                  paddingHorizontal: theme.spacing.sm,
                  ...(isRTL
                    ? { paddingRight: theme.spacing.md + 4 }
                    : { paddingLeft: theme.spacing.md + 4 }),
                  backgroundColor: active ? colors.brandSoft : 'transparent',
                  borderLeftWidth: active && !isRTL ? 3 : 0,
                  borderRightWidth: active && isRTL ? 3 : 0,
                  borderLeftColor: colors.brand,
                  borderRightColor: colors.brand,
                }}
              >
                <AnimatedPressable
                  variant="button"
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => {
                    void haptics.selection();
                    onSelect(row.id);
                  }}
                  style={{
                    flex: 1,
                    minHeight: theme.sizes.touch.min,
                    justifyContent: 'center',
                    paddingVertical: theme.spacing.sm,
                    gap: 2,
                  }}
                >
                  <AppText
                    weight={active ? titleWeight : 'regular'}
                    style={{ color: active ? colors.brand : colors.textPrimary, textAlign: isRTL ? 'right' : 'left' }}
                  >
                    {row.label}
                  </AppText>
                  <AppText variant="caption" color="muted" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {row.warehouseLabel}
                  </AppText>
                </AnimatedPressable>
                {canManage ? (
                  <View
                    style={{
                      flexDirection: isRTL ? 'row-reverse' : 'row',
                      gap: 2,
                    }}
                  >
                    <IconWell
                      name="create-outline"
                      label={t('mobile.purchasing.fabricHoldingEdit')}
                      onPress={() => onEdit?.(row)}
                    />
                    <IconWell
                      name="trash-outline"
                      label={t('mobile.purchasing.fabricHoldingRemove')}
                      onPress={() => onRemove?.(row)}
                    />
                  </View>
                ) : null}
              </View>
            );
          })}
        </ScrollView>
      )}

      {canManage && hasWarehouse && onAdd ? (
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: colors.border,
            padding: theme.spacing.sm,
            ...(isRTL
              ? { paddingRight: theme.spacing.sm + 4 }
              : { paddingLeft: theme.spacing.sm + 4 }),
          }}
        >
          <AddRow label={t('mobile.purchasing.fabricHoldingAdd')} onPress={onAdd} />
        </View>
      ) : null}
    </View>
  );
}

function AddRow({ label, onPress }: { label: string; onPress: () => void }) {
  const { isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  return (
    <AnimatedPressable
      variant="button"
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        void haptics.selection();
        onPress();
      }}
      style={{
        minHeight: theme.sizes.touch.min,
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: colors.brand,
        backgroundColor: colors.brandSoft,
        paddingHorizontal: theme.spacing.md,
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
      }}
    >
      <Ionicons name="add" size={18} color={colors.brand} />
      <AppText weight={titleWeight} style={{ color: colors.brand }}>
        {label}
      </AppText>
    </AnimatedPressable>
  );
}

function IconWell({
  name,
  label,
  onPress,
}: {
  name: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  const { colors, theme } = useTheme();
  return (
    <AnimatedPressable
      variant="button"
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        void haptics.selection();
        onPress();
      }}
      style={{
        width: theme.sizes.touch.min,
        height: theme.sizes.touch.min,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Ionicons name={name} size={18} color={colors.brand} />
    </AnimatedPressable>
  );
}
