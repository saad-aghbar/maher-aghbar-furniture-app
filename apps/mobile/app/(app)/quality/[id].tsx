import { localizedName } from '@maher/i18n';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { apiFetch } from '../../../src/api/client';
import { errorMessage, useAction, useItemQuery } from '../../../src/api/hooks';
import { formatDate } from '../../../src/lib/format';
import { can } from '../../../src/permissions/can';
import { useAuth } from '../../../src/providers/auth-provider';
import { useI18n } from '../../../src/providers/i18n-provider';
import { colors, spacing } from '../../../src/theme/tokens';
import {
  Button,
  Card,
  Chip,
  ChipGroup,
  ErrorState,
  ListSkeleton,
  Row,
  Screen,
  StatusBadge,
  Text,
  TextField,
} from '../../../src/ui';

type QualityResult = 'PASSED' | 'PASSED_WITH_NOTES' | 'FAILED_REWORK_REQUIRED';

type InspectionDetail = {
  id: string;
  number: string;
  status: string;
  result?: string | null;
  notes?: string | null;
  defectDescription?: string | null;
  createdAt?: string | null;
  productionOrder?: { number?: string } | null;
  items?: {
    id: string;
    description?: string | null;
    criteria?: string | null;
    nameEn?: string | null;
    nameAr?: string | null;
    label?: string | null;
    passed?: boolean | null;
  }[];
  defects?: { id: string; description?: string | null; severity?: string | null }[];
  reworkRequests?: { id: string; status?: string | null }[];
  rework?: { id: string; status?: string | null }[];
};

const RESULTS: QualityResult[] = ['PASSED', 'PASSED_WITH_NOTES', 'FAILED_REWORK_REQUIRED'];

export default function QualityDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const [result, setResult] = useState<QualityResult | null>(null);
  const [notes, setNotes] = useState('');
  const [defectDescription, setDefectDescription] = useState('');

  const key = ['quality-inspections', id];
  const query = useItemQuery<InspectionDetail>(key, `/quality-inspections/${id}`, {
    enabled: Boolean(id),
  });
  const invalidate = [['quality-inspections'], ['quality-inspections', 'home'], key];

  const onError = (err: unknown) =>
    Alert.alert(t('common.error', 'Error'), errorMessage(err, t('common.actionFailed', 'Action failed')));

  const submit = useAction(
    (body: { result: QualityResult; notes?: string; defectDescription?: string }) =>
      apiFetch(`/quality-inspections/${id}/submit`, { method: 'POST', body }),
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

  const inspection = query.data;
  const items = inspection.items ?? [];
  const defects = inspection.defects ?? [];
  const rework = inspection.reworkRequests ?? inspection.rework ?? [];
  const canPerform = can(user, 'quality-inspection.perform');
  const isComplete = inspection.status === 'COMPLETED';
  const badgeStatus = inspection.result ?? inspection.status;

  return (
    <>
      <Stack.Screen options={{ title: inspection.number }} />
      <Screen
        refreshing={query.isFetching}
        onRefresh={() => void query.refetch()}
        footer={
          canPerform && !isComplete ? (
            <Button
              label={t('catalog.submitResult', 'Submit result')}
              disabled={!result || (result === 'FAILED_REWORK_REQUIRED' && !defectDescription.trim())}
              loading={submit.isPending}
              fullWidth
              onPress={() => {
                if (!result) return;
                submit.mutate(
                  {
                    result,
                    notes: notes.trim() || undefined,
                    defectDescription:
                      result === 'FAILED_REWORK_REQUIRED'
                        ? defectDescription.trim()
                        : undefined,
                  },
                  {
                    onError,
                    onSuccess: () => {
                      setResult(null);
                      setNotes('');
                      setDefectDescription('');
                    },
                  },
                );
              }}
            />
          ) : undefined
        }
      >
        <Card>
          <View style={styles.titleRow}>
            <View style={styles.titleText}>
              <Text variant="title" latin>
                {inspection.number}
              </Text>
              <Text variant="caption" color="secondary" latin>
                {inspection.productionOrder?.number
                  ? `${t('catalog.productionOrder', 'Production order')} · ${inspection.productionOrder.number}`
                  : formatDate(inspection.createdAt)}
              </Text>
            </View>
            <StatusBadge status={badgeStatus} />
          </View>
        </Card>

        {inspection.notes ? (
          <Card title={t('common.notes', 'Notes')}>
            <Text variant="caption" color="secondary">
              {inspection.notes}
            </Text>
          </Card>
        ) : null}

        {defects.length > 0 ? (
          <Card title={t('mobile.defects', 'Defects')} style={styles.defectCard}>
            {defects.map((d) => (
              <View key={d.id} style={styles.defectRow}>
                <Text variant="subheading" color="error">
                  {d.description ?? '—'}
                </Text>
                {d.severity ? (
                  <StatusBadge status={d.severity} tone="error" />
                ) : null}
              </View>
            ))}
          </Card>
        ) : null}

        {items.length > 0 ? (
          <Card title={t('common.items', 'Items')}>
            {items.map((item) => {
              const label =
                localizedName(locale, item, item.description ?? item.label ?? item.criteria ?? '—') ||
                item.description ||
                item.label ||
                item.criteria ||
                '—';
              return (
                <Row
                  key={item.id}
                  label={label}
                  value={
                    item.passed == null
                      ? '—'
                      : item.passed
                        ? t('statuses.PASSED', 'Passed')
                        : t('statuses.FAILED', 'Failed')
                  }
                />
              );
            })}
          </Card>
        ) : null}

        {rework.length > 0 ? (
          <Card title={t('mobile.reworkRequests', 'Rework requests')}>
            {rework.map((r) => (
              <Row
                key={r.id}
                label={r.id.slice(0, 8)}
                value={r.status ? t(`statuses.${r.status}`, r.status) : '—'}
                latin
              />
            ))}
          </Card>
        ) : null}

        {canPerform && !isComplete ? (
          <Card title={t('catalog.submitResult', 'Submit result')}>
            <ChipGroup>
              {RESULTS.map((value) => (
                <Chip
                  key={value}
                  label={t(`statuses.${value}`, value)}
                  active={result === value}
                  onPress={() => setResult(value)}
                />
              ))}
            </ChipGroup>
            <TextField
              label={t('common.notes', 'Notes')}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
              style={styles.multiline}
            />
            {result === 'FAILED_REWORK_REQUIRED' ? (
              <TextField
                label={`${t('catalog.defectDescription', 'Defect description')} *`}
                value={defectDescription}
                onChangeText={setDefectDescription}
                multiline
                numberOfLines={3}
                style={styles.multiline}
              />
            ) : null}
          </Card>
        ) : null}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  titleText: { flex: 1, gap: 2 },
  defectCard: { borderColor: colors.error },
  defectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: 6,
  },
  multiline: { minHeight: 90, textAlignVertical: 'top', paddingTop: spacing.sm, marginTop: spacing.sm },
});
