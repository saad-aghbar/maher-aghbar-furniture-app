import { localizedName } from '@maher/i18n';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { ListScreen, statusFilters } from '../../../src/features/shared/ListScreen';
import type { TaskRow } from '../../../src/features/home/use-home-data';
import { daysUntil, formatDate } from '../../../src/lib/format';
import { useNav } from '../../../src/lib/nav';
import { can } from '../../../src/permissions/can';
import { useAuth } from '../../../src/providers/auth-provider';
import { useI18n } from '../../../src/providers/i18n-provider';
import { colors } from '../../../src/theme/tokens';
import { Chip, ChipGroup, ListRow, ProgressBar, StatusBadge, Text } from '../../../src/ui';

const FILTERS = statusFilters('NOT_STARTED', 'IN_PROGRESS', 'PAUSED', 'BLOCKED', 'COMPLETED');

export default function TasksScreen() {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const router = useNav();
  // Supervisors can see the whole floor; workers are always scoped to themselves.
  const canSeeAll = can(user, 'production-task.update-any');
  const [mineOnly, setMineOnly] = useState(true);
  const scoped = canSeeAll ? mineOnly : true;

  return (
    <>
      <Stack.Screen options={{ title: t('navigation.tasks', 'Tasks') }} />
      <ListScreen<TaskRow>
        queryKey={`tasks-${scoped ? 'mine' : 'all'}`}
        basePath={scoped ? '/tasks?mine=true' : '/tasks'}
        filters={FILTERS}
        emptyTitle={t('mobile.noTasks', 'No tasks assigned')}
        emptyDescription={t('mobile.noTasksHint', 'Tasks assigned to you will appear here.')}
        header={
          canSeeAll ? (
            <ChipGroup>
              <Chip
                label={t('mobile.myTasks', 'My tasks')}
                active={mineOnly}
                onPress={() => setMineOnly(true)}
              />
              <Chip
                label={t('mobile.allTasks', 'All tasks')}
                active={!mineOnly}
                onPress={() => setMineOnly(false)}
              />
            </ChipGroup>
          ) : undefined
        }
        sortFn={(a, b) => {
          const da = daysUntil(a.plannedCompletion) ?? 9999;
          const db = daysUntil(b.plannedCompletion) ?? 9999;
          return da - db;
        }}
        renderItem={(task) => {
          const overdue = (daysUntil(task.plannedCompletion) ?? 1) < 0;
          const percent = Number(task.progressPercent ?? 0);
          return (
            <ListRow
              title={
                task.stageDefinition
                  ? localizedName(locale, task.stageDefinition, task.name)
                  : task.name
              }
              meta={`${task.number} · ${task.productionOrder?.number ?? '—'}`}
              description={
                task.plannedCompletion
                  ? `${t('catalog.plannedEnd', 'Planned end')}: ${formatDate(task.plannedCompletion)}`
                  : undefined
              }
              right={<StatusBadge status={task.status} />}
              accent={overdue ? colors.error : undefined}
              onPress={() => router.push(`/tasks/${task.id}`)}
              footer={
                <View>
                  <ProgressBar
                    percent={percent}
                    tone={task.status === 'BLOCKED' ? colors.error : colors.brand}
                  />
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
