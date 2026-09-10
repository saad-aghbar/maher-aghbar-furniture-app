import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Payment } from '@/api/modules/payments';
import { AppText } from '@/components/AppText';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import { paymentMethodKey } from '../selectStatement';

type Props = {
  payment: Payment;
  onPdf: () => void;
};

function methodIcon(method: string): keyof typeof Ionicons.glyphMap {
  switch (method.toUpperCase()) {
    case 'CASH':
      return 'cash-outline';
    case 'CHEQUE':
      return 'document-text-outline';
    case 'CARD':
      return 'card-outline';
    case 'BANK_TRANSFER':
      return 'swap-horizontal-outline';
    default:
      return 'wallet-outline';
  }
}

/**
 * Dealer payment floor card — header band, amount inset, PDF in the header.
 */
export function PaymentBoardCard({ payment, onPdf }: Props) {
  const { t, isRTL, locale, formatCurrency, formatDate } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const amount = Number(payment.amount ?? 0);
  const unallocated = Number(payment.unallocatedAmount ?? 0);
  const allocated = Number(
    payment.allocatedAmount ?? Math.max(0, amount - unallocated),
  );
  const hasCredit = unallocated > 0.001;
  const accent = hasCredit ? colors.success : colors.brand;
  const method = String(payment.method ?? '');
  const methodLabel = t(paymentMethodKey(method));

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
          opacity: hasCredit ? 0.9 : 0.55,
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
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: theme.spacing.sm,
            flex: 1,
            minWidth: 0,
          }}
        >
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Ionicons name={methodIcon(method)} size={14} color={accent} />
          </View>
          <AppText
            variant="caption"
            weight="semibold"
            numberOfLines={1}
            style={{ color: accent, flex: 1 }}
          >
            {methodLabel}
          </AppText>
        </View>
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: theme.spacing.md,
          }}
        >
          <AnimatedPressable
            variant="button"
            accessibilityRole="button"
            accessibilityLabel={t('mobile.account.downloadPdf')}
            onPress={() => {
              void haptics.selection();
              onPdf();
            }}
            hitSlop={10}
          >
            <AppText variant="caption" color="brand" weight="semibold">
              {t('catalog.pdf')}
            </AppText>
          </AnimatedPressable>
          <AppText variant="caption" color="muted">
            {formatDate(payment.paymentDate)}
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
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: theme.spacing.md,
          }}
        >
          <AppText
            variant="body"
            weight={titleWeight}
            numberOfLines={1}
            dir="ltr"
            style={{ flex: 1, textAlign: isRTL ? 'right' : 'left' }}
          >
            {payment.number}
          </AppText>
        </View>

        {payment.notes?.trim() || payment.referenceNumber ? (
          <AppText
            variant="caption"
            color="muted"
            numberOfLines={2}
            style={{ textAlign: isRTL ? 'right' : 'left' }}
          >
            {payment.notes?.trim() || payment.referenceNumber}
          </AppText>
        ) : null}

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
              {t('mobile.account.typePayment')}
            </AppText>
            <AppText
              weight={titleWeight}
              dir="ltr"
              style={{
                fontSize: 20,
                lineHeight: locale === 'ar' ? 30 : 24,
                color: colors.success,
                fontVariant: ['tabular-nums'],
              }}
            >
              {formatCurrency(amount)}
            </AppText>
          </View>

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
            <AppText variant="caption" color="muted" style={{ flex: 1 }}>
              {t('accounting.allocatedToInvoices')}
            </AppText>
            <AppText
              variant="caption"
              weight="semibold"
              dir="ltr"
              style={{ color: colors.textPrimary, fontVariant: ['tabular-nums'] }}
            >
              {formatCurrency(allocated)}
            </AppText>
          </View>

          {hasCredit ? (
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: theme.spacing.md,
              }}
            >
              <AppText variant="caption" color="muted" style={{ flex: 1 }}>
                {t('accounting.unallocatedCredit')}
              </AppText>
              <AppText
                variant="caption"
                weight="semibold"
                dir="ltr"
                style={{ color: colors.success, fontVariant: ['tabular-nums'] }}
              >
                {formatCurrency(unallocated)}
              </AppText>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}
