import { localizedName } from '@maher/i18n';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Alert, StyleSheet, View } from 'react-native';
import { apiFetch } from '../../../src/api/client';
import { errorMessage, useAction, useItemQuery } from '../../../src/api/hooks';
import { formatDate } from '../../../src/lib/format';
import { useNav } from '../../../src/lib/nav';
import { can } from '../../../src/permissions/can';
import { useAuth } from '../../../src/providers/auth-provider';
import { useI18n } from '../../../src/providers/i18n-provider';
import { spacing } from '../../../src/theme/tokens';
import {
  Button,
  Card,
  ErrorState,
  ListRow,
  ListSkeleton,
  ProgressBar,
  Row,
  Screen,
  Section,
  StatusBadge,
  Text,
} from '../../../src/ui';

type StageTask = {
  id: string;
  number: string;
  name: string;
  status: string;
  progressPercent?: number | null;
  assignedEmployee?: { firstName?: string | null; lastName?: string | null } | null;
};

type Stage = {
  id: string;
  status: string;
  progressPercent?: number | null;
  startedAt?: string | null;
  actualStart?: string | null;
  completedAt?: string | null;
  actualEnd?: string | null;
  stageDefinition?: {
    code?: string | null;
    nameEn?: string | null;
    nameAr?: string | null;
  } | null;
  tasks?: StageTask[];
};

type ProductionDetail = {
  id: string;
  number: string;
  status: string;
  productDescription?: string | null;
  plannedStart?: string | null;
  plannedStartDate?: string | null;
  plannedCompletion?: string | null;
  plannedCompletionDate?: string | null;
  actualStart?: string | null;
  actualStartDate?: string | null;
  progressPercent?: number | null;
  notes?: string | null;
  salesOrder?: {
    id?: string;
    number?: string | null;
    customer?: {
      nameEn?: string | null;
      nameAr?: string | null;
      name?: string | null;
    } | null;
  } | null;
  stages?: Stage[];
};

function overallProgress(order: ProductionDetail): number {
  if (order.progressPercent != null && Number.isFinite(Number(order.progressPercent))) {
    return Number(order.progressPercent);
  }
  const stages = order.stages ?? [];
  if (stages.length === 0) return 0;
  const done = stages.filter((s) => s.status === 'COMPLETED').length;
  return (done / stages.length) * 100;
}

export default function ProductionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const router = useNav();

  const key = ['production-orders', id];
  const query = useItemQuery<ProductionDetail>(key, `/production-orders/${id}`, {
    enabled: Boolean(id),
  });
  const invalidate = [['production-orders'], key];

  const onError = (err: unknown) =>
    Alert.alert(t('common.error', 'Error'), errorMessage(err, t('common.actionFailed', 'Action failed')));

  const start = useAction(
    () => apiFetch(`/production-orders/${id}/start`, { method: 'POST' }),
    invalidate,
  );

  if (query.isLoading) {
    return (
      <Screen>
        <ListSkeleton rows={3} />
      </Screen>
    );
  }
  if (query.isError || !query.data) {
    return (
      <Screen>
        <ErrorState onRetry={() => void query.refetch()} />
      </Screen>
    );
  }

  const order = query.data;
  const stages = order.stages ?? [];
  const percent = Math.round(overallProgress(order));
  const canStart = can(user, 'production-order.update') && order.status === 'PLANNED';
  const customerName = localizedName(
    locale,
    order.salesOrder?.customer
      ? {
          nameEn: order.salesOrder.customer.nameEn ?? order.salesOrder.customer.name,
          nameAr: order.salesOrder.customer.nameAr,
        }
      : null,
  );

  return (
    <>
      <Stack.Screen options={{ title: order.number }} />
      <Screen
        refreshing={query.isFetching}
        onRefresh={() => void query.refetch()}
        footer={
          canStart ? (
            <Button
              label={t('catalog.startProduction', 'Start production')}
              loading={start.isPending}
              onPress={() =>
                Alert.alert(
                  t('catalog.startProduction', 'Start production'),
                  t('mobile.startProductionConfirm', 'Start this production order?'),
                  [
                    { text: t('common.cancel', 'Cancel'), style: 'cancel' },
                    {
                      text: t('catalog.startProduction', 'Start production'),
                      onPress: () => start.mutate(undefined, { onError }),
                    },
                  ],
                )
              }
              fullWidth
            />
          ) : undefined
        }
      >
        <Card>
          <View style={styles.titleRow}>
            <View style={styles.titleText}>
              <Text variant="title">{order.productDescription || order.number}</Text>
              <Text variant="caption" color="secondary" latin>
                {order.number}
              </Text>
            </View>
            <StatusBadge status={order.status} />
          </View>
          <View style={styles.progressBlock}>
            <View style={styles.progressHead}>
              <Text variant="caption" color="secondary">
                {t('catalog.progress', 'Progress')}
              </Text>
              <Text variant="subheading" latin>
                {`${percent}%`}
              </Text>
            </View>
            <ProgressBar percent={percent} height={10} />
          </View>
        </Card>

        <Card title={t('mobile.details', 'Details')}>
          <Row
            label={t('catalog.salesOrder', 'Sales order')}
            value={order.salesOrder?.number ?? '—'}
            latin
          />
          <Row label={t('catalog.customer', 'Customer')} value={customerName} />
          <Row
            label={t('catalog.plannedStart', 'Planned start')}
            value={formatDate(order.plannedStart ?? order.plannedStartDate)}
            latin
          />
          <Row
            label={t('catalog.plannedEnd', 'Planned end')}
            value={formatDate(order.plannedCompletion ?? order.plannedCompletionDate)}
            latin
          />
          <Row
            label={t('mobile.actualStart', 'Started')}
            value={formatDate(order.actualStart ?? order.actualStartDate)}
            latin
          />
        </Card>

        <Section title={t('catalog.stages', 'Production stages')}>
          {stages.length === 0 ? (
            <Text variant="caption" color="secondary">
              {t('mobile.noStages', 'No stages yet')}
            </Text>
          ) : (
            stages.map((stage) => {
              const stagePercent = Number(stage.progressPercent ?? 0);
              const tasks = stage.tasks ?? [];
              return (
                <View key={stage.id} style={styles.stageBlock}>
                  <ListRow
                    title={localizedName(locale, stage.stageDefinition)}
                    meta={stage.stageDefinition?.code ?? undefined}
                    right={<StatusBadge status={stage.status} />}
                    footer={
                      <View>
                        <ProgressBar percent={stagePercent} />
                        <Text variant="micro" color="tertiary" latin style={{ marginTop: 4 }}>
                          {`${Math.round(stagePercent)}%`}
                        </Text>
                      </View>
                    }
                  />
                  {tasks.map((task) => {
                    const assignee = task.assignedEmployee
                      ? [task.assignedEmployee.firstName, task.assignedEmployee.lastName]
                          .filter(Boolean)
                          .join(' ')
                      : t('catalog.unassigned', 'Unassigned');
                    return (
                      <ListRow
                        key={task.id}
                        title={task.name}
                        meta={`${task.number} · ${assignee}`}
                        right={<StatusBadge status={task.status} />}
                        onPress={() => router.push(`/tasks/${task.id}`)}
                      />
                    );
                  })}
                </View>
              );
            })
          )}
        </Section>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  titleText: { flex: 1, gap: 2 },
  progressBlock: { marginTop: spacing.md, gap: spacing.sm },
  progressHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stageBlock: { gap: spacing.sm },
});
