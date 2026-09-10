import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import { PurchasingFloorBoard } from './PurchasingFloorBoard';

export type ReceiveLineCardProps = {
  name: string;
  sku: string;
  ordered: string;
  remaining: string;
  destination: string;
};

export function ReceiveLineCard({
  name,
  sku,
  ordered,
  remaining,
  destination,
}: ReceiveLineCardProps) {
  const { t, isRTL } = useLocale();
  const { theme } = useTheme();
  const row = isRTL ? 'row-reverse' : 'row';
  return (
    <PurchasingFloorBoard title={name}>
      <AppText variant="caption" color="muted" dir="ltr">
        {sku}
      </AppText>
      <View style={{ flexDirection: row, justifyContent: 'space-between' }}>
        <AppText variant="caption">{t('catalog.qty')}</AppText>
        <AppText dir="ltr">{ordered}</AppText>
      </View>
      <View style={{ flexDirection: row, justifyContent: 'space-between' }}>
        <AppText variant="caption">{t('catalog.remainingQty')}</AppText>
        <AppText dir="ltr">{remaining}</AppText>
      </View>
      <View style={{ paddingTop: theme.spacing.xs }}>
        <AppText variant="caption">{destination}</AppText>
      </View>
    </PurchasingFloorBoard>
  );
}
