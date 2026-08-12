import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import type { StatementSummaryModel } from '../selectStatement';

type Props = {
  summary: StatementSummaryModel;
  onDownloadPdf?: () => void;
  pdfBusy?: boolean;
};

/**
 * Outstanding-first SOA board — paid bar, invoiced/paid pills, PDF action.
 */
export function StatementBalanceBoard({
  summary,
  onDownloadPdf,
  pdfBusy = false,
}: Props) {
  const { t, isRTL, locale, formatDate } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const accent = colors.brand;
  const currency = summary.currency || 'ILS';

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
          ...(isRTL ? { right: 0 } : { left: 0 }),
          width: 3,
          backgroundColor: accent,
          opacity: 0.55,
        }}
      />

      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.sm,
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.md,
          ...(isRTL
            ? { paddingRight: theme.spacing.lg + 4 }
            : { paddingLeft: theme.spacing.lg + 4 }),
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          backgroundColor: colors.surfaceSecondary,
        }}
      >
        <AppText
          variant="caption"
          weight="semibold"
          style={{ color: colors.brand, flex: 1 }}
          numberOfLines={1}
        >
          {summary.customerLabel}
        </AppText>
        {onDownloadPdf ? (
          <AnimatedPressable
            variant="button"
            disabled={pdfBusy}
            onPress={() => {
              void haptics.selection();
              onDownloadPdf();
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('mobile.account.downloadPdf')}
          >
            <AppText variant="caption" color="brand" weight="semibold">
              {t('mobile.account.downloadPdf')}
            </AppText>
          </AnimatedPressable>
        ) : null}
      </View>

      <View
        style={{
          padding: theme.spacing.lg,
          gap: theme.spacing.md,
          ...(isRTL
            ? { paddingRight: theme.spacing.lg + 4 }
            : { paddingLeft: theme.spacing.lg + 4 }),
        }}
      >
        <View style={{ gap: 6 }}>
          <AppText
            variant="caption"
            color="muted"
            style={{
              textTransform: locale === 'ar' ? 'none' : 'uppercase',
              letterSpacing: locale === 'ar' ? 0 : 0.55,
              fontSize: 11,
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {t('mobile.account.outstanding')}
          </AppText>
          <AppText
            weight={titleWeight}
            dir="ltr"
            style={{
              fontSize: 34,
              lineHeight: locale === 'ar' ? 52 : 42,
              textAlign: isRTL ? 'right' : 'left',
              color: colors.textPrimary,
              fontVariant: ['tabular-nums'],
            }}
          >
            {summary.outstandingLabel}
          </AppText>
          <AppText
            variant="caption"
            color="muted"
            style={{ textAlign: isRTL ? 'right' : 'left' }}
          >
            {t('mobile.account.asOf', { date: formatDate(summary.asOf) })}
          </AppText>
        </View>

        <View
          style={{
            height: 6,
            borderRadius: 3,
            backgroundColor: colors.surfaceSecondary,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <View
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              ...(isRTL
                ? { right: 0, width: `${summary.paidRatio * 100}%` as `${number}%` }
                : { left: 0, width: `${summary.paidRatio * 100}%` as `${number}%` }),
              backgroundColor: colors.brand,
              opacity: 0.85,
            }}
          />
        </View>

        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            gap: theme.spacing.md,
          }}
        >
          <MoneyPill
            label={t('mobile.account.totalInvoiced')}
            value={`${summary.totalInvoicedLabel} ${currency}`}
            alignEnd={false}
          />
          <MoneyPill
            label={t('mobile.account.totalPaid')}
            value={`${summary.totalPaidLabel} ${currency}`}
            alignEnd
          />
        </View>
      </View>
    </View>
  );
}

function MoneyPill({
  label,
  value,
  alignEnd,
}: {
  label: string;
  value: string;
  alignEnd: boolean;
}) {
  const { isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const textAlign = alignEnd
    ? isRTL
      ? 'left'
      : 'right'
    : isRTL
      ? 'right'
      : 'left';

  return (
    <View
      style={{
        flex: 1,
        minWidth: 0,
        gap: 4,
        paddingVertical: theme.spacing.sm,
        paddingHorizontal: theme.spacing.md,
        borderRadius: theme.radius.lg,
        backgroundColor: colors.surfaceSecondary,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <AppText
        variant="caption"
        color="muted"
        style={{
          fontSize: 10,
          textTransform: 'uppercase',
          letterSpacing: 0.4,
          textAlign,
        }}
      >
        {label}
      </AppText>
      <AppText
        weight="semibold"
        dir="ltr"
        numberOfLines={1}
        style={{ fontSize: 15, lineHeight: 20, textAlign, color: colors.textPrimary }}
      >
        {value}
      </AppText>
    </View>
  );
}
