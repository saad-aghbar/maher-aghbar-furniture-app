import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { AnimatedPressable, haptics } from '@/motion';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';

type Props = {
  title: string;
  amountLabel?: string;
  dueLabel?: string;
  statusLabel?: string;
  /** Raw status code for StatusBadge when available. */
  status?: string;
  onPress: () => void;
};

/**
 * Compact floor tile for dealer home recent-invoices rail.
 */
export function DealerInvoiceCard({
  title,
  amountLabel,
  dueLabel,
  statusLabel,
  status,
  onPress,
}: Props) {
  const { isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  return (
    <AnimatedPressable
      variant="card"
      onPress={() => {
        void haptics.selection();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={{
        width: 240,
        borderRadius: theme.radius.xl,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.borderStrong,
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
          ...(isRTL ? { right: 0 } : { left: 0 }),
          width: 3,
          backgroundColor: colors.brand,
          opacity: 0.55,
        }}
      />

      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
          ...(isRTL
            ? { paddingRight: theme.spacing.md + 4 }
            : { paddingLeft: theme.spacing.md + 4 }),
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          backgroundColor: colors.surfaceSecondary,
        }}
      >
        {status ? (
          <StatusBadge status={status} dot />
        ) : statusLabel ? (
          <AppText variant="caption" color="secondary" numberOfLines={1}>
            {statusLabel}
          </AppText>
        ) : (
          <View />
        )}
      </View>

      <View
        style={{
          padding: theme.spacing.md,
          gap: theme.spacing.sm,
          ...(isRTL
            ? { paddingRight: theme.spacing.md + 4 }
            : { paddingLeft: theme.spacing.md + 4 }),
          alignItems: isRTL ? 'flex-end' : 'flex-start',
        }}
      >
        <AppText
          variant="body"
          weight={titleWeight}
          dir="ltr"
          numberOfLines={1}
          style={{
            color: colors.textPrimary,
            textAlign: isRTL ? 'right' : 'left',
            alignSelf: 'stretch',
            fontSize: 15,
          }}
        >
          {title}
        </AppText>
        {amountLabel ? (
          <AppText
            variant="heading"
            weight={titleWeight}
            dir="ltr"
            style={{ color: colors.textPrimary, fontSize: 22, lineHeight: 28 }}
          >
            {amountLabel}
          </AppText>
        ) : null}
        {dueLabel ? (
          <AppText variant="caption" color="muted">
            {dueLabel}
          </AppText>
        ) : null}
      </View>
    </AnimatedPressable>
  );
}
