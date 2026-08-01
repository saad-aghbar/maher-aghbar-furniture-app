import { localizedName } from '@maher/i18n';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Alert, StyleSheet, View } from 'react-native';
import { apiFetch } from '../../../src/api/client';
import { errorMessage, useAction, useItemQuery } from '../../../src/api/hooks';
import { formatDate, formatMoney, formatNumber } from '../../../src/lib/format';
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
  phone?: string | null;
};

type RequestItem = {
  id: string;
  description?: string | null;
  productName?: string | null;
  quantity: unknown;
  notes?: string | null;
};

type LinkedQuotation = {
  id: string;
  number: string;
  status: string;
  totalAmount?: unknown;
  total?: unknown;
  currency?: string | null;
};

type RequestDetail = {
  id: string;
  number: string;
  status: string;
  title?: string | null;
  projectName?: string | null;
  description?: string | null;
  notes?: string | null;
  createdAt: string;
  customer?: NamedCustomer | null;
  items?: RequestItem[];
  quotations?: LinkedQuotation[];
  documents?: { id: string }[];
};

export default function RequestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const router = useNav();

  const key = ['requests', id];
  const query = useItemQuery<RequestDetail>(key, `/requests/${id}`, { enabled: Boolean(id) });
  const invalidate = [key, ['requests'], ['requests', 'home']];

  const onError = (err: unknown) =>
    Alert.alert(t('common.error', 'Error'), errorMessage(err, t('common.actionFailed', 'Action failed')));

  const submit = useAction(() => apiFetch(`/requests/${id}/submit`, { method: 'POST' }), invalidate);

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

  const request = query.data;
  const customerName = localizedName(
    locale,
    request.customer
      ? {
          nameEn: request.customer.nameEn ?? request.customer.name,
          nameAr: request.customer.nameAr,
        }
      : null,
    request.number,
  );
  const title = request.title || request.projectName || customerName;
  const description = request.description || request.notes;
  const items = request.items ?? [];
  const quotations = request.quotations ?? [];
  const canSubmit = can(user, 'request.update') && request.status === 'DRAFT';

  return (
    <>
      <Stack.Screen options={{ title: request.number }} />
      <Screen
        refreshing={query.isFetching}
        onRefresh={() => void query.refetch()}
        footer={
          canSubmit ? (
            <Button
              label={t('mobile.submitRequest', 'Submit request')}
              onPress={() =>
                Alert.alert(
                  t('mobile.submitRequest', 'Submit request'),
                  t('mobile.submitRequestConfirm', 'Submit this request for review?'),
                  [
                    { text: t('common.cancel', 'Cancel'), style: 'cancel' },
                    {
                      text: t('common.submit', 'Submit'),
                      onPress: () => submit.mutate(undefined, { onError }),
                    },
                  ],
                )
              }
              loading={submit.isPending}
              fullWidth
            />
          ) : undefined
        }
      >
        <Card>
          <View style={styles.titleRow}>
            <View style={styles.titleText}>
              <Text variant="title">{title}</Text>
              <Text variant="caption" color="secondary" latin>
                {`${request.number} · ${formatDate(request.createdAt)}`}
              </Text>
            </View>
            <StatusBadge status={request.status} />
          </View>
        </Card>

        <Card title={t('mobile.details', 'Details')}>
          <Row label={t('quotations.customer', 'Customer')} value={customerName} />
          <Row label={t('common.date', 'Date')} value={formatDate(request.createdAt)} latin />
          <Row
            label={t('common.status', 'Status')}
            value={t(`statuses.${request.status}`, request.status)}
          />
          {request.customer?.phone ? (
            <Row label={t('catalog.phone', 'Phone')} value={request.customer.phone} latin />
          ) : null}
        </Card>

        {description ? (
          <Card title={t('catalog.description', 'Description')}>
            <Text variant="body" color="secondary">
              {description}
            </Text>
          </Card>
        ) : null}

        {items.length > 0 ? (
          <Card title={t('catalog.lineItems', 'Line items')}>
            {items.map((item) => (
              <Row
                key={item.id}
                label={item.description || item.productName || '—'}
                value={formatNumber(item.quantity)}
                latin
              />
            ))}
          </Card>
        ) : null}

        {quotations.length > 0 ? (
          <Section title={t('navigation.quotations', 'Quotations')}>
            {quotations.map((q) => (
              <ListRow
                key={q.id}
                title={q.number}
                meta={formatMoney(q.totalAmount ?? q.total, q.currency ?? 'JOD')}
                right={<StatusBadge status={q.status} />}
                onPress={() => router.push(`/quotations/${q.id}`)}
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
});
