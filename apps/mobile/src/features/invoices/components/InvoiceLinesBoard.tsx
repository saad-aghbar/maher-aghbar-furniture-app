import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { ListItemEnter } from '@/motion';
import { useTheme } from '@/theme';
import type { InvoiceDetailModel } from '../selectInvoice';
import { InvoiceFloorBoard } from './InvoiceFloorBoard';

type Props = {
  model: InvoiceDetailModel;
  currencySuffix?: string;
};

/** Receipt-style line items board. */
export function InvoiceLinesBoard({ model, currencySuffix = '₪' }: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  return (
    <InvoiceFloorBoard title={t('accounting.lines')} quiet>
      {model.lines.length === 0 ? (
        <AppText
          variant="caption"
          color="muted"
          style={{ textAlign: isRTL ? 'right' : 'left' }}
        >
          {t('accounting.noLines')}
        </AppText>
      ) : (
        model.lines.map((line, index) => (
          <ListItemEnter key={line.id} index={index}>
            <View
              style={{
                gap: 6,
                paddingBottom: index < model.lines.length - 1 ? theme.spacing.md : 0,
                borderBottomWidth: index < model.lines.length - 1 ? 1 : 0,
                borderBottomColor: colors.border,
              }}
            >
              <AppText
                weight={titleWeight}
                style={{
                  textAlign: isRTL ? 'right' : 'left',
                  fontSize: 15,
                  lineHeight: 20,
                }}
              >
                {line.description}
              </AppText>
              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  gap: theme.spacing.sm,
                }}
              >
                <AppText variant="caption" color="secondary" dir="ltr" style={{ flex: 1 }}>
                  {`${line.quantityLabel} × ${line.unitPriceLabel} ${currencySuffix}`}
                </AppText>
                <AppText
                  weight="semibold"
                  dir="ltr"
                  style={{
                    fontSize: 14,
                    fontVariant: ['tabular-nums'],
                    color: colors.textPrimary,
                  }}
                >
                  {`${line.lineTotalLabel} ${currencySuffix}`}
                </AppText>
              </View>
            </View>
          </ListItemEnter>
        ))
      )}
    </InvoiceFloorBoard>
  );
}
