import { localizedName } from '@maher/i18n';
import { Stack } from 'expo-router';
import { ListScreen, statusFilters } from '../../../src/features/shared/ListScreen';
import { useI18n } from '../../../src/providers/i18n-provider';
import { ListRow, StatusBadge } from '../../../src/ui';

type CustomerRow = {
  id: string;
  code?: string | null;
  nameEn?: string | null;
  nameAr?: string | null;
  name?: string | null;
  status: string;
  phone?: string | null;
  email?: string | null;
  city?: string | null;
};

const FILTERS = statusFilters('LEAD', 'PROSPECT', 'ACTIVE', 'INACTIVE');

export default function CustomersScreen() {
  const { t, locale } = useI18n();

  return (
    <>
      <Stack.Screen options={{ title: t('navigation.customers', 'Customers') }} />
      <ListScreen<CustomerRow>
        queryKey="customers"
        basePath="/customers"
        filters={FILTERS}
        emptyTitle={t('customers.empty', 'No customers registered')}
        emptyDescription={t('customers.searchPlaceholder', 'Search by name or code…')}
        renderItem={(row) => {
          const meta = `${row.code ?? ''} ${row.phone ?? ''}`.trim();
          const description = [row.city, row.email].filter(Boolean).join(' · ') || undefined;
          return (
            <ListRow
              title={localizedName(
                locale,
                { nameEn: row.nameEn ?? row.name, nameAr: row.nameAr },
                row.code ?? '—',
              )}
              meta={meta || undefined}
              description={description}
              right={<StatusBadge status={row.status} />}
            />
          );
        }}
      />
    </>
  );
}
