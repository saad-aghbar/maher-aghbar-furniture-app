import { localizedName } from '@maher/i18n';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { apiFetch } from '../../../src/api/client';
import { errorMessage, useAction, useItemQuery } from '../../../src/api/hooks';
import { formatDate, formatDateTime, formatNumber } from '../../../src/lib/format';
import { can } from '../../../src/permissions/can';
import { useAuth } from '../../../src/providers/auth-provider';
import { useI18n } from '../../../src/providers/i18n-provider';
import { spacing } from '../../../src/theme/tokens';
import {
  Button,
  Card,
  ErrorState,
  ListSkeleton,
  Row,
  Screen,
  StatusBadge,
  Text,
  TextField,
} from '../../../src/ui';

type DeliveryDetail = {
  id: string;
  number: string;
  status: string;
  scheduledDate?: string | null;
  deliveredAt?: string | null;
  recipientName?: string | null;
  failureReason?: string | null;
  notes?: string | null;
  customer?: { nameEn?: string; nameAr?: string; phone?: string | null } | null;
  driver?: { firstName?: string; lastName?: string } | null;
  items?: { id: string; description?: string | null; quantity?: unknown }[];
  salesOrder?: { number?: string } | null;
};

type FormMode = 'delivered' | 'failed' | null;

export default function DeliveryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [recipientName, setRecipientName] = useState('');
  const [notes, setNotes] = useState('');
  const [failureReason, setFailureReason] = useState('');

  const key = ['deliveries', id];
  const query = useItemQuery<DeliveryDetail>(key, `/deliveries/${id}`, {
    enabled: Boolean(id),
  });
  const invalidate = [['deliveries'], ['deliveries', 'home'], key];

  const onError = (err: unknown) =>
    Alert.alert(t('common.error', 'Error'), errorMessage(err, t('common.actionFailed', 'Action failed')));

  const updateStatus = useAction(
    (body: {
      status: string;
      recipientName?: string;
      notes?: string;
      failureReason?: string;
    }) => apiFetch(`/deliveries/${id}/status`, { method: 'PATCH', body }),
    invalidate,
  );

  const run = <V,>(action: { mutate: (v: V, opts?: object) => void }, vars: V) =>
    action.mutate(vars, { onError });

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

  const delivery = query.data;
  const items = delivery.items ?? [];
  const canUpdate = can(user, 'delivery.update');
  const terminal = delivery.status === 'DELIVERED' || delivery.status === 'CANCELLED';
  const canGoOut = ['PLANNED', 'READY_FOR_DELIVERY', 'RESCHEDULED'].includes(delivery.status);
  const driverName = delivery.driver
    ? [delivery.driver.firstName, delivery.driver.lastName].filter(Boolean).join(' ')
    : '—';
  const busy = updateStatus.isPending;

  return (
    <>
      <Stack.Screen options={{ title: delivery.number }} />
      <Screen
        refreshing={query.isFetching}
        onRefresh={() => void query.refetch()}
        footer={
          canUpdate && !terminal ? (
            <View style={styles.footerCol}>
              {canGoOut ? (
                <Button
                  label={t('mobile.outForDelivery', 'Out for delivery')}
                  onPress={() => run(updateStatus, { status: 'OUT_FOR_DELIVERY' })}
                  loading={updateStatus.isPending}
                  disabled={busy}
                  fullWidth
                />
              ) : null}
              <View style={styles.footerRow}>
                <Button
                  label={t('catalog.markDelivered', 'Mark delivered')}
                  variant={formMode === 'delivered' ? 'primary' : 'secondary'}
                  onPress={() => {
                    setFormMode(formMode === 'delivered' ? null : 'delivered');
                    setFailureReason('');
                  }}
                  disabled={busy}
                  style={styles.grow}
                />
                <Button
                  label={t('mobile.reportFailure', 'Report failure')}
                  variant={formMode === 'failed' ? 'danger' : 'subtle'}
                  onPress={() => {
                    setFormMode(formMode === 'failed' ? null : 'failed');
                    setRecipientName('');
                    setNotes('');
                  }}
                  disabled={busy}
                  style={styles.grow}
                />
              </View>
            </View>
          ) : undefined
        }
      >
        <Card>
          <View style={styles.titleRow}>
            <View style={styles.titleText}>
              <Text variant="title">
                {localizedName(locale, delivery.customer, delivery.number)}
              </Text>
              <Text variant="caption" color="secondary" latin>
                {`${delivery.number} · ${formatDate(delivery.scheduledDate)}`}
              </Text>
            </View>
            <StatusBadge status={delivery.status} />
          </View>
        </Card>

        <Card title={t('mobile.details', 'Details')}>
          <Row
            label={t('mobile.scheduledDate', 'Scheduled date')}
            value={formatDate(delivery.scheduledDate)}
            latin
          />
          <Row
            label={t('mobile.deliveredAt', 'Delivered at')}
            value={formatDateTime(delivery.deliveredAt)}
            latin
          />
          <Row label={t('mobile.driver', 'Driver')} value={driverName || '—'} />
          <Row
            label={t('catalog.salesOrder', 'Sales order')}
            value={delivery.salesOrder?.number ?? '—'}
            latin
          />
          <Row
            label={t('catalog.recipientName', 'Recipient name')}
            value={delivery.recipientName ?? '—'}
          />
          {delivery.failureReason ? (
            <Row
              label={t('mobile.failureReason', 'Failure reason')}
              value={delivery.failureReason}
            />
          ) : null}
          {delivery.customer?.phone ? (
            <Row label={t('catalog.phone', 'Phone')} value={delivery.customer.phone} latin />
          ) : null}
        </Card>

        {items.length > 0 ? (
          <Card title={t('common.items', 'Items')}>
            {items.map((item) => (
              <Row
                key={item.id}
                label={item.description ?? '—'}
                value={formatNumber(item.quantity)}
                latin
              />
            ))}
          </Card>
        ) : null}

        {formMode === 'delivered' ? (
          <Card title={t('catalog.proofOfDelivery', 'Proof of delivery')}>
            <TextField
              label={`${t('catalog.recipientName', 'Recipient name')} *`}
              value={recipientName}
              onChangeText={setRecipientName}
              autoCapitalize="words"
            />
            <TextField
              label={t('common.notes', 'Notes')}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
              style={styles.multiline}
            />
            <View style={styles.formActions}>
              <Button
                label={t('common.cancel', 'Cancel')}
                variant="ghost"
                size="sm"
                onPress={() => setFormMode(null)}
                style={styles.grow}
              />
              <Button
                label={t('catalog.markDelivered', 'Mark delivered')}
                size="sm"
                disabled={recipientName.trim().length === 0}
                loading={updateStatus.isPending}
                onPress={() =>
                  updateStatus.mutate(
                    {
                      status: 'DELIVERED',
                      recipientName: recipientName.trim(),
                      notes: notes.trim() || undefined,
                    },
                    {
                      onError,
                      onSuccess: () => {
                        setFormMode(null);
                        setRecipientName('');
                        setNotes('');
                      },
                    },
                  )
                }
                style={styles.grow}
              />
            </View>
          </Card>
        ) : null}

        {formMode === 'failed' ? (
          <Card title={t('mobile.reportFailure', 'Report failure')}>
            <TextField
              label={`${t('mobile.failureReason', 'Failure reason')} *`}
              value={failureReason}
              onChangeText={setFailureReason}
              multiline
              numberOfLines={3}
              style={styles.multiline}
            />
            <View style={styles.formActions}>
              <Button
                label={t('common.cancel', 'Cancel')}
                variant="ghost"
                size="sm"
                onPress={() => setFormMode(null)}
                style={styles.grow}
              />
              <Button
                label={t('mobile.reportFailure', 'Report failure')}
                variant="danger"
                size="sm"
                disabled={failureReason.trim().length === 0}
                loading={updateStatus.isPending}
                onPress={() =>
                  updateStatus.mutate(
                    {
                      status: 'FAILED',
                      failureReason: failureReason.trim(),
                    },
                    {
                      onError,
                      onSuccess: () => {
                        setFormMode(null);
                        setFailureReason('');
                      },
                    },
                  )
                }
                style={styles.grow}
              />
            </View>
          </Card>
        ) : null}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  titleText: { flex: 1, gap: 2 },
  footerCol: { gap: spacing.sm },
  footerRow: { flexDirection: 'row', gap: spacing.sm },
  grow: { flex: 1 },
  formActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  multiline: { minHeight: 90, textAlignVertical: 'top', paddingTop: spacing.sm },
});
