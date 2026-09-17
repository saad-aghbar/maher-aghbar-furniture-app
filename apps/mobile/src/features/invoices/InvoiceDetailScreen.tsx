import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { can } from '@maher/permissions';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { useToast } from '@/components/feedback/Toast';
import { AppScreen } from '@/components/layout/AppScreen';
import { FloatingActionDock } from '@/components/layout/FloatingActionDock';
import { stickyCtaBottomInset } from '@/components/layout/stickyCtaInset';
import { ScreenBackLead } from '@/components/layout/ScreenBackLead';
import { useNetwork } from '@/components/network/NetworkProvider';
import { useLocale } from '@/i18n';
import { ListItemEnter } from '@/motion';
import { useTheme } from '@/theme';
import { openInvoicePdf } from './api';
import { openPaymentPdf } from '@/api/modules/payments';
import { usePdfDownload } from '@/features/pdf/usePdfDownload';
import { ApplyCreditSheet } from './components/ApplyCreditSheet';
import { EditInvoiceSheet } from './components/EditInvoiceSheet';
import { EditPaymentSheet } from './components/EditPaymentSheet';
import { InvoiceReturnBoard } from './components/InvoiceReturnBoard';
import { ConfirmationSheet } from '@/components/sheets/ConfirmationSheet';
import {
  useDeleteAllocationMutation,
  useDeletePaymentMutation,
  useInvoiceQuery,
} from './query';
import { selectInvoiceDetail, type InvoiceHistoryRow } from './selectInvoice';
import { InvoiceBalanceBoard } from './components/InvoiceBalanceBoard';
import { InvoiceDetailHero } from './components/InvoiceDetailHero';
import { InvoiceLinesBoard } from './components/InvoiceLinesBoard';
import { InvoiceMetaBoard } from './components/InvoiceMetaBoard';
import { InvoicePaymentsBoard } from './components/InvoicePaymentsBoard';
import { InvoiceStickyActions } from './components/InvoiceStickyActions';
import { RecordPaymentSheet } from './components/RecordPaymentSheet';

type Props = {
  invoiceId: string;
  backFallback?: Href;
  embedded?: boolean;
};

/** Same side inset as PersistentSurfaceTabBar floating shell. */
const TAB_BAR_SIDE_INSET_KEY = 'md' as const;

/** Invoice detail money mark — ₪, same as PORD/SINV leftovers. */
const INVOICE_DETAIL_CURRENCY = '₪';

/**
 * Invoice detail — document-forward floor boards with PDF / payment actions
 * docked above the tab bar.
 */
