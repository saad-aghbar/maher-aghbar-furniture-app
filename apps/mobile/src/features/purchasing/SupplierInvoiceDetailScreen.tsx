import { useState } from 'react';
import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { can } from '@maher/permissions';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { useToast } from '@/components/feedback/Toast';
import { AppScreen } from '@/components/layout/AppScreen';
import { FloatingActionDock } from '@/components/layout/FloatingActionDock';
import { stickyCtaBottomInset } from '@/components/layout/stickyCtaInset';
import { ScreenBackLead } from '@/components/layout/ScreenBackLead';
import { useNetwork } from '@/components/network/NetworkProvider';
import { ConfirmationSheet } from '@/components/sheets/ConfirmationSheet';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { usePdfDownload } from '@/features/pdf/usePdfDownload';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics, ListItemEnter } from '@/motion';
import { useTheme } from '@/theme';
import { InvoiceRowActionChip } from '@/features/invoices/components/InvoiceRowActionChip';
import { InvoiceStickyActions } from '@/features/invoices/components/InvoiceStickyActions';
import {
  openGoodsReceiptPdf,
  openPurchaseOrderPdf,
  openSupplierPaymentPdf,
} from './api';
import { EditSupplierInvoiceSheet } from './components/EditSupplierInvoiceSheet';
import { EditSupplierPaymentSheet } from './components/EditSupplierPaymentSheet';
import { RecordSupplierPaymentSheet } from './components/RecordSupplierPaymentSheet';
import { PurchasingFloorBoard } from './components/PurchasingFloorBoard';
import {
  useDeleteSupplierPaymentMutation,
  useSupplierInvoiceQuery,
} from './query';
import { paymentHistoryCaption } from '@/features/invoices/selectInvoice';
import { formatSupplierInvoiceLineMath, localizedNamed } from './selectPurchase';

type Props = { invoiceId: string };

