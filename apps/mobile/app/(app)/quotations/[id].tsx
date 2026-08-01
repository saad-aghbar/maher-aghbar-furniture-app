import { localizedName } from '@maher/i18n';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
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
  TextField,
} from '../../../src/ui';

type NamedCustomer = {
  nameEn?: string | null;
  nameAr?: string | null;
  name?: string | null;
};

type QuoteItem = {
  id: string;
  description: string;
  quantity: unknown;
  unitPrice: unknown;
  lineTotal: unknown;
  notes?: string | null;
};

type QuotationDetail = {
  id: string;
  number: string;
  status: string;
  version?: number | null;
  totalAmount?: unknown;
  total?: unknown;
  subtotalAmount?: unknown;
  subtotal?: unknown;
  taxAmount?: unknown;
  taxTotal?: unknown;
  discountAmount?: unknown;
  discountTotal?: unknown;
  currency?: string | null;
  validUntil?: string | null;
  expirationDate?: string | null;
  notes?: string | null;
  customerNotes?: string | null;
  termsAndConditions?: string | null;
  paymentTerms?: string | null;
  deliveryTerms?: string | null;
  warrantyTerms?: string | null;
  createdAt: string;
  customer?: NamedCustomer | null;
  items?: QuoteItem[];
  lines?: QuoteItem[];
  approvals?: { id: string; status?: string; decision?: string; comment?: string | null; createdAt?: string }[];
};

const CUSTOMER_ACTION_STATUSES = ['SENT', 'VIEWED'];
const APPROVE_STATUSES = ['PENDING_APPROVAL', 'INTERNAL_REVIEW'];