export function InvoiceDetailScreen({
  invoiceId,
  backFallback = '/(app)/(admin)/invoices' as Href,
  embedded = false,
}: Props) {
  const { user } = useAuth();
  const router = useRouter();
  const { t, locale } = useLocale();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { showOfflineBanner } = useNetwork();
  const { showToast } = useToast();
  const canRead = can(user, 'invoice.read');
  const canPay = can(user, 'payment.record');
  const canEditInvoice = can(user, 'invoice.update');
  /** Dealers never edit finance from the handset. */
  const isDealer = Boolean(user?.customerId);

  const [payOpen, setPayOpen] = useState(false);
  const [creditOpen, setCreditOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editRow, setEditRow] = useState<InvoiceHistoryRow | null>(null);
  const [deleteRow, setDeleteRow] = useState<InvoiceHistoryRow | null>(null);
  const query = useInvoiceQuery(invoiceId, canRead);
  const deletePayment = useDeletePaymentMutation(invoiceId, query.data?.customerId);
  const deleteAllocation = useDeleteAllocationMutation(invoiceId, query.data?.customerId);
  const { pickPdfOptions, pdfDownloadSheet } = usePdfDownload();

  const model = useMemo(
    () => (query.data ? selectInvoiceDetail(query.data, locale) : null),
    [query.data, locale],
  );

  const methodLabel = (method: string) => {
    if (method === 'CREDIT') return t('accounting.applyCredit');
    const key = `accounting.method${method}`;
    const translated = t(key);
    return translated === key ? method : translated;
  };

  if (!canRead) {
    return (
      <AppScreen backFallback={backFallback}>
        <EmptyState title={t('mobile.noModules')} description={t('mobile.noModulesHint')} />
      </AppScreen>
    );
  }

  if (query.isError && !query.data) {
    return (
      <AppScreen backFallback={backFallback}>
        {showOfflineBanner ? <OfflineBanner /> : null}
        <ErrorState
          title={t('mobile.invoices.errorTitle')}
          description={t('mobile.invoices.errorBody')}
          retryLabel={t('mobile.invoices.retry')}
          onRetry={() => void query.refetch()}
        />
      </AppScreen>
    );
  }

  if (!model) {
    return (
      <AppScreen backFallback={backFallback}>
        <AppText>{t('mobile.invoices.loading')}</AppText>
      </AppScreen>
    );
  }

  const showPay =
    canPay && !isDealer && model.outstanding > 0 && model.status !== 'CANCELLED';
  const showApplyCredit =
    canPay &&
    !isDealer &&
    model.outstanding > 0 &&
    model.availableCredit > 0 &&
    model.status !== 'CANCELLED';
  const contentPad = theme.spacing.lg;
  const tabBarInset = theme.spacing[TAB_BAR_SIDE_INSET_KEY];
  const stickyPad =
    stickyCtaBottomInset(insets.bottom, theme.spacing.md) +
    (showPay || showApplyCredit ? 108 : 72);

  const onPdf = () => {
    void (async () => {
      const opts = await pickPdfOptions();
      if (!opts) return;
      try {
        await openInvoicePdf(invoiceId, opts);
      } catch {
        showToast({ variant: 'error', message: t('mobile.invoices.pdfFailed') });
      }
    })();
  };

  const onPaymentPdf = (paymentId: string) => {
    void (async () => {
      const opts = await pickPdfOptions();
      if (!opts) return;
      try {
        await openPaymentPdf(paymentId, opts);
      } catch {
        showToast({
          variant: 'error',
          message: t('mobile.account.paymentPdfFailed'),
        });
      }
    })();
  };

  return (
    <AppScreen edges={{ top: true, bottom: false }} style={{ paddingHorizontal: 0 }}>
      {embedded ? null : (
        <View style={{ paddingHorizontal: contentPad }}>
          <ScreenBackLead fallback={backFallback} />
        </View>
      )}
      {showOfflineBanner ? (
        <View style={{ paddingHorizontal: contentPad }}>
          <OfflineBanner />
        </View>
      ) : null}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          gap: theme.spacing.md,
          paddingHorizontal: contentPad,
          paddingBottom: stickyPad,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <ListItemEnter index={0}>
          <InvoiceDetailHero
            model={model}
            onEdit={
              canEditInvoice &&
              !isDealer &&
              model.status !== 'CANCELLED' &&
              model.status !== 'VOID'
                ? () => setEditOpen(true)
                : undefined
            }
          />
        </ListItemEnter>

        <ListItemEnter index={1}>
          <InvoiceBalanceBoard model={model} currencySuffix={INVOICE_DETAIL_CURRENCY} />
        </ListItemEnter>

        {query.data?.returnRequest ? (
          <ListItemEnter index={2}>
            <InvoiceReturnBoard
              invoice={query.data}
              onOpenReturn={(returnId) => {
                router.push(
                  (isDealer
                    ? `/(app)/(customer)/returns/${returnId}`
                    : `/(app)/(admin)/returns/${returnId}`) as Href,
                );
              }}
              onOpenOrder={(orderId) => {
                router.push(
                  (isDealer
                    ? `/(app)/(customer)/sales-orders/${orderId}`
                    : `/(app)/(admin)/orders/${orderId}`) as Href,
                );
              }}
            />
          </ListItemEnter>
        ) : null}

        <ListItemEnter index={3}>
          <InvoiceMetaBoard
            model={model}
            onOpenReturn={(returnId) => {
              router.push(
                (isDealer
                  ? `/(app)/(customer)/returns/${returnId}`
                  : `/(app)/(admin)/returns/${returnId}`) as Href,
              );
            }}
          />
        </ListItemEnter>

        <InvoiceLinesBoard model={model} currencySuffix={INVOICE_DETAIL_CURRENCY} />
        <InvoicePaymentsBoard
          model={model}
          currencySuffix={INVOICE_DETAIL_CURRENCY}
          methodLabel={methodLabel}
          onPaymentPdf={onPaymentPdf}
          canEditPayments={canPay && !isDealer}
          onEditPayment={setEditRow}
          onDeletePayment={setDeleteRow}
        />
      </ScrollView>

      <FloatingActionDock
        floating
        style={{ paddingHorizontal: tabBarInset, zIndex: 30 }}
      >
        <InvoiceStickyActions
          pdfLabel={t('accounting.downloadPdf')}
          payLabel={showPay ? t('accounting.recordPayment') : undefined}
          applyCreditLabel={
            showApplyCredit ? t('accounting.applyCredit') : undefined
          }
          onPdf={onPdf}
          onPay={
            showPay
              ? () => {
                  setPayOpen(true);
                }
              : undefined
          }
          onApplyCredit={
            showApplyCredit
              ? () => {
                  setCreditOpen(true);
                }
              : undefined
          }
        />
      </FloatingActionDock>

      {showPay ? (
        <RecordPaymentSheet
          open={payOpen}
          onClose={() => setPayOpen(false)}
          invoiceId={model.id}
          customerId={model.customerId}
          defaultAmount={model.outstanding}
          onRecorded={() => void query.refetch()}
        />
      ) : null}
      {showApplyCredit ? (
        <ApplyCreditSheet
          open={creditOpen}
          onClose={() => setCreditOpen(false)}
          invoiceId={model.id}
          customerId={model.customerId}
          remaining={model.outstanding}
          availableCredit={model.availableCredit}
          onApplied={() => void query.refetch()}
        />
      ) : null}
      {canPay && !isDealer ? (
        <EditPaymentSheet
          open={Boolean(editRow)}
          onClose={() => setEditRow(null)}
          invoiceId={invoiceId}
          customerId={model.customerId}
          payment={
            editRow
              ? {
                  id: editRow.id,
                  allocationId: editRow.allocationId,
                  kind: editRow.kind,
                  amount: editRow.amount,
                  method: editRow.method,
                  reference: editRow.reference,
                }
              : null
          }
          onSaved={() => void query.refetch()}
        />
      ) : null}
      <ConfirmationSheet
        open={Boolean(deleteRow)}
        onClose={() => setDeleteRow(null)}
        title={t('mobile.invoices.deletePayment')}
        message={t('mobile.invoices.deletePaymentConfirm')}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        destructive
        onConfirm={() => {
          if (!deleteRow) return;
          const onGone = () => {
            setDeleteRow(null);
            void query.refetch();
          };
          if (deleteRow.kind === 'credit' && deleteRow.allocationId) {
            deleteAllocation.mutate(deleteRow.allocationId, { onSuccess: onGone });
            return;
          }
          deletePayment.mutate(deleteRow.id, { onSuccess: onGone });
        }}
      />
      {canEditInvoice && !isDealer && query.data ? (
        <EditInvoiceSheet
          open={editOpen}
          onClose={() => setEditOpen(false)}
          invoice={query.data}
          onSaved={() => {
            showToast({
              variant: 'success',
              message: t('mobile.invoices.editSaved'),
            });
            void query.refetch();
          }}
        />
      ) : null}
      {pdfDownloadSheet}
    </AppScreen>
  );
}
