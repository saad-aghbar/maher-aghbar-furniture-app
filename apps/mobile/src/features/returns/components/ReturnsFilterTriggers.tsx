import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';

type Props = {
  showDealers?: boolean;
  dealerLabel: string | null;
  onOpenDealers: () => void;
  onClearDealer?: () => void;
  statusActive: boolean;
  statusLabel: string;
  onOpenStatus: () => void;
};

export function ReturnsFilterTriggers({
  showDealers = false,
  dealerLabel,
  onOpenDealers,
  onClearDealer,
  statusActive,
  statusLabel,
  onOpenStatus,
}: Props) {
  const { isRTL } = useLocale();

  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        gap: 10,
        alignItems: 'stretch',
      }}
    >
      {showDealers ? (
        <FloorTrigger
          flex={1}
          icon="storefront-outline"
          label={dealerLabel}
          fallbackKey="catalog.allDealers"
          fallbackText="All dealers"
          active={Boolean(dealerLabel)}
          onPress={onOpenDealers}
          onClear={dealerLabel && onClearDealer ? onClearDealer : undefined}
          a11yKey={dealerLabel ? 'catalog.dealerFilterActive' : 'catalog.filterDealer'}
          a11yVars={dealerLabel ? { dealer: dealerLabel } : undefined}
        />
      ) : null}
      <FloorTrigger
        flex={showDealers ? 1 : undefined}
        stretch={!showDealers}
        icon="options-outline"
        label={statusLabel}
        fallbackKey="accounting.filter"
        fallbackText="Filter"
        active={statusActive}
        onPress={onOpenStatus}
        a11yKey="accounting.filterTitle"
      />
    </View>
  );
}

function FloorTrigger({
  flex,
  stretch,
  icon,
  label,
  fallbackKey,
  fallbackText,
  active,
  onPress,
  onClear,
  a11yKey,
  a11yVars,
}: {
  flex?: number;
  stretch?: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  label: string | null;
  fallbackKey: string;
  fallbackText: string;
  active: boolean;
  onPress: () => void;
  onClear?: () => void;
  a11yKey: string;
  a11yVars?: Record<string, string>;
}) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const translated = t(fallbackKey);
  const text =
    label?.trim() ||
    (translated !== fallbackKey ? translated : fallbackText);

  return (
    <View
      style={{
        flex: stretch ? undefined : flex,
        alignSelf: stretch ? 'stretch' : undefined,
        width: stretch ? '100%' : undefined,
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
            top: 0,
            bottom: 0,
            ...(isRTL ? { right: 0 } : { left: 0 }),
            width: 3,
            backgroundColor: colors.brand,
            opacity: 0.85,
          }}
        />
      ) : null}

      <AnimatedPressable
        variant="button"
        accessibilityRole="button"
        accessibilityLabel={t(a11yKey, a11yVars)}
        accessibilityState={{ selected: active }}
        onPress={() => {
          void haptics.selection();
          onPress();
        }}
        style={{
          flex: 1,
          minHeight: 48,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
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
          variant="label"
          weight={titleWeight}
          numberOfLines={1}
          style={{
            flex: 1,
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
          accessibilityLabel={t('catalog.clearDealerFilter')}
          onPress={() => {
            void haptics.selection();
            onClear();
          }}
          hitSlop={8}
          style={{
            width: 44,
            minHeight: 48,
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
