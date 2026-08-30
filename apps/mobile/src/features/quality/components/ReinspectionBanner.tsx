import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';

type Props = {
  previousFailure?: string | null;
  reworkedBy?: string | null;
};

/**
 * Reinspection banner — previous failure + who reworked.
 */
export function ReinspectionBanner({ previousFailure, reworkedBy }: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  return (
    <View
      style={{
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: colors.brand,
        backgroundColor: colors.brandSoft,
        overflow: 'hidden',
        ...orderBoardShadow(colorScheme),
      }}
    >
      <View
        style={{
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm + 2,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          backgroundColor: colors.surfaceSecondary,
        }}
      >
        <AppText
          variant="caption"
          weight="semibold"
          style={{
            color: colors.brand,
            letterSpacing: locale === 'ar' ? 0 : 1,
            textTransform: locale === 'ar' ? 'none' : 'uppercase',
            fontSize: 11,
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {t('mobile.quality.readyForReinspection')}
        </AppText>
      </View>
      <View style={{ padding: theme.spacing.md, gap: theme.spacing.sm }}>
        {previousFailure ? (
          <View style={{ gap: 4 }}>
            <AppText
              variant="caption"
              weight="semibold"
              style={{
                color: colors.error,
                textAlign: isRTL ? 'right' : 'left',
                fontSize: 11,
              }}
            >
              {t('mobile.quality.previousFailure')}
            </AppText>
            <AppText
              variant="body"
              weight={titleWeight}
              style={{ textAlign: isRTL ? 'right' : 'left' }}
            >
              {previousFailure}
            </AppText>
          </View>
        ) : null}
        {reworkedBy ? (
          <AppText
            variant="bodySecondary"
            color="secondary"
            style={{ textAlign: isRTL ? 'right' : 'left' }}
          >
            {t('mobile.quality.reworkedBy', { name: reworkedBy })}
          </AppText>
        ) : (
          <AppText
            variant="bodySecondary"
            color="secondary"
            style={{ textAlign: isRTL ? 'right' : 'left' }}
          >
            {t('mobile.quality.reinspectionHint')}
          </AppText>
        )}
      </View>
    </View>
  );
}
