import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Divider } from '@/components/layout/Divider';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';

type Props = {
  amountDue: number;
  availableCredit: number;
  paidTotal: number;
};

/**
 * Always-visible dealer finance — amount due stays separate from unused credit
 * that applies to the next invoice after an overpay.
 */
export function DealerCreditBoard({ amountDue, availableCredit, paidTotal }: Props) {
  const { t, isRTL, locale, formatCurrency } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const hasDue = amountDue > 0.009;
  const hasCredit = availableCredit > 0.009;

  return (
    <View
      style={{
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: hasCredit ? `${colors.success}66` : hasDue ? colors.warning : colors.borderStrong,
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
          backgroundColor: hasCredit ? colors.success : colors.brand,
          opacity: 0.7,
        }}
      />

      <View
        style={{
          paddingHorizontal: theme.spacing.lg,
          paddingTop: theme.spacing.md,
          paddingBottom: theme.spacing.sm,
          gap: 2,
          backgroundColor: hasCredit ? colors.successSoft : colors.surfaceSecondary,
          ...(isRTL
            ? { paddingRight: theme.spacing.lg + 4 }
            : { paddingLeft: theme.spacing.lg + 4 }),
        }}
      >
        <AppText
          variant="caption"
          color="muted"
          style={{
            textTransform: locale === 'ar' ? 'none' : 'uppercase',
            letterSpacing: locale === 'ar' ? 0 : 0.55,
            fontSize: 10,
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {t('mobile.dealers.creditEyebrow')}
        </AppText>
        <AppText
          variant="label"
          weight={titleWeight}
          style={{ textAlign: isRTL ? 'right' : 'left' }}
        >
          {t('accounting.accountCredit')}
        </AppText>
      </View>

      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          gap: theme.spacing.sm,
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.md,
          ...(isRTL
            ? { paddingRight: theme.spacing.lg + 4 }
            : { paddingLeft: theme.spacing.lg + 4 }),
        }}
      >
        <View
          style={{
            flex: 1,
            gap: 4,
            padding: theme.spacing.sm,
            borderRadius: theme.radius.lg,
            backgroundColor: hasDue ? colors.warningSoft : colors.surfaceSecondary,
            borderWidth: 1,
            borderColor: hasDue ? colors.warning : colors.border,
          }}
        >
          <AppText
            variant="caption"
            color="muted"
            style={{
              textTransform: locale === 'ar' ? 'none' : 'uppercase',
              letterSpacing: locale === 'ar' ? 0 : 0.45,
              fontSize: 10,
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {t('accounting.amountDue')}
          </AppText>
          <AppText
            variant="title"
            weight={titleWeight}
            dir="ltr"
            style={{
              color: hasDue ? colors.warning : colors.textPrimary,
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {formatCurrency(amountDue)}
          </AppText>
        </View>

        <View
          style={{
            flex: 1,
            gap: 4,
            padding: theme.spacing.sm,
            borderRadius: theme.radius.lg,
            backgroundColor: hasCredit ? colors.successSoft : colors.surfaceSecondary,
            borderWidth: 1,
            borderColor: hasCredit ? `${colors.success}55` : colors.border,
          }}
        >
          <AppText
            variant="caption"
            color="muted"
            style={{
              textTransform: locale === 'ar' ? 'none' : 'uppercase',
              letterSpacing: locale === 'ar' ? 0 : 0.45,
              fontSize: 10,
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {t('accounting.accountCredit')}
          </AppText>
          <AppText
            variant="title"
            weight={titleWeight}
            dir="ltr"
            style={{
              color: hasCredit ? colors.success : colors.textSecondary,
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {formatCurrency(availableCredit)}
          </AppText>
        </View>
      </View>

      <View
        style={{
          paddingHorizontal: theme.spacing.lg,
          paddingBottom: theme.spacing.md,
          ...(isRTL
            ? { paddingRight: theme.spacing.lg + 4 }
            : { paddingLeft: theme.spacing.lg + 4 }),
        }}
      >
        <AppText
          variant="caption"
          color="muted"
          style={{ textAlign: isRTL ? 'right' : 'left' }}
        >
          {hasCredit
            ? t('mobile.dealers.creditHint')
            : t('mobile.dealers.creditEmptyHint')}
        </AppText>
      </View>

      <Divider compact />
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.md,
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.md,
          ...(isRTL
            ? { paddingRight: theme.spacing.lg + 4 }
            : { paddingLeft: theme.spacing.lg + 4 }),
        }}
      >
        <AppText
          variant="caption"
          color="muted"
          style={{
            textTransform: locale === 'ar' ? 'none' : 'uppercase',
            letterSpacing: locale === 'ar' ? 0 : 0.45,
            fontSize: 10,
            flexShrink: 0,
          }}
        >
          {t('customers.amountPaid')}
        </AppText>
        <AppText
          weight="semibold"
          dir="ltr"
          numberOfLines={1}
          style={{
            flex: 1,
            minWidth: 0,
            textAlign: isRTL ? 'left' : 'right',
            fontSize: 14,
          }}
        >
          {formatCurrency(paidTotal)}
        </AppText>
      </View>
    </View>
  );
}
