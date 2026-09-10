import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import type { ProductionOriginModel } from '../selectProduction';

type Props = {
  origin: ProductionOriginModel;
  compact?: boolean;
};

export function productionOriginTraceLine(
  origin: ProductionOriginModel,
  t: (key: string, vars?: Record<string, string | number>) => string,
): string {
  if (!origin.originalOrderNumber) return origin.number;
  return `${origin.number} · ${t('mobile.production.origin.wasOrder', {
    order: origin.originalOrderNumber,
  })}`;
}

/**
 * Sheet-chip recipe: brandSoft wash, brand border, 3px start rail.
 */
export function ProductionOriginChip({ origin, compact }: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const label =
    origin.kind === 'REPLACEMENT'
      ? t('mobile.production.origin.replacement')
      : t('mobile.production.origin.returnWork');

  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        alignSelf: isRTL ? 'flex-end' : 'flex-start',
        minHeight: compact ? 28 : 32,
        paddingStart: theme.spacing.sm + 3,
        paddingEnd: theme.spacing.sm,
        paddingVertical: compact ? 2 : 4,
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: colors.brand,
        backgroundColor: colors.brandSoft,
        overflow: 'hidden',
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
          ...(isRTL ? { right: 0 } : { left: 0 }),
        }}
      />
      <AppText
        variant="caption"
        weight={titleWeight}
        numberOfLines={1}
        style={{
          color: colors.brand,
          fontSize: 11,
          letterSpacing: 0,
          textTransform: 'none',
        }}
      >
        {label}
      </AppText>
    </View>
  );
}
