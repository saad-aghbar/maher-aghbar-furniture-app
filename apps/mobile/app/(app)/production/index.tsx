import { Stack } from 'expo-router';
import { View } from 'react-native';
import { ListScreen, statusFilters } from '../../../src/features/shared/ListScreen';
import {daysUntil, relativeDay} from '../../../src/lib/format';
import { useNav } from '../../../src/lib/nav';
import { useI18n } from '../../../src/providers/i18n-provider';
import { colors } from '../../../src/theme/tokens';
import { ListRow, ProgressBar, StatusBadge, Text } from '../../../src/ui';

type ProductionRow = {
  id: string;
  number: string;
  status: string;
  productDescription?: string | null;
  plannedStart?: string | null;
  plannedStartDate?: string | null;
  plannedCompletion?: string | null;
  plannedCompletionDate?: string | null;
  progressPercent?: number | null;
  salesOrder?: {
    number?: string | null;
    customer?: { nameEn?: string | null; nameAr?: string | null } | null;
  } | null;
  stages?: { id: string; status: string }[];
};

const FILTERS = statusFilters(
  'PLANNED',
  'READY',
  'IN_PROGRESS',
  'WAITING_FOR_MATERIALS',
  'QUALITY_CHECK',
  'ON_HOLD',
  'COMPLETED',
  'CANCELLED',
);

function progressOf(row: ProductionRow): number {
  if (row.progressPercent != null && Number.isFinite(Number(row.progressPercent))) {
    return Number(row.progressPercent);
  }
  const stages = row.stages ?? [];
  if (stages.length === 0) return 0;
  const done = stages.filter((s) => s.status === 'COMPLETED').length;
  return (done / stages.length) * 100;
}

export default function ProductionScreen() {
  const { t } = useI18n();
  const router = useNav();

  return (
    <>
      <Stack.Screen options={{ title: t('navigation.production', 'Production') }} />
      <ListScreen<ProductionRow>
        queryKey="production-orders"
        basePath="/production-orders"
        filters={FILTERS}
        emptyTitle={t('mobile.noProductionOrders', 'No production orders')}
        emptyDescription={t(
          'mobile.noProductionOrdersHint',
          'Production orders will appear here when scheduled.',
        )}
        renderItem={(row) => {
          const completion = row.plannedCompletion ?? row.plannedCompletionDate;
          const due = daysUntil(completion);
          const overdue = due != null && due < 0 && row.status !== 'COMPLETED';
          const dueHint = relativeDay(due, t, due != null && due < 0 ? 'overdue' : 'due');
          const percent = Math.round(progressOf(row));
          return (
            <ListRow
              title={row.productDescription || row.number}
              meta={`${row.number} · ${row.salesOrder?.number ?? '—'}`}
              description={dueHint}
              right={<StatusBadge status={row.status} />}
              accent={overdue ? colors.error : undefined}
              onPress={() => router.push(`/production/${row.id}`)}
              footer={
                <View>
                  <ProgressBar percent={percent} />
                  <Text variant="micro" color="tertiary" latin style={{ marginTop: 4 }}>
                    {`${percent}%`}
                  </Text>
                </View>
              }
            />
          );
        }}
      />
    </>
  );
}
