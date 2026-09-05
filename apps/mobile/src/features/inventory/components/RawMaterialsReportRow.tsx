import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';

type Props = {
  onPress: () => void;
};

/** Inventory floor row that opens the Raw Materials management report sheet. */
export function RawMaterialsReportRow({ onPress }: Props) {
  const { t, locale, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const chevron = isRTL ? 'chevron-back' : 'chevron-forward';
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  return (
    <AnimatedPressable
      variant="button"
      accessibilityRole="button"
      accessibilityLabel={t('mobile.inventory.rawReport.rowTitle')}
      onPress={() => {
        void haptics.selection();
        onPress();
      }}
      style={{
        minHeight: theme.sizes.touch.min,
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: colors.borderStrong,
        backgroundColor: colors.surface,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
        paddingStart: theme.spacing.lg + 4,
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
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
      <Ionicons name="document-text-outline" size={18} color={colors.brand} />
      <View style={{ flex: 1, gap: 2 }}>
        <AppText
          variant="body"
          weight={titleWeight}
          style={{ textAlign: isRTL ? 'right' : 'left', color: colors.brand }}
          numberOfLines={1}
        >
          {t('mobile.inventory.rawReport.rowTitle')}
        </AppText>
        <AppText
          variant="caption"
          color="muted"
          style={{ textAlign: isRTL ? 'right' : 'left' }}
          numberOfLines={2}
        >
          {t('mobile.inventory.rawReport.rowHint')}
        </AppText>
      </View>
      <Ionicons name={chevron} size={16} color={colors.textMuted} />
    </AnimatedPressable>
  );
}