export function SupplierInvoiceDetailScreen({ invoiceId }: Props) {
  const { user } = useAuth();
  const router = useRouter();
  const { t, locale, formatCurrency, formatDate, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const insets = useSafeAreaInsets();
  const { showOfflineBanner } = useNetwork();
  const { showToast } = useToast();
  const { pickPdfOptions, pdfDownloadSheet } = usePdfDownload();
  const canRead = can(user, 'supplier-invoice.read');
  const canEdit = can(user, 'supplier-invoice.update');
  const canPay = can(user, 'supplier-payment.record');
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const backFallback = '/(app)/(admin)/purchasing?tab=invoices' as Href;
  const [editOpen, setEditOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [editPaymentId, setEditPaymentId] = useState<string | null>(null);
  const [deletePaymentId, setDeletePaymentId] = useState<string | null>(null);
  const query = useSupplierInvoiceQuery(invoiceId, canRead);
  const deletePayment = useDeleteSupplierPaymentMutation(invoiceId);

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
          title={t('mobile.purchasing.errorTitle')}
          description={t('mobile.purchasing.errorBody')}
          retryLabel={t('mobile.purchasing.retry')}
          onRetry={() => void query.refetch()}
        />
      </AppScreen>
    );
  }

  const inv = query.data;
  if (!inv) {
    return (
      <AppScreen backFallback={backFallback}>
        <AppText>{t('mobile.purchasing.loading')}</AppText>
      </AppScreen>
    );
  }

  const outstanding = Number(inv.outstandingAmount) || 0;
  const paid = Number(inv.paidAmount) || 0;
  const total = Number(inv.total) || 0;
  const tax = Number(inv.taxTotal ?? inv.taxAmount) || 0;
  const subtotal = Number(inv.subtotal) || Math.max(0, total - tax);
  const locked = inv.status === 'CANCELLED' || inv.status === 'VOID';
  const fabric = String(inv.materialKind ?? '').toUpperCase() === 'FABRIC';
  const showPay = canPay && !locked && outstanding > 0.001;
  const poId = inv.purchaseOrder?.id;
  const showDock = Boolean(showPay || poId);
  const stickyPad = stickyCtaBottomInset(insets.bottom, theme.spacing.md) + (showDock ? 88 : 24);
  const editingPayment = (inv.payments ?? []).find((row) => row.id === editPaymentId) ?? null;
  const methodLabel = (method: string) => {
    const key = `accounting.method${method}`;
    const translated = t(key);
    return translated === key ? method : translated;
  };

  const openPo = () => {
    if (!inv.purchaseOrder?.id) return;
    router.push(`/(app)/(admin)/purchasing/${inv.purchaseOrder.id}` as Href);
  };

  return (
    <AppScreen edges={{ top: true, bottom: false }} style={{ paddingHorizontal: 0 }}>
      <View style={{ paddingHorizontal: theme.spacing.lg }}>
        <ScreenBackLead fallback={backFallback} />
      </View>
      {showOfflineBanner ? (
        <View style={{ paddingHorizontal: theme.spacing.lg }}>
          <OfflineBanner />
        </View>
      ) : null}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          gap: theme.spacing.md,
          paddingHorizontal: theme.spacing.lg,
          paddingBottom: stickyPad,
        }}
      >
        <ListItemEnter index={0}>
          <View
            style={{
              borderRadius: theme.radius.xl,
              borderWidth: 1,
              borderColor: colors.borderStrong,
              backgroundColor: colors.surface,
              overflow: 'hidden',
              ...orderBoardShadow(colorScheme),
            }}
          >
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                ...(isRTL ? { right: 0 } : { left: 0 }),
                width: 3,
                backgroundColor: colors.brand,
                opacity: 0.55,
              }}
            />
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: theme.spacing.sm,
                paddingHorizontal: theme.spacing.lg,
                paddingVertical: theme.spacing.md,
                ...(isRTL ? { paddingRight: theme.spacing.lg + 4 } : { paddingLeft: theme.spacing.lg + 4 }),
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
                backgroundColor: colors.surfaceSecondary,
              }}
            >
              <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 8, alignItems: 'center' }}>
                <StatusBadge status={inv.status} dot />
                <View
                  style={{
                    paddingHorizontal: 10,
                    minHeight: 28,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: colors.brand,
                    backgroundColor: colors.brandSoft,
                    justifyContent: 'center',
                  }}
                >
                  <AppText variant="caption" color="brand" weight={titleWeight}>
                    {fabric
                      ? t('mobile.invoices.purchasingKind.fabric')
                      : t('mobile.invoices.purchasingKind.raw')}
                  </AppText>
                </View>
              </View>
              {canEdit && !locked ? (
                <AnimatedPressable
                  variant="button"
                  onPress={() => {
                    void haptics.selection();
                    setEditOpen(true);
                  }}
                  style={{
                    minHeight: 36,
                    paddingHorizontal: theme.spacing.md,
                    borderRadius: theme.radius.full,
                    borderWidth: 1,
                    borderColor: colors.brand,
                    backgroundColor: colors.surface,
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Ionicons name="create-outline" size={16} color={colors.brand} />
                  <AppText variant="caption" weight={titleWeight} color="brand">
                    {t('mobile.invoices.edit')}
                  </AppText>
                </AnimatedPressable>
              ) : null}
            </View>
            <View
              style={{
                padding: theme.spacing.lg,
                ...(isRTL ? { paddingRight: theme.spacing.lg + 4 } : { paddingLeft: theme.spacing.lg + 4 }),
                gap: 6,
              }}
            >
              <AppText variant="title" weight={titleWeight} dir="ltr">
                {inv.number}
              </AppText>
              <AppText variant="caption" color="secondary">
                {localizedNamed(locale, inv.supplier)}
              </AppText>
            </View>
          </View>
        </ListItemEnter>

        <ListItemEnter index={1}>
          <PurchasingFloorBoard title={t('accounting.amountDue')}>
            <AppText
              weight={titleWeight}
              dir="ltr"
              style={{
                fontSize: 34,
                lineHeight: locale === 'ar' ? 52 : 42,
                fontVariant: ['tabular-nums'],
                color: outstanding > 0 ? colors.warning : colors.success,
              }}
            >
              {formatCurrency(outstanding)}
            </AppText>
            <Meta label={t('catalog.paid')} value={formatCurrency(paid)} />
            <Meta label={t('accounting.subtotal')} value={formatCurrency(subtotal)} />
            <Meta label={t('accounting.tax')} value={formatCurrency(tax)} />
            <Meta label={t('accounting.total')} value={formatCurrency(total)} />
          </PurchasingFloorBoard>
        </ListItemEnter>

        <ListItemEnter index={2}>
          <PurchasingFloorBoard title={t('mobile.invoices.editHeader')}>
            <Meta label={t('catalog.supplier')} value={localizedNamed(locale, inv.supplier)} />
            {inv.purchaseOrder?.number ? (
              <AnimatedPressable variant="button" onPress={openPo}>
                <Meta label={t('catalog.poShort')} value={inv.purchaseOrder.number} />
              </AnimatedPressable>
            ) : null}
            {inv.goodsReceipt?.number ? (
              <Meta label={t('mobile.invoices.goodsReceipt')} value={inv.goodsReceipt.number} />
            ) : null}
            {inv.invoiceDate ? (
              <Meta label={t('mobile.invoices.invoiceDate')} value={formatDate(inv.invoiceDate)} />
            ) : null}
            {inv.dueDate ? (
              <Meta label={t('accounting.dueDate')} value={formatDate(inv.dueDate)} />
            ) : null}
            <Meta label={t('mobile.invoices.currency')} value={inv.currency ?? 'ILS'} />
            {inv.purchaseOrder?.paymentTermsDays != null ? (
              <Meta
                label={t('mobile.invoices.paymentTerms')}
                value={String(inv.purchaseOrder.paymentTermsDays)}
              />
            ) : null}
          </PurchasingFloorBoard>
        </ListItemEnter>

        <ListItemEnter index={3}>
          <PurchasingFloorBoard title={t('catalog.materialsList')}>
            {(inv.lines ?? []).length === 0 ? (
              <AppText variant="caption" color="muted">—</AppText>
            ) : (
              (inv.lines ?? []).map((line) => (
                <View
                  key={line.id}
                  style={{
                    borderRadius: theme.radius.lg,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.surfaceSecondary,
                    padding: theme.spacing.sm,
                    gap: 4,
                  }}
                >
                  <AppText weight="semibold">{line.description}</AppText>
                  <AppText variant="caption" color="secondary" dir="ltr">
                    {formatSupplierInvoiceLineMath(
                      locale,
                      line.quantity,
                      line.unitPrice,
                      line.lineTotal,
                    )}
                  </AppText>
                  <AppText variant="caption" color="muted">
                    {t('accounting.tax')} {String(line.taxRate ?? 0)}
                  </AppText>
                </View>
              ))
            )}
          </PurchasingFloorBoard>
        </ListItemEnter>

        <ListItemEnter index={4}>
          <PurchasingFloorBoard title={t('accounting.paymentHistory')}>
            {(inv.payments ?? []).length === 0 ? (
              <AppText variant="caption" color="muted">{t('accounting.noPayments')}</AppText>
            ) : (
              (inv.payments ?? []).map((payment) => (
                <View key={payment.id} style={{ gap: 4 }}>
                  <AppText weight="semibold" dir="ltr">
                    {payment.number ?? payment.id}
                  </AppText>
                  <AppText variant="caption" color="secondary">
                    {paymentHistoryCaption([
                      payment.paymentDate ? formatDate(payment.paymentDate) : null,
                      payment.method ? methodLabel(payment.method) : null,
                      payment.referenceNumber,
                      formatCurrency(Number(payment.amount) || 0),
                    ])}
                  </AppText>
                  <View
                    style={{
                      flexDirection: isRTL ? 'row-reverse' : 'row',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      gap: theme.spacing.sm,
                      paddingTop: 4,
                    }}
                  >
                    <InvoiceRowActionChip
                      label={t('catalog.pdf')}
                      icon="download-outline"
                      onPress={() => {
                        void (async () => {
                          const opts = await pickPdfOptions();
                          if (!opts) return;
                          try {
                            await openSupplierPaymentPdf(payment.id, opts);
                          } catch {
                            showToast({
                              variant: 'error',
                              message: t('mobile.account.paymentPdfFailed'),
                            });
                          }
                        })();
                      }}
                    />
                    {canPay ? (
                      <InvoiceRowActionChip
                        label={t('mobile.invoices.edit')}
                        icon="create-outline"
                        onPress={() => setEditPaymentId(payment.id)}
                      />
                    ) : null}
                    {canPay ? (
                      <InvoiceRowActionChip
                        label={t('common.delete')}
                        icon="trash-outline"
                        tone="danger"
                        onPress={() => setDeletePaymentId(payment.id)}
                      />
                    ) : null}
                  </View>
                </View>
              ))
            )}
          </PurchasingFloorBoard>
        </ListItemEnter>

        <ListItemEnter index={5}>
          <PurchasingFloorBoard title={t('mobile.invoices.documents')}>
            {!inv.purchaseOrder?.id && !inv.goodsReceipt?.id ? (
              <AppText variant="caption" color="muted">—</AppText>
            ) : null}
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: theme.spacing.sm,
              }}
            >
              {inv.purchaseOrder?.id ? (
                <InvoiceRowActionChip
                  label={t('mobile.invoices.poPdf')}
                  icon="download-outline"
                  onPress={() => {
                    void (async () => {
                      const opts = await pickPdfOptions();
                      if (!opts) return;
                      try {
                        await openPurchaseOrderPdf(inv.purchaseOrder!.id, opts);
                      } catch {
                        showToast({ variant: 'error', message: t('mobile.invoices.pdfFailed') });
                      }
                    })();
                  }}
                />
              ) : null}
              {inv.goodsReceipt?.id ? (
                <InvoiceRowActionChip
                  label={t('mobile.invoices.grnPdf')}
                  icon="download-outline"
                  onPress={() => {
                    void (async () => {
                      const opts = await pickPdfOptions();
                      if (!opts) return;
                      try {
                        await openGoodsReceiptPdf(inv.goodsReceipt!.id, opts);
                      } catch {
                        showToast({ variant: 'error', message: t('mobile.invoices.pdfFailed') });
                      }
                    })();
                  }}
                />
              ) : null}
            </View>
          </PurchasingFloorBoard>
        </ListItemEnter>
      </ScrollView>

      {showDock ? (
        <FloatingActionDock floating style={{ paddingHorizontal: theme.spacing.md, zIndex: 30 }}>
          <InvoiceStickyActions
            pdfLabel={poId ? t('mobile.invoices.poPdf') : undefined}
            onPdf={
              poId
                ? () => {
                    void (async () => {
                      const opts = await pickPdfOptions();
                      if (!opts) return;
                      try {
                        await openPurchaseOrderPdf(poId, opts);
                      } catch {
                        showToast({ variant: 'error', message: t('mobile.invoices.pdfFailed') });
                      }
                    })();
                  }
                : undefined
            }
            payLabel={showPay ? t('mobile.invoices.recordSupplierPayment') : undefined}
            onPay={showPay ? () => setPayOpen(true) : undefined}
          />
        </FloatingActionDock>
      ) : null}

      {canEdit && !locked ? (
        <EditSupplierInvoiceSheet
          open={editOpen}
          onClose={() => setEditOpen(false)}
          invoice={inv}
          onSaved={() => {
            showToast({ variant: 'success', message: t('mobile.invoices.editSaved') });
            void query.refetch();
          }}
        />
      ) : null}
      {showPay ? (
        <RecordSupplierPaymentSheet
          open={payOpen}
          onClose={() => setPayOpen(false)}
          invoiceId={inv.id}
          supplierId={inv.supplierId}
          outstanding={outstanding}
          onRecorded={() => void query.refetch()}
        />
      ) : null}
      {canPay ? (
        <EditSupplierPaymentSheet
          open={Boolean(editPaymentId)}
          onClose={() => setEditPaymentId(null)}
          invoiceId={inv.id}
          payment={editingPayment}
          onSaved={() => {
            showToast({ variant: 'success', message: t('mobile.invoices.editSaved') });
            void query.refetch();
          }}
        />
      ) : null}
      <ConfirmationSheet
        open={Boolean(deletePaymentId)}
        onClose={() => setDeletePaymentId(null)}
        title={t('mobile.invoices.deletePayment')}
        message={t('mobile.invoices.deletePaymentConfirm')}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        destructive
        onConfirm={() => {
          if (!deletePaymentId) return;
          deletePayment.mutate(deletePaymentId, {
            onSuccess: () => {
              setDeletePaymentId(null);
              void query.refetch();
            },
          });
        }}
      />
      {pdfDownloadSheet}
    </AppScreen>
  );
}

function Meta({
  label,
  value,
  danger,
}: {
  label: string;
  value: string;
  danger?: boolean;
}) {
  const { colors, theme } = useTheme();
  const { isRTL } = useLocale();
  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        justifyContent: 'space-between',
        gap: theme.spacing.md,
        paddingVertical: 4,
      }}
    >
      <AppText variant="caption" color="muted" style={{ textAlign: isRTL ? 'right' : 'left' }}>
        {label}
      </AppText>
      <AppText
        weight="semibold"
        dir="ltr"
        style={{
          flex: 1,
          textAlign: isRTL ? 'left' : 'right',
          color: danger ? colors.error : colors.textPrimary,
        }}
      >
        {value}
      </AppText>
    </View>
  );
}
