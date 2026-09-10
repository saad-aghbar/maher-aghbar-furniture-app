import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import { PurchasingFloorBoard } from './PurchasingFloorBoard';

export type BuilderLineCardProps = {
  name: string;
  sku: string;
  quantity: string;
  unitPrice: string;
  destination: string;
};

export function BuilderLineCard({ name, sku, quantity, unitPrice, destination }: BuilderLineCardProps) {
  const { t, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const row = isRTL ? 'row-reverse' : 'row';
  return (
    <PurchasingFloorBoard title={name}>
      <AppText variant="caption" color="muted" dir="ltr">
        {sku}
      </AppText>
      <View style={{ flexDirection: row, justifyContent: 'space-between' }}>
        <AppText variant="caption">{t('catalog.qty')}</AppText>
        <AppText dir="ltr">{quantity}</AppText>
      </View>
      <View style={{ flexDirection: row, justifyContent: 'space-between' }}>
        <AppText variant="caption">{t('catalog.unitPrice')}</AppText>
        <AppText dir="ltr">{unitPrice}</AppText>
      </View>
      <View
        style={{
          borderRadius: theme.radius.md,
          backgroundColor: colors.surfaceSecondary,
          padding: theme.spacing.sm,
        }}
      >
        <AppText variant="caption">{destination}</AppText>
      </View>
    </PurchasingFloorBoard>
  );
}
