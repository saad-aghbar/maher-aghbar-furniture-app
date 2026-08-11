import { ScrollView, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { statusLabel } from '@maher/i18n';
import { TertiaryButton } from '@/components/buttons/TertiaryButton';
import { resolveStatusVariant } from '@/components/badges/badgeStyles';
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

function toneForStatus(
  status: string,
): 'neutral' | 'success' | 'warning' | 'danger' | 'info' {
  const v = resolveStatusVariant(status);
  if (v === 'success') return 'success';
  if (v === 'warning') return 'warning';
  if (v === 'error') return 'danger';
  if (v === 'info' || v === 'brand') return 'info';
  return 'neutral';
}

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
                statusTone={toneForStatus(inv.status)}
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
