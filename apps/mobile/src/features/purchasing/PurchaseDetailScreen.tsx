import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { can } from '@maher/permissions';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { useToast } from '@/components/feedback/Toast';
import { AppScreen } from '@/components/layout/AppScreen';
import { FloatingActionDock } from '@/components/layout/FloatingActionDock';
import { stickyCtaBottomInset } from '@/components/layout/stickyCtaInset';
import { useNetwork } from '@/components/network/NetworkProvider';
import { ConfirmationSheet } from '@/components/sheets/ConfirmationSheet';
import { PurchaseWhatsAppPreviewSheet } from './components/PurchaseWhatsAppPreviewSheet';
import { PurchasingSkeleton } from './components/PurchasingSkeleton';
import { openPurchaseOrderPdf } from './api';
import { usePdfDownload } from '@/features/pdf/usePdfDownload';
import { useLocale } from '@/i18n';
import { haptics } from '@/motion';
import { SURFACE_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import { useTheme } from '@/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { PurchaseWhatsAppResult } from '@/api/modules/purchasing';
import { PurchasingFloorBoard } from './components/PurchasingFloorBoard';
import { usePurchaseActionMutation, usePurchaseOrderQuery } from './query';
import { groupReceiptsByWarehouse } from './receiveLineDrafts';
import {
  localizedNamed,
  purchaseLineQtyLabel,
  resolvePhaseLabel,
  selectPurchaseDetail,
} from './selectPurchase';

type Props = { orderId: string };

/** Extra lift so the last Receipts card clears the floating tab bar. */
const RECEIPTS_TAB_CLEARANCE_EXTRA = 48;

export function PurchaseDetailScreen({ orderId }: Props) {
  const { user } = useAuth();
  const router = useRouter();
  const { t, locale, formatCurrency, formatDate, isRTL } = useLocale();
  const { theme, colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { showOfflineBanner } = useNetwork();
  const { showToast } = useToast();
  const canRead = can(user, 'purchase-order.read');
  const canApprove = can(user, 'purchase-order.approve');
  const canReceive = can(user, 'inventory.receive');
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const backFallback = '/(app)/(admin)/purchasing' as Href;

  const [confirm, setConfirm] = useState<'approve' | null>(null);
  const [whatsappPreview, setWhatsappPreview] = useState<PurchaseWhatsAppResult | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewDraft, setPreviewDraft] = useState<{ to: string | null; body: string } | null>(null);
  const { pickPdfOptions, pdfDownloadSheet } = usePdfDownload();
  const query = usePurchaseOrderQuery(orderId, canRead);
  const actions = usePurchaseActionMutation(orderId);

  const detail = useMemo(
    () => (query.data ? selectPurchaseDetail(query.data, locale) : null),
    [query.data, locale],
  );

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

  const po = query.data;
  if (!po || !detail) {
    return (
      <AppScreen backFallback={backFallback}>
        <PurchasingSkeleton />
      </AppScreen>
    );
  }

  const presentation = po.presentation;
  const phaseLabel = resolvePhaseLabel(t, presentation);
  const progressPct = Math.round((Number(presentation?.progress) || 0) * 100);
  const costing = po.purchasingCosting;
  const remainingLines = detail.lines.filter((l) => l.remainingQty > 0).length;
  const remainingNonFabric = detail.lines.filter(
    (l) => l.remainingQty > 0 && !l.fabricProcurementId,
  ).length;
  const canOpenReceive =
    canReceive &&
    remainingNonFabric > 0 &&
    (po.status === 'SENT' || po.status === 'PARTIALLY_RECEIVED');
  const showApprove = canApprove && po.status === 'DRAFT';
  const showSend = canApprove && po.status === 'APPROVED';
  const showResendWhatsapp = canApprove && po.status === 'SENT';
  const whatsappBody = whatsappPreview?.body ?? po.whatsappLastBody ?? null;
  const whatsappTo = whatsappPreview?.to ?? po.whatsappLastTo ?? null;
  const hasDockActions = showApprove || showSend || canOpenReceive || showResendWhatsapp;
  const dockPad = hasDockActions
    ? stickyCtaBottomInset(insets.bottom, theme.spacing.md, SURFACE_TAB_BAR_CLEARANCE) +
      96 +
      RECEIPTS_TAB_CLEARANCE_EXTRA
    : theme.spacing['3xl'] + SURFACE_TAB_BAR_CLEARANCE + RECEIPTS_TAB_CLEARANCE_EXTRA;

  return (
    <AppScreen backFallback={backFallback}>
      {showOfflineBanner ? <OfflineBanner /> : null}
      <ScrollView
        contentContainerStyle={{
          gap: theme.spacing.md,
          paddingBottom: dockPad,
        }}
      >
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            justifyContent: 'space-between',
            gap: theme.spacing.sm,
            alignItems: 'flex-start',
          }}
        >
          <View style={{ flex: 1, gap: 4 }}>
            <AppText
              variant="title"
              weight={titleWeight}
              dir="ltr"
              style={{ textAlign: isRTL ? 'right' : 'left' }}
            >
              {po.number}
            </AppText>
            {phaseLabel ? (
              <AppText
                variant="caption"
                weight="semibold"
                style={{
                  textAlign: isRTL ? 'right' : 'left',
                  color:
                    presentation?.attentionReason === 'OVERDUE_ETA'
                      ? colors.error
                      : colors.brand,
                }}
              >
                {phaseLabel}
                {presentation?.attentionReason === 'OVERDUE_ETA'
                  ? ` · ${t('mobile.purchasing.overdueEta')}`
                  : ''}
              </AppText>
            ) : (
              <StatusBadge status={po.status} />
            )}
          </View>
        </View>

        <PurchasingFloorBoard>
          <Meta label={t('catalog.supplier')} value={detail.supplierName} />
          {po.origin && po.origin !== 'MANUAL' ? (
            <Meta
              label={t('mobile.purchasing.origin')}
              value={t(
                `mobile.purchasing.origin${po.origin === 'LOW_STOCK' ? 'LowStock' : po.origin === 'DEMAND' ? 'Demand' : po.origin === 'FABRIC' ? 'Fabric' : 'Request'}`,
              )}
            />
          ) : null}
          {detail.expectedDeliveryDate ? (
            <Meta
              label={t('mobile.purchasing.expectedArrival')}
              value={formatDate(detail.expectedDeliveryDate)}
              ltr
            />
          ) : null}
          {detail.notes ? <Meta label={t('catalog.notes')} value={detail.notes} /> : null}
          <Meta
            label={t('mobile.purchasing.grandTotalInclTax')}
            value={formatCurrency(detail.grandTotalInclTax)}
            emphasize
            ltr
          />
          {presentation ? (
            <Meta
              label={t('mobile.purchasing.progressReceived', { pct: String(progressPct) })}
              value={`${remainingLines} ${t('mobile.purchasing.remaining')}`}
            />
          ) : null}
        </PurchasingFloorBoard>

        {costing ? (
          <PurchasingFloorBoard title={t('mobile.purchasing.purchaseVariance')}>
            <Meta
              label={t('mobile.purchasing.expectedTotal')}
              value={formatCurrency(Number(costing.expectedTotal) || 0)}
            />
            <Meta
              label={t('mobile.purchasing.actualReceived')}
              value={formatCurrency(Number(costing.actualReceivedValue) || 0)}
            />
            <Meta
              label={t('mobile.purchasing.purchaseVariance')}
              value={formatCurrency(Number(costing.purchaseVariance) || 0)}
              emphasize
            />
          </PurchasingFloorBoard>
        ) : null}

        <PurchasingFloorBoard title={t('catalog.materialsList')}>
          {detail.lines.length === 0 ? (
            <AppText variant="caption" color="muted">
              —
            </AppText>
          ) : (
            detail.lines.map((line) => (
              <View key={line.key} style={{ gap: 4, paddingBottom: theme.spacing.sm }}>
                <AppText weight="semibold" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                  {line.description}
                </AppText>
                <AppText variant="caption" color="secondary" dir="ltr">
                  {`${purchaseLineQtyLabel(locale, line.quantity, line.unit)} × ${formatCurrency(line.unitPrice)}`}
                </AppText>
                <AppText
                  variant="caption"
                  color="muted"
                  style={{ textAlign: isRTL ? 'right' : 'left' }}
                >
                  {`${t('mobile.purchasing.alreadyReceived')}: ${String(line.receivedQty ?? 0)} · ${t('mobile.purchasing.remaining')}: ${String(line.remainingQty ?? Math.max(0, Number(line.quantity) - Number(line.receivedQty ?? 0)))}`}
                </AppText>
                {line.warehouseId || line.locationId || line.warehouse || line.location ? (
                  <AppText variant="caption" color="muted" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {`${t('mobile.purchasing.destination')}: ${
                      line.location?.name ||
                      line.warehouse?.nameAr ||
                      line.warehouse?.nameEn ||
                      line.warehouse?.name ||
                      line.locationId ||
                      line.warehouseId
                    }`}
                  </AppText>
                ) : null}
                <AppText variant="caption" weight="semibold" dir="ltr">
                  {String(line.lineTotal ?? '—')}
                </AppText>
                {line.fabricProcurementId ? (
                  <>
                    <AppText
                      variant="caption"
                      color="secondary"
                      style={{
                        color: colors.brand,
                        textAlign: isRTL ? 'right' : 'left',
                      }}
                    >
                      {t('mobile.purchasing.fabricReceiveOnFabricScreen')}
                    </AppText>
                    <SecondaryButton
                      label={t('mobile.purchasing.openFabric')}
                      onPress={() => {
                        void haptics.selection();
                        router.push(
                          `/(app)/(admin)/purchasing/fabric/${line.fabricProcurementId}` as Href,
                        );
                      }}
                      style={{
                        borderRadius: theme.radius.xl,
                        minHeight: theme.sizes.touch.min,
                      }}
                    />
                  </>
                ) : null}
              </View>
            ))
          )}
        </PurchasingFloorBoard>

        <PurchasingFloorBoard title={t('mobile.purchasing.receipts')}>
          {(po.goodsReceipts ?? []).length === 0 ? (
            <AppText variant="caption" color="muted">
              {t('mobile.purchasing.noReceiptsYet')}
            </AppText>
          ) : (
            groupReceiptsByWarehouse(po.goodsReceipts ?? []).flatMap((group) =>
              group.receipts.map((grn) => (
              <View key={grn.id} style={{ gap: 4, paddingBottom: theme.spacing.sm }}>
                <View
                  style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    justifyContent: 'space-between',
                    gap: theme.spacing.sm,
                  }}
                >
                  <AppText weight="semibold" dir="ltr">
                    {`${grn.number ?? grn.id}${grn.warehouse?.nameEn || grn.warehouseId ? ` · ${grn.warehouse?.nameEn || grn.warehouseId}` : ''}`}
                  </AppText>
                  <AppText variant="caption" color="muted" dir="ltr">
                    {grn.createdAt || grn.receiptDate
                      ? formatDate(grn.createdAt || grn.receiptDate!)
                      : '—'}
                  </AppText>
                </View>
                {(grn.lines ?? []).map((gl, gi) => (
                  <AppText
                    key={gl.id ?? `${grn.id}-${gi}`}
                    variant="caption"
                    color="secondary"
                    style={{ textAlign: isRTL ? 'right' : 'left' }}
                  >
                    {`${gl.inventoryItem?.sku ?? ''} × ${String(gl.receivedQty ?? 0)}${gl.unitCost != null ? ` @ ${formatCurrency(Number(gl.unitCost))}` : ''}`}
                  </AppText>
                ))}
              </View>
            )))
          )}
        </PurchasingFloorBoard>

        {(po.attachments ?? []).length > 0 ? (
          <PurchasingFloorBoard title={t('mobile.purchasing.attachments')}>
            {(po.attachments ?? []).map((att) => {
              const categoryLabel = att.category.includes(':')
                ? att.category.split(':')[0]
                : att.category;
              return (
                <View
                  key={att.id}
                  style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    justifyContent: 'space-between',
                    gap: theme.spacing.sm,
                    alignItems: 'flex-start',
                    paddingBottom: theme.spacing.sm,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                  }}
                >
                  <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
                    <AppText
                      weight="semibold"
                      numberOfLines={2}
                      style={{ textAlign: isRTL ? 'right' : 'left' }}
                    >
                      {att.fileName}
                    </AppText>
                    <AppText
                      variant="caption"
                      color="muted"
                      numberOfLines={1}
                      style={{ textAlign: isRTL ? 'right' : 'left' }}
                    >
                      {categoryLabel}
                    </AppText>
                  </View>
                  <AppText variant="caption" color="muted" dir="ltr">
                    {att.createdAt ? formatDate(att.createdAt) : '—'}
                  </AppText>
                </View>
              );
            })}
          </PurchasingFloorBoard>
        ) : null}

        {po.whatsappLastBody || po.whatsappSentAt ? (
          <PurchasingFloorBoard title={t('mobile.purchasing.whatsappMessage')}>
            {whatsappTo ? (
              <AppText variant="caption" color="muted" dir="ltr">
                {whatsappTo}
              </AppText>
            ) : null}
            {po.whatsappSentAt ? (
              <AppText variant="caption" color="muted" dir="ltr">
                {formatDate(po.whatsappSentAt)}
              </AppText>
            ) : null}
            <AppText
              variant="caption"
              color="secondary"
              style={{ textAlign: isRTL ? 'right' : 'left' }}
            >
              {whatsappBody}
            </AppText>
            <SecondaryButton
              label={t('mobile.purchasing.copyWhatsapp')}
              onPress={() => {
                void Clipboard.setStringAsync(whatsappBody ?? '').then(() => {
                  void haptics.confirmLight();
                  showToast({
                    variant: 'success',
                    message: t('mobile.purchasing.copied'),
                  });
                });
              }}
              style={{ borderRadius: theme.radius.xl }}
            />
          </PurchasingFloorBoard>
        ) : null}

      </ScrollView>

      {hasDockActions ? (
        <FloatingActionDock floating>
          <View style={{ gap: theme.spacing.sm }}>
            {showApprove ? (
              <PrimaryButton
                label={t('mobile.purchasing.approve')}
                onPress={() => setConfirm('approve')}
                style={{ borderRadius: theme.radius.xl }}
              />
            ) : null}
            {showSend ? (
              <PrimaryButton
                label={t('mobile.purchasing.previewSend')}
                loading={actions.draftWhatsApp.isPending}
                onPress={() => {
                  actions.draftWhatsApp.mutate(undefined, {
                    onSuccess: (draft) => {
                      setPreviewDraft({ to: draft.to, body: draft.body });
                      setPreviewOpen(true);
                    },
                    onError: () =>
                      showToast({ variant: 'error', message: t('mobile.purchasing.updateFailed') }),
                  });
                }}
                style={{ borderRadius: theme.radius.xl, minHeight: 44 }}
              />
            ) : null}
            {showResendWhatsapp ? (
              <SecondaryButton
                label={t('mobile.purchasing.resendWhatsapp')}
                onPress={() => {
                  actions.draftWhatsApp.mutate(undefined, {
                    onSuccess: (draft) => {
                      setPreviewDraft({ to: draft.to, body: draft.body });
                      setPreviewOpen(true);
                    },
                    onError: () =>
                      showToast({ variant: 'error', message: t('mobile.purchasing.updateFailed') }),
                  });
                }}
                style={{ borderRadius: theme.radius.xl, minHeight: 44 }}
              />
            ) : null}
            <SecondaryButton
              label={t('mobile.purchasing.pdf')}
              onPress={() => {
                void pickPdfOptions().then((opts) => {
                  if (!opts) return;
                  return openPurchaseOrderPdf(po.id, opts);
                }).catch(() => {
                  void haptics.error();
                  showToast({ variant: 'error', message: t('mobile.invoices.pdfFailed') });
                });
              }}
              style={{ borderRadius: theme.radius.xl, minHeight: 44 }}
            />
            {canOpenReceive ? (
              <SecondaryButton
                label={t('mobile.purchasing.receive')}
                onPress={() =>
                  router.push(`/(app)/(admin)/inventory/receive/${po.id}` as Href)
                }
                style={{ borderRadius: theme.radius.xl }}
              />
            ) : showSend ? (
              <AppText color="muted" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                {t('mobile.purchasing.receiveAfterSend')}
              </AppText>
            ) : null}
          </View>
        </FloatingActionDock>
      ) : null}

      <ConfirmationSheet
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        title={t('mobile.purchasing.approve')}
        message={t('mobile.purchasing.approveConfirm')}
        confirmLabel={t('mobile.purchasing.confirm')}
        cancelLabel={t('mobile.purchasing.cancel')}
        onConfirm={() => {
          actions.approve.mutate(undefined, {
            onSuccess: () => {
              void haptics.confirmMedium();
              showToast({
                variant: 'success',
                message: t('mobile.purchasing.updateSuccess'),
              });
            },
            onError: () =>
              showToast({
                variant: 'error',
                message: t('mobile.purchasing.updateFailed'),
              }),
          });
        }}
      />
      <PurchaseWhatsAppPreviewSheet
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        to={previewDraft?.to}
        body={previewDraft?.body ?? ''}
        templateBody={previewDraft?.body}
        sending={actions.send.isPending}
        onSend={(orders) => {
          actions.send.mutate(
            { body: orders[0]?.body },
            {
              onSuccess: (result) => {
                void haptics.confirmMedium();
                setPreviewOpen(false);
                setWhatsappPreview(result.whatsapp);
                const wa = result.whatsapp;
                if (wa.ok && wa.to) {
                  showToast({
                    variant: 'success',
                    message: t('mobile.purchasing.whatsappSentOk', { to: wa.to }),
                  });
                } else if (!wa.to) {
                  showToast({
                    variant: 'warning',
                    message: t('mobile.purchasing.whatsappNoPhone'),
                  });
                } else {
                  showToast({
                    variant: 'warning',
                    message: t('mobile.purchasing.whatsappSentFailed'),
                  });
                }
              },
              onError: () =>
                showToast({
                  variant: 'error',
                  message: t('mobile.purchasing.updateFailed'),
                }),
            },
          );
        }}
      />

      {pdfDownloadSheet}
    </AppScreen>
  );
}

function Meta({
  label,
  value,
  emphasize,
  ltr,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
  ltr?: boolean;
}) {
  const { isRTL } = useLocale();
  return (
    <View style={{ gap: 2 }}>
      <AppText
        variant="caption"
        color="muted"
        style={{ textAlign: isRTL ? 'right' : 'left', fontSize: 11 }}
      >
        {label}
      </AppText>
      <AppText
        weight={emphasize ? 'semibold' : 'medium'}
        dir={ltr ? 'ltr' : undefined}
        style={{ textAlign: isRTL ? 'right' : 'left' }}
      >
        {value}
      </AppText>
    </View>
  );
}
