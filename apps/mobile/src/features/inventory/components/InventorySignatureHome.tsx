import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { Alert, FlatList, RefreshControl, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { can } from '@maher/permissions';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { useToast } from '@/components/feedback/Toast';
import { AppScreen } from '@/components/layout/AppScreen';
import { useNetwork } from '@/components/network/NetworkProvider';
import { useLocale } from '@/i18n';
import { usePdfDownload } from '@/features/pdf/usePdfDownload';
import { haptics } from '@/motion';
import { useTheme } from '@/theme';
import { SURFACE_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import { openInventoryLabelPdf, type InventoryCategoryGroup } from '../api';
import {
  isValidCategoryGroup,
  selectInventoryItemCard,
  type InventoryItemCardModel,
} from '../selectInventory';
import {
  filterStockCountCards,
  filterTransferCards,
  selectStockCountCard,
  selectTransferCard,
  type StockCountCardModel,
  type TransferCardModel,
} from '../selectInventoryOps';
import { AddStockSheet, type StockMoveMode } from './AddStockSheet';
import { InventoryCategoryRail } from './InventoryCategoryRail';
import { InventoryCompositionChrome } from './InventoryCompositionChrome';
import { CreateInventoryItemSheet } from './CreateInventoryItemSheet';
import { CreateStockCountSheet } from './CreateStockCountSheet';
import { CreateTransferSheet } from './CreateTransferSheet';
import { CreateWarehouseSheet } from './CreateWarehouseSheet';
import { EditInventoryItemSheet } from './EditInventoryItemSheet';
import { InventoryLowStockFocus } from './InventoryLowStockFocus';
import { InventoryMaterialRow } from './InventoryMaterialRow';
import type { InventoryHomeSection } from './InventorySectionTabs';
import { InventoryListSkeleton } from './InventorySkeleton';
import { InventoryStockCountRow } from './InventoryStockCountRow';
import { InventoryTransferRow } from './InventoryTransferRow';
import {
  flattenInventoryItemPages,
  flattenInventoryStockCountPages,
  flattenWarehouseTransferPages,
  useCreateInventoryItemMutation,
  useCreateInventoryStockCountMutation,
  useCreateWarehouseTransferMutation,
  useInventoryGroupsQuery,
  useInventoryItemsInfiniteQuery,
  useInventoryStockCountsInfiniteQuery,
  useIssueStockMutation,
  useReceiveStockMutation,
  useSyncInventoryFromMaterialsMutation,
  useUpdateInventoryItemMutation,
  useWarehouseTransfersInfiniteQuery,
  useWarehousesQuery,
} from '../query';

type MoveTarget = {
  mode: StockMoveMode;
  item: InventoryItemCardModel;
};

type ListRow =
  | { kind: 'item'; model: InventoryItemCardModel }
  | { kind: 'transfer'; model: TransferCardModel }
  | { kind: 'count'; model: StockCountCardModel };

type Props = {
  initialGroup?: InventoryCategoryGroup;
};

/**
 * Signature inventory home — stable shell; only the list body swaps on section change.
 */
export function InventorySignatureHome({ initialGroup }: Props) {
  const { user } = useAuth();
  const { t, locale } = useLocale();
  const { theme } = useTheme();
  const { showOfflineBanner } = useNetwork();
  const { showToast } = useToast();
  const { pickPdfOptions, pdfDownloadSheet } = usePdfDownload();
  const router = useRouter();
  const allowed = can(user, 'inventory.read');
  const canSync = can(user, 'inventory.adjust');
  const canCreateItem = can(user, 'inventory.adjust');
  const canCreateTransfer = can(user, 'inventory.transfer');
  const canCreateCount = can(user, 'inventory.count');
  const canReceive = can(user, 'inventory.receive');
  const canIssue = can(user, 'inventory.issue');
  const canEdit = can(user, 'inventory.adjust');
  const canLabelPdf = can(user, 'inventory.read');
  const canEditCost = can(user, 'inventory.cost.read');
  const canCreateWarehouse = can(user, 'warehouse.manage');

  const [section, setSection] = useState<InventoryHomeSection>('items');
  const [createItemOpen, setCreateItemOpen] = useState(false);
  const [createOpsOpen, setCreateOpsOpen] = useState(false);
  const [createWarehouseOpen, setCreateWarehouseOpen] = useState(false);
  const [editItem, setEditItem] = useState<InventoryItemCardModel | null>(null);
  const [move, setMove] = useState<MoveTarget | null>(null);
  const [categoryGroup, setCategoryGroup] = useState<InventoryCategoryGroup>(
    initialGroup && isValidCategoryGroup(initialGroup) ? initialGroup : 'fabric',
  );
  const [searchInput, setSearchInput] = useState('');
  const [q, setQ] = useState('');
  const listRef = useRef<FlatList<ListRow>>(null);

  useEffect(() => {
    if (initialGroup && isValidCategoryGroup(initialGroup)) {
      setCategoryGroup(initialGroup);
      setSection('items');
    }
  }, [initialGroup]);

  useEffect(() => {
    const id = setTimeout(() => setQ(searchInput.trim()), 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  useEffect(() => {
    setCreateOpsOpen(false);
  }, [section]);

  const groupsQuery = useInventoryGroupsQuery(allowed);
  const itemsQuery = useInventoryItemsInfiniteQuery(
    { categoryGroup, q: section === 'items' ? q || undefined : undefined },
    allowed,
  );
  const transfersQuery = useWarehouseTransfersInfiniteQuery(allowed);
  const countsQuery = useInventoryStockCountsInfiniteQuery(allowed);
  const warehousesQuery = useWarehousesQuery(
    allowed &&
      (section !== 'items' || Boolean(move) || createOpsOpen || canReceive || canIssue),
  );

  const syncMutation = useSyncInventoryFromMaterialsMutation();
  const createItemMutation = useCreateInventoryItemMutation();
  const updateItemMutation = useUpdateInventoryItemMutation();
  const receiveMutation = useReceiveStockMutation();
  const issueMutation = useIssueStockMutation();
  const createTransferMutation = useCreateWarehouseTransferMutation();
  const createCountMutation = useCreateInventoryStockCountMutation();

  function openLabelPdf(item: InventoryItemCardModel) {
    void (async () => {
      const opts = await pickPdfOptions();
      if (!opts) return;
      try {
        await openInventoryLabelPdf(item.id, item.sku, opts);
      } catch {
        void haptics.error();
        Alert.alert(
          t('mobile.inventory.labelPdfFailedTitle'),
          t('mobile.inventory.labelPdfFailedBody'),
        );
      }
    })();
  }

  const groups = groupsQuery.data ?? [];
  const activeGroup = groups.find((g) => g.categoryGroup === categoryGroup);
  const groupLabel = t(`mobile.inventory.groups.${categoryGroup}`);
  const lowStockCount = activeGroup?.lowStockCount ?? 0;

  const items = useMemo(
    () =>
      flattenInventoryItemPages(itemsQuery.data).map((item) =>
        selectInventoryItemCard(item, locale),
      ),
    [itemsQuery.data, locale],
  );

  const transfers = useMemo(() => {
    const rows = flattenWarehouseTransferPages(transfersQuery.data).map((row) =>
      selectTransferCard(row, locale),
    );
    return filterTransferCards(rows, section === 'transfers' ? q : '');
  }, [transfersQuery.data, locale, q, section]);

  const counts = useMemo(() => {
    const warehouses = warehousesQuery.data ?? [];
    const rows = flattenInventoryStockCountPages(countsQuery.data).map((row) =>
      selectStockCountCard(row, locale, warehouses),
    );
    return filterStockCountCards(rows, section === 'counts' ? q : '');
  }, [countsQuery.data, warehousesQuery.data, locale, q, section]);

  const topLowStock = useMemo(
    () => items.find((item) => item.isLowStock) ?? null,
    [items],
  );

  const listRows: ListRow[] = useMemo(() => {
    if (section === 'transfers') {
      return transfers.map((model) => ({ kind: 'transfer' as const, model }));
    }
    if (section === 'counts') {
      return counts.map((model) => ({ kind: 'count' as const, model }));
    }
    return items.map((model) => ({ kind: 'item' as const, model }));
  }, [section, items, transfers, counts]);

  const activeQuery =
    section === 'transfers'
      ? transfersQuery
      : section === 'counts'
        ? countsQuery
        : itemsQuery;

  const refreshing =
    section === 'items'
      ? (groupsQuery.isRefetching || itemsQuery.isRefetching) &&
        !itemsQuery.isFetchingNextPage
      : activeQuery.isRefetching && !activeQuery.isFetchingNextPage;

  // Only skeleton the list body when that section has never loaded — never the whole page
  const bodyLoading = activeQuery.isPending && !activeQuery.data;
  const bodyError = activeQuery.isError && !activeQuery.data;

  async function onRefresh() {
    if (section === 'items') {
      await Promise.all([groupsQuery.refetch(), itemsQuery.refetch()]);
      return;
    }
    if (section === 'transfers') {
      await transfersQuery.refetch();
      return;
    }
    await Promise.all([countsQuery.refetch(), warehousesQuery.refetch()]);
  }

  function onSectionChange(next: InventoryHomeSection) {
    if (next === section) return;
    setSection(next);
    setSearchInput('');
    setQ('');
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }

  if (!allowed) {
    return (
      <AppScreen>
        <EmptyState title={t('mobile.noModules')} description={t('mobile.noModulesHint')} />
      </AppScreen>
    );
  }

  const canCreate =
    section === 'items'
      ? canCreateItem
      : section === 'transfers'
        ? canCreateTransfer
        : canCreateCount;

  const createLabel =
    section === 'items'
      ? t('mobile.inventory.newItem')
      : section === 'transfers'
        ? t('mobile.inventory.newTransfer')
        : t('mobile.inventory.newCount');

  const searchPlaceholder =
    section === 'items'
      ? t('mobile.inventory.searchPlaceholderGlobal')
      : section === 'transfers'
        ? t('mobile.inventory.searchTransfers')
        : t('mobile.inventory.searchCounts');

  const header = (
    <View style={{ gap: theme.spacing.md, marginBottom: theme.spacing.sm }}>
      <InventoryCompositionChrome
        title={t('mobile.inventory.title')}
        subtitle={t('mobile.inventory.signatureSubtitle')}
        section={section}
        onSectionChange={onSectionChange}
        showSearch
        searchInput={searchInput}
        setSearchInput={setSearchInput}
        searchPlaceholder={searchPlaceholder}
        canSync={section === 'items' && canSync}
        syncing={syncMutation.isPending}
        onSync={
          section === 'items'
            ? () => {
                syncMutation.mutate(undefined, {
                  onSuccess: (result) => {
                    void haptics.confirmMedium();
                    showToast({
                      variant: 'success',
                      message: t('mobile.inventory.syncSuccess', {
                        count: result.created,
                      }),
                    });
                  },
                  onError: () => {
                    void haptics.error();
                    showToast({
                      variant: 'error',
                      message: t('mobile.inventory.syncFailed'),
                    });
                  },
                });
              }
            : undefined
        }
        canCreate={canCreate}
        createLabel={createLabel}
        canCreateWarehouse={canCreateWarehouse}
        warehouseLabel={t('mobile.inventory.newWarehouse')}
        onCreateWarehouse={() => setCreateWarehouseOpen(true)}
        onCreate={() => {
          if (section === 'items') setCreateItemOpen(true);
          else setCreateOpsOpen(true);
        }}
      >
        {section === 'items' ? (
          <InventoryCategoryRail
            groups={groups}
            active={categoryGroup}
            onChange={setCategoryGroup}
          />
        ) : null}
      </InventoryCompositionChrome>

      {section === 'items' && lowStockCount > 0 ? (
        <InventoryLowStockFocus
          count={lowStockCount}
          groupLabel={groupLabel}
          topSkuName={topLowStock?.name}
          onPress={() => {
            if (topLowStock) {
              router.push(
                `/(app)/(admin)/inventory/items/${topLowStock.id}` as Href,
              );
            }
          }}
        />
      ) : null}

      <AppText
        variant="caption"
        color="muted"
        weight={locale === 'ar' ? 'regular' : 'medium'}
      >
        {section === 'items'
          ? t('mobile.inventory.materialsHeading', { group: groupLabel })
          : section === 'transfers'
            ? t('mobile.inventory.transfersHeading')
            : t('mobile.inventory.countsHeading')}
      </AppText>
    </View>
  );

  let empty: ReactElement | null = null;
  if (bodyLoading) {
    empty = <InventoryListSkeleton />;
  } else if (bodyError) {
    empty = (
      <ErrorState
        title={t('mobile.inventory.errorTitle')}
        description={t('mobile.inventory.errorBody')}
        retryLabel={t('mobile.inventory.retry')}
        onRetry={() => void activeQuery.refetch()}
      />
    );
  } else if (section === 'items') {
    empty = (
      <EmptyState
        title={t('mobile.inventory.emptyMaterialsTitle')}
        description={
          q
            ? t('mobile.inventory.emptySearchBody')
            : t('mobile.inventory.emptyCategoryBody', { group: groupLabel })
        }
      />
    );
  } else if (section === 'transfers') {
    empty = (
      <EmptyState
        title={t('mobile.inventory.emptyTransfersTitle')}
        description={
          q ? t('mobile.inventory.emptySearchBody') : t('mobile.inventory.emptyTransfersBody')
        }
      />
    );
  } else {
    empty = (
      <EmptyState
        title={t('mobile.inventory.emptyCountsTitle')}
        description={
          q ? t('mobile.inventory.emptySearchBody') : t('mobile.inventory.emptyCountsBody')
        }
      />
    );
  }

  const movePending =
    (move?.mode === 'receive' && receiveMutation.isPending) ||
    (move?.mode === 'issue' && issueMutation.isPending);

  return (
    <AppScreen>
      {showOfflineBanner ? <OfflineBanner /> : null}
      <FlatList
        ref={listRef}
        data={bodyLoading || bodyError ? [] : listRows}
        keyExtractor={(row) => `${row.kind}-${row.model.id}`}
        contentContainerStyle={{
          gap: theme.spacing.md,
          paddingBottom: theme.spacing['3xl'] + SURFACE_TAB_BAR_CLEARANCE,
          flexGrow: 1,
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />
        }
        onEndReached={() => {
          if (activeQuery.hasNextPage && !activeQuery.isFetchingNextPage) {
            void activeQuery.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.4}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={
          activeQuery.isFetchingNextPage ? (
            <AppText
              variant="caption"
              color="secondary"
              style={{ textAlign: 'center', paddingVertical: theme.spacing.md }}
            >
              {t('mobile.inventory.loadingMore')}
            </AppText>
          ) : null
        }
        renderItem={({ item, index }) =>
          item.kind === 'item' ? (
            <InventoryMaterialRow
              item={item.model}
              index={index}
              animateEnter={false}
              onPress={() =>
                router.push(
                  `/(app)/(admin)/inventory/items/${item.model.id}` as Href,
                )
              }
              canReceive={canReceive}
              canIssue={canIssue}
              canEdit={canEdit}
              canLabelPdf={canLabelPdf}
              onReceive={() => setMove({ mode: 'receive', item: item.model })}
              onIssue={() => setMove({ mode: 'issue', item: item.model })}
              onEdit={() => setEditItem(item.model)}
              onLabelPdf={() => openLabelPdf(item.model)}
            />
          ) : item.kind === 'transfer' ? (
            <InventoryTransferRow
              transfer={item.model}
              index={index}
              animateEnter={false}
            />
          ) : (
            <InventoryStockCountRow
              count={item.model}
              index={index}
              animateEnter={false}
            />
          )
        }
      />

      <CreateWarehouseSheet
        open={createWarehouseOpen}
        onClose={() => setCreateWarehouseOpen(false)}
        onCreated={() => setCreateWarehouseOpen(false)}
      />

      <CreateInventoryItemSheet
        open={createItemOpen}
        onClose={() => setCreateItemOpen(false)}
        categoryGroup={categoryGroup}
        loading={createItemMutation.isPending}
        onSubmit={(body) => {
          createItemMutation.mutate(body, {
            onSuccess: () => {
              void haptics.confirmMedium();
              setCreateItemOpen(false);
              showToast({
                variant: 'success',
                message: t('mobile.inventory.itemCreated'),
              });
            },
            onError: () => {
              void haptics.error();
              showToast({
                variant: 'error',
                message: t('mobile.inventory.itemCreateFailed'),
              });
            },
          });
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
                unit: move.item.unit,
                balances: move.item.balances,
              }
            : null
        }
        loading={movePending}
        onSubmit={(input) => {
          if (!move) return;
          const body = {
            inventoryItemId: input.inventoryItemId,
            warehouseId: input.warehouseId,
            quantity: input.quantity,
            notes: input.notes,
            idempotencyKey: `mobile-${move.mode}-${input.inventoryItemId}-${Date.now()}`,
          };
          const mutation = move.mode === 'issue' ? issueMutation : receiveMutation;
          mutation.mutate(body, {
            onSuccess: () => {
              void haptics.confirmMedium();
              setMove(null);
              showToast({
                variant: 'success',
                message:
                  move.mode === 'issue'
                    ? t('mobile.inventory.issueStockSuccess')
                    : t('mobile.inventory.receiveStockSuccess'),
              });
            },
            onError: () => {
              void haptics.error();
              showToast({
                variant: 'error',
                message:
                  move.mode === 'issue'
                    ? t('mobile.inventory.issueStockFailed')
                    : t('mobile.inventory.receiveStockFailed'),
              });
            },
          });
        }}
      />

      <CreateTransferSheet
        open={section === 'transfers' && createOpsOpen}
        onClose={() => setCreateOpsOpen(false)}
        warehouses={warehousesQuery.data ?? []}
        loading={createTransferMutation.isPending}
        onSubmit={(body) => {
          createTransferMutation.mutate(body, {
            onSuccess: () => {
              void haptics.confirmMedium();
              setCreateOpsOpen(false);
              showToast({
                variant: 'success',
                message: t('mobile.inventory.transferCreated'),
              });
            },
            onError: () => {
              void haptics.error();
              showToast({
                variant: 'error',
                message: t('mobile.inventory.transferCreateFailed'),
              });
            },
          });
        }}
      />

      <CreateStockCountSheet
        open={section === 'counts' && createOpsOpen}
        onClose={() => setCreateOpsOpen(false)}
        warehouses={warehousesQuery.data ?? []}
        loading={createCountMutation.isPending}
        onSubmit={(body) => {
          createCountMutation.mutate(body, {
            onSuccess: () => {
              void haptics.confirmMedium();
              setCreateOpsOpen(false);
              showToast({
                variant: 'success',
                message: t('mobile.inventory.countCreated'),
              });
            },
            onError: () => {
              void haptics.error();
              showToast({
                variant: 'error',
                message: t('mobile.inventory.countCreateFailed'),
              });
            },
          });
        }}
      />
      {pdfDownloadSheet}
    </AppScreen>
  );
}
