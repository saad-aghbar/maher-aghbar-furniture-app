import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { can } from '@maher/permissions';
import { localizedName } from '@maher/i18n';
import type { PurchaseOrder, PurchaseRunWhatsAppMessage } from '@/api/modules/purchasing';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { useToast } from '@/components/feedback/Toast';
import { AppScreen } from '@/components/layout/AppScreen';
import { FloatingActionDock } from '@/components/layout/FloatingActionDock';
import { stickyCtaBottomInset } from '@/components/layout/stickyCtaInset';
import { ConfirmationSheet } from '@/components/sheets/ConfirmationSheet';
import { usePdfDownload } from '@/features/pdf/usePdfDownload';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics, ListItemEnter } from '@/motion';
import { useTheme } from '@/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { openPurchaseOrderPdf } from './api';
import { PurchaseWhatsAppPreviewSheet } from './components/PurchaseWhatsAppPreviewSheet';
import { PurchasingFloorBoard } from './components/PurchasingFloorBoard';
import { PurchasingSkeleton } from './components/PurchasingSkeleton';
import { usePurchaseRunActions, usePurchaseRunQuery } from './query';
import { useTabBarReserve } from '@/adaptive/useSurfaceClearance';

type Props = { runId: string };

const RECEIPTS_TAB_CLEARANCE_EXTRA = 48;

function destinationName(line: {
  warehouse?: { name?: string | null; nameEn?: string | null; nameAr?: string | null } | null;
  location?: { name?: string | null } | null;
  warehouseId?: string | null;
  locationId?: string | null;
}, locale: string) {
  if (line.location?.name) return line.location.name;
  if (line.warehouse) {
    return locale === 'ar'
      ? line.warehouse.nameAr || line.warehouse.nameEn || line.warehouse.name || ''
      : line.warehouse.nameEn || line.warehouse.nameAr || line.warehouse.name || '';
  }
  return line.locationId || line.warehouseId || '';
}

