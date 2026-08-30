import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable } from '@/motion';
import { useTheme } from '@/theme';
import { useMgmtNav } from './boardShared';
import type { MgmtFinanceSummary } from '../../api';

type Props = {
  finance: MgmtFinanceSummary;
  dueLabel: string;
  overdueLabel: string;
  creditLabel: string;
  invoicesLabel: string;
};

/** Twin ledger + invoice CTA — Money board. */
export function MoneyBoard({
  finance,
  dueLabel,
  overdueLabel,
  creditLabel,
  invoicesLabel,
}: Props) {
  const { formatCurrency, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const nav = useMgmtNav();

  return (
    <View style={{ gap: theme.spacing.md }}>
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          gap: theme.spacing.sm,
        }}
      >
        <View
          style={{
            flex: 1,
            borderRadius: theme.radius.lg,
            borderWidth: 1,
            borderColor: colors.borderStrong,
            backgroundColor: colors.surfaceSecondary,
            padding: theme.spacing.md,
            gap: 6,
            borderTopWidth: 3,
            borderTopColor: colors.brand,
            ...orderBoardShadow(colorScheme),
          }}
        >
          <AppText variant="caption" color="secondary">
            {dueLabel}
          </AppText>
          <AppText variant="heading" weight="semibold" color="brand">
            {formatCurrency(finance.receivable)}
          </AppText>
          {finance.overdue > 0 ? (
            <AppText variant="caption" style={{ color: colors.error }}>
              {overdueLabel}: {formatCurrency(finance.overdue)}
            </AppText>
          ) : null}
        </View>
        <View
          style={{
            flex: 1,
            borderRadius: theme.radius.lg,
            borderWidth: 1,
            borderColor: colors.borderStrong,
            backgroundColor: colors.surfaceSecondary,
            padding: theme.spacing.md,
            gap: 6,
            borderTopWidth: 3,
            borderTopColor: colors.success,
            ...orderBoardShadow(colorScheme),
          }}
        >
          <AppText variant="caption" color="secondary">
            {creditLabel}
          </AppText>
          <AppText variant="heading" weight="semibold" style={{ color: colors.success }}>
            {formatCurrency(finance.accountCredit)}
          </AppText>
        </View>
      </View>

      {finance.openInvoices.count > 0 ? (
        <AnimatedPressable
          variant="card"
          accessibilityRole="button"
          accessibilityLabel={`${invoicesLabel} ${finance.openInvoices.count}`}
          onPress={() => nav(finance.openInvoices.href, finance.openInvoices.filter)}
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: theme.spacing.md,
            borderRadius: theme.radius.lg,
            borderWidth: 1,
            borderColor: colors.borderStrong,
            backgroundColor: colors.surface,
            padding: theme.spacing.md,
            ...orderBoardShadow(colorScheme),
          }}
        >
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              backgroundColor: colors.brandSoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="document-text-outline" size={18} color={colors.brand} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="label" weight="semibold">
              {invoicesLabel}
            </AppText>
            <AppText variant="caption" color="secondary">
              {finance.openInvoices.count}
            </AppText>
          </View>
          <Ionicons
            name={isRTL ? 'chevron-back' : 'chevron-forward'}
            size={16}
            color={colors.textMuted}
          />
        </AnimatedPressable>
      ) : null}
    </View>
  );
}
