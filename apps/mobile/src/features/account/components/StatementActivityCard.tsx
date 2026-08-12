import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import {
  formatStatementDelta,
  type StatementActivityRow,
} from '../selectStatement';

type Props = {
  row: StatementActivityRow;
  currency?: string;
  onPress?: () => void;
  onDownloadPdf?: () => void;
};

/**
 * Ledger activity floor card — type, ref, signed delta, running balance.
 */
export function StatementActivityCard({
  row,
  currency = 'ILS',
  onPress,
  onDownloadPdf,
}: Props) {
  const { t, isRTL, locale, formatDate } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const isInvoice = row.type === 'INVOICE';
  const accent = isInvoice ? colors.brand : colors.success;
  const delta = formatStatementDelta(row.amount, row.side, isRTL);
  const typeLabel = isInvoice
    ? t('mobile.account.typeInvoice')
    : t('mobile.account.typePayment');

  const body = (
    <>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          ...(isRTL ? { right: 0 } : { left: 0 }),
          width: 3,
          backgroundColor: accent,
          opacity: 0.7,
        }}
      />

      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.sm,
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.sm + 2,
          ...(isRTL
            ? { paddingRight: theme.spacing.lg + 4 }
            : { paddingLeft: theme.spacing.lg + 4 }),
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          backgroundColor: colors.surfaceSecondary,
        }}
      >
        <View
          style={{
            paddingHorizontal: theme.spacing.sm + 2,
            paddingVertical: 4,
            borderRadius: theme.radius.full,
            backgroundColor: isInvoice ? colors.brandSoft : colors.successSoft,
            borderWidth: 1,
            borderColor: accent,
          }}
        >
          <AppText
            variant="caption"
            weight="semibold"
            style={{ color: accent, fontSize: 11 }}
          >
            {typeLabel}
          </AppText>
        </View>
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: theme.spacing.md,
          }}
        >
          {onDownloadPdf ? (
            <AnimatedPressable
              variant="button"
              accessibilityRole="button"
              accessibilityLabel={t('accounting.downloadPdf')}
              onPress={() => {
                void haptics.selection();
                onDownloadPdf();
              }}
              hitSlop={8}
            >
              <AppText variant="caption" color="brand" weight="semibold">
                {t('catalog.pdf')}
              </AppText>
            </AnimatedPressable>
          ) : null}
          <AppText variant="caption" color="muted">
            {formatDate(row.date)}
          </AppText>
        </View>
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
            variant="body"
            weight={titleWeight}
            numberOfLines={2}
            style={{ textAlign: isRTL ? 'right' : 'left', color: colors.textPrimary }}
          >
            {row.description}
          </AppText>
          {row.reference ? (
            <View
              style={{
                alignSelf: isRTL ? 'flex-end' : 'flex-start',
                paddingHorizontal: theme.spacing.sm + 2,
                paddingVertical: 4,
                borderRadius: theme.radius.full,
                backgroundColor: colors.brandSoft,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <AppText
                variant="caption"
                weight="semibold"
                dir="ltr"
                style={{ color: colors.brand, fontSize: 11 }}
              >
                {row.reference}
              </AppText>
            </View>
          ) : null}
        </View>

        <View
          style={{
            borderRadius: theme.radius.lg,
            backgroundColor: colors.surfaceSecondary,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.md,
            gap: theme.spacing.sm,
          }}
        >
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: theme.spacing.md,
            }}
          >
            <AppText
              variant="caption"
              color="muted"
              style={{
                textTransform: locale === 'ar' ? 'none' : 'uppercase',
                letterSpacing: locale === 'ar' ? 0 : 0.45,
                fontSize: 10,
              }}
            >
              {isInvoice ? t('common.debit') : t('common.credit')}
            </AppText>
            <AppText
              weight={titleWeight}
              dir="ltr"
              style={{
                fontSize: 20,
                lineHeight: locale === 'ar' ? 30 : 24,
                color: isInvoice ? colors.error : colors.success,
                fontVariant: ['tabular-nums'],
              }}
            >
              {`${delta} ${currency}`}
            </AppText>
          </View>

          {row.balance ? (
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: theme.spacing.md,
                paddingTop: theme.spacing.sm,
                borderTopWidth: 1,
                borderTopColor: colors.border,
              }}
            >
              <AppText
                variant="caption"
                color="muted"
                style={{
                  textTransform: locale === 'ar' ? 'none' : 'uppercase',
                  letterSpacing: locale === 'ar' ? 0 : 0.45,
                  fontSize: 10,
                }}
              >
                {t('mobile.account.runningBalance')}
              </AppText>
              <AppText
                weight="semibold"
                dir="ltr"
                style={{
                  fontSize: 14,
                  color: colors.textPrimary,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {`${row.balance} ${currency}`}
              </AppText>
            </View>
          ) : null}
        </View>
      </View>
    </>
  );

  const shellStyle = {
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    overflow: 'hidden' as const,
    ...orderBoardShadow(colorScheme),
  };

  if (onPress) {
    return (
      <AnimatedPressable
        variant="card"
        accessibilityRole="button"
        accessibilityLabel={`${typeLabel} ${row.reference}`}
        onPress={() => {
          void haptics.selection();
          onPress();
        }}
        style={shellStyle}
      >
        {body}
      </AnimatedPressable>
    );
  }

  return <View style={shellStyle}>{body}</View>;
}
