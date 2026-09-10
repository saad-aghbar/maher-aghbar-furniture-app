import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import { PurchasingFloorBoard } from './PurchasingFloorBoard';

export type LowStockSupplierBoardProps = {
  supplierName: string;
  itemCount: number;
  unassigned?: boolean;
};

export function LowStockSupplierBoard({
  supplierName,
  itemCount,
  unassigned,
}: LowStockSupplierBoardProps) {
  const { t, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  return (
    <PurchasingFloorBoard title={supplierName}>
      {unassigned ? (
        <AppText variant="caption" style={{ color: colors.warning }}>
          {t('mobile.purchasing.unassignedSupplierHint')}
        </AppText>
      ) : null}
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
        }}
      >
        <StatusBadge status={unassigned ? 'NEEDS_REVIEW' : 'READY'} />
        <AppText variant="caption" dir="ltr">
          {itemCount}
        </AppText>
      </View>
    </PurchasingFloorBoard>
  );
}
