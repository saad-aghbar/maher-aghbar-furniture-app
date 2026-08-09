import type { Href } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
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
import { localizedNamed } from './selectPurchase';

type Props = { orderId: string };

export function PurchaseDetailScreen({ orderId }: Props) {
  const { user } = useAuth();
  const { t, locale, formatCurrency, formatDate, isRTL } = useLocale();
  const { theme } = useTheme();
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
  if (!po) {
    return (
      <AppScreen backFallback={backFallback}>
        <AppText>{t('mobile.purchasing.loading')}</AppText>
      </AppScreen>
    );
  }

  return (
    <AppScreen backFallback={backFallback}>
      {showOfflineBanner ? <OfflineBanner /> : null}
      <ScrollView
        contentContainerStyle={{
          gap: theme.spacing.md,
          paddingBottom: theme.spacing['3xl'] + SURFACE_TAB_BAR_CLEARANCE,
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
            {po.number}
          </AppText>
          <StatusBadge status={po.status} />
        </View>

        <PurchasingFloorBoard>
          <Meta label={t('catalog.supplier')} value={localizedNamed(locale, po.supplier)} />
          {po.expectedDeliveryDate ? (
            <Meta
              label={t('mobile.purchasing.expectedArrival')}
              value={formatDate(po.expectedDeliveryDate)}
            />
          ) : null}
          {po.notes ? <Meta label={t('catalog.notes')} value={po.notes} /> : null}
          <Meta
            label={t('mobile.purchasing.grandTotal')}
            value={formatCurrency(Number(po.total) || 0)}
            emphasize
          />
        </PurchasingFloorBoard>

        <PurchasingFloorBoard title={t('catalog.materialsList')}>
          {(po.lines ?? []).length === 0 ? (
            <AppText variant="caption" color="muted">
              —
            </AppText>
          ) : (
            (po.lines ?? []).map((line, idx) => (
              <View
                key={line.id ?? String(idx)}
                style={{ gap: 4, paddingBottom: theme.spacing.sm }}
              >
                <AppText weight="semibold" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                  {line.description}
                </AppText>
                <AppText variant="caption" color="secondary" dir="ltr">
                  {`${String(line.quantity)} ${line.unit || 'pcs'} × ${String(line.unitPrice)}`}
                </AppText>
                <AppText variant="caption" weight="semibold" dir="ltr">
                  {String(line.lineTotal ?? '—')}
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
}: {
  label: string;
  value: string;
  emphasize?: boolean;
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
        style={{ textAlign: isRTL ? 'right' : 'left' }}
      >
        {value}
      </AppText>
    </View>
  );
}
