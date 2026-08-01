import { localizedName } from '@maher/i18n';
import { Stack } from 'expo-router';
import { ListScreen, statusFilters } from '../../../src/features/shared/ListScreen';
import type { SalesOrderRow } from '../../../src/features/home/use-home-data';
import { daysUntil, formatMoney } from '../../../src/lib/format';
import { useNav } from '../../../src/lib/nav';
import { useI18n } from '../../../src/providers/i18n-provider';
import { ListRow, StatusBadge } from '../../../src/ui';

const FILTERS = statusFilters(
  'DRAFT',
  'CONFIRMED',
  'IN_PRODUCTION',
  'READY_FOR_DELIVERY',
  'DELIVERED',
  'INVOICED',
  'COMPLETED',
  'CANCELLED',
);

type Row = SalesOrderRow & {
  total?: unknown;
  currency?: string | null;
  requiredDeliveryDate?: string | null;
  customer?: { nameEn?: string | null; nameAr?: string | null; name?: string | null } | null;
};

export default function SalesOrdersScreen() {
  const { t, locale } = useI18n();
  const router = useNav();

  return (
    <>
      <Stack.Screen options={{ title: t('navigation.salesOrders', 'Sales orders') }} />
      <ListScreen<Row>
        queryKey="sales-orders"
        basePath="/sales-orders"
        filters={FILTERS}
        emptyTitle={t('sales.empty', 'No sales orders')}
        emptyDescription={t('common.ordersSubtitle', 'Track manufacturing progress for each sales order.')}
        renderItem={(row) => {
          const delivery = row.requestedDeliveryDate ?? row.requiredDeliveryDate;
          const days = daysUntil(delivery);
          const total = row.totalAmount ?? row.total;
          const currency = row.currency ?? 'JOD';
          let deliveryHint: string | undefined;
          if (days != null) {
            if (days < 0) deliveryHint = t('mobile.overdueByDays', 'Overdue').concat(` · ${Math.abs(days)}d`);
            else if (days === 0) deliveryHint = t('mobile.dueToday', 'Due today');
            else if (days === 1) deliveryHint = t('mobile.dueTomorrow', 'Due tomorrow');
            else deliveryHint = `${t('mobile.dueIn', 'Due in')} ${days}d`;
          }
          return (
            <ListRow
              title={localizedName(
                locale,
                row.customer
                  ? { nameEn: row.customer.nameEn ?? row.customer.name, nameAr: row.customer.nameAr }
                  : null,
                row.number,
              )}
              meta={`${row.number} · ${formatMoney(total, currency)}`}
              description={deliveryHint}
              right={<StatusBadge status={row.status} />}
              onPress={() => router.push(`/sales-orders/${row.id}`)}
            />
          );
        }}
      />
    </>
  );
}
