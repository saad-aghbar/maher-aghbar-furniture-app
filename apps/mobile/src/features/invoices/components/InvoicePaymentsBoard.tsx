import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { ListItemEnter } from '@/motion';
import { useTheme } from '@/theme';
import { paymentHistoryCaption, type InvoiceDetailModel } from '../selectInvoice';
import { InvoiceFloorBoard } from './InvoiceFloorBoard';
import { InvoiceRowActionChip } from './InvoiceRowActionChip';

type Props = {
  model: InvoiceDetailModel;
  currencySuffix?: string;
  methodLabel: (method: string) => string;
  onPaymentPdf?: (paymentId: string) => void;
  canEditPayments?: boolean;
  onEditPayment?: (row: InvoiceDetailModel['payments'][number]) => void;
  onDeletePayment?: (row: InvoiceDetailModel['payments'][number]) => void;
};

/** Timeline-ish payment history board. */
export function InvoicePaymentsBoard({
  model,
  currencySuffix = '₪',
  methodLabel,
  onPaymentPdf,
  canEditPayments,
  onEditPayment,
  onDeletePayment,
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
        model.payments.map((p, index) => {
          const canMutateRow = Boolean(canEditPayments);
          return (
          <ListItemEnter key={p.allocationId ?? p.id} index={index}>
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
                <AppText
                  variant="caption"
                  color="secondary"
                  style={{
                    textAlign: isRTL ? 'right' : 'left',
                    lineHeight: 17,
                  }}
                >
                  {paymentHistoryCaption([
                    p.dateLabel,
                    p.kind === 'credit' ? t('accounting.applyCredit') : methodLabel(p.method),
                    p.reference,
                  ])}
                </AppText>
                {onPaymentPdf || (canMutateRow && (onEditPayment || onDeletePayment)) ? (
                  <View
                    style={{
                      flexDirection: isRTL ? 'row-reverse' : 'row',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      gap: theme.spacing.sm,
                      paddingTop: 4,
                    }}
                  >
                    {onPaymentPdf ? (
                      <InvoiceRowActionChip
                        label={t('catalog.pdf')}
                        icon="download-outline"
                        onPress={() => onPaymentPdf(p.id)}
                      />
                    ) : null}
                    {canMutateRow && onEditPayment ? (
                      <InvoiceRowActionChip
                        label={t('mobile.invoices.edit')}
                        icon="create-outline"
                        onPress={() => onEditPayment(p)}
                      />
                    ) : null}
                    {canMutateRow && onDeletePayment ? (
                      <InvoiceRowActionChip
                        label={t('common.delete')}
                        icon="trash-outline"
                        tone="danger"
                        onPress={() => onDeletePayment(p)}
                      />
                    ) : null}
                  </View>
                ) : null}
              </View>
            </View>
          </ListItemEnter>
          );
        })
      )}
    </InvoiceFloorBoard>
  );
}
