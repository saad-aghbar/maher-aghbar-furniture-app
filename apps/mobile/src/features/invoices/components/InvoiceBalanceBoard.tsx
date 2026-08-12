import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { formatNumber } from '@/i18n/format';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import type { InvoiceDetailModel } from '../selectInvoice';

type Props = {
  model: InvoiceDetailModel;
  currencySuffix?: string;
};

function moneyLabel(locale: string, value: number): string {
  const typed = locale === 'ar' || locale === 'he' || locale === 'en' ? locale : 'en';
  return formatNumber(typed, value, { maximumFractionDigits: 2 });
}

/**
 * Outstanding-first statement board — big balance, paid bar, compact subtotal/tax.
 */
export function InvoiceBalanceBoard({ model, currencySuffix = 'ILS' }: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const overdue = model.isOverdue;
  const accent = overdue ? colors.error : colors.brand;
  const paidRatio =
    model.total > 0 ? Math.min(1, Math.max(0, model.paid / model.total)) : model.outstanding <= 0 ? 1 : 0;

  return (
    <View
      style={{
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: overdue ? colors.error : colors.borderStrong,
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
          opacity: overdue ? 0.9 : 0.55,
        }}
      />

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
            {t('accounting.outstanding')}
          </AppText>
          <AppText
            weight={titleWeight}
            dir="ltr"
            style={{
              fontSize: 34,
              // Arabic KO Sans needs ~1.5×; AppText also guards metrics.
              lineHeight: locale === 'ar' ? 52 : 42,
              textAlign: isRTL ? 'right' : 'left',
              color: overdue ? colors.error : colors.textPrimary,
              fontVariant: ['tabular-nums'],
            }}
          >
            {`${moneyLabel(locale, model.outstanding)} ${currencySuffix}`}
          </AppText>
          {overdue ? (
            <AppText
              variant="caption"
              weight="semibold"
              style={{ color: colors.error, textAlign: isRTL ? 'right' : 'left' }}
            >
              {t('accounting.overdueHint')}
            </AppText>
          ) : null}
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
                ? { right: 0, width: `${paidRatio * 100}%` as `${number}%` }
                : { left: 0, width: `${paidRatio * 100}%` as `${number}%` }),
              backgroundColor: overdue ? colors.error : colors.brand,
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
            label={t('accounting.paidAmount')}
            value={`${moneyLabel(locale, model.paid)} ${currencySuffix}`}
            alignEnd={false}
          />
          <MoneyPill
            label={t('accounting.total')}
            value={`${moneyLabel(locale, model.total)} ${currencySuffix}`}
            alignEnd
          />
        </View>

        <View
          style={{
            marginTop: theme.spacing.xs,
            paddingTop: theme.spacing.md,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            gap: theme.spacing.sm,
          }}
        >
          <FootRow
            label={t('accounting.subtotal')}
            value={`${moneyLabel(locale, model.subtotal)} ${currencySuffix}`}
          />
          <FootRow
            label={t('accounting.tax')}
            value={`${moneyLabel(locale, model.tax)} ${currencySuffix}`}
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

function FootRow({ label, value }: { label: string; value: string }) {
  const { isRTL } = useLocale();
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <AppText
        variant="caption"
        color="muted"
        style={{ textAlign: isRTL ? 'right' : 'left', fontSize: 12 }}
      >
        {label}
      </AppText>
      <AppText
        variant="caption"
        weight="semibold"
        dir="ltr"
        style={{ color: colors.textSecondary, fontVariant: ['tabular-nums'] }}
      >
        {value}
      </AppText>
    </View>
  );
}
