import { useMemo } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { can } from '@maher/permissions';
import type { DealerDeliveryDto } from '@/api/modules/scheduling';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { ErrorState } from '@/components/feedback/ErrorState';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { AppScreen } from '@/components/layout/AppScreen';
import { ScreenBackLead } from '@/components/layout/ScreenBackLead';
import { useNetwork } from '@/components/network/NetworkProvider';
import { DealerEmptyState } from '@/features/dealer-ui';
import { DealerBoard } from '@/features/dealers/components/DealerBoard';
import { ConfirmReceiptSheet } from '@/features/sales-orders/components/ConfirmReceiptSheet';
import { resolveOrderMediaUri } from '@/features/sales-orders/components/OrderCardMedia';
import { OrderDetailSkeleton } from '@/features/sales-orders/components/OrderDetailSkeleton';
import { useSalesOrderQuery } from '@/features/sales-orders/query';
import { useOwnDeliveriesQuery } from '@/features/scheduling/query';
import { useLocale } from '@/i18n';
import { haptics, ListItemEnter } from '@/motion';
import { SURFACE_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import { useTheme } from '@/theme';
import { DealerReceiptIdentityBoard } from './components/DealerReceiptIdentityBoard';
import {
  isLeftFactory,
  promisedDay,
  receiptDay,
  receiptKindFromStatus,
  receiptProductLabel,
  toReceiptYmd,
  uniqueReceiptRows,
} from './selectDealerReceipts';
import { useDealerReceiptConfirm } from './useDealerReceiptConfirm';

type Props = {
  salesOrderId: string;
  backFallback?: Href;
  embedded?: boolean;
};

function DetailTitle({
  number,
  backFallback,
  titleWeight,
  embedded = false,
}: {
  number: string;
  backFallback: Href;
  titleWeight: 'medium' | 'semibold';
  embedded?: boolean;
}) {
  const { isRTL } = useLocale();
  const { theme } = useTheme();
  const leadSize = theme.sizes.touch.min;

  return (
    <View style={{ minHeight: leadSize, justifyContent: 'center' }}>
      {embedded ? null : (
        <View
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            ...(isRTL ? { right: 0 } : { left: 0 }),
            zIndex: 1,
            justifyContent: 'center',
          }}
        >
          <ScreenBackLead fallback={backFallback} />
        </View>
      )}
      <AppText
        variant="largeTitle"
        weight={titleWeight}
        align="center"
        numberOfLines={1}
        dir="ltr"
        style={{ paddingHorizontal: leadSize + theme.spacing.sm }}
      >
        {number}
      </AppText>
    </View>
  );
}

function FactRow({
  label,
  value,
  ltr,
}: {
  label: string;
  value: string;
  ltr?: boolean;
}) {
  const { isRTL } = useLocale();
  const { colors } = useTheme();
  return (
    <View style={{ gap: 2 }}>
      <AppText
        variant="caption"
        color="muted"
        style={{ textAlign: isRTL ? 'right' : 'left' }}
      >
        {label}
      </AppText>
      <AppText
        variant="body"
        dir={ltr ? 'ltr' : undefined}
        style={{ color: colors.textPrimary, textAlign: isRTL ? 'right' : 'left' }}
      >
        {value}
      </AppText>
    </View>
  );
}