export function PurchaseRunDetailScreen({ runId }: Props) {
  const { user } = useAuth();
  const router = useRouter();
  const { t, locale, isRTL, formatCurrency } = useLocale();
  const { colors, theme } = useTheme();
  const insets = useSafeAreaInsets();
  const tabBarReserve = useTabBarReserve();
  const { showToast } = useToast();
  const canRead = can(user, 'purchase-order.read');
  const canApprove = can(user, 'purchase-order.approve');
  const canReceive = can(user, 'inventory.receive');
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const backFallback = '/(app)/(admin)/purchasing' as Href;
  const query = usePurchaseRunQuery(runId, canRead);
  const actions = usePurchaseRunActions(runId);
  const { pickPdfOptions, pdfDownloadSheet } = usePdfDownload();
  const [confirm, setConfirm] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [messages, setMessages] = useState<PurchaseRunWhatsAppMessage[]>([]);

  const run = query.data;
  const orders = run?.orders ?? [];
  const allDraft = orders.every((po) => po.status === 'DRAFT');
  const anyApproved = orders.some((po) => po.status === 'APPROVED');
  const sentOrLater = orders.some(
    (po) => po.status === 'SENT' || po.status === 'PARTIALLY_RECEIVED' || po.status === 'RECEIVED',
  );
  const canReceiveNow =
    canReceive &&
    orders.some(
      (po) =>
        (po.status === 'SENT' || po.status === 'PARTIALLY_RECEIVED') &&
        Number(po.orderedQty ?? 1) - Number(po.receivedAcceptedQty ?? 0) > 0,
    );
  const showApprove = canApprove && allDraft && orders.length > 0;
  const showSend = canApprove && anyApproved;
  const showResend = canApprove && sentOrLater;
  const hasDock = showApprove || showSend || showResend || canReceiveNow || orders.length > 0;
  const dockPad = hasDock
    ? stickyCtaBottomInset(insets.bottom, theme.spacing.md, tabBarReserve) +
      96 +
      RECEIPTS_TAB_CLEARANCE_EXTRA
    : theme.spacing['3xl'] + tabBarReserve;

  const previewMessages = useMemo(
    () =>
      messages.map((message) => ({
        orderId: message.orderId,
        supplierName: message.supplierName,
        to: message.to,
        body: message.body,
        templateBody: message.templateBody,
        lines: message.lines,
      })),
    [messages],
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
        <ErrorState
          title={t('mobile.purchasing.errorTitle')}
          description={t('mobile.purchasing.errorBody')}
          retryLabel={t('mobile.purchasing.retry')}
          onRetry={() => void query.refetch()}
        />
      </AppScreen>
    );
  }
  if (!run) {
    return (
      <AppScreen backFallback={backFallback}>
        <PurchasingSkeleton />
      </AppScreen>
    );
  }

  const openPreview = () => {
    actions.draftWhatsApp.mutate(undefined, {
      onSuccess: (draft) => {
        setMessages(draft.messages);
        setPreviewOpen(true);
      },
      onError: () => showToast({ variant: 'error', message: t('mobile.purchasing.updateFailed') }),
    });
  };

  return (
    <AppScreen backFallback={backFallback}>
      <ScrollView contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: dockPad }}>
        <ListItemEnter index={0}>
          <PurchasingFloorBoard
            title={run.number}
            trailing={<StatusBadge status={String(run.phase)} dot />}
          >
            <View
              style={{
                borderRadius: theme.radius.lg,
                backgroundColor: colors.surfaceSecondary,
                borderWidth: 1,
                borderColor: colors.border,
                overflow: 'hidden',
              }}
            >
              <RunMetaRow
                label={t('mobile.purchasing.tabs.suppliers')}
                value={String(run.supplierCount)}
                valueLtr
              />
              <View style={{ height: 1, backgroundColor: colors.border }} />
              <RunMetaRow
                label={t('mobile.purchasing.grandTotal')}
                value={formatCurrency(Number(run.total) || 0)}
                valueLtr
                emphasize
              />
            </View>
          </PurchasingFloorBoard>
        </ListItemEnter>

        {orders.map((po, index) => (
          <ListItemEnter key={po.id} index={index + 1}>
            <SupplierOrderBoard
              po={po}
              locale={locale}
              isRTL={isRTL}
              titleWeight={titleWeight}
              onOpen={() => router.push(`/(app)/(admin)/purchasing/${po.id}` as Href)}
            />
          </ListItemEnter>
        ))}
      </ScrollView>

      {hasDock ? (
        <FloatingActionDock floating>
          <View style={{ gap: theme.spacing.sm }}>
            {showApprove ? (
              <PrimaryButton
                label={t('mobile.purchasing.approve')}
                onPress={() => setConfirm(true)}
                style={{ borderRadius: theme.radius.full, minHeight: 44 }}
              />
            ) : null}
            {showSend || showResend ? (
              <PrimaryButton
                label={
                  showResend
                    ? t('mobile.purchasing.resendWhatsapp')
                    : t('mobile.purchasing.previewSend')
                }
                loading={actions.draftWhatsApp.isPending}
                onPress={openPreview}
                style={{ borderRadius: theme.radius.full, minHeight: 44 }}
              />
            ) : null}
            <SecondaryButton
              label={t('mobile.purchasing.pdf')}
              onPress={() => {
                const first = orders[0];
                if (!first) return;
                void pickPdfOptions()
                  .then((opts) => (opts ? openPurchaseOrderPdf(first.id, opts) : undefined))
                  .catch(() => {
                    void haptics.error();
                    showToast({ variant: 'error', message: t('mobile.invoices.pdfFailed') });
                  });
              }}
              style={{ borderRadius: theme.radius.full, minHeight: 44 }}
            />
            {canReceiveNow ? (
              <SecondaryButton
                label={t('mobile.purchasing.receive')}
                onPress={() => {
                  const receivable = orders.find(
                    (po) => po.status === 'SENT' || po.status === 'PARTIALLY_RECEIVED',
                  );
                  if (!receivable) return;
                  router.push(`/(app)/(admin)/inventory/receive/${receivable.id}` as Href);
                }}
                style={{ borderRadius: theme.radius.full, minHeight: 44 }}
              />
            ) : (
              <AppText color="muted" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                {t('mobile.purchasing.receiveAfterSend')}
              </AppText>
            )}
          </View>
        </FloatingActionDock>
      ) : null}

      <ConfirmationSheet
        open={confirm}
        onClose={() => setConfirm(false)}
        title={t('mobile.purchasing.approve')}
        message={t('mobile.purchasing.approveRunConfirm')}
        confirmLabel={t('mobile.purchasing.confirm')}
        cancelLabel={t('mobile.purchasing.cancel')}
        onConfirm={() => {
          actions.approve.mutate(undefined, {
            onSuccess: () => {
              void haptics.confirmMedium();
              showToast({ variant: 'success', message: t('mobile.purchasing.updateSuccess') });
            },
            onError: () =>
              showToast({ variant: 'error', message: t('mobile.purchasing.updateFailed') }),
          });
        }}
      />
      <PurchaseWhatsAppPreviewSheet
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        sending={actions.send.isPending}
        messages={previewMessages}
        onSend={(payload) => {
          actions.send.mutate(payload, {
            onSuccess: (result) => {
              void haptics.confirmMedium();
              const failed = result.results.filter((row) => !row.ok).length;
              showToast({
                variant: failed ? 'warning' : 'success',
                message: failed
                  ? t('mobile.purchasing.sendPartial')
                  : t('mobile.purchasing.sendAllOk'),
              });
              if (!failed) setPreviewOpen(false);
            },
            onError: () =>
              showToast({ variant: 'error', message: t('mobile.purchasing.updateFailed') }),
          });
        }}
      />
      {pdfDownloadSheet}
    </AppScreen>
  );
}

