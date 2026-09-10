import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import { quotationDaysLeft, quotationExpiryYmd } from '../dealerQuotationUi';

type Props = {
  expirationDate?: string | null;
  commerciallyExpired?: boolean;
};

function monthLabel(ymd: string, locale: string): string {
  const date = new Date(`${ymd}T12:00:00`);
  const tag = locale === 'ar' ? 'ar-u-nu-latn' : locale === 'he' ? 'he-u-nu-latn' : 'en-GB';
  return new Intl.DateTimeFormat(tag, { month: 'short' }).format(date);
}

/**
 * Quote-only calendar stub — validity as a ticket well, not an invoice icon disc.
 */
export function QuotationValidityStub({ expirationDate, commerciallyExpired }: Props) {
  const { t, locale } = useLocale();
  const { colors, theme } = useTheme();
  const ymd = quotationExpiryYmd(expirationDate);
  const days = quotationDaysLeft(expirationDate);
  const urgent =
    Boolean(commerciallyExpired) || (days != null && days <= 7);
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const caption =
    commerciallyExpired || (days != null && days < 0)
      ? t('mobile.dealerQuotations.stubExpired')
      : days === 0
        ? t('mobile.dealerQuotations.expiresToday')
        : days != null
          ? t('mobile.dealerQuotations.daysLeft', { n: String(days) })
          : t('mobile.dealerQuotations.validOpen');

  return (
    <View
      style={{
        width: 64,
        borderRadius: theme.radius.lg,
        backgroundColor: urgent ? colors.warningSoft : colors.surfaceSecondary,
        borderWidth: 1,
        borderColor: commerciallyExpired ? colors.error : urgent ? colors.warning : colors.border,
        overflow: 'hidden',
        alignItems: 'center',
      }}
    >
      <View
        style={{
          alignSelf: 'stretch',
          paddingVertical: 4,
          backgroundColor: commerciallyExpired
            ? `${colors.error}22`
            : urgent
              ? `${colors.warning}22`
              : colors.surface,
          borderBottomWidth: 1,
          borderBottomColor: commerciallyExpired
            ? colors.error
            : urgent
              ? colors.warning
              : colors.border,
          alignItems: 'center',
        }}
      >
        <AppText
          variant="caption"
          weight={titleWeight}
          numberOfLines={1}
          style={{
            color: commerciallyExpired ? colors.error : colors.brand,
            textTransform: locale === 'ar' ? 'none' : 'uppercase',
            letterSpacing: locale === 'ar' ? 0 : 0.4,
            fontSize: 10,
          }}
        >
          {ymd ? monthLabel(ymd, locale) : '—'}
        </AppText>
      </View>
      <View style={{ paddingVertical: 6, paddingHorizontal: 4, alignItems: 'center', gap: 2 }}>
        <AppText
          weight={titleWeight}
          dir="ltr"
          style={{
            fontSize: 22,
            lineHeight: locale === 'ar' ? 30 : 26,
            color: commerciallyExpired ? colors.error : colors.textPrimary,
            fontVariant: ['tabular-nums'],
          }}
        >
          {ymd ? String(Number(ymd.slice(8, 10))) : '—'}
        </AppText>
        <AppText
          variant="caption"
          numberOfLines={2}
          align="center"
          style={{
            color: commerciallyExpired
              ? colors.error
              : urgent
                ? colors.warning
                : colors.textMuted,
            fontSize: 9,
            lineHeight: 12,
          }}
        >
          {caption}
        </AppText>
      </View>
    </View>
  );
}
