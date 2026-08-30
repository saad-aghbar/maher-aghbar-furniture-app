import { useEffect, useRef, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { can } from '@maher/permissions';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { EmptyState } from '@/components/feedback/EmptyState';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { InventoryGroupLoadError } from './components/InventoryGroupLoadError';
import { useToast, toastCopy } from '@/components/feedback/Toast';
import { TextField } from '@/components/forms/TextField';
import { AppScreen } from '@/components/layout/AppScreen';
import { useNetwork } from '@/components/network/NetworkProvider';
import { useLocale } from '@/i18n';
import { usePdfDownload } from '@/features/pdf/usePdfDownload';
import { haptics } from '@/motion';
import { useTheme } from '@/theme';
import { SURFACE_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import { openInventoryLabelPdf, openInventoryQrLabelPdf, type InventoryCategoryGroup } from './api';
import { AddStockSheet, type StockMoveMode } from './components/AddStockSheet';
import { EditInventoryItemSheet } from './components/EditInventoryItemSheet';
import { InventoryMaterialCard } from './components/InventoryMaterialCard';
import { InventoryQrSheet, qrItemFromCard, type InventoryQrItem } from './components/InventoryQrSheet';
import { InventoryListSkeleton } from './components/InventorySkeleton';
import { toGoodsReceiptArgs } from './stockMoveSubmit';
import {
  flattenInventoryItemPages,
  useInventoryItemsInfiniteQuery,
  useIssueStockMutation,
  useReceiveAgainstPoMutation,
  useReceiveStockMutation,
  useUpdateInventoryItemMutation,
  useWarehousesQuery,
} from './query';
import {
  selectInventoryItemCard,
  type InventoryItemCardModel,
} from './selectInventory';

type MoveTarget = {
  mode: StockMoveMode;
  item: InventoryItemCardModel;
};

type InventoryGroupListScreenProps = {
  categoryGroup: InventoryCategoryGroup;
};

export function InventoryGroupListScreen({
  categoryGroup,
}: InventoryGroupListScreenProps) {
  const { user } = useAuth();
  const { t, locale } = useLocale();
  const { theme, colors } = useTheme();
  const { showOfflineBanner } = useNetwork();
  const { showToast } = useToast();
  const { pickPdfOptions, pdfDownloadSheet } = usePdfDownload();
  const router = useRouter();
  const allowed = can(user, 'inventory.read');
  const canReceive = can(user, 'inventory.receive');
  const canIssue = can(user, 'inventory.issue');
  const canEdit = can(user, 'inventory.adjust');
  const canLabelPdf = can(user, 'inventory.read');
  const canEditCost = can(user, 'inventory.cost.read');

  const [searchInput, setSearchInput] = useState('');
  const [q, setQ] = useState('');
  const [move, setMove] = useState<MoveTarget | null>(null);
  const [editItem, setEditItem] = useState<InventoryItemCardModel | null>(null);
  const [qrItem, setQrItem] = useState<InventoryQrItem | null>(null);
  const pendingPrintRef = useRef<{ id: string; sku: string } | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setQ(searchInput.trim()), 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  const query = useInventoryItemsInfiniteQuery(
    { categoryGroup, q: q || undefined },
    allowed,
  );
  const receiveMutation = useReceiveStockMutation();
  const receivePoMutation = useReceiveAgainstPoMutation();
  const issueMutation = useIssueStockMutation();
  const updateItemMutation = useUpdateInventoryItemMutation();
  const warehousesQuery = useWarehousesQuery(Boolean(move) && (canReceive || canIssue));

  const refreshing = query.isRefetching && !query.isFetchingNextPage;
  const items = flattenInventoryItemPages(query.data).map((item) =>
    selectInventoryItemCard(item, locale),
  );

  const title = t(`mobile.inventory.groups.${categoryGroup}`);
  const movePending =
    (move?.mode === 'receive' &&
      (receiveMutation.isPending || receivePoMutation.isPending)) ||
    (move?.mode === 'issue' && issueMutation.isPending);

  function openLabelPdf(item: { id: string; sku: string }) {
    void (async () => {
      const opts = await pickPdfOptions();
      if (!opts) return;
      try {
        await openInventoryLabelPdf(item.id, item.sku, opts);
      } catch {
        void haptics.error();
        showToast({
          variant: 'error',
          message: toastCopy(
            t('mobile.inventory.labelPdfFailedTitle'),
            t('mobile.inventory.labelPdfFailedBody'),
          ),
        });
      }
    })();
  }

  function openQrLabelPdf(item: { id: string; sku: string }) {
    void (async () => {
      const opts = await pickPdfOptions();
      if (!opts) return;
      try {
        await openInventoryQrLabelPdf(item.id, item.sku, opts);
      } catch {
        void haptics.error();
        showToast({
          variant: 'error',
          message: toastCopy(
            t('mobile.inventory.labelPdfFailedTitle'),
            t('mobile.inventory.labelPdfFailedBody'),
          ),
        });
      }
    })();
  }

  /** Close QR Modal first — iOS will no-op a second Modal while QR is open. */
  function printLabelAfterQrCloses(item: { id: string; sku: string }) {
    pendingPrintRef.current = { id: item.id, sku: item.sku };
    setQrItem(null);
  }

  function flushPendingPrint() {
    const next = pendingPrintRef.current;
    pendingPrintRef.current = null;
    if (next) openQrLabelPdf(next);
  }

  if (!allowed) {
    return (
      <AppScreen backFallback={'/(app)/(admin)/(tabs)/inventory' as Href}>
        <EmptyState title={t('mobile.noModules')} description={t('mobile.noModulesHint')} />
      </AppScreen>
    );
  }

  if (query.isLoading && !query.data) {
    return (
      <AppScreen backFallback={'/(app)/(admin)/(tabs)/inventory' as Href}>
        <AppText variant="title" weight="semibold">
          {title}
        </AppText>
        <InventoryListSkeleton />
      </AppScreen>
    );
  }

  if (query.isError && !query.data) {
    return (
      <AppScreen backFallback={'/(app)/(admin)/(tabs)/inventory' as Href}>
        {showOfflineBanner ? <OfflineBanner /> : null}
        <InventoryGroupLoadError
          groupTitle={title}
          onRetry={() => void query.refetch()}
        />
      </AppScreen>
    );
  }

  return (
    <AppScreen backFallback={'/(app)/(admin)/(tabs)/inventory' as Href}>
      {showOfflineBanner ? <OfflineBanner /> : null}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          gap: theme.spacing.md,
          paddingBottom: theme.spacing['3xl'] + SURFACE_TAB_BAR_CLEARANCE,
          flexGrow: 1,
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void query.refetch()} />
        }
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage) {
            void query.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.4}
        ListHeaderComponent={
          <View style={{ gap: theme.spacing.md, marginBottom: theme.spacing.sm }}>
            <View style={{ gap: theme.spacing.xs }}>
              <AppText
                variant="caption"
                weight={locale === 'ar' ? 'regular' : 'medium'}
                style={{
                  letterSpacing: locale === 'ar' ? 0 : 1.4,
                  textTransform: locale === 'ar' ? 'none' : 'uppercase',
                  color: colors.brand,
                }}
              >
                {t('mobile.inventory.pulseEyebrow')}
              </AppText>
              <AppText variant="title" weight={locale === 'ar' ? 'medium' : 'semibold'}>
                {title}
              </AppText>
            </View>
            <TextField
              value={searchInput}
              onChangeText={setSearchInput}
              placeholder={t('mobile.inventory.searchPlaceholder', { group: title })}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
            />
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            title={t('mobile.inventory.emptyMaterialsTitle')}
            description={
              q
                ? t('mobile.inventory.emptySearchBody')
                : t('mobile.inventory.emptyMaterialsBody')
            }
          />
        }
        ListFooterComponent={
          query.isFetchingNextPage ? (
            <AppText
              variant="caption"
              color="secondary"
              style={{ textAlign: 'center', paddingVertical: theme.spacing.md }}
            >
              {t('mobile.inventory.loadingMore')}
            </AppText>
          ) : null
        }
        renderItem={({ item }) => (
          <InventoryMaterialCard
            item={item}
            onPress={() =>
              router.push(`/(app)/(admin)/inventory/items/${item.id}` as Href)
            }
            canReceive={canReceive}
            canIssue={canIssue}
            canEdit={canEdit}
            canLabelPdf={canLabelPdf}
            onReceive={() => setMove({ mode: 'receive', item })}
            onIssue={() => setMove({ mode: 'issue', item })}
            onEdit={() => setEditItem(item)}
            onLabelPdf={() => openLabelPdf(item)}
            onQrCode={() => setQrItem(qrItemFromCard(item))}
          />
        )}
      />

      <AddStockSheet
        open={Boolean(move)}
        onClose={() => setMove(null)}
        mode={move?.mode ?? 'receive'}
        warehouses={warehousesQuery.data ?? []}
        initialItem={
          move
            ? {
                id: move.item.id,
                sku: move.item.sku,
                name: move.item.name,
                category: move.item.category,
                itemClass: move.item.itemClass,
                unit: move.item.unit,
                imageUrl: move.item.imageUrl,
                materialType: move.item.materialType,
                onHand: move.item.onHand,
                reservedQty: move.item.reservedQty,
                availableQty: move.item.freeQty,
                balances: move.item.balances,
              }
            : null
        }
        loading={movePending}
        onSubmit={(input) => {
          if (!move) return;
          const po = move.mode === 'receive' ? toGoodsReceiptArgs(input) : null;
          const onSuccess = () => {
            void haptics.confirmMedium();
            setMove(null);
            showToast({
              variant: 'success',
              message:
                move.mode === 'issue'
                  ? t('mobile.inventory.issueStockSuccess')
                  : t('mobile.inventory.receiveStockSuccess'),
            });
          };
          const onError = () => {
            void haptics.error();
            showToast({
              variant: 'error',
              message:
                move.mode === 'issue'
                  ? t('mobile.inventory.issueStockFailed')
                  : t('mobile.inventory.receiveStockFailed'),
            });
          };
          if (po) {
            receivePoMutation.mutate(po, { onSuccess, onError });
            return;
          }
          const body = {
            inventoryItemId: input.inventoryItemId,
            warehouseId: input.warehouseId,
            quantity: input.quantity,
            notes: input.notes,
            idempotencyKey: `mobile-${move.mode}-${input.inventoryItemId}-${Date.now()}`,
          };
          const mutation = move.mode === 'issue' ? issueMutation : receiveMutation;
          mutation.mutate(body, { onSuccess, onError });
        }}
      />

      <EditInventoryItemSheet
        open={Boolean(editItem)}
        onClose={() => setEditItem(null)}
        item={editItem}
        canEditCost={canEditCost}
        loading={updateItemMutation.isPending}
        onSubmit={(body) => {
          if (!editItem) return;
          updateItemMutation.mutate(
            { id: editItem.id, body },
            {
              onSuccess: () => {
                void haptics.confirmMedium();
                setEditItem(null);
                showToast({
                  variant: 'success',
                  message: t('mobile.inventory.itemUpdated'),
                });
              },
              onError: () => {
                void haptics.error();
                showToast({
                  variant: 'error',
                  message: t('mobile.inventory.itemUpdateFailed'),
                });
              },
            },
          );
        }}
      />
      <InventoryQrSheet
        open={Boolean(qrItem)}
        item={qrItem}
        onClose={() => setQrItem(null)}
        onClosed={flushPendingPrint}
        onPrint={qrItem ? () => printLabelAfterQrCloses(qrItem) : undefined}
      />
      {pdfDownloadSheet}
    </AppScreen>
  );
}
