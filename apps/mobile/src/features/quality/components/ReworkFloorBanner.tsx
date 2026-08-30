import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';

type Props = {
  problemText?: string | null;
  hasPhotos?: boolean;
};

/**
 * Rework floor banner — REWORK stamp, problem text, photos note.
 */
export function ReworkFloorBanner({ problemText, hasPhotos }: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  return (
    <View
      style={{
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: colors.warning,
        backgroundColor: colors.warningSoft,
        overflow: 'hidden',
        ...orderBoardShadow(colorScheme),
      }}
    >
      <View
        style={{
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm + 2,
          borderBottomWidth: 1,
          borderBottomColor: colors.warning,
          backgroundColor: colors.warning,
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <AppText
          variant="caption"
          weight="semibold"
          style={{
            color: colors.onBrand,
            letterSpacing: locale === 'ar' ? 0 : 1.2,
            textTransform: locale === 'ar' ? 'none' : 'uppercase',
            fontSize: 12,
          }}
        >
          {t('mobile.quality.stampRework')}
        </AppText>
        <AppText variant="caption" weight="semibold" style={{ color: colors.onBrand }}>
          {t('mobile.quality.needsRework')}
        </AppText>
      </View>
      <View style={{ padding: theme.spacing.md, gap: theme.spacing.sm }}>
        <AppText
          variant="label"
          weight={titleWeight}
          style={{ textAlign: isRTL ? 'right' : 'left' }}
        >
          {t('mobile.quality.reworkInProgress')}
        </AppText>
        {problemText ? (
          <AppText
            variant="body"
            style={{ textAlign: isRTL ? 'right' : 'left' }}
          >
            {problemText}
          </AppText>
        ) : (
          <AppText
            variant="bodySecondary"
            color="secondary"
            style={{ textAlign: isRTL ? 'right' : 'left' }}
          >
            {t('mobile.quality.reworkFixHint')}
          </AppText>
        )}
        {hasPhotos ? (
          <AppText
            variant="caption"
            color="muted"
            style={{ textAlign: isRTL ? 'right' : 'left' }}
          >
            {t('mobile.quality.reworkPhotosNote')}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}
