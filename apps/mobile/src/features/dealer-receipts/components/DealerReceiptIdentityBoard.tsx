import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { ProductThumb } from '@/components/desk/ProductThumb';
import { OrderBoardCard } from '@/features/sales-orders/components/OrderBoardCard';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import type { DealerReceiptKind } from '../selectDealerReceipts';
import { DealerReceiptStub } from './DealerReceiptStub';

type Props = {
  number: string;
  title: string;
  mediaUri?: string | null;
  quantityLabel: string;
  kind: DealerReceiptKind;
  ymd: string | null;
};

/** Receipt identity — 72px media, product, qty, receipt stub. */
export function DealerReceiptIdentityBoard({
  number,
  title,
  mediaUri,
  quantityLabel,
  kind,
  ymd,
}: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const awaiting = kind === 'awaiting';
  const accent = awaiting ? colors.warning : colors.success;

  return (
    <OrderBoardCard
      accent={accent}
      header={
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
            weight={titleWeight}
            style={{ color: awaiting ? colors.warning : colors.success }}
          >
            {t(
              awaiting
                ? 'mobile.dealerReceipts.stubAwaiting'
                : 'mobile.dealerReceipts.stubReceived',
            )}
          </AppText>
          <AppText
            variant="caption"
            color="brand"
            weight={titleWeight}
            dir="ltr"
            numberOfLines={1}
            style={{ flexShrink: 1 }}
          >
            {number}
          </AppText>
        </View>
      }
    >
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'stretch',
          gap: theme.spacing.md,
        }}
      >
        <ProductThumb uri={mediaUri} size={72} radius={theme.radius.md} />
        <View style={{ flex: 1, minWidth: 0, gap: theme.spacing.xs }}>
          <AppText
            variant="title"
            weight={titleWeight}
            style={{ textAlign: isRTL ? 'right' : 'left' }}
          >
            {title}
          </AppText>
          <AppText
            variant="caption"
            color="muted"
            dir="ltr"
            style={{ textAlign: isRTL ? 'right' : 'left' }}
          >
            {t('mobile.orders.qty')} · {quantityLabel}
          </AppText>
        </View>
        <DealerReceiptStub kind={kind} ymd={ymd} />
      </View>
    </OrderBoardCard>
  );
}