export default function QuotationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const [rejectComment, setRejectComment] = useState('');
  const [revisionComment, setRevisionComment] = useState('');
  const [approveComment, setApproveComment] = useState('');
  const [formMode, setFormMode] = useState<'reject' | 'revision' | 'approve' | null>(null);

  const key = ['quotations', id];
  const query = useItemQuery<QuotationDetail>(key, `/quotations/${id}`, { enabled: Boolean(id) });
  const invalidate = [key, ['quotations'], ['quotations', 'home']];

  const onError = (err: unknown) =>
    Alert.alert(t('common.error', 'Error'), errorMessage(err, t('common.actionFailed', 'Action failed')));

  const accept = useAction(
    () => apiFetch(`/quotations/${id}/accept`, { body: { signatureData: user?.name } }),
    invalidate,
  );
  const reject = useAction(
    (comment: string) => apiFetch(`/quotations/${id}/reject`, { body: { comment } }),
    invalidate,
  );
  const requestRevision = useAction(
    (comment: string) => apiFetch(`/quotations/${id}/request-revision`, { body: { comment } }),
    invalidate,
  );
  const approve = useAction(
    (comment?: string) =>
      apiFetch(`/quotations/${id}/approve`, { body: { comment: comment || undefined } }),
    invalidate,
  );
  const send = useAction(() => apiFetch(`/quotations/${id}/send`, { method: 'POST' }), invalidate);
  const submitForApproval = useAction(
    () => apiFetch(`/quotations/${id}/submit-for-approval`, { method: 'POST' }),
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

  const quote = query.data;
  const currency = quote.currency ?? 'JOD';
  const total = quote.totalAmount ?? quote.total;
  const subtotal = quote.subtotalAmount ?? quote.subtotal;
  const tax = quote.taxAmount ?? quote.taxTotal;
  const discount = quote.discountAmount ?? quote.discountTotal;
  const validUntil = quote.validUntil ?? quote.expirationDate;
  const notes = quote.notes ?? quote.customerNotes;
  const terms =
    quote.termsAndConditions ||
    [quote.paymentTerms, quote.deliveryTerms, quote.warrantyTerms].filter(Boolean).join('\n\n') ||
    null;
  const items = quote.items ?? quote.lines ?? [];
  const customerName = localizedName(
    locale,
    quote.customer
      ? { nameEn: quote.customer.nameEn ?? quote.customer.name, nameAr: quote.customer.nameAr }
      : null,
    quote.number,
  );

  const customerActions = CUSTOMER_ACTION_STATUSES.includes(quote.status);
  const canAccept = can(user, 'quotation.accept') && customerActions;
  const canReject = can(user, 'quotation.reject') && customerActions;
  const canRequestRevision = can(user, 'quotation.accept') && customerActions;
  const canApprove = can(user, 'quotation.approve') && APPROVE_STATUSES.includes(quote.status);
  const canSend = can(user, 'quotation.send') && quote.status === 'APPROVED';
  const canSubmit = can(user, 'quotation.update') && quote.status === 'DRAFT';
  const hasActions =
    canAccept || canReject || canRequestRevision || canApprove || canSend || canSubmit;
  const busy =
    accept.isPending ||
    reject.isPending ||
    requestRevision.isPending ||
    approve.isPending ||
    send.isPending ||
    submitForApproval.isPending;

  const versionLabel =
    quote.version != null ? `${quote.number} · v${quote.version}` : quote.number;

  const footer = !hasActions
    ? undefined
    : formMode === 'reject' ? (
        <View style={styles.formBlock}>
          <TextField
            label={t('mobile.rejectComment', 'Reason for rejection')}
            value={rejectComment}
            onChangeText={setRejectComment}
            multiline
            numberOfLines={3}
            style={styles.multiline}
          />
          <View style={styles.footerRow}>
            <Button
              label={t('common.cancel', 'Cancel')}
              variant="ghost"
              onPress={() => {
                setFormMode(null);
                setRejectComment('');
              }}
              style={styles.grow}
            />
            <Button
              label={t('quotations.reject', 'Reject')}
              variant="danger"
              disabled={rejectComment.trim().length === 0 || busy}
              loading={reject.isPending}
              onPress={() =>
                reject.mutate(rejectComment.trim(), {
                  onError,
                  onSuccess: () => {
                    setRejectComment('');
                    setFormMode(null);
                  },
                })
              }
              style={styles.grow}
            />
          </View>
        </View>
      ) : formMode === 'revision' ? (
        <View style={styles.formBlock}>
          <TextField
            label={t('quotations.revisionComment', 'What should we change?')}
            value={revisionComment}
            onChangeText={setRevisionComment}
            multiline
            numberOfLines={3}
            style={styles.multiline}
          />
          <View style={styles.footerRow}>
            <Button
              label={t('common.cancel', 'Cancel')}
              variant="ghost"
              onPress={() => {
                setFormMode(null);
                setRevisionComment('');
              }}
              style={styles.grow}
            />
            <Button
              label={t('quotations.requestRevision', 'Request revision')}
              variant="secondary"
              disabled={revisionComment.trim().length === 0 || busy}
              loading={requestRevision.isPending}
              onPress={() =>
                requestRevision.mutate(revisionComment.trim(), {
                  onError,
                  onSuccess: () => {
                    setRevisionComment('');
                    setFormMode(null);
                  },
                })
              }
              style={styles.grow}
            />
          </View>
        </View>
      ) : formMode === 'approve' ? (
        <View style={styles.formBlock}>
          <TextField
            label={t('mobile.approveComment', 'Comment (optional)')}
            value={approveComment}
            onChangeText={setApproveComment}
            multiline
            numberOfLines={2}
            style={styles.multiline}
          />
          <View style={styles.footerRow}>
            <Button
              label={t('common.cancel', 'Cancel')}
              variant="ghost"
              onPress={() => {
                setFormMode(null);
                setApproveComment('');
              }}
              style={styles.grow}
            />
            <Button
              label={t('quotations.approve', 'Approve')}
              disabled={busy}
              loading={approve.isPending}
              onPress={() =>
                approve.mutate(approveComment.trim() || undefined, {
                  onError,
                  onSuccess: () => {
                    setApproveComment('');
                    setFormMode(null);
                  },
                })
              }
              style={styles.grow}
            />
          </View>
        </View>
      ) : (
        <View style={styles.actionsCol}>
          {canAccept ? (
            <Button
              label={t('quotations.accept', 'Accept quote')}
              disabled={busy}
              loading={accept.isPending}
              onPress={() =>
                Alert.alert(
                  t('quotations.accept', 'Accept quote'),
                  t('mobile.acceptQuoteConfirm', 'Accept this quotation electronically?'),
                  [
                    { text: t('common.cancel', 'Cancel'), style: 'cancel' },
                    {
                      text: t('quotations.accept', 'Accept quote'),
                      onPress: () => accept.mutate(undefined, { onError }),
                    },
                  ],
                )
              }
              fullWidth
            />
          ) : null}
          {canReject ? (
            <Button
              label={t('quotations.reject', 'Reject')}
              variant="danger"
              disabled={busy}
              onPress={() => setFormMode('reject')}
              fullWidth
            />
          ) : null}
          {canRequestRevision ? (
            <Button
              label={t('quotations.requestRevision', 'Request revision')}
              variant="secondary"
              disabled={busy}
              onPress={() => setFormMode('revision')}
              fullWidth
            />
          ) : null}
          {canApprove ? (
            <Button
              label={t('quotations.approve', 'Approve')}
              disabled={busy}
              onPress={() => setFormMode('approve')}
              fullWidth
            />
          ) : null}
          {canSend ? (
            <Button
              label={t('quotations.send', 'Send to customer')}
              disabled={busy}
              loading={send.isPending}
              onPress={() =>
                Alert.alert(
                  t('quotations.send', 'Send to customer'),
                  t('mobile.sendQuoteConfirm', 'Send this quotation to the customer?'),
                  [
                    { text: t('common.cancel', 'Cancel'), style: 'cancel' },
                    {
                      text: t('quotations.send', 'Send to customer'),
                      onPress: () => send.mutate(undefined, { onError }),
                    },
                  ],
                )
              }
              fullWidth
            />
          ) : null}
          {canSubmit ? (
            <Button
              label={t('catalog.submitForApproval', 'Submit for approval')}
              disabled={busy}
              loading={submitForApproval.isPending}
              onPress={() =>
                Alert.alert(
                  t('catalog.submitForApproval', 'Submit for approval'),
                  t('mobile.submitQuoteConfirm', 'Submit this quotation for internal approval?'),
                  [
                    { text: t('common.cancel', 'Cancel'), style: 'cancel' },
                    {
                      text: t('common.submit', 'Submit'),
                      onPress: () => submitForApproval.mutate(undefined, { onError }),
                    },
                  ],
                )
              }
              fullWidth
            />
          ) : null}
        </View>
      );

  return (
    <>
      <Stack.Screen options={{ title: quote.number }} />
      <Screen
        refreshing={query.isFetching}
        onRefresh={() => void query.refetch()}
        footer={footer}
      >
        <Card>
          <View style={styles.titleRow}>
            <View style={styles.titleText}>
              <Text variant="title">{customerName}</Text>
              <Text variant="caption" color="secondary" latin>
                {versionLabel}
              </Text>
            </View>
            <StatusBadge status={quote.status} />
          </View>
          <Text variant="title" latin style={styles.total}>
            {formatMoney(total, currency)}
          </Text>
        </Card>

        <Card title={t('mobile.totals', 'Totals')}>
          <Row
            label={t('mobile.subtotal', 'Subtotal')}
            value={formatMoney(subtotal, currency)}
            latin
          />
          <Row
            label={t('catalog.discount', 'Discount')}
            value={formatMoney(discount, currency)}
            latin
          />
          <Row label={t('mobile.tax', 'Tax')} value={formatMoney(tax, currency)} latin />
          <Row label={t('quotations.total', 'Total')} value={formatMoney(total, currency)} latin />
          <Row
            label={t('quotations.validUntil', 'Valid until')}
            value={formatDate(validUntil)}
            latin
          />
        </Card>

        {items.length > 0 ? (
          <Section title={t('quotations.lines', 'Quote lines')}>
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

        {terms ? (
          <Card title={t('mobile.terms', 'Terms & conditions')}>
            <Text variant="body" color="secondary">
              {terms}
            </Text>
          </Card>
        ) : null}

        {notes ? (
          <Card title={t('catalog.notes', 'Notes')}>
            <Text variant="body" color="secondary">
              {notes}
            </Text>
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
  actionsCol: { gap: spacing.sm },
  formBlock: { gap: spacing.sm },
  footerRow: { flexDirection: 'row', gap: spacing.sm },
  grow: { flex: 1 },
  multiline: { minHeight: 90, textAlignVertical: 'top', paddingTop: spacing.sm },
});
