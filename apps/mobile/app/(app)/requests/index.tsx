import { localizedName } from '@maher/i18n';
import { Stack } from 'expo-router';
import { ListScreen, statusFilters } from '../../../src/features/shared/ListScreen';
import type { RequestRow } from '../../../src/features/home/use-home-data';
import { formatDate } from '../../../src/lib/format';
import { useNav } from '../../../src/lib/nav';
import { useI18n } from '../../../src/providers/i18n-provider';
import { ListRow, StatusBadge } from '../../../src/ui';

const FILTERS = statusFilters(
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'NEEDS_INFORMATION',
  'READY_FOR_QUOTATION',
  'QUOTED',
  'CLOSED',
);

type Row = RequestRow & {
  title?: string | null;
  projectName?: string | null;
  customer?: { nameEn?: string | null; nameAr?: string | null; name?: string | null } | null;
};

export default function RequestsScreen() {
  const { t, locale } = useI18n();
  const router = useNav();

  return (
    <>
      <Stack.Screen options={{ title: t('navigation.rfqRequests', 'Requests') }} />
      <ListScreen<Row>
        queryKey="requests"
        basePath="/requests"
        filters={FILTERS}
        emptyTitle={t('quotations.noRequestsYet', 'No requests yet')}
        emptyDescription={t('quotations.noRequestsHint', 'Submit a quote request from Request quote.')}
        renderItem={(row) => {
          const title =
            row.title ||
            row.projectName ||
            localizedName(
              locale,
              row.customer
                ? { nameEn: row.customer.nameEn ?? row.customer.name, nameAr: row.customer.nameAr }
                : null,
              row.number,
            );
          return (
            <ListRow
              title={title}
              meta={`${row.number} · ${formatDate(row.createdAt)}`}
              right={<StatusBadge status={row.status} />}
              onPress={() => router.push(`/requests/${row.id}`)}
            />
          );
        }}
      />
    </>
  );
}
