import { localizedName } from '@maher/i18n';
import { Stack } from 'expo-router';
import { ListScreen, statusFilters } from '../../../src/features/shared/ListScreen';
import type { InspectionRow as HomeInspectionRow } from '../../../src/features/home/use-home-data';
import { formatDate } from '../../../src/lib/format';
import { useNav } from '../../../src/lib/nav';
import { useI18n } from '../../../src/providers/i18n-provider';
import { ListRow, StatusBadge } from '../../../src/ui';

type InspectionRow = HomeInspectionRow & {
  stageDefinition?: { nameEn?: string; nameAr?: string } | null;
};

const FILTERS = statusFilters('PENDING', 'IN_PROGRESS', 'COMPLETED');

export default function QualityScreen() {
  const { t, locale } = useI18n();
  const router = useNav();

  return (
    <>
      <Stack.Screen options={{ title: t('navigation.quality', 'Quality') }} />
      <ListScreen<InspectionRow>
        queryKey="quality-inspections"
        basePath="/quality-inspections"
        filters={FILTERS}
        emptyTitle={t('mobile.noInspections', 'No pending inspections')}
        emptyDescription={t(
          'mobile.noInspectionsHint',
          'Quality inspections ready for review will appear here.',
        )}
        renderItem={(row) => (
          <ListRow
            title={row.productionOrder?.number ?? row.number}
            meta={`${row.number} · ${formatDate(row.createdAt)}`}
            description={
              row.stageDefinition ? localizedName(locale, row.stageDefinition) : undefined
            }
            right={<StatusBadge status={row.result ?? row.status} />}
            onPress={() => router.push(`/quality/${row.id}`)}
          />
        )}
      />
    </>
  );
}
