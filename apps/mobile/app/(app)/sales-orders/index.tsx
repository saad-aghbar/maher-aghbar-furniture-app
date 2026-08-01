import { localizedName } from '@maher/i18n';
import { Stack } from 'expo-router';
import { ListScreen, statusFilters } from '../../../src/features/shared/ListScreen';
import type { SalesOrderRow } from '../../../src/features/home/use-home-data';
import {daysUntil, formatMoney, relativeDay} from '../../../src/lib/format';
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
          const deliveryHint = relativeDay(days, t, days != null && days < 0 ? 'overdue' : 'due');
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
