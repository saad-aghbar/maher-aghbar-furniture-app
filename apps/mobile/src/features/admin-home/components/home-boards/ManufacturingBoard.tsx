import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';

type Manufacturing = {
  finalCostOrders: number;
  finalCostTotal: number;
  incompleteCosting: number;
  grossMfgDifference: number | null;
};

type Props = {
  manufacturing: Manufacturing;
  finalOrdersLabel: string;
  incompleteLabel?: string;
  grossDiffLabel: string;
};

/** Cost stamp + incomplete bar — Manufacturing board. */
export function ManufacturingBoard({
  manufacturing,
  finalOrdersLabel,
  incompleteLabel,
  grossDiffLabel,
}: Props) {
  const { formatCurrency, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const incomplete = manufacturing.incompleteCosting;
  const totalOrders = Math.max(manufacturing.finalCostOrders + incomplete, 1);
  const completeShare = Math.round((manufacturing.finalCostOrders / totalOrders) * 100);

  return (
    <View
      style={{
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: colors.borderStrong,
        backgroundColor: colors.surfaceSecondary,
        padding: theme.spacing.lg,
        gap: theme.spacing.md,
        ...orderBoardShadow(colorScheme),
      }}
    >
      <AppText variant="bodySecondary" color="secondary">
        {finalOrdersLabel}
      </AppText>
      <AppText variant="heading" weight="semibold" color="brand">
        {formatCurrency(manufacturing.finalCostTotal)}
      </AppText>

      <View style={{ gap: 6 }}>
        <View
          style={{
            height: 8,
            borderRadius: 4,
            backgroundColor: colors.border,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              width: `${Math.max(8, completeShare)}%`,
              height: '100%',
              backgroundColor: incomplete > 0 ? colors.warning : colors.success,
              alignSelf: isRTL ? 'flex-end' : 'flex-start',
            }}
          />
        </View>
        {incomplete > 0 && incompleteLabel ? (
          <AppText variant="caption" style={{ color: colors.warning }}>
            {incompleteLabel}
          </AppText>
        ) : null}
      </View>

      {manufacturing.grossMfgDifference != null ? (
        <AppText variant="body" weight="semibold">
          {grossDiffLabel}: {formatCurrency(manufacturing.grossMfgDifference)}
        </AppText>
      ) : null}
    </View>
  );
}
