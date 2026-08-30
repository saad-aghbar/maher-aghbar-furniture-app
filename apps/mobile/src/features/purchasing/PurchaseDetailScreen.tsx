import type { Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { can } from '@maher/permissions';
import { listWarehouses } from '@/api/modules/inventory';
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
import { useNetwork } from '@/components/network/NetworkProvider';
import { ConfirmationSheet } from '@/components/sheets/ConfirmationSheet';
import { useLocale } from '@/i18n';
import { haptics } from '@/motion';
import { SURFACE_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import { useTheme } from '@/theme';
import { PurchasingFloorBoard } from './components/PurchasingFloorBoard';
import { usePurchaseActionMutation, usePurchaseOrderQuery } from './query';
import { selectPurchaseDetail } from './selectPurchase';

type Props = { orderId: string };

/** Extra lift so the last Receipts card clears the floating tab bar. */
const RECEIPTS_TAB_CLEARANCE_EXTRA = 48;

export function PurchaseDetailScreen({ orderId }: Props) {
  const { user } = useAuth();
  const { t, locale, formatCurrency, formatDate, formatNumber, isRTL } = useLocale();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { showOfflineBanner } = useNetwork();
  const { showToast } = useToast();
  const canRead = can(user, 'purchase-order.read');
  const canApprove = can(user, 'purchase-order.approve');
  const canReceive = can(user, 'inventory.receive');
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const backFallback = '/(app)/(admin)/purchasing' as Href;

  const [confirm, setConfirm] = useState<'approve' | 'send' | 'receive' | null>(null);
  const query = usePurchaseOrderQuery(orderId, canRead);
  const actions = usePurchaseActionMutation(orderId);
  const warehousesQuery = useQuery({
    queryKey: ['warehouses-receive'],
    queryFn: listWarehouses,
    enabled: canReceive,
  });

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
        <AppText>{t('mobile.purchasing.loading')}</AppText>
      </AppScreen>
    );
  }

  const qtyLabel = (n: number) =>
    formatNumber(n, { maximumFractionDigits: 3, minimumFractionDigits: 0 });
  const remainingLabel = t('mobile.purchasing.remainingCount', {
    count: qtyLabel(detail.remainingQty),
  });

  return (
    <AppScreen backFallback={backFallback}>
      {showOfflineBanner ? <OfflineBanner /> : null}
      <ScrollView
        contentContainerStyle={{
          gap: theme.spacing.md,
          paddingBottom:
            theme.spacing['3xl'] +
            SURFACE_TAB_BAR_CLEARANCE +
            Math.max(insets.bottom, RECEIPTS_TAB_CLEARANCE_EXTRA),
        }}
      >
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            justifyContent: 'space-between',
            gap: theme.spacing.sm,
          }}
        >
          <AppText
            variant="title"
            weight={titleWeight}
            dir="ltr"
            style={{ flex: 1, textAlign: isRTL ? 'right' : 'left' }}
          >
            {detail.number}
          </AppText>
          <StatusBadge status={detail.status} />
        </View>

        <PurchasingFloorBoard>
          <Meta label={t('catalog.supplier')} value={detail.supplierName} />
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
          {detail.lines.length > 0 ? (
            <View style={{ gap: 4 }}>
              <AppText
                variant="caption"
                color="muted"
                style={{ textAlign: isRTL ? 'right' : 'left', fontSize: 11 }}
              >
                {t('mobile.purchasing.receptionStatus')}
              </AppText>
              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  gap: theme.spacing.sm,
                }}
              >
                <AppText
                  weight="medium"
                  style={{ flex: 1, textAlign: isRTL ? 'right' : 'left' }}
                >
                  {t('mobile.purchasing.percentReceived', {
                    percent: `${detail.receivedPercent}%`,
                  })}
                </AppText>
                <AppText weight="semibold" color="brand" dir="ltr">
                  {remainingLabel}
                </AppText>
              </View>
            </View>
          ) : null}
        </PurchasingFloorBoard>

        {detail.lines.length > 0 ? (
          <PurchasingFloorBoard title={t('mobile.purchasing.purchaseVariance')}>
            <Meta
              label={t('mobile.purchasing.expectedTotalExTax')}
              value={formatCurrency(detail.expectedNet)}
              ltr
            />
            <Meta
              label={t('mobile.purchasing.actualReceivedExTax')}
              value={formatCurrency(detail.actualReceivedNet)}
              ltr
            />
            <Meta
              label={t('mobile.purchasing.purchaseVariance')}
              value={formatCurrency(detail.varianceNet)}
              emphasize
              ltr
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
                  {`${qtyLabel(line.quantity)} ${line.unit} × ${formatCurrency(line.unitPrice)}`}
                </AppText>
                <AppText variant="caption" color="muted" dir="ltr">
                  {t('mobile.purchasing.lineReceiveMeta', {
                    received: qtyLabel(line.receivedQty),
                    remaining: qtyLabel(line.remainingQty),
                  })}
                </AppText>
              </View>
            ))
          )}
        </PurchasingFloorBoard>

        <PurchasingFloorBoard title={t('mobile.purchasing.receipts')}>
          {detail.receipts.length === 0 ? (
            <AppText variant="caption" color="muted">
              {t('mobile.noGoodsReceipts')}
            </AppText>
          ) : (
            detail.receipts.map((grn) => (
              <View
                key={grn.id}
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  justifyContent: 'space-between',
                  gap: theme.spacing.sm,
                }}
              >
                <AppText weight="medium" dir="ltr" style={{ flex: 1 }}>
                  {grn.number}
                </AppText>
                <AppText variant="caption" color="muted" dir="ltr">
                  {grn.date ? formatDate(grn.date) : '—'}
                </AppText>
              </View>
            ))
          )}
        </PurchasingFloorBoard>

        {canApprove && po.status === 'DRAFT' ? (
          <PrimaryButton
            label={t('mobile.purchasing.approve')}
            onPress={() => setConfirm('approve')}
            style={{ borderRadius: theme.radius.xl }}
          />
        ) : null}
        {canApprove && po.status === 'APPROVED' ? (
          <PrimaryButton
            label={t('mobile.purchasing.send')}
            onPress={() => setConfirm('send')}
            style={{ borderRadius: theme.radius.xl }}
          />
        ) : null}
        {canReceive &&
        (po.status === 'SENT' ||
          po.status === 'PARTIALLY_RECEIVED' ||
          po.status === 'APPROVED') ? (
          <SecondaryButton
            label={t('mobile.purchasing.receive')}
            onPress={() => setConfirm('receive')}
            style={{ borderRadius: theme.radius.xl }}
          />
        ) : null}
      </ScrollView>

      <ConfirmationSheet
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        title={t(`mobile.purchasing.${confirm ?? 'approve'}`)}
        message={t(`mobile.purchasing.${confirm ?? 'approve'}Confirm`)}
        confirmLabel={t('mobile.purchasing.confirm')}
        cancelLabel={t('mobile.purchasing.cancel')}
        onConfirm={() => {
          if (confirm === 'approve') {
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
          } else if (confirm === 'send') {
            actions.send.mutate(undefined, {
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
          } else if (confirm === 'receive') {
            const warehouseId = po.warehouseId || warehousesQuery.data?.[0]?.id;
            const lines = (po.lines ?? [])
              .filter((l) => l.inventoryItemId)
              .map((l) => ({
                inventoryItemId: l.inventoryItemId as string,
                orderedQty: Number(l.quantity),
                receivedQty: Number(l.quantity),
              }));
            if (!warehouseId || lines.length === 0) {
              showToast({
                variant: 'error',
                message: t('mobile.purchasing.receiveFailed'),
              });
              return;
            }
            actions.receive.mutate(
              { warehouseId, lines },
              {
                onSuccess: () => {
                  void haptics.confirmMedium();
                  showToast({
                    variant: 'success',
                    message: t('mobile.purchasing.receiveSuccess'),
                  });
                },
                onError: () =>
                  showToast({
                    variant: 'error',
                    message: t('mobile.purchasing.receiveFailed'),
                  }),
              },
            );
          }
        }}
      />
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
