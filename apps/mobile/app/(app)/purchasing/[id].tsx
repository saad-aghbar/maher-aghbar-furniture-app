import { localizedName } from '@maher/i18n';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Alert, StyleSheet, View } from 'react-native';
import { apiFetch } from '../../../src/api/client';
import { errorMessage, useAction, useItemQuery } from '../../../src/api/hooks';
import { formatDate, formatMoney, formatNumber } from '../../../src/lib/format';
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
  Row,
  Screen,
  Section,
  StatusBadge,
  Text,
} from '../../../src/ui';

type PurchaseOrderDetail = {
  id: string;
  number: string;
  status: string;
  totalAmount?: unknown;
  total?: unknown;
  currency?: string | null;
  expectedDate?: string | null;
  expectedDeliveryDate?: string | null;
  createdAt: string;
  notes?: string | null;
  supplier?: {
    nameEn?: string | null;
    nameAr?: string | null;
    name?: string | null;
    phone?: string | null;
    email?: string | null;
  } | null;
  lines?: {
    id: string;
    description?: string | null;
    quantity?: unknown;
    unitPrice?: unknown;
    lineTotal?: unknown;
    receivedQuantity?: unknown;
  }[];
  goodsReceipts?: {
    id: string;
    number: string;
    receivedAt?: string | null;
    receiptDate?: string | null;
    createdAt?: string;
  }[];
};

export default function PurchaseOrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, locale } = useI18n();
  const { user } = useAuth();

  const key = ['purchase-orders', id];
  const query = useItemQuery<PurchaseOrderDetail>(key, `/purchase-orders/${id}`, {
    enabled: Boolean(id),
  });
  const invalidate = [['purchase-orders'], ['purchase-orders', 'home'], key];

  const onError = (err: unknown) =>
    Alert.alert(t('common.error', 'Error'), errorMessage(err, t('common.actionFailed', 'Action failed')));

  const approve = useAction(
    () => apiFetch(`/purchase-orders/${id}/approve`, { method: 'POST' }),
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

  const po = query.data;
  const currency = po.currency ?? 'JOD';
  const total = po.totalAmount ?? po.total;
  const lines = po.lines ?? [];
  const receipts = po.goodsReceipts ?? [];
  const expected = po.expectedDate ?? po.expectedDeliveryDate;
  const canApprove = can(user, 'purchase-order.approve') && po.status === 'PENDING_APPROVAL';

  return (
    <>
      <Stack.Screen options={{ title: po.number }} />
      <Screen
        refreshing={query.isFetching}
        onRefresh={() => void query.refetch()}
        footer={
          canApprove ? (
            <Button
              label={t('catalog.approve', 'Approve')}
              loading={approve.isPending}
              onPress={() =>
                Alert.alert(
                  t('catalog.approve', 'Approve'),
                  t('mobile.approvePoConfirm', 'Approve this purchase order?'),
                  [
                    { text: t('common.cancel', 'Cancel'), style: 'cancel' },
                    {
                      text: t('catalog.approve', 'Approve'),
                      onPress: () => approve.mutate(undefined, { onError }),
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
              <Text variant="title">
                {localizedName(
                  locale,
                  po.supplier
                    ? {
                        nameEn: po.supplier.nameEn ?? po.supplier.name,
                        nameAr: po.supplier.nameAr,
                      }
                    : null,
                  po.number,
                )}
              </Text>
              <Text variant="caption" color="secondary" latin>
                {`${po.number} · ${formatMoney(total, currency)}`}
              </Text>
            </View>
            <StatusBadge status={po.status} />
          </View>
        </Card>

        <Card title={t('mobile.details', 'Details')}>
          <Row
            label={t('catalog.supplier', 'Supplier')}
            value={localizedName(
              locale,
              po.supplier
                ? {
                    nameEn: po.supplier.nameEn ?? po.supplier.name,
                    nameAr: po.supplier.nameAr,
                  }
                : null,
            )}
          />
          {po.supplier?.phone ? (
            <Row label={t('catalog.phone', 'Phone')} value={po.supplier.phone} latin />
          ) : null}
          {po.supplier?.email ? (
            <Row label={t('catalog.email', 'Email')} value={po.supplier.email} latin />
          ) : null}
          <Row label={t('mobile.expectedDate', 'Expected date')} value={formatDate(expected)} latin />
          <Row label={t('common.date', 'Date')} value={formatDate(po.createdAt)} latin />
          <Row label={t('common.total', 'Total')} value={formatMoney(total, currency)} latin />
          {po.notes ? <Row label={t('common.notes', 'Notes')} value={po.notes} /> : null}
        </Card>

        {lines.length > 0 ? (
          <Card title={t('mobile.lines', 'Lines')}>
            {lines.map((line) => {
              const qtyLabel =
                line.receivedQuantity != null
                  ? `${formatNumber(line.receivedQuantity)} / ${formatNumber(line.quantity)}`
                  : formatNumber(line.quantity);
              return (
                <Row
                  key={line.id}
                  label={line.description ?? '—'}
                  value={`${qtyLabel} · ${formatMoney(line.lineTotal, currency)}`}
                  latin
                />
              );
            })}
          </Card>
        ) : null}

        <Section title={t('mobile.goodsReceipts', 'Goods receipts')}>
          {receipts.length === 0 ? (
            <Text variant="caption" color="secondary">
              {t('mobile.noGoodsReceipts', 'No goods receipts yet')}
            </Text>
          ) : (
            receipts.map((gr) => (
              <ListRow
                key={gr.id}
                title={gr.number}
                meta={formatDate(gr.receivedAt ?? gr.receiptDate ?? gr.createdAt)}
              />
            ))
          )}
        </Section>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  titleText: { flex: 1, gap: 2 },
});