export function DealerReceiptDetailScreen({
  salesOrderId,
  backFallback = '/(app)/(customer)/deliveries' as Href,
  embedded = false,
}: Props) {
  const { user } = useAuth();
  const { t, locale, isRTL, formatDate } = useLocale();
  const { colors, theme } = useTheme();
  const { showOfflineBanner } = useNetwork();
  const router = useRouter();
  const allowed = can(user, 'sales-order.read');
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const confirm = useDealerReceiptConfirm();

  const deliveriesQuery = useOwnDeliveriesQuery(undefined, allowed);
  const orderQuery = useSalesOrderQuery(salesOrderId, allowed && Boolean(salesOrderId));

  const row = useMemo((): DealerDeliveryDto | null => {
    const found = uniqueReceiptRows(deliveriesQuery.data?.data ?? []).find(
      (r) => r.salesOrderId === salesOrderId,
    );
    return found ?? null;
  }, [deliveriesQuery.data?.data, salesOrderId]);

  const order = orderQuery.data;
  const deliveryStatus =
    row?.customerStatus ??
    order?.deliveries?.find((d) => isLeftFactory(d.status))?.status ??
    order?.deliveryStatus ??
    null;
  const kind = receiptKindFromStatus(deliveryStatus);
  const awaiting = kind === 'awaiting';

  const number = row?.salesOrderNumber ?? order?.number ?? '';
  const title = row
    ? receiptProductLabel(row, locale)
    : order?.title?.trim() || order?.projectName || number;
  const mediaUri = resolveOrderMediaUri(row?.imageUrl ?? order?.imageUrl ?? null);
  const qtyLabel =
    row?.quantity != null && Number.isFinite(Number(row.quantity))
      ? String(row.quantity)
      : order?.orderedItems?.[0]?.quantity != null
        ? String(order.orderedItems[0].quantity)
        : '—';
  const address =
    row?.deliveryAddress?.trim() ||
    order?.deliveries?.find((d) => isLeftFactory(d.status))?.deliveryAddress?.trim() ||
    order?.deliveryAddress?.trim() ||
    '—';
  const promised = row
    ? promisedDay(row)
    : toReceiptYmd(order?.committedDeliveryDate ?? order?.requestedDeliveryDate ?? order?.requiredDeliveryDate);
  const left = row ? receiptDay(row) : toReceiptYmd(order?.deliveries?.find((d) => isLeftFactory(d.status))?.deliveryDate);
  const stubYmd = left;

  const loading =
    (deliveriesQuery.isLoading || orderQuery.isLoading) && !row && !order;
  const loadError = (deliveriesQuery.isError && !deliveriesQuery.data) ||
    (orderQuery.isError && !orderQuery.data && !row);

  if (!allowed) {
    return (
      <AppScreen>
        <DetailTitle number={t('mobile.dealerReceipts.title')} backFallback={backFallback} titleWeight={titleWeight} embedded={embedded} />
        <DealerEmptyState title={t('mobile.noModules')} body={t('mobile.noModulesHint')} />
      </AppScreen>
    );
  }

  if (loadError) {
    return (
      <AppScreen>
        <DetailTitle number={t('mobile.dealerReceipts.title')} backFallback={backFallback} titleWeight={titleWeight} embedded={embedded} />
        {showOfflineBanner ? <OfflineBanner /> : null}
        <ErrorState
          title={t('mobile.dealerReceipts.errorTitle')}
          description={t('mobile.dealerReceipts.errorBody')}
          retryLabel={t('mobile.dealerReceipts.retry')}
          onRetry={() => {
            void deliveriesQuery.refetch();
            void orderQuery.refetch();
          }}
        />
      </AppScreen>
    );
  }

  if (loading) {
    return (
      <AppScreen>
        <DetailTitle number={t('mobile.dealerReceipts.title')} backFallback={backFallback} titleWeight={titleWeight} embedded={embedded} />
        <OrderDetailSkeleton />
      </AppScreen>
    );
  }

  if (!kind) {
    return (
      <AppScreen>
        <DetailTitle number={number || t('mobile.dealerReceipts.title')} backFallback={backFallback} titleWeight={titleWeight} embedded={embedded} />
        <DealerEmptyState
          title={t('mobile.dealerReceipts.notOnDesk')}
          body={t('mobile.dealerReceipts.notOnDeskHint')}
          actionLabel={t('mobile.dealerReceipts.openOrder')}
          onAction={() =>
            router.push(`/(app)/(customer)/orders/${salesOrderId}` as Href)
          }
        />
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      {showOfflineBanner ? <OfflineBanner /> : null}
      <DetailTitle number={number} backFallback={backFallback} titleWeight={titleWeight} embedded={embedded} />
      <ScrollView
        style={{ flex: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={
              (deliveriesQuery.isRefetching || orderQuery.isRefetching) &&
              !deliveriesQuery.isLoading &&
              !orderQuery.isLoading
            }
            onRefresh={() => {
              void deliveriesQuery.refetch();
              void orderQuery.refetch();
            }}
            tintColor={colors.brand}
          />
        }
        contentContainerStyle={{
          gap: theme.spacing.md,
          paddingBottom: theme.spacing['3xl'] + SURFACE_TAB_BAR_CLEARANCE,
        }}
      >
        <ListItemEnter index={0}>
          <DealerReceiptIdentityBoard
            number={number}
            title={title}
            mediaUri={mediaUri}
            quantityLabel={qtyLabel}
            kind={kind}
            ymd={stubYmd}
          />
        </ListItemEnter>

        <ListItemEnter index={1}>
          <DealerBoard title={t('mobile.dealerReceipts.factsTitle')} titleWeight={titleWeight}>
            <View style={{ gap: theme.spacing.md }}>
              <FactRow label={t('mobile.dealerReceipts.address')} value={address} />
              <FactRow
                label={t('mobile.dealerReceipts.promisedDay')}
                value={promised ? formatDate(promised) : '—'}
                ltr
              />
              <FactRow
                label={
                  awaiting
                    ? t('mobile.dealerReceipts.leftDay')
                    : t('mobile.dealerReceipts.receivedDay')
                }
                value={left ? formatDate(left) : '—'}
                ltr
              />
            </View>
          </DealerBoard>
        </ListItemEnter>

        <ListItemEnter index={2}>
          <DealerBoard
            title={t('mobile.dealerReceipts.confirmTitle')}
            titleWeight={titleWeight}
            accentColor={awaiting ? colors.warning : colors.success}
          >
            {awaiting ? (
              <View style={{ gap: theme.spacing.md }}>
                <AppText
                  variant="body"
                  color="secondary"
                  style={{ textAlign: isRTL ? 'right' : 'left' }}
                >
                  {t('mobile.dealerReceipts.confirmHint')}
                </AppText>
                <PrimaryButton
                  label={t('lifecycle.confirmReceived')}
                  onPress={() => {
                    void haptics.selection();
                    void confirm.open({
                      salesOrderId,
                      salesOrderNumber: number,
                      productTitle: title,
                      quantity: qtyLabel === '—' ? null : qtyLabel,
                      imageUrl: row?.imageUrl,
                    });
                  }}
                  accessibilityLabel={`${t('lifecycle.confirmReceived')} ${number}`}
                  style={{
                    alignSelf: 'stretch',
                    width: '100%',
                    borderRadius: theme.radius.xl,
                  }}
                />
              </View>
            ) : (
              <AppText
                variant="body"
                style={{
                  color: colors.success,
                  textAlign: isRTL ? 'right' : 'left',
                }}
              >
                {t('mobile.dealerReceipts.receivedCaption')}
              </AppText>
            )}
          </DealerBoard>
        </ListItemEnter>
      </ScrollView>

      <ConfirmReceiptSheet
        open={Boolean(confirm.target)}
        orderNumber={confirm.target?.salesOrderNumber ?? ''}
        productTitle={confirm.target?.productTitle ?? ''}
        quantity={confirm.target?.quantity}
        imageUrl={confirm.target?.imageUrl}
        loading={confirm.resolving || confirm.pending}
        error={confirm.error}
        canConfirm={Boolean(confirm.deliveryId) && !confirm.resolving}
        onClose={confirm.close}
        onConfirm={confirm.confirm}
      />
    </AppScreen>
  );
}
