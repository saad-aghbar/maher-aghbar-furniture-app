import { ScrollView, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { statusLabel } from '@maher/i18n';
import { TertiaryButton } from '@/components/buttons/TertiaryButton';
import {
  DealerInvoiceCard,
  DealerSectionHeader,
} from '@/features/dealer-ui';
import { useLocale } from '@/i18n';
import { ListItemEnter } from '@/motion';
import { useTheme } from '@/theme';
import type { DealerHomeInvoiceCardModel } from '../selectDealerHome';

type Props = {
  invoices: DealerHomeInvoiceCardModel[];
};

export function RecentInvoices({ invoices }: Props) {
  const { t, locale, formatCurrency, formatDate, isRTL } = useLocale();
  const { theme } = useTheme();
  const router = useRouter();

  if (invoices.length === 0) return null;

  return (
    <View style={{ marginBottom: theme.spacing.lg, gap: theme.spacing.sm }}>
      <DealerSectionHeader
        title={t('mobile.dealerHome.recentInvoices')}
        action={
          <TertiaryButton
            label={t('mobile.dealerHome.seeAll')}
            onPress={() => router.push('/(app)/(customer)/invoices' as Href)}
          />
        }
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          gap: theme.spacing.md,
          paddingEnd: theme.spacing.sm,
          flexDirection: isRTL ? 'row-reverse' : 'row',
        }}
      >
        {invoices.map((inv, index) => {
          const due = inv.outstandingAmount > 0;
          return (
            <ListItemEnter key={inv.id} index={index}>
              <DealerInvoiceCard
                title={inv.number}
                amountLabel={formatCurrency(
                  due ? inv.outstandingAmount : inv.total,
                )}
                dueLabel={
                  inv.dueDate
                    ? formatDate(inv.dueDate)
                    : due
                      ? t('mobile.dealerHome.invoiceOutstanding')
                      : formatDate(inv.issuedAt)
                }
                statusLabel={statusLabel(locale, inv.status)}
                status={inv.status}
                onPress={() =>
                  router.push(`/(app)/(customer)/invoices/${inv.id}` as Href)
                }
              />
            </ListItemEnter>
          );
        })}
      </ScrollView>
    </View>
  );
}