function SupplierOrderBoard({
  po,
  locale,
  isRTL,
  titleWeight,
  onOpen,
}: {
  po: PurchaseOrder;
  locale: string;
  isRTL: boolean;
  titleWeight: 'medium' | 'semibold';
  onOpen: () => void;
}) {
  const { t, formatCurrency } = useLocale();
  const { colors, theme } = useTheme();
  const supplier = po.supplier
    ? localizedName(
        locale,
        { name: po.supplier.name, nameEn: po.supplier.nameEn, nameAr: po.supplier.nameAr, nameHe: po.supplier.nameHe },
        po.supplier.code,
      )
    : po.number;
  return (
    <PurchasingFloorBoard
      title={supplier}
      trailing={<StatusBadge status={po.status} dot />}
      contentStyle={{ gap: theme.spacing.sm }}
    >
      <AnimatedPressable
        variant="button"
        accessibilityRole="button"
        accessibilityLabel={po.number}
        onPress={() => {
          void haptics.selection();
          onOpen();
        }}
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.sm,
          minHeight: theme.sizes.touch.min,
          paddingHorizontal: theme.spacing.md,
          borderRadius: theme.radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surfaceSecondary,
        }}
      >
        <AppText variant="caption" color="muted" dir="ltr" style={{ flex: 1 }}>
          {po.number}
        </AppText>
        <AppText variant="caption" color="brand" weight={titleWeight}>
          {t('common.details')}
        </AppText>
        <Ionicons
          name={isRTL ? 'chevron-back' : 'chevron-forward'}
          size={16}
          color={colors.brand}
        />
      </AnimatedPressable>
      {(po.lines ?? []).map((line) => {
        const dest = destinationName(line, locale);
        return (
          <View
            key={line.id ?? line.inventoryItemId ?? line.description}
            style={{
              borderRadius: theme.radius.lg,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surfaceSecondary,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                gap: theme.spacing.sm,
                paddingHorizontal: theme.spacing.md,
                paddingTop: theme.spacing.md,
                paddingBottom: theme.spacing.sm,
              }}
            >
              <AppText
                weight={titleWeight}
                numberOfLines={2}
                style={{ flex: 1, minWidth: 0, textAlign: isRTL ? 'right' : 'left' }}
              >
                {line.description}
              </AppText>
              <View
                style={{
                  borderRadius: theme.radius.lg,
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                  paddingHorizontal: theme.spacing.sm,
                  minHeight: 24,
                  justifyContent: 'center',
                }}
              >
                <AppText variant="caption" dir="ltr">
                  {`${line.quantity} ${line.unit ?? ''}`.trim()}
                </AppText>
              </View>
            </View>
            {dest ? (
              <>
                <View style={{ height: 1, backgroundColor: colors.border }} />
                <RunMetaRow label={t('mobile.purchasing.destination')} value={dest} />
              </>
            ) : null}
          </View>
        );
      })}
      <View
        style={{
          borderRadius: theme.radius.lg,
          backgroundColor: colors.surfaceSecondary,
          borderWidth: 1,
          borderColor: colors.border,
          overflow: 'hidden',
        }}
      >
        <RunMetaRow
          label={t('mobile.purchasing.supplierSubtotal')}
          value={formatCurrency(Number(po.total) || 0)}
          valueLtr
          emphasize
        />
      </View>
    </PurchasingFloorBoard>
  );
}

function RunMetaRow({
  label,
  value,
  emphasize,
  valueLtr,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
  valueLtr?: boolean;
}) {
  const { isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.spacing.md,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm + 2,
      }}
    >
      <AppText
        variant="caption"
        color="muted"
        style={{
          flexShrink: 0,
          fontSize: 10,
          textTransform: locale === 'ar' ? 'none' : 'uppercase',
          letterSpacing: locale === 'ar' ? 0 : 0.45,
          textAlign: isRTL ? 'right' : 'left',
        }}
      >
        {label}
      </AppText>
      <AppText
        weight={emphasize ? titleWeight : 'medium'}
        dir={valueLtr ? 'ltr' : undefined}
        numberOfLines={2}
        style={{
          flex: 1,
          minWidth: 0,
          color: colors.textPrimary,
          fontSize: emphasize ? 15 : 13,
          textAlign: isRTL ? 'left' : 'right',
        }}
      >
        {value}
      </AppText>
    </View>
  );
}
