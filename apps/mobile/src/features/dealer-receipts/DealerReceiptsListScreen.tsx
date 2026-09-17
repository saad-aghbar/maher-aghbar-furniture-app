import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { can } from '@maher/permissions';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { ErrorState } from '@/components/feedback/ErrorState';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { AppScreen } from '@/components/layout/AppScreen';
import { ScreenBackLead } from '@/components/layout/ScreenBackLead';
import { useNetwork } from '@/components/network/NetworkProvider';
import { DealerEmptyState, DealerSearchBar } from '@/features/dealer-ui';
import { ConfirmReceiptSheet } from '@/features/sales-orders/components/ConfirmReceiptSheet';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { OrdersListSkeleton } from '@/features/sales-orders/components/OrdersListSkeleton';
import { useOwnDeliveriesQuery } from '@/features/scheduling/query';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import { DealerReceiptCard } from './components/DealerReceiptCard';
import { DealerReceiptsHubBoard } from './components/DealerReceiptsHubBoard';
import {
  countDealerReceiptStamps,
  filterDealerReceipts,
  receiptProductLabel,
  type DealerReceiptTileKey,
} from './selectDealerReceipts';
import { useDealerReceiptConfirm } from './useDealerReceiptConfirm';
import { useSurfaceClearance } from '@/adaptive/useSurfaceClearance';

type Props = {
  detailHref: (salesOrderId: string) => Href;
  backFallback?: Href;
};

function ReceiptsScreenTitle({
  backFallback,
  titleWeight,
}: {
  backFallback: Href;
  titleWeight: 'medium' | 'semibold';
}) {
  const { t, isRTL } = useLocale();
  const { theme } = useTheme();
  const leadSize = theme.sizes.touch.min;

  return (
    <View style={{ minHeight: leadSize, justifyContent: 'center' }}>
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
      <AppText
        variant="largeTitle"
        weight={titleWeight}
        align="center"
        numberOfLines={1}
        style={{ paddingHorizontal: leadSize + theme.spacing.sm }}
      >
        {t('mobile.dealerReceipts.title')}
      </AppText>
    </View>
  );
}

export function DealerReceiptsListScreen({
  detailHref,
  backFallback = '/(app)/(customer)/(tabs)' as Href,
}: Props) {
  const { user } = useAuth();
  const { t, locale, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const insets = useSafeAreaInsets();
  const surfaceClearance = useSurfaceClearance();
  const { showOfflineBanner } = useNetwork();
  const router = useRouter();
  const allowed = can(user, 'sales-order.read');
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const [selectedTile, setSelectedTile] = useState<DealerReceiptTileKey | null>(null);
  const [search, setSearch] = useState('');
  const confirm = useDealerReceiptConfirm();

  const query = useOwnDeliveriesQuery(undefined, allowed);
  const stamps = useMemo(
    () => countDealerReceiptStamps(query.data?.data ?? []),
    [query.data?.data],
  );
  const rows = useMemo(
    () => filterDealerReceipts(query.data?.data ?? [], selectedTile, search),
    [query.data?.data, search, selectedTile],
  );
  const filtersActive = Boolean(selectedTile) || search.trim().length > 0;

  if (!allowed) {
    return (
      <AppScreen>
        <ReceiptsScreenTitle backFallback={backFallback} titleWeight={titleWeight} />
        <DealerEmptyState title={t('mobile.noModules')} body={t('mobile.noModulesHint')} />
      </AppScreen>
    );
  }

  if (query.isError && !query.data) {
    return (
      <AppScreen>
        <ReceiptsScreenTitle backFallback={backFallback} titleWeight={titleWeight} />
        {showOfflineBanner ? <OfflineBanner /> : null}
        <ErrorState
          title={t('mobile.dealerReceipts.errorTitle')}
          description={t('mobile.dealerReceipts.errorBody')}
          retryLabel={t('mobile.dealerReceipts.retry')}
          onRetry={() => void query.refetch()}
        />
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      {showOfflineBanner ? <OfflineBanner /> : null}
      <FlatList
        data={rows}
        keyExtractor={(item) => item.salesOrderId}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          gap: theme.spacing.md,
          flexGrow: 1,
          paddingBottom: surfaceClearance,
        }}
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching && !query.isLoading}
            onRefresh={() => void query.refetch()}
            tintColor={colors.brand}
          />
        }
        ListHeaderComponent={
          <View style={{ gap: theme.spacing.md, paddingBottom: theme.spacing.sm }}>
            <ReceiptsScreenTitle backFallback={backFallback} titleWeight={titleWeight} />
            <DealerReceiptsHubBoard
              counts={stamps}
              selectedTile={selectedTile}
              onSelectTile={setSelectedTile}
            />
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
                  width: 3,
                  backgroundColor: colors.brand,
                  opacity: 0.55,
                  ...(isRTL ? { right: 0 } : { left: 0 }),
                }}
              />
              <View
                style={{
                  padding: theme.spacing.md,
                  ...(isRTL
                    ? { paddingRight: theme.spacing.md + 4 }
                    : { paddingLeft: theme.spacing.md + 4 }),
                }}
              >
                <DealerSearchBar
                  value={search}
                  onChangeText={setSearch}
                  placeholder={t('mobile.dealerReceipts.searchPlaceholder')}
                />
              </View>
            </View>
          </View>
        }
        ListEmptyComponent={
          query.isLoading ? (
            <OrdersListSkeleton />
          ) : (
            <DealerEmptyState
              title={
                filtersActive
                  ? t('mobile.dealerReceipts.emptyFilter')
                  : t('mobile.dealerReceipts.empty')
              }
              body={
                filtersActive
                  ? t('mobile.dealerReceipts.emptyFilterHint')
                  : t('mobile.dealerReceipts.emptyHint')
              }
            />
          )
        }
        renderItem={({ item, index }) => (
          <DealerReceiptCard
            row={item}
            index={index}
            onPress={() => router.push(detailHref(item.salesOrderId))}
            onConfirm={() =>
              void confirm.open({
                salesOrderId: item.salesOrderId,
                salesOrderNumber: item.salesOrderNumber,
                productTitle: receiptProductLabel(item, locale),
                quantity: item.quantity,
                imageUrl: item.imageUrl,
              })
            }
          />
        )}
      />
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
