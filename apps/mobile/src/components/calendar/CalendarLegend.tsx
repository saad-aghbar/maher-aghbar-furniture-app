import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import {
  ADMIN_LOAD_LEGEND,
  resolveAdminLoadVisual,
  type AdminLoadLegendKey,
} from './loadToneVisuals';

type Props = {
  /**
   * `admin` — factory load labels (Empty/Light/Half/Busy/Closed).
   * `dealer` — same swatches, labels describe delivery availability meaning.
   */
  variant?: 'admin' | 'dealer';
  compact?: boolean;
};

/** Dealer legend order follows how a dealer reads the month (soonest → blocked). */
const DEALER_LEGEND_KEYS: AdminLoadLegendKey[] = [
  'light',
  'half',
  'empty',
  'busy',
  'closed',
];

/**
 * Color key for month calendars.
 * Swatches always use the shared load palette; labels depend on variant.
 */
export function CalendarLegend({ variant = 'admin', compact = false }: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const keys = variant === 'dealer' ? DEALER_LEGEND_KEYS : ADMIN_LOAD_LEGEND;
  const labelKey = (key: AdminLoadLegendKey) =>
    variant === 'dealer'
      ? `mobile.calendar.legend.dealer.${key}`
      : `mobile.calendar.legend.${key}`;

  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        flexWrap: 'wrap',
        gap: compact ? theme.spacing.xs : theme.spacing.sm,
        paddingVertical: compact ? theme.spacing.xs : theme.spacing.sm,
        paddingHorizontal: compact ? theme.spacing.sm : theme.spacing.md,
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        ...orderBoardShadow(colorScheme),
      }}
    >
      {keys.map((key) => {
        const visual = resolveAdminLoadVisual(key, colors);
        return (
          <View
            key={key}
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <View
              style={{
                width: compact ? 12 : 14,
                height: compact ? 12 : 14,
                borderRadius: 4,
                backgroundColor: visual.swatch,
                borderWidth: 1.5,
                borderColor: visual.border,
              }}
            />
            <AppText
              variant="caption"
              weight={locale === 'ar' ? 'regular' : 'medium'}
              style={{
                color: colors.textSecondary,
                letterSpacing: locale === 'ar' ? 0 : 0.4,
                textTransform: locale === 'ar' ? 'none' : 'uppercase',
                fontSize: compact ? 9 : 10,
              }}
            >
              {t(labelKey(key))}
            </AppText>
          </View>
        );
      })}
    </View>
  );
}
