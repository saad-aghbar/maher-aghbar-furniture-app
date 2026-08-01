import { localizedName } from '@maher/i18n';
import { Stack } from 'expo-router';
import { View } from 'react-native';
import { ListScreen } from '../../../src/features/shared/ListScreen';
import {daysUntil, formatMoney, relativeDay} from '../../../src/lib/format';
import { useNav } from '../../../src/lib/nav';
import { useI18n } from '../../../src/providers/i18n-provider';
import { colors } from '../../../src/theme/tokens';
import { ListRow, ProgressBar, StatusBadge, Text } from '../../../src/ui';

type InvoiceRow = {
  id: string;
  number: string;
  status: string;
  totalAmount?: unknown;
  total?: unknown;
  paidAmount?: unknown;
  currency?: string | null;
  issueDate?: string | null;
  invoiceDate?: string | null;
  dueDate?: string | null;
  customer?: {
    nameEn?: string | null;
    nameAr?: string | null;
    name?: string | null;
  } | null;
};

export default function InvoicesScreen() {
  const { t, locale } = useI18n();
  const router = useNav();

  return (
    <>
      <Stack.Screen options={{ title: t('navigation.invoices', 'Invoices') }} />
      <ListScreen<InvoiceRow>
        queryKey="invoices"
        basePath="/invoices"
        emptyTitle={t('accounting.empty', 'No invoices')}
        emptyDescription={t('common.invoicesSubtitle', 'Electronic invoices and balances.')}
        renderItem={(row) => {
          const currency = row.currency ?? 'JOD';
          const total = Number(row.totalAmount ?? row.total ?? 0);
          const paid = Number(row.paidAmount ?? 0);
          const due = daysUntil(row.dueDate);
          const overdue = due != null && due < 0 && row.status !== 'PAID';
          const dueHint = relativeDay(due, t, due != null && due < 0 ? 'overdue' : 'due');
          const showProgress =
            row.paidAmount != null && row.status === 'PARTIALLY_PAID' && total > 0;
          return (
            <ListRow
              title={localizedName(
                locale,
                row.customer
                  ? {
                      nameEn: row.customer.nameEn ?? row.customer.name,
                      nameAr: row.customer.nameAr,
                    }
                  : null,
                row.number,
              )}
              meta={`${row.number} · ${formatMoney(total, currency)}`}
              description={dueHint}
              right={<StatusBadge status={row.status} />}
              accent={overdue ? colors.error : undefined}
              onPress={() => router.push(`/invoices/${row.id}`)}
              footer={
                showProgress ? (
                  <View>
                    <ProgressBar percent={(paid / total) * 100} />
                    <Text variant="micro" color="tertiary" latin style={{ marginTop: 4 }}>
                      {`${formatMoney(paid, currency)} / ${formatMoney(total, currency)}`}
                    </Text>
                  </View>
                ) : undefined
              }
            />
          );
        }}
      />
    </>
  );
}
