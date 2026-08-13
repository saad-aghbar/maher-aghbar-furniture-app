import { ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Payment } from '@/api/modules/payments';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import { DealerEmptyPanel } from './DealerEmptyPanel';

type Props = {
  payments: Payment[];
  emptyLabel: string;
  onPaymentPdf?: (paymentId: string) => void;
};

/** Visible window — enough rows to invite scroll without eating the page. */
const LIST_MAX_H = 320;

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

function methodLabel(
  method: string,
  t: (key: string, values?: Record<string, string | number>) => string,
): string {
  const key = `mobile.account.method.${method.toUpperCase()}`;
  const translated = t(key);
  return translated === key ? t('mobile.account.method.OTHER') : translated;
}

/**
 * Scrollable payments ledger for dealer summary — capped height, floor-row aesthetic.
 */
export function DealerPaymentsList({ payments, emptyLabel, onPaymentPdf }: Props) {
  const { t, formatCurrency, formatDate, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  if (payments.length === 0) {
    return <DealerEmptyPanel text={emptyLabel} icon="cash-outline" nested />;
  }

  return (
    <View>
      <View
        style={{
          paddingHorizontal: theme.spacing.lg,
          paddingTop: theme.spacing.md,
          paddingBottom: theme.spacing.sm,
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <AppText
          variant="caption"
          color="muted"
          weight={titleWeight}
          style={{
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            fontSize: 11,
          }}
        >
          {t('navigation.payments')}
        </AppText>
        <AppText variant="caption" color="secondary" weight="semibold" dir="ltr">
          {payments.length}
        </AppText>
      </View>

      <ScrollView
        nestedScrollEnabled
        showsVerticalScrollIndicator
        style={{ maxHeight: LIST_MAX_H }}
        contentContainerStyle={{
          padding: theme.spacing.md,
          gap: theme.spacing.sm,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {payments.map((p) => {
          const method = String(p.method ?? '');
          return (
            <View
              key={p.id}
              style={{
                borderRadius: theme.radius.lg,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surfaceSecondary,
                paddingHorizontal: theme.spacing.md,
                paddingVertical: theme.spacing.sm + 2,
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                gap: theme.spacing.md,
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.borderStrong,
                }}
              >
                <Ionicons name={methodIcon(method)} size={18} color={colors.brand} />
              </View>

              <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                <View
                  style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                    gap: theme.spacing.sm,
                  }}
                >
                  <AppText
                    variant="label"
                    weight={titleWeight}
                    numberOfLines={1}
                    dir="ltr"
                    style={{ flex: 1, fontSize: 13, lineHeight: 18 }}
                  >
                    {p.number}
                  </AppText>
                  <AppText
                    variant="label"
                    weight={titleWeight}
                    color="brand"
                    numberOfLines={1}
                    dir="ltr"
                    style={{ fontSize: 13, lineHeight: 18 }}
                  >
                    {formatCurrency(Number(p.amount))}
                  </AppText>
                </View>
                <View
                  style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: theme.spacing.sm,
                  }}
                >
                  <AppText
                    variant="caption"
                    color="muted"
                    numberOfLines={1}
                    style={{
                      flex: 1,
                      textAlign: isRTL ? 'right' : 'left',
                      fontSize: 11,
                    }}
                  >
                    {`${formatDate(p.paymentDate)} · ${methodLabel(method, t)}`}
                  </AppText>
                  {onPaymentPdf ? (
                    <AnimatedPressable
                      variant="button"
                      accessibilityRole="button"
                      accessibilityLabel={t('accounting.downloadPdf')}
                      onPress={() => {
                        void haptics.selection();
                        onPaymentPdf(p.id);
                      }}
                      hitSlop={8}
                    >
                      <AppText variant="caption" color="brand" weight="semibold">
                        {t('catalog.pdf')}
                      </AppText>
                    </AnimatedPressable>
                  ) : null}
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
