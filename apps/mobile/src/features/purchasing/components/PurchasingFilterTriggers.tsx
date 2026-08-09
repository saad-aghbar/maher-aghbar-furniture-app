import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';

/** Shared chrome metrics — search row + filter triggers stay aligned. */
export const PURCHASING_CHROME_CONTROL_H = 48;
export const PURCHASING_CHROME_GAP = 10;

type Props = {
  supplierLabel: string | null;
  onOpenSuppliers: () => void;
  onClearSupplier?: () => void;
  statusActive: boolean;
  statusLabel: string;
  onOpenStatus: () => void;
};

/** Two floor triggers under search: suppliers + status filter. */
export function PurchasingFilterTriggers({
  supplierLabel,
  onOpenSuppliers,
  onClearSupplier,
  statusActive,
  statusLabel,
  onOpenStatus,
}: Props) {
  const { isRTL } = useLocale();

  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        gap: PURCHASING_CHROME_GAP,
        alignItems: 'stretch',
      }}
    >
      <FloorTrigger
        flex={1}
        icon="business-outline"
        label={supplierLabel}
        fallbackKey="mobile.purchasing.tabs.suppliers"
        active={Boolean(supplierLabel)}
        onPress={onOpenSuppliers}
        onClear={supplierLabel && onClearSupplier ? onClearSupplier : undefined}
        a11yKey="catalog.allSuppliers"
      />
      <FloorTrigger
        flex={1}
        icon="options-outline"
        label={statusLabel}
        fallbackKey="mobile.purchasing.filter"
        active={statusActive}
        onPress={onOpenStatus}
        a11yKey="mobile.purchasing.filterTitle"
      />
    </View>
  );
}

function FloorTrigger({
  flex,
  icon,
  label,
  fallbackKey,
  active,
  onPress,
  onClear,
  a11yKey,
}: {
  flex?: number;
  icon: keyof typeof Ionicons.glyphMap;
  label: string | null;
  fallbackKey: string;
  active: boolean;
  onPress: () => void;
  onClear?: () => void;
  a11yKey: string;
}) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const rawFallback = t(fallbackKey);
  const text =
    label?.trim() ||
    (rawFallback === fallbackKey
      ? fallbackKey.includes('suppliers')
        ? 'Suppliers'
        : 'Filter'
      : rawFallback);

  return (
    <View
      style={{
        flex,
        minWidth: 0,
        height: PURCHASING_CHROME_CONTROL_H,
        borderRadius: theme.radius.xl,
        backgroundColor: active ? colors.brandSoft : colors.surfaceSecondary,
        borderWidth: 1.5,
        borderColor: active ? colors.brand : colors.borderStrong,
        overflow: 'hidden',
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        ...orderBoardShadow(colorScheme),
      }}
    >
      {active ? (
        <View
          style={{
            position: 'absolute',
            top: 6,
            bottom: 6,
            ...(isRTL ? { right: 0 } : { left: 0 }),
            width: 3,
            borderRadius: 2,
            backgroundColor: colors.brand,
            opacity: 0.85,
          }}
        />
      ) : null}
      <AnimatedPressable
        variant="button"
        accessibilityRole="button"
        accessibilityLabel={t(a11yKey)}
        accessibilityState={{ selected: active }}
        onPress={() => {
          void haptics.selection();
          onPress();
        }}
        style={{
          flex: 1,
          minWidth: 0,
          height: PURCHASING_CHROME_CONTROL_H,
          paddingHorizontal: theme.spacing.md,
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
          ...(isRTL
            ? { paddingRight: active ? theme.spacing.md + 4 : theme.spacing.md }
            : { paddingLeft: active ? theme.spacing.md + 4 : theme.spacing.md }),
        }}
      >
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: active ? colors.brand : colors.border,
          }}
        >
          <Ionicons
            name={icon}
            size={15}
            color={active ? colors.brand : colors.textSecondary}
          />
        </View>
        <AppText
          variant="caption"
          weight={titleWeight}
          numberOfLines={1}
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 13,
            lineHeight: 16,
            color: active ? colors.brand : colors.textPrimary,
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {text}
        </AppText>
        <Ionicons
          name={isRTL ? 'chevron-back' : 'chevron-forward'}
          size={16}
          color={active ? colors.brand : colors.textMuted}
        />
      </AnimatedPressable>
      {onClear ? (
        <AnimatedPressable
          variant="button"
          accessibilityRole="button"
          accessibilityLabel={t('catalog.allSuppliers')}
          onPress={() => {
            void haptics.selection();
            onClear();
          }}
          style={{
            width: 40,
            height: PURCHASING_CHROME_CONTROL_H,
            alignItems: 'center',
            justifyContent: 'center',
            borderLeftWidth: isRTL ? 0 : StyleSheet.hairlineWidth,
            borderRightWidth: isRTL ? StyleSheet.hairlineWidth : 0,
            borderColor: colors.border,
          }}
        >
          <Ionicons name="close" size={18} color={colors.brand} />
        </AnimatedPressable>
      ) : null}
    </View>
  );
}
