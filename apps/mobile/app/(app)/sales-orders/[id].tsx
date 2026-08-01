import { localizedName } from '@maher/i18n';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Alert, StyleSheet, View } from 'react-native';
import { apiFetch } from '../../../src/api/client';
import { errorMessage, useAction, useItemQuery } from '../../../src/api/hooks';
import { formatDate, formatDateTime, formatMoney, formatNumber } from '../../../src/lib/format';
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
  Row,
  Screen,
  Section,
  StatusBadge,
  Text,
} from '../../../src/ui';

type NamedCustomer = {
  nameEn?: string | null;
  nameAr?: string | null;
  name?: string | null;
};

type OrderItem = {
  id: string;
  description: string;
  quantity: unknown;
  unitPrice: unknown;
  lineTotal: unknown;
};

type SalesOrderDetail = {
  id: string;
  number: string;
  status: string;
  totalAmount?: unknown;
  total?: unknown;
  currency?: string | null;
  requestedDeliveryDate?: string | null;
  requiredDeliveryDate?: string | null;
  confirmedAt?: string | null;
  createdAt: string;
  customer?: NamedCustomer | null;
  items?: OrderItem[];
  lines?: OrderItem[];
  productionOrders?: { id: string; number: string; status: string }[];
  invoices?: {
    id: string;
    number: string;
    status: string;
    totalAmount?: unknown;
    total?: unknown;
  }[];
  deliveries?: {
    id: string;
    number: string;
    status: string;
    scheduledDate?: string | null;
    deliveryDate?: string | null;
  }[];
};

export default function SalesOrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const router = useNav();

  const key = ['sales-orders', id];
  const query = useItemQuery<SalesOrderDetail>(key, `/sales-orders/${id}`, {
    enabled: Boolean(id),
  });
  const invalidate = [key, ['sales-orders'], ['sales-orders', 'home']];

  const onError = (err: unknown) =>
    Alert.alert(t('common.error', 'Error'), errorMessage(err, t('common.actionFailed', 'Action failed')));

  const confirm = useAction(
    () => apiFetch(`/sales-orders/${id}/confirm`, { method: 'POST' }),
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
  const currency = order.currency ?? 'JOD';
  const total = order.totalAmount ?? order.total;
  const delivery = order.requestedDeliveryDate ?? order.requiredDeliveryDate;
  const items = order.items ?? order.lines ?? [];
  const productionOrders = order.productionOrders ?? [];
  const invoices = order.invoices ?? [];
  const deliveries = order.deliveries ?? [];
  const customerName = localizedName(
    locale,
    order.customer
      ? { nameEn: order.customer.nameEn ?? order.customer.name, nameAr: order.customer.nameAr }
      : null,
    order.number,
  );
  const canConfirm = can(user, 'sales-order.update') && order.status === 'DRAFT';

  return (
    <>
      <Stack.Screen options={{ title: order.number }} />
      <Screen
        refreshing={query.isFetching}
        onRefresh={() => void query.refetch()}
        footer={
          canConfirm ? (
            <Button
              label={t('mobile.confirmOrder', 'Confirm order')}
              loading={confirm.isPending}
              onPress={() =>
                Alert.alert(
                  t('mobile.confirmOrder', 'Confirm order'),
                  t('mobile.confirmOrderConfirm', 'Confirm this sales order?'),
                  [
                    { text: t('common.cancel', 'Cancel'), style: 'cancel' },
                    {
                      text: t('common.confirm', 'Confirm'),
                      onPress: () => confirm.mutate(undefined, { onError }),
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
              <Text variant="title">{customerName}</Text>
              <Text variant="caption" color="secondary" latin>
                {order.number}
              </Text>
            </View>
            <StatusBadge status={order.status} />
          </View>
          <Text variant="title" latin style={styles.total}>
            {formatMoney(total, currency)}
          </Text>
        </Card>

        <Card title={t('mobile.details', 'Details')}>
          <Row
            label={t('sales.deliveryDate', 'Delivery date')}
            value={formatDate(delivery)}
            latin
          />
          <Row
            label={t('mobile.confirmedAt', 'Confirmed')}
            value={formatDateTime(order.confirmedAt)}
            latin
          />
          <Row label={t('sales.orderDate', 'Order date')} value={formatDate(order.createdAt)} latin />
          <Row label={t('sales.total', 'Total')} value={formatMoney(total, currency)} latin />
        </Card>

        {items.length > 0 ? (
          <Section title={t('sales.lines', 'Order lines')}>
            {items.map((item) => (
              <ListRow
                key={item.id}
                title={item.description}
                meta={`${formatNumber(item.quantity)} × ${formatMoney(item.unitPrice, currency)}`}
                right={
                  <Text variant="subheading" latin>
                    {formatMoney(item.lineTotal, currency)}
                  </Text>
                }
              />
            ))}
          </Section>
        ) : null}

        {productionOrders.length > 0 ? (
          <Section title={t('navigation.production', 'Production')}>
            {productionOrders.map((po) => (
              <ListRow
                key={po.id}
                title={po.number}
                right={<StatusBadge status={po.status} />}
                onPress={() => router.push(`/production/${po.id}`)}
              />
            ))}
          </Section>
        ) : null}

        {invoices.length > 0 ? (
          <Section title={t('navigation.invoices', 'Invoices')}>
            {invoices.map((inv) => (
              <ListRow
                key={inv.id}
                title={inv.number}
                meta={formatMoney(inv.totalAmount ?? inv.total, currency)}
                right={<StatusBadge status={inv.status} />}
                onPress={() => router.push(`/invoices/${inv.id}`)}
              />
            ))}
          </Section>
        ) : null}

        {deliveries.length > 0 ? (
          <Section title={t('navigation.deliveries', 'Deliveries')}>
            {deliveries.map((d) => (
              <ListRow
                key={d.id}
                title={d.number}
                meta={formatDate(d.scheduledDate ?? d.deliveryDate)}
                right={<StatusBadge status={d.status} />}
                onPress={() => router.push(`/deliveries/${d.id}`)}
              />
            ))}
          </Section>
        ) : null}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  titleText: { flex: 1, gap: 2 },
  total: { marginTop: spacing.md },
});
