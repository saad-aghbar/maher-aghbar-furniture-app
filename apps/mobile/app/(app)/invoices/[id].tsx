import { localizedName } from '@maher/i18n';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { apiFetch } from '../../../src/api/client';
import { errorMessage, useAction, useItemQuery } from '../../../src/api/hooks';
import { formatDate, formatMoney } from '../../../src/lib/format';
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
  TextField,
} from '../../../src/ui';

type InvoiceDetail = {
  id: string;
  number: string;
  status: string;
  customerId?: string;
  totalAmount?: unknown;
  total?: unknown;
  paidAmount?: unknown;
  outstandingAmount?: unknown;
  subtotalAmount?: unknown;
  subtotal?: unknown;
  taxAmount?: unknown;
  taxTotal?: unknown;
  currency?: string | null;
  issueDate?: string | null;
  invoiceDate?: string | null;
  dueDate?: string | null;
  notes?: string | null;
  customer?: {
    id?: string;
    nameEn?: string | null;
    nameAr?: string | null;
    name?: string | null;
  } | null;
  lines?: {
    id: string;
    description?: string | null;
    quantity?: unknown;
    unitPrice?: unknown;
    lineTotal?: unknown;
  }[];
  payments?: {
    id: string;
    amount: unknown;
    method?: string | null;
    paidAt?: string | null;
    paymentDate?: string | null;
    createdAt: string;
    reference?: string | null;
    referenceNumber?: string | null;
  }[];
  salesOrder?: { id: string; number: string } | null;
};

