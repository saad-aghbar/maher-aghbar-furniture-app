import { localizedName } from '@maher/i18n';
import { Stack } from 'expo-router';
import { ListScreen, statusFilters } from '../../../src/features/shared/ListScreen';
import type { DeliveryRow as HomeDeliveryRow } from '../../../src/features/home/use-home-data';
import {daysUntil, formatDate, relativeDay} from '../../../src/lib/format';
import { useNav } from '../../../src/lib/nav';
import { useI18n } from '../../../src/providers/i18n-provider';
import { colors } from '../../../src/theme/tokens';
import { ListRow, StatusBadge } from '../../../src/ui';

type DeliveryRow = HomeDeliveryRow & {
  salesOrder?: { number: string } | null;
  items?: { id: string }[];
};

const FILTERS = statusFilters(
  'PLANNED',
  'READY_FOR_DELIVERY',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'FAILED',
  'RESCHEDULED',
);

export default function DeliveriesScreen() {
  const { t, locale } = useI18n();
  const router = useNav();

  return (
    <>
      <Stack.Screen options={{ title: t('navigation.deliveries', 'Deliveries') }} />
      <ListScreen<DeliveryRow>
        queryKey="deliveries"
        basePath="/deliveries"
        filters={FILTERS}
        emptyTitle={t('mobile.noDeliveries', 'No deliveries scheduled')}
        emptyDescription={t(
          'mobile.noDeliveriesHint',
          'Scheduled deliveries will appear here.',
        )}
        sortFn={(a, b) => {
          const da = a.scheduledDate;
          const db = b.scheduledDate;
          if (!da && !db) return 0;
          if (!da) return 1;
          if (!db) return -1;
          return new Date(da).getTime() - new Date(db).getTime();
        }}
        renderItem={(row) => {
          const due = daysUntil(row.scheduledDate);
          const overdue = due != null && due < 0 && row.status !== 'DELIVERED';
          const description = relativeDay(due, t, due != null && due < 0 ? 'overdue' : 'due');
          return (
            <ListRow
              title={localizedName(locale, row.customer, row.number)}
              meta={`${row.number} · ${formatDate(row.scheduledDate)}`}
              description={description}
              right={<StatusBadge status={row.status} />}
              accent={overdue ? colors.error : undefined}
              onPress={() => router.push(`/deliveries/${row.id}`)}
            />
          );
        }}
      />
    </>
  );
}
