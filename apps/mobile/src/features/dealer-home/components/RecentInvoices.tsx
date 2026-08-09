import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { ListItemEnter } from '@/motion';
import { useTheme } from '@/theme';
import type { DealerHomeInvoice } from '../api';

type RecentInvoicesProps = {
  invoices: DealerHomeInvoice[];
};

export function RecentInvoices({ invoices }: RecentInvoicesProps) {
  const { t, formatCurrency, formatDate, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  if (invoices.length === 0) return null;

  return (
    <View style={{ marginBottom: theme.spacing.xl, gap: theme.spacing.md }}>
      <SectionHeader title={t('mobile.dealerHome.recentInvoices')} />
      {invoices.map((inv, index) => {
        const due = Number(inv.outstandingAmount) > 0;
        return (
          <ListItemEnter key={inv.id} index={index}>
            <View
              style={{
                borderRadius: theme.radius.xl,
                borderWidth: 1,
                borderColor: due ? colors.warning : colors.borderStrong,
                backgroundColor: colors.surface,
                overflow: 'hidden',
                ...orderBoardShadow(colorScheme),
              }}
            >
              <View
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  ...(isRTL ? { right: 0 } : { left: 0 }),
                  width: 3,
                  backgroundColor: due ? colors.warning : colors.brand,
                  opacity: 0.7,
                }}
              />
              <View
                style={{
                  padding: theme.spacing.md,
                  gap: theme.spacing.xs,
                  ...(isRTL
                    ? { paddingRight: theme.spacing.md + 4 }
                    : { paddingLeft: theme.spacing.md + 4 }),
                }}
              >
                <View
                  style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: theme.spacing.sm,
                  }}
                >
                  <AppText
                    variant="label"
                    weight={titleWeight}
                    style={{ flex: 1 }}
                    numberOfLines={1}
                    dir="ltr"
                  >
                    {inv.number}
                  </AppText>
                  <StatusBadge status={inv.status} dot />
                </View>
                <AppText variant="body" weight="medium" dir="ltr">
                  {formatCurrency(Number(inv.outstandingAmount) || Number(inv.total))}
                </AppText>
                <AppText variant="caption" color="secondary">
                  {formatDate(inv.issuedAt)}
                  {due ? ` · ${t('mobile.dealerHome.invoiceOutstanding')}` : ''}
                </AppText>
              </View>
            </View>
          </ListItemEnter>
        );
      })}
    </View>
  );
}
