import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { AnimatedPressable, ListItemEnter, haptics } from '@/motion';
import { useTheme } from '@/theme';
import type { InvoiceDetailModel } from '../selectInvoice';
import { InvoiceFloorBoard } from './InvoiceFloorBoard';

type Props = {
  model: InvoiceDetailModel;
  currencySuffix?: string;
  methodLabel: (method: string) => string;
  onPaymentPdf?: (paymentId: string) => void;
};

/** Timeline-ish payment history board. */
export function InvoicePaymentsBoard({
  model,
  currencySuffix = 'ILS',
  methodLabel,
  onPaymentPdf,
}: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  return (
    <InvoiceFloorBoard title={t('accounting.paymentHistory')} quiet>
      {model.payments.length === 0 ? (
        <AppText
          variant="caption"
          color="muted"
          style={{ textAlign: isRTL ? 'right' : 'left' }}
        >
          {t('accounting.noPayments')}
        </AppText>
      ) : (
        model.payments.map((p, index) => (
          <ListItemEnter key={p.id} index={index}>
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                gap: theme.spacing.md,
                paddingBottom: index < model.payments.length - 1 ? theme.spacing.md : 0,
                borderBottomWidth: index < model.payments.length - 1 ? 1 : 0,
                borderBottomColor: colors.border,
              }}
            >
              <View
                style={{
                  width: 10,
                  alignItems: 'center',
                  paddingTop: 5,
                }}
              >
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: colors.brand,
                    opacity: 0.75,
                  }}
                />
                {index < model.payments.length - 1 ? (
                  <View
                    style={{
                      flex: 1,
                      width: 1,
                      marginTop: 4,
                      backgroundColor: colors.borderStrong,
                      minHeight: 18,
                    }}
                  />
                ) : null}
              </View>

              <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                <View
                  style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    gap: theme.spacing.sm,
                  }}
                >
                  <AppText
                    weight={titleWeight}
                    dir="ltr"
                    numberOfLines={1}
                    style={{ flex: 1, fontSize: 14 }}
                  >
                    {p.number}
                  </AppText>
                  <AppText
                    weight="semibold"
                    dir="ltr"
                    style={{
                      fontSize: 15,
                      fontVariant: ['tabular-nums'],
                      color: colors.brand,
                    }}
                  >
                    {`${p.amountLabel} ${currencySuffix}`}
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
                    color="secondary"
                    style={{
                      flex: 1,
                      textAlign: isRTL ? 'right' : 'left',
                      lineHeight: 17,
                    }}
                  >
                    {[p.dateLabel, methodLabel(p.method), p.reference]
                      .filter(Boolean)
                      .join(' · ')}
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
          </ListItemEnter>
        ))
      )}
    </InvoiceFloorBoard>
  );
}
