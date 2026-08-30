import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import type { InvoiceDetailModel } from '../selectInvoice';
import { InvoiceFloorBoard } from './InvoiceFloorBoard';

type Props = {
  model: InvoiceDetailModel;
};

/** Slim dates & order refs board. */
export function InvoiceMetaBoard({ model }: Props) {
  const { t } = useLocale();
  const { theme, colors } = useTheme();

  return (
    <InvoiceFloorBoard quiet contentStyle={{ gap: theme.spacing.sm }}>
      <MetaRow label={t('accounting.invoiceDate')} value={model.invoiceDateLabel} />
      <View style={{ height: 1, alignSelf: 'stretch', backgroundColor: colors.border }} />
      <MetaRow
        label={t('accounting.dueDate')}
        value={model.dueDateLabel ?? '—'}
        hint={model.isOverdue ? t('accounting.overdueHint') : null}
        danger={model.isOverdue}
      />
      {model.factoryOrderNumber ? (
        <>
          <View style={{ height: 1, alignSelf: 'stretch', backgroundColor: colors.border }} />
          <MetaRow label={t('accounting.salesOrder')} value={model.factoryOrderNumber} />
        </>
      ) : null}
    </InvoiceFloorBoard>
  );
}

function MetaRow({
  label,
  value,
  hint,
  danger,
}: {
  label: string;
  value: string;
  hint?: string | null;
  danger?: boolean;
}) {
  const { isRTL } = useLocale();
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 12,
      }}
    >
      <AppText
        variant="caption"
        color="muted"
        style={{
          flexShrink: 0,
          fontSize: 12,
          textAlign: isRTL ? 'right' : 'left',
        }}
      >
        {label}
      </AppText>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <AppText
          weight="semibold"
          dir="ltr"
          numberOfLines={2}
          style={{
            fontSize: 14,
            lineHeight: 18,
            textAlign: isRTL ? 'left' : 'right',
            color: danger ? colors.error : colors.textPrimary,
          }}
        >
          {value}
        </AppText>
        {hint ? (
          <AppText
            variant="caption"
            numberOfLines={1}
            style={{
              fontSize: 11,
              textAlign: isRTL ? 'left' : 'right',
              color: danger ? colors.error : colors.textSecondary,
            }}
          >
            {hint}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}