export default function InvoiceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const router = useNav();
  const [showPayForm, setShowPayForm] = useState(false);
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');

  const key = ['invoices', id];
  const query = useItemQuery<InvoiceDetail>(key, `/invoices/${id}`, { enabled: Boolean(id) });
  const invalidate = [['invoices'], ['invoices', 'home'], key, ['payments']];

  const onError = (err: unknown) =>
    Alert.alert(t('common.error', 'Error'), errorMessage(err, t('common.actionFailed', 'Action failed')));

  const recordPayment = useAction(
    (body: {
      invoiceId: string;
      customerId: string;
      amount: number;
      referenceNumber?: string;
    }) => apiFetch('/payments', { body }),
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

  const invoice = query.data;
  const currency = invoice.currency ?? 'JOD';
  const total = Number(invoice.totalAmount ?? invoice.total ?? 0);
  const paid = Number(invoice.paidAmount ?? 0);
  const balance =
    invoice.outstandingAmount != null
      ? Number(invoice.outstandingAmount)
      : Math.max(0, total - paid);
  const lines = invoice.lines ?? [];
  const payments = invoice.payments ?? [];
  const customerId = invoice.customerId ?? invoice.customer?.id;
  const canPay = can(user, 'payment.record') && invoice.status !== 'PAID';
  const amountNum = Number(amount);
  const amountValid = Number.isFinite(amountNum) && amountNum > 0;
  const paidPercent = total > 0 ? (paid / total) * 100 : 0;

  return (
    <>
      <Stack.Screen options={{ title: invoice.number }} />
      <Screen
        refreshing={query.isFetching}
        onRefresh={() => void query.refetch()}
        footer={
          canPay ? (
            <Button
              label={t('accounting.recordPayment', 'Record payment')}
              onPress={() => {
                setShowPayForm((v) => !v);
                if (!showPayForm) {
                  setAmount(balance > 0 ? String(balance) : '');
                  setReference('');
                }
              }}
              variant={showPayForm ? 'secondary' : 'primary'}
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
                  invoice.customer
                    ? {
                        nameEn: invoice.customer.nameEn ?? invoice.customer.name,
                        nameAr: invoice.customer.nameAr,
                      }
                    : null,
                  invoice.number,
                )}
              </Text>
              <Text variant="caption" color="secondary" latin>
                {invoice.number}
              </Text>
            </View>
            <StatusBadge status={invoice.status} />
          </View>
          <Text variant="title" latin style={styles.total}>
            {formatMoney(total, currency)}
          </Text>
          <View style={styles.progressBlock}>
            <ProgressBar percent={paidPercent} height={10} />
            <Text variant="caption" color="secondary" latin style={styles.balanceCaption}>
              {`${t('mobile.balanceDue', 'Balance due')}: ${formatMoney(balance, currency)}`}
            </Text>
          </View>
        </Card>

        <Card title={t('mobile.totals', 'Totals')}>
          <Row
            label={t('mobile.subtotal', 'Subtotal')}
            value={formatMoney(invoice.subtotalAmount ?? invoice.subtotal, currency)}
            latin
          />
          <Row
            label={t('mobile.tax', 'Tax')}
            value={formatMoney(invoice.taxAmount ?? invoice.taxTotal, currency)}
            latin
          />
          <Row label={t('common.total', 'Total')} value={formatMoney(total, currency)} latin />
          <Row
            label={t('accounting.paid', 'Paid')}
            value={formatMoney(paid, currency)}
            latin
          />
          <Row
            label={t('mobile.balanceDue', 'Balance due')}
            value={formatMoney(balance, currency)}
            latin
          />
          <Row
            label={t('mobile.issueDate', 'Issue date')}
            value={formatDate(invoice.issueDate ?? invoice.invoiceDate)}
            latin
          />
          <Row
            label={t('accounting.dueDate', 'Due date')}
            value={formatDate(invoice.dueDate)}
            latin
          />
        </Card>

        {lines.length > 0 ? (
          <Card title={t('mobile.lines', 'Lines')}>
            {lines.map((line) => (
              <Row
                key={line.id}
                label={line.description ?? '—'}
                value={formatMoney(line.lineTotal, currency)}
                latin
              />
            ))}
          </Card>
        ) : null}

        <Section title={t('accounting.payments', 'Payments')}>
          {payments.length === 0 ? (
            <Text variant="caption" color="secondary">
              {t('mobile.noPayments', 'No payments recorded')}
            </Text>
          ) : (
            payments.map((payment) => (
              <ListRow
                key={payment.id}
                title={
                  payment.method
                    ? t(`statuses.${payment.method}`, payment.method)
                    : t('mobile.payment', 'Payment')
                }
                meta={`${formatDate(payment.paidAt ?? payment.paymentDate ?? payment.createdAt)} · ${formatMoney(payment.amount, currency)}`}
              />
            ))
          )}
        </Section>

        {invoice.salesOrder ? (
          <ListRow
            title={t('catalog.salesOrder', 'Sales order')}
            meta={invoice.salesOrder.number}
            onPress={() => router.push(`/sales-orders/${invoice.salesOrder!.id}`)}
          />
        ) : null}

        {showPayForm && canPay ? (
          <Card title={t('accounting.recordPayment', 'Record payment')}>
            <TextField
              label={t('accounting.amount', 'Amount')}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              latin
            />
            <TextField
              label={t('mobile.reference', 'Reference')}
              value={reference}
              onChangeText={setReference}
              autoCapitalize="characters"
            />
            <View style={styles.formActions}>
              <Button
                label={t('common.cancel', 'Cancel')}
                variant="ghost"
                size="sm"
                onPress={() => setShowPayForm(false)}
                style={styles.grow}
              />
              <Button
                label={t('accounting.recordPayment', 'Record payment')}
                size="sm"
                disabled={!amountValid || !customerId}
                loading={recordPayment.isPending}
                onPress={() => {
                  if (!customerId || !amountValid) return;
                  recordPayment.mutate(
                    {
                      invoiceId: invoice.id,
                      customerId,
                      amount: amountNum,
                      referenceNumber: reference.trim() || undefined,
                    },
                    {
                      onError,
                      onSuccess: () => {
                        setShowPayForm(false);
                        setAmount('');
                        setReference('');
                      },
                    },
                  );
                }}
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
  total: { marginTop: spacing.md },
  progressBlock: { marginTop: spacing.md, gap: spacing.sm },
  balanceCaption: { marginTop: 2 },
  formActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  grow: { flex: 1 },
});
