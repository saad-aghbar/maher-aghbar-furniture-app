import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { localizedName } from '@maher/i18n';
import { can } from '@maher/permissions';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { EmptyState } from '@/components/feedback/EmptyState';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { useToast, toastCopy } from '@/components/feedback/Toast';
import { AppScreen } from '@/components/layout/AppScreen';
import { useNetwork } from '@/components/network/NetworkProvider';
import { useCodeScanner } from '@/components/scan/CodeScannerProvider';
import { ActionSheet } from '@/components/sheets/ActionSheet';
import { useLocale } from '@/i18n';
import { usePdfDownload } from '@/features/pdf/usePdfDownload';
import { haptics } from '@/motion';
import { useTheme } from '@/theme';
import { SURFACE_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import type { FinishedLot, SemiFinishedLot, WipKitCard } from '@/api/modules/inventory';
import { queryKeys } from '@/api/queryKeys';
import {
  fetchWipKitBoard,
  getInventoryItem,
  openInventoryLabelPdf,
  openInventoryQrLabelPdf,
  openWipKitQrLabelPdf,
  type InventoryCategoryGroup,
  type InventoryItem,
} from '../api';
import { resolveInventoryScan } from '../resolveInventoryScan';
import { toGoodsReceiptArgs } from '../stockMoveSubmit';
import {
  inventoryGroupRouteTitle,
  isValidCategoryGroup,
  selectInventoryItemCard,
  type InventoryItemCardModel,
} from '../selectInventory';
import {
  countMatchesLifecycle,
  filterStockCountCards,
  filterTransferCards,
  selectStockCountCard,
  selectTransferCard,
  transferMatchesLifecycle,
  type StockCountCardModel,
  type TransferCardModel,
} from '../selectInventoryOps';
import { AddStockSheet, type StockMoveMode } from './AddStockSheet';
import { InventoryCategoryRail } from './InventoryCategoryRail';
import { InventoryGroupLoadError } from './InventoryGroupLoadError';
import { InventoryCompositionChrome } from './InventoryCompositionChrome';
import { CreateInventoryItemSheet } from './CreateInventoryItemSheet';
import { CreateStockCountSheet } from './CreateStockCountSheet';
import { CreateTransferSheet } from './CreateTransferSheet';
import { CreateWarehouseSheet } from './CreateWarehouseSheet';
import { EditInventoryItemSheet } from './EditInventoryItemSheet';
import { InventoryLowStockFocus } from './InventoryLowStockFocus';
import { InventoryMaterialRow } from './InventoryMaterialRow';
import { InventoryQrSheet, qrItemFromApi, qrItemFromCard, type InventoryQrItem } from './InventoryQrSheet';
import { InventoryScanResultSheet } from './InventoryScanResultSheet';
import { InventorySemiOrderDetailSheet } from './InventorySemiOrderDetailSheet';
import {
  countActiveSemiFilters,
  defaultSemiFilterDraft,
  InventorySemiFilterSheet,
  type SemiFilterDraft,
} from './InventorySemiFilterSheet';
import { InventorySemiOrderGroupCard } from './InventorySemiOrderGroupCard';
import type { InventoryHomeSection } from './InventorySectionTabs';
import type { InventoryLifecycle } from './InventoryLifecycleTabs';
import { InventoryListSkeleton } from './InventorySkeleton';
import { InventoryStockCountRow } from './InventoryStockCountRow';
import { InventoryTransferRow } from './InventoryTransferRow';
import { InventoryFinishedRow, InventoryFgLotRow } from './InventoryProductionRows';
import {
  countActiveFinishedFilters,
  defaultFinishedFilterDraft,
  InventoryFinishedFilterSheet,
  type FinishedFilterDraft,
} from './InventoryFinishedFilterSheet';
import { InventoryFinishedOrderCard } from './InventoryFinishedOrderCard';
import { InventoryLotInspectSheet } from './InventoryLotInspectSheet';
import { InventoryFgLotInspectSheet } from './InventoryFgLotInspectSheet';
import { warehousesForLifecycle, warehouseTypeForLifecycle } from '../preferWarehouseForReceive';
import {
  boardParamsForSemiFilter,
  selectSemiOrdersFromBoard,
  type SemiOrderFilter,
  type SemiOrderGroup,
} from '../selectSemiOrders';
import {
  selectFinishedOrders,
  type FinishedBoardScope,
  type FinishedOrderGroup,
} from '../selectFinishedOrders';
import {
  type FgFilter,
} from '../fgFilters';
import {
  flattenFinishedLotsPages,
  flattenInventoryItemPages,
  flattenInventoryStockCountPages,
  flattenWarehouseTransferPages,
  useCompleteWarehouseTransferMutation,
  useCreateInventoryItemMutation,
  useCreateInventoryStockCountMutation,
  useCreateWarehouseTransferMutation,
  useFinishedLotsInfiniteQuery,
  useInventoryGroupsQuery,
  useInventoryItemsInfiniteQuery,
  useInventoryStockCountsInfiniteQuery,
  useIssueStockMutation,
  usePostInventoryStockCountMutation,
  useReceiveAgainstPoMutation,
  useReceiveStockMutation,
  useSyncInventoryFromMaterialsMutation,
  useUpdateInventoryItemMutation,
  useWarehouseTransfersInfiniteQuery,
  useWarehousesQuery,
} from '../query';

function defaultHistoryFrom(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

function defaultHistoryTo(): string {
  return new Date().toISOString().slice(0, 10);
}
type MoveTarget = {
  mode: StockMoveMode;
  item: InventoryItemCardModel;
};

type ListRow =
  | { kind: 'item'; model: InventoryItemCardModel }
  | { kind: 'transfer'; model: TransferCardModel }
  | { kind: 'count'; model: StockCountCardModel }
  | { kind: 'semiOrder'; model: SemiOrderGroup }
  | { kind: 'finishedOrder'; model: FinishedOrderGroup }
  | { kind: 'fgLot'; model: FinishedLot }
  | { kind: 'fg'; model: InventoryItemCardModel & { reservedQty: number; quarantined: boolean } };

type Props = {
  initialGroup?: InventoryCategoryGroup;
  initialLifecycle?: InventoryLifecycle;
  initialScope?: FinishedBoardScope;
  initialLowStock?: boolean;
  initialHandoff?: boolean;
  initialTab?: string;
};

/**
 * Signature inventory home — stable shell; only the list body swaps on section change.
 */
export function InventorySignatureHome({
  initialGroup,
  initialLifecycle,
  initialScope,
  initialLowStock,
  initialHandoff,
  initialTab,
}: Props) {
  const { user } = useAuth();
  const { t, locale, isRTL } = useLocale();
  const { theme, colors } = useTheme();
  const { showOfflineBanner } = useNetwork();
  const { showToast } = useToast();
  const { pickPdfOptions, pdfDownloadSheet } = usePdfDownload();
  const { openScanner } = useCodeScanner();
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
  const [lifecycle, setLifecycle] = useState<InventoryLifecycle>(
    initialLifecycle ?? 'materials',
  );
  const historyDefaults = useMemo(
    () => ({ historyFrom: defaultHistoryFrom(), historyTo: defaultHistoryTo() }),
    [],
  );
  const [fgFilter, setFgFilter] = useState<FgFilter>('all');
  const [fgScope, setFgScope] = useState<FinishedBoardScope>(initialScope ?? 'inWarehouse');
  const [fgWarehouseId, setFgWarehouseId] = useState<string | null>(null);
  const [fgHistoryFrom, setFgHistoryFrom] = useState(historyDefaults.historyFrom);
  const [fgHistoryTo, setFgHistoryTo] = useState(historyDefaults.historyTo);
  const [fgFilterSheetOpen, setFgFilterSheetOpen] = useState(false);
  const [fgFilterDraft, setFgFilterDraft] = useState<FinishedFilterDraft>(() =>
    defaultFinishedFilterDraft(historyDefaults),
  );
  const [semiOrderFilter, setSemiOrderFilter] = useState<SemiOrderFilter>('active');
  const [semiWarehouseId, setSemiWarehouseId] = useState<string | null>(null);
  const [semiHistoryFrom, setSemiHistoryFrom] = useState(historyDefaults.historyFrom);
  const [semiHistoryTo, setSemiHistoryTo] = useState(historyDefaults.historyTo);
  const [semiFilterSheetOpen, setSemiFilterSheetOpen] = useState(false);
  const [semiFilterDraft, setSemiFilterDraft] = useState<SemiFilterDraft>(() =>
    defaultSemiFilterDraft(historyDefaults),
  );
  const [inspectKitId, setInspectKitId] = useState<string | null>(null);
  const [inspectKitSeed, setInspectKitSeed] = useState<WipKitCard | null>(null);
  const [createItemOpen, setCreateItemOpen] = useState(false);
  const [createOpsOpen, setCreateOpsOpen] = useState(false);
  const [createWarehouseOpen, setCreateWarehouseOpen] = useState(false);
  const [inspectLot, setInspectLot] = useState<SemiFinishedLot | null>(null);
  const [inspectFgLot, setInspectFgLot] = useState<FinishedLot | null>(null);
  const [editItem, setEditItem] = useState<InventoryItemCardModel | null>(null);
  const [move, setMove] = useState<MoveTarget | null>(null);
  const [scanResult, setScanResult] = useState<InventoryItem | 'not-found' | null>(null);
  const [qrItem, setQrItem] = useState<InventoryQrItem | null>(null);
  const pendingPrintRef = useRef<{
    id: string;
    sku: string;
    kind?: 'item' | 'wip-kit';
  } | null>(null);
  const lotQrKindRef = useRef<{
    id: string;
    sku: string;
    kind: 'item' | 'wip-kit';
  } | null>(null);
  /** Close Semi detail first — iOS freezes if QR/PDF opens while that Modal is still up. */
  const pendingAfterSemiDetailRef = useRef<
    | { type: 'qr'; kit: WipKitCard }
    | { type: 'print'; kit: WipKitCard }
    | null
  >(null);
  const pendingAfterScanRef = useRef<
    | { type: 'receive'; item: InventoryItem }
    | { type: 'issue'; item: InventoryItem }
    | { type: 'transfer'; item: InventoryItem }
    | { type: 'count'; item: InventoryItem }
    | { type: 'details'; itemId: string }
    | { type: 'qr'; item: InventoryQrItem }
    | { type: 'scanAgain' }
    | { type: 'purchasing'; purchaseOrderId: string }
    | null
  >(null);
  const createdAfterSaveRef = useRef<InventoryItem | null>(null);
  const [createSuccessOpen, setCreateSuccessOpen] = useState(false);
  const [opsFromScan, setOpsFromScan] = useState<'transfer' | 'count' | null>(null);
  const [opsItem, setOpsItem] = useState<InventoryItem | null>(null);
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
    if (initialLifecycle) {
      setLifecycle(initialLifecycle);
      setSection('items');
    } else if (initialLowStock) {
      setLifecycle('materials');
      setSection('items');
    }
    if (initialScope) setFgScope(initialScope);
    if (initialHandoff && !initialLifecycle) {
      setLifecycle('semiFinished');
      setSection('items');
    }
    if (initialTab === 'corrections') setSection('items');
  }, [initialHandoff, initialLifecycle, initialLowStock, initialScope, initialTab]);

  useEffect(() => {
    const id = setTimeout(() => setQ(searchInput.trim()), 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  useEffect(() => {
    setCreateOpsOpen(false);
  }, [section, lifecycle]);

  useEffect(() => {
    if (createItemOpen) createdAfterSaveRef.current = null;
  }, [createItemOpen]);

  const groupsQuery = useInventoryGroupsQuery(allowed && lifecycle === 'materials');
  const itemsQuery = useInventoryItemsInfiniteQuery(
    { categoryGroup, q: section === 'items' ? q || undefined : undefined },
    allowed && lifecycle === 'materials',
  );
  const semiBoardParams = useMemo(
    () =>
      boardParamsForSemiFilter(semiOrderFilter, {
        from: semiHistoryFrom,
        to: semiHistoryTo,
        warehouseId: semiWarehouseId ?? undefined,
        q: section === 'items' ? q || undefined : undefined,
      }),
    [semiOrderFilter, semiHistoryFrom, semiHistoryTo, semiWarehouseId, section, q],
  );
  const wipKitBoardQuery = useQuery({
    queryKey: queryKeys.inventory.wipKitBoard(semiBoardParams),
    queryFn: () => fetchWipKitBoard(semiBoardParams),
    enabled: allowed && lifecycle === 'semiFinished' && section === 'items',
  });

  const fgQuery = useFinishedLotsInfiniteQuery(
    {
      q: section === 'items' ? q || undefined : undefined,
      warehouseId: fgWarehouseId ?? undefined,
      scope: fgScope,
      from: fgScope === 'history' ? fgHistoryFrom : undefined,
      to: fgScope === 'history' ? fgHistoryTo : undefined,
      pageSize: 50,
    },
    allowed && lifecycle === 'finished' && section === 'items',
  );
  const warehouseType = warehouseTypeForLifecycle(lifecycle);
  const transfersQuery = useWarehouseTransfersInfiniteQuery(allowed, warehouseType);
  const countsQuery = useInventoryStockCountsInfiniteQuery(allowed, warehouseType);
  const warehousesQuery = useWarehousesQuery(
    allowed &&
      (section !== 'items' ||
        lifecycle === 'finished' ||
        lifecycle === 'semiFinished' ||
        Boolean(move) ||
        createOpsOpen ||
        Boolean(opsFromScan) ||
        canReceive ||
        canIssue),
  );

  const syncMutation = useSyncInventoryFromMaterialsMutation();
  const createItemMutation = useCreateInventoryItemMutation();
  const updateItemMutation = useUpdateInventoryItemMutation();
  const receiveMutation = useReceiveStockMutation();
  const receivePoMutation = useReceiveAgainstPoMutation();
  const issueMutation = useIssueStockMutation();
  const createTransferMutation = useCreateWarehouseTransferMutation();
  const createCountMutation = useCreateInventoryStockCountMutation();
  const completeTransferMutation = useCompleteWarehouseTransferMutation();
  const postCountMutation = usePostInventoryStockCountMutation();

  function openLabelPdf(item: InventoryItemCardModel | InventoryQrItem | { id: string; sku: string }) {
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

  function openQrLabelPdf(item: InventoryItemCardModel | InventoryQrItem | { id: string; sku: string; kind?: 'item' | 'wip-kit' }) {
    void (async () => {
      const opts = await pickPdfOptions();
      if (!opts) return;
      try {
        if ('kind' in item && item.kind === 'wip-kit') {
          await openWipKitQrLabelPdf(item.id, item.sku, opts);
        } else {
          await openInventoryQrLabelPdf(item.id, item.sku, opts);
        }
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
  function printLabelAfterQrCloses(item: {
    id: string;
    sku: string;
    kind?: 'item' | 'wip-kit';
  }) {
    pendingPrintRef.current = { id: item.id, sku: item.sku, kind: item.kind ?? 'item' };
    setQrItem(null);
  }

  function flushPendingPrint() {
    const next = pendingPrintRef.current;
    pendingPrintRef.current = null;
    if (next) openQrLabelPdf(next);
  }

  function lotScanPayload(lot: SemiFinishedLot): string | null {
    return lot.qrCode?.trim() || lot.wipKit?.qrCode?.trim() || null;
  }

  function openLotQr(lot: SemiFinishedLot) {
    const code = lotScanPayload(lot);
    if (!code) return;
    setInspectLot(null);
    pendingPrintRef.current = null;
    lotQrKindRef.current = lot.wipKit?.id
      ? { id: lot.wipKit.id, sku: lot.wipKit.qrCode || code, kind: 'wip-kit' }
      : { id: lot.inventoryItem.id, sku: lot.inventoryItem.sku, kind: 'item' };
    setQrItem({
      id: lot.wipKit?.id ?? lot.inventoryItem.id,
      sku: code,
      name: localizedName(locale, lot.inventoryItem),
      scanCode: code,
      category: 'SEMI_FINISHED',
      unit: String(lot.quantity),
      imageUrl: lot.inventoryItem.product?.imageUrl ?? null,
      itemClass: 'SEMI_FINISHED_GOOD',
    });
  }

  function openKitQr(kit: WipKitCard) {
    pendingAfterSemiDetailRef.current = { type: 'qr', kit };
    // Keep seed so the same BottomSheet instance can animate closed (clearing
    // seed remounts the empty sheet and skips onClosed — freezes QR handoff).
    setInspectKitId(null);
  }

  function printKitQr(kit: WipKitCard) {
    pendingAfterSemiDetailRef.current = { type: 'print', kit };
    setInspectKitId(null);
  }

  function flushAfterSemiDetailClosed() {
    setInspectKitSeed(null);
    const next = pendingAfterSemiDetailRef.current;
    pendingAfterSemiDetailRef.current = null;
    if (!next) return;
    if (next.type === 'qr') {
      lotQrKindRef.current = { id: next.kit.id, sku: next.kit.qrCode, kind: 'wip-kit' };
      pendingPrintRef.current = null;
      setQrItem({
        id: next.kit.id,
        sku: next.kit.qrCode,
        name:
          next.kit.productionOrder.product
            ? localizedName(locale, next.kit.productionOrder.product)
            : next.kit.productionOrder.productDescription,
        scanCode: next.kit.qrCode,
        category: 'SEMI_FINISHED',
        unit: `${next.kit.pieces.length}/${next.kit.expectedPieceCount}`,
        imageUrl: next.kit.productionOrder.product?.imageUrl ?? null,
        itemClass: 'SEMI_FINISHED_GOOD',
      });
      return;
    }
    openQrLabelPdf({
      id: next.kit.id,
      sku: next.kit.qrCode,
      kind: 'wip-kit',
    });
  }

  function printLotQr(lot: SemiFinishedLot) {
    setInspectLot(null);
    if (lot.wipKit?.id) {
      openQrLabelPdf({
        id: lot.wipKit.id,
        sku: lot.wipKit.qrCode || lot.qrCode || lot.inventoryItem.sku,
        kind: 'wip-kit',
      });
      return;
    }
    openQrLabelPdf({
      id: lot.inventoryItem.id,
      sku: lot.inventoryItem.sku,
      kind: 'item',
    });
  }

  async function runIdentifyScan() {
    const code = await openScanner({
      title: t('mobile.inventory.scan'),
      hint: t('mobile.inventory.scanBarcodeHint'),
    });
    if (!code) return;
    void haptics.selection();
    const resolved = await resolveInventoryScan(code);
    if (resolved.status === 'FOUND') {
      void haptics.confirmLight();
      setScanResult(resolved.item);
      return;
    }
    if (resolved.status === 'NOT_FOUND') {
      void haptics.error();
      setScanResult('not-found');
      return;
    }
    void haptics.error();
    showToast({
      variant: 'error',
      message: t('mobile.inventory.couldntIdentifyItem'),
    });
  }

  function cardFromItem(found: InventoryItem): InventoryItemCardModel {
    return selectInventoryItemCard(found, locale);
  }

  function lifecycleFromItem(found: InventoryItem): InventoryLifecycle {
    if (found.itemClass === 'FINISHED_GOOD') return 'finished';
    if (found.itemClass === 'SEMI_FINISHED_GOOD') return 'semiFinished';
    return 'materials';
  }

  /** Queue destination, then dismiss scan sheet — flush only in onClosed. */
  function queueAfterScan(
    action: NonNullable<(typeof pendingAfterScanRef)['current']>,
  ) {
    pendingAfterScanRef.current = action;
    setScanResult(null);
  }

  function flushAfterScanClosed() {
    const next = pendingAfterScanRef.current;
    pendingAfterScanRef.current = null;
    if (!next) return;
    switch (next.type) {
      case 'receive':
        setMove({ mode: 'receive', item: cardFromItem(next.item) });
        break;
      case 'issue':
        setMove({ mode: 'issue', item: cardFromItem(next.item) });
        break;
      case 'transfer':
        setOpsItem(next.item);
        setOpsFromScan('transfer');
        break;
      case 'count':
        setOpsItem(next.item);
        setOpsFromScan('count');
        break;
      case 'details':
        router.push(`/(app)/(admin)/inventory/items/${next.itemId}` as Href);
        break;
      case 'qr':
        setQrItem(next.item);
        break;
      case 'scanAgain':
        void runIdentifyScan();
        break;
      case 'purchasing':
        router.push(`/(app)/(admin)/purchasing/${next.purchaseOrderId}` as Href);
        break;
      default:
        break;
    }
  }

  function cancelScanResult() {
    pendingAfterScanRef.current = null;
    setScanResult(null);
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
    const rows = flattenWarehouseTransferPages(transfersQuery.data)
      .filter((row) => transferMatchesLifecycle(row, lifecycle))
      .map((row) => selectTransferCard(row, locale));
    return filterTransferCards(rows, section === 'transfers' ? q : '');
  }, [transfersQuery.data, locale, q, section, lifecycle]);

  const counts = useMemo(() => {
    const warehouses = warehousesQuery.data ?? [];
    const rows = flattenInventoryStockCountPages(countsQuery.data)
      .filter(
        (row) =>
          warehouses.length === 0 || countMatchesLifecycle(row, lifecycle, warehouses),
      )
      .map((row) => selectStockCountCard(row, locale, warehouses));
    return filterStockCountCards(rows, section === 'counts' ? q : '');
  }, [countsQuery.data, warehousesQuery.data, locale, q, section, lifecycle]);

  const lifecycleWarehouses = useMemo(
    () => warehousesForLifecycle(warehousesQuery.data ?? [], lifecycle),
    [warehousesQuery.data, lifecycle],
  );

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
    if (lifecycle === 'semiFinished') {
      return selectSemiOrdersFromBoard(wipKitBoardQuery.data?.sections ?? [], {
        filter: semiOrderFilter,
        q,
      }).map((model) => ({ kind: 'semiOrder' as const, model }));
    }
    if (lifecycle === 'finished') {
      return selectFinishedOrders(flattenFinishedLotsPages(fgQuery.data), {
        fgFilter: fgScope === 'inWarehouse' ? fgFilter : 'all',
        scope: fgScope,
      }).map((model) => ({
        kind: 'finishedOrder' as const,
        model,
      }));
    }
    return items.map((model) => ({ kind: 'item' as const, model }));
  }, [
    section,
    lifecycle,
    semiOrderFilter,
    items,
    transfers,
    counts,
    wipKitBoardQuery.data,
    fgQuery.data,
    locale,
    fgFilter,
    fgScope,
    q,
  ]);

  const activeQuery =
    section === 'transfers'
      ? transfersQuery
      : section === 'counts'
        ? countsQuery
        : lifecycle === 'semiFinished'
          ? wipKitBoardQuery
          : lifecycle === 'finished'
            ? fgQuery
            : itemsQuery;

  const refreshing =
    section === 'items' && lifecycle === 'materials'
      ? (groupsQuery.isRefetching || itemsQuery.isRefetching) &&
        !itemsQuery.isFetchingNextPage
      : section === 'items' && lifecycle === 'semiFinished'
        ? wipKitBoardQuery.isRefetching
        : 'isFetchingNextPage' in activeQuery
          ? activeQuery.isRefetching && !activeQuery.isFetchingNextPage
          : activeQuery.isRefetching;

  // Only skeleton the list body when that section has never loaded — never the whole page
  const bodyLoading = activeQuery.isPending && !activeQuery.data;
  const bodyError = activeQuery.isError && !activeQuery.data;
  const bodyRetrying = bodyError && activeQuery.isFetching;

  async function onRefresh() {
    if (section === 'transfers') {
      await transfersQuery.refetch();
      return;
    }
    if (section === 'counts') {
      await Promise.all([countsQuery.refetch(), warehousesQuery.refetch()]);
      return;
    }
    if (lifecycle === 'semiFinished') {
      await wipKitBoardQuery.refetch();
      return;
    }
    if (lifecycle === 'finished') {
      await fgQuery.refetch();
      return;
    }
    await Promise.all([groupsQuery.refetch(), itemsQuery.refetch()]);
  }

  function onLifecycleChange(next: InventoryLifecycle) {
    if (next === lifecycle) return;
    setLifecycle(next);
    setSection('items');
    setCreateOpsOpen(false);
    setSearchInput('');
    setQ('');
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }

  function onSectionChange(next: InventoryHomeSection) {
    if (next === section) return;
    setSection(next);
    setSearchInput('');
    setQ('');
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }

  function openCreateSuccessIfNeeded() {
    if (createdAfterSaveRef.current) setCreateSuccessOpen(true);
  }

  if (!allowed) {
    return (
      <AppScreen>
        <EmptyState title={t('mobile.noModules')} description={t('mobile.noModulesHint')} />
      </AppScreen>
    );
  }

  if (bodyError) {
    const landmarkKey =
      lifecycle === 'semiFinished'
        ? 'semi'
        : lifecycle === 'finished'
          ? 'finished'
          : 'raw';
    return (
      <AppScreen>
        {showOfflineBanner ? <OfflineBanner /> : null}
        <InventoryGroupLoadError
          groupTitle={inventoryGroupRouteTitle(landmarkKey, t)}
          onRetry={() => void activeQuery.refetch()}
        />
      </AppScreen>
    );
  }

  const canCreate =
    section === 'items'
      ? lifecycle === 'materials' && canCreateItem
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
      ? lifecycle === 'finished'
        ? t('mobile.inventory.fgSearchPlaceholder')
        : lifecycle === 'semiFinished'
          ? t('mobile.inventory.semiSearchPlaceholder')
          : t('mobile.inventory.searchPlaceholderGlobal')
      : section === 'transfers'
        ? t('mobile.inventory.searchTransfers')
        : t('mobile.inventory.searchCounts');

  const header = (
    <View style={{ gap: theme.spacing.md, marginBottom: theme.spacing.sm }}>
      <InventoryCompositionChrome
        title={
          lifecycle === 'finished'
            ? t('mobile.inventory.fgDeskTitle')
            : lifecycle === 'semiFinished'
              ? t('mobile.inventory.semiHeading')
              : t('mobile.inventory.title')
        }
        subtitle={
          lifecycle === 'finished'
            ? t('mobile.inventory.signatureSubtitleFinished')
            : lifecycle === 'semiFinished'
              ? t('mobile.inventory.signatureSubtitleSemi')
              : t('mobile.inventory.signatureSubtitle')
        }
        lifecycle={lifecycle}
        onLifecycleChange={onLifecycleChange}
        section={section}
        onSectionChange={onSectionChange}
        showSearch
        searchInput={searchInput}
        setSearchInput={setSearchInput}
        searchPlaceholder={searchPlaceholder}
        canSync={lifecycle === 'materials' && section === 'items' && canSync}
        syncing={syncMutation.isPending}
        onRefresh={() => void onRefresh()}
        onSync={
          lifecycle === 'materials' && section === 'items'
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
        canScan={allowed}
        scanLabel={t('mobile.inventory.scan')}
        onScan={() => void runIdentifyScan()}
        onCreate={() => {
          if (section === 'items') setCreateItemOpen(true);
          else setCreateOpsOpen(true);
        }}
        onOpenFilters={
          section === 'items' && lifecycle === 'finished'
            ? () => {
                setFgFilterDraft({
                  scope: fgScope,
                  warehouseId: fgWarehouseId,
                  fgFilter,
                  historyFrom: fgHistoryFrom,
                  historyTo: fgHistoryTo,
                });
                setFgFilterSheetOpen(true);
              }
            : section === 'items' && lifecycle === 'semiFinished'
              ? () => {
                  setSemiFilterDraft({
                    scope: semiOrderFilter,
                    warehouseId: semiWarehouseId,
                    historyFrom: semiHistoryFrom,
                    historyTo: semiHistoryTo,
                  });
                  setSemiFilterSheetOpen(true);
                }
              : undefined
        }
        filterActiveCount={
          section === 'items' && lifecycle === 'finished'
            ? countActiveFinishedFilters(
                {
                  scope: fgScope,
                  warehouseId: fgWarehouseId,
                  fgFilter,
                  historyFrom: fgHistoryFrom,
                  historyTo: fgHistoryTo,
                },
                historyDefaults,
              )
            : section === 'items' && lifecycle === 'semiFinished'
              ? countActiveSemiFilters(
                  {
                    scope: semiOrderFilter,
                    warehouseId: semiWarehouseId,
                    historyFrom: semiHistoryFrom,
                    historyTo: semiHistoryTo,
                  },
                  historyDefaults,
                )
              : 0
        }
      >
        {section === 'items' && lifecycle === 'materials' ? (
          <InventoryCategoryRail
            groups={groups}
            active={categoryGroup}
            onChange={setCategoryGroup}
          />
        ) : null}
      </InventoryCompositionChrome>

      {section === 'items' && lifecycle === 'materials' && lowStockCount > 0 ? (
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

      {section === 'items' && lifecycle === 'semiFinished' ? (
        <View style={{ gap: 4, marginBottom: theme.spacing.xs }}>
          <AppText
            variant="body"
            weight={locale === 'ar' ? 'medium' : 'semibold'}
            style={{ textAlign: isRTL ? 'right' : 'left', color: colors.info }}
          >
            {t('mobile.inventory.semiHeading')}
          </AppText>
          <AppText
            variant="caption"
            color="muted"
            style={{ textAlign: isRTL ? 'right' : 'left' }}
          >
            {t('mobile.inventory.semiOrdersHint')}
          </AppText>
        </View>
      ) : section === 'items' && lifecycle === 'finished' ? (
        <View style={{ gap: 4, marginBottom: theme.spacing.xs }}>
          <AppText
            variant="body"
            weight={locale === 'ar' ? 'medium' : 'semibold'}
            style={{ textAlign: isRTL ? 'right' : 'left', color: colors.success }}
          >
            {t('mobile.inventory.finishedHeading')}
          </AppText>
          <AppText
            variant="caption"
            color="muted"
            style={{ textAlign: isRTL ? 'right' : 'left' }}
          >
            {t('mobile.inventory.finishedSectionHint')}
          </AppText>
        </View>
      ) : section === 'items' && lifecycle === 'materials' ? (
        <View style={{ gap: 4, marginBottom: theme.spacing.xs }}>
          <AppText
            variant="body"
            weight={locale === 'ar' ? 'medium' : 'semibold'}
            style={{ textAlign: isRTL ? 'right' : 'left', color: colors.brand }}
          >
            {t('mobile.inventory.materialsHeading', { group: groupLabel })}
          </AppText>
          <AppText
            variant="caption"
            color="muted"
            style={{ textAlign: isRTL ? 'right' : 'left' }}
          >
            {t('mobile.inventory.materialsSectionHint')}
          </AppText>
        </View>
      ) : (
        <AppText
          variant="caption"
          color="muted"
          weight={locale === 'ar' ? 'regular' : 'medium'}
        >
          {section === 'transfers'
            ? lifecycle === 'semiFinished'
              ? t('mobile.inventory.transfersHeadingSemi')
              : lifecycle === 'finished'
                ? t('mobile.inventory.transfersHeadingFinished')
                : t('mobile.inventory.transfersHeading')
            : lifecycle === 'semiFinished'
              ? t('mobile.inventory.countsHeadingSemi')
              : lifecycle === 'finished'
                ? t('mobile.inventory.countsHeadingFinished')
                : t('mobile.inventory.countsHeading')}
        </AppText>
      )}
    </View>
  );

  let empty: ReactElement | null = null;
  if (bodyLoading || bodyRetrying) {
    empty = <InventoryListSkeleton />;
  } else if (bodyError) {
    empty = (
      <ErrorState
        title={t('mobile.inventory.errorTitle')}
        description={t('mobile.inventory.errorBody')}
        retryLabel={t('mobile.inventory.retry')}
        onRetry={() => {
          void activeQuery.refetch();
        }}
      />
    );
  } else if (section === 'items') {
    empty = (
      <EmptyState
        title={
          lifecycle === 'semiFinished'
            ? t('mobile.inventory.emptySemiTitle')
            : lifecycle === 'finished'
              ? t('mobile.inventory.emptyFinishedTitle')
              : t('mobile.inventory.emptyMaterialsTitle')
        }
        description={
          lifecycle === 'finished'
            ? q.trim()
              ? t('lifecycle.noFinishedGoodsSearch', { query: q.trim() })
              : fgScope === 'history'
                ? t('mobile.inventory.fgHistoryEmpty')
                : fgFilter !== 'all'
                  ? t('lifecycle.noFinishedGoodsFilter')
                  : t('lifecycle.noFinishedGoods')
            : q
              ? t('mobile.inventory.emptySearchBody')
              : lifecycle === 'semiFinished'
                ? semiOrderFilter === 'active'
                  ? t('mobile.inventory.semiOrdersEmptyActive')
                  : t('mobile.inventory.semiOrdersEmptyHistory')
                : t('mobile.inventory.emptyCategoryBody', { group: groupLabel })
        }
      />
    );
  } else if (section === 'transfers') {
    empty = (
      <EmptyState
        title={t('mobile.inventory.emptyTransfersTitle')}
        description={
          q
            ? t('mobile.inventory.emptySearchBody')
            : lifecycle === 'semiFinished'
              ? t('mobile.inventory.emptyTransfersSemiBody')
              : lifecycle === 'finished'
                ? t('mobile.inventory.emptyTransfersFinishedBody')
                : t('mobile.inventory.emptyTransfersBody')
        }
      />
    );
  } else {
    empty = (
      <EmptyState
        title={t('mobile.inventory.emptyCountsTitle')}
        description={
          q
            ? t('mobile.inventory.emptySearchBody')
            : lifecycle === 'semiFinished'
              ? t('mobile.inventory.emptyCountsSemiBody')
              : lifecycle === 'finished'
                ? t('mobile.inventory.emptyCountsFinishedBody')
                : t('mobile.inventory.emptyCountsBody')
        }
      />
    );
  }

  const movePending =
    (move?.mode === 'receive' &&
      (receiveMutation.isPending || receivePoMutation.isPending)) ||
    (move?.mode === 'issue' && issueMutation.isPending);
  /** Same stack inset as order detail so the last card clears the floating pill. */
  const listBottomPad =
    theme.spacing['3xl'] +
    surfaceTabBarStackInset(insets.bottom, theme.spacing.sm) +
    theme.spacing['2xl'];

  return (
    <AppScreen>
      {showOfflineBanner ? <OfflineBanner /> : null}
      <FlatList
        ref={listRef}
        data={bodyLoading || bodyError ? [] : listRows}
        keyExtractor={(row) =>
          row.kind === 'semiOrder'
            ? `semiOrder-${row.model.productionOrderId}`
            : row.kind === 'finishedOrder'
              ? `finishedOrder-${row.model.salesOrderId}`
              : `${row.kind}-${row.model.id}`
        }
        contentContainerStyle={{
          gap: theme.spacing.md,
          paddingBottom: bodyLoading
            ? theme.spacing.md + surfaceTabBarStackInset(insets.bottom, theme.spacing.sm)
            : listBottomPad,
          flexGrow: 1,
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />
        }
        onEndReached={() => {
          if (
            'hasNextPage' in activeQuery &&
            activeQuery.hasNextPage &&
            !activeQuery.isFetchingNextPage
          ) {
            void activeQuery.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.4}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={
          'isFetchingNextPage' in activeQuery && activeQuery.isFetchingNextPage ? (
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
              onQrCode={() => setQrItem(qrItemFromCard(item.model))}
            />
          ) : item.kind === 'semiOrder' ? (
            <InventorySemiOrderGroupCard
              order={item.model}
              index={index}
              animateEnter={false}
              onPress={() => {
                router.push(
                  `/(app)/(admin)/inventory/semi/${item.model.productionOrderId}` as Href,
                );
              }}
            />
          ) : item.kind === 'finishedOrder' ? (
            <InventoryFinishedOrderCard
              order={item.model}
              index={index}
              animateEnter={false}
              onPress={() => {
                router.push(
                  `/(app)/(admin)/inventory/finished/${item.model.salesOrderId}` as Href,
                );
              }}
            />
          ) : item.kind === 'fgLot' ? (
            <InventoryFgLotRow
              lot={item.model}
              index={index}
              animateEnter={false}
              onPress={() => setInspectFgLot(item.model)}
            />
          ) : item.kind === 'fg' ? (
            <InventoryFinishedRow
              name={item.model.name}
              sku={item.model.sku}
              available={item.model.onHand}
              reserved={item.model.reservedQty}
              quarantined={item.model.quarantined}
              imageUrl={item.model.imageUrl}
              index={index}
              animateEnter={false}
              onPress={() =>
                router.push(
                  `/(app)/(admin)/inventory/items/${item.model.id}?lifecycle=finished` as Href,
                )
              }
            />
          ) : item.kind === 'transfer' ? (
            <InventoryTransferRow
              transfer={item.model}
              index={index}
              animateEnter={false}
              onComplete={
                canCreateTransfer &&
                item.model.status !== 'COMPLETED' &&
                item.model.status !== 'CANCELLED'
                  ? () =>
                      completeTransferMutation.mutate(item.model.id, {
                        onSuccess: () => {
                          void haptics.confirmMedium();
                          showToast({
                            variant: 'success',
                            message: t('mobile.inventory.transferCompleted'),
                          });
                        },
                        onError: () => {
                          void haptics.error();
                          showToast({
                            variant: 'error',
                            message: t('mobile.inventory.transferCompleteFailed'),
                          });
                        },
                      })
                  : undefined
              }
              completing={completeTransferMutation.isPending}
            />
          ) : (
            <InventoryStockCountRow
              count={item.model}
              index={index}
              animateEnter={false}
              onPost={
                canCreateCount && item.model.status !== 'POSTED'
                  ? () =>
                      postCountMutation.mutate(item.model.id, {
                        onSuccess: () => {
                          void haptics.confirmMedium();
                          showToast({
                            variant: 'success',
                            message: t('mobile.inventory.countPosted'),
                          });
                        },
                        onError: () => {
                          void haptics.error();
                          showToast({
                            variant: 'error',
                            message: t('mobile.inventory.countPostFailed'),
                          });
                        },
                      })
                  : undefined
              }
              posting={postCountMutation.isPending}
            />
          )
        }
      />

      <CreateWarehouseSheet
        open={createWarehouseOpen}
        onClose={() => setCreateWarehouseOpen(false)}
        defaultType={warehouseTypeForLifecycle(lifecycle)}
        onCreated={() => setCreateWarehouseOpen(false)}
      />

      <CreateInventoryItemSheet
        open={createItemOpen}
        onClose={() => setCreateItemOpen(false)}
        onClosed={openCreateSuccessIfNeeded}
        categoryGroup={categoryGroup}
        loading={createItemMutation.isPending}
        onSubmit={(body) => {
          createItemMutation.mutate(body, {
            onSuccess: (created) => {
              void haptics.confirmMedium();
              createdAfterSaveRef.current = created;
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

      <CreateTransferSheet
        open={(section === 'transfers' && createOpsOpen) || opsFromScan === 'transfer'}
        onClose={() => {
          setCreateOpsOpen(false);
          setOpsFromScan(null);
          setOpsItem(null);
        }}
        lifecycle={
          opsFromScan === 'transfer' && opsItem ? lifecycleFromItem(opsItem) : lifecycle
        }
        warehouses={
          opsFromScan === 'transfer' && opsItem
            ? warehousesForLifecycle(warehousesQuery.data ?? [], lifecycleFromItem(opsItem))
            : lifecycleWarehouses
        }
        initialItem={opsFromScan === 'transfer' ? opsItem : null}
        loading={createTransferMutation.isPending}
        onSubmit={(body) => {
          createTransferMutation.mutate(body, {
            onSuccess: () => {
              void haptics.confirmMedium();
              setCreateOpsOpen(false);
              setOpsFromScan(null);
              setOpsItem(null);
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

      <InventoryFinishedFilterSheet
        open={fgFilterSheetOpen}
        onClose={() => setFgFilterSheetOpen(false)}
        draft={fgFilterDraft}
        onChange={setFgFilterDraft}
        warehouses={lifecycleWarehouses}
        defaults={historyDefaults}
        onReset={() => {
          const next = defaultFinishedFilterDraft(historyDefaults);
          setFgFilterDraft(next);
          setFgScope(next.scope);
          setFgWarehouseId(next.warehouseId);
          setFgFilter(next.fgFilter);
          setFgHistoryFrom(next.historyFrom);
          setFgHistoryTo(next.historyTo);
          setFgFilterSheetOpen(false);
        }}
        onApply={() => {
          setFgScope(fgFilterDraft.scope);
          setFgWarehouseId(fgFilterDraft.warehouseId);
          setFgFilter(fgFilterDraft.fgFilter);
          setFgHistoryFrom(fgFilterDraft.historyFrom);
          setFgHistoryTo(fgFilterDraft.historyTo);
          setFgFilterSheetOpen(false);
        }}
      />

      <InventorySemiFilterSheet
        open={semiFilterSheetOpen}
        onClose={() => setSemiFilterSheetOpen(false)}
        draft={semiFilterDraft}
        onChange={setSemiFilterDraft}
        warehouses={lifecycleWarehouses}
        defaults={historyDefaults}
        onReset={() => {
          const next = defaultSemiFilterDraft(historyDefaults);
          setSemiFilterDraft(next);
          setSemiOrderFilter(next.scope);
          setSemiWarehouseId(next.warehouseId);
          setSemiHistoryFrom(next.historyFrom);
          setSemiHistoryTo(next.historyTo);
          setSemiFilterSheetOpen(false);
        }}
        onApply={() => {
          setSemiOrderFilter(semiFilterDraft.scope);
          setSemiWarehouseId(semiFilterDraft.warehouseId);
          setSemiHistoryFrom(semiFilterDraft.historyFrom);
          setSemiHistoryTo(semiFilterDraft.historyTo);
          setSemiFilterSheetOpen(false);
        }}
      />

      <CreateStockCountSheet
        open={(section === 'counts' && createOpsOpen) || opsFromScan === 'count'}
        onClose={() => {
          setCreateOpsOpen(false);
          setOpsFromScan(null);
          setOpsItem(null);
        }}
        lifecycle={opsFromScan === 'count' && opsItem ? lifecycleFromItem(opsItem) : lifecycle}
        warehouses={
          opsFromScan === 'count' && opsItem
            ? warehousesForLifecycle(warehousesQuery.data ?? [], lifecycleFromItem(opsItem))
            : lifecycleWarehouses
        }
        initialItem={opsFromScan === 'count' ? opsItem : null}
        loading={createCountMutation.isPending}
        onSubmit={(body) => {
          createCountMutation.mutate(body, {
            onSuccess: () => {
              void haptics.confirmMedium();
              setCreateOpsOpen(false);
              setOpsFromScan(null);
              setOpsItem(null);
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
      <InventoryScanResultSheet
        open={Boolean(scanResult)}
        item={scanResult}
        onClose={cancelScanResult}
        onClosed={flushAfterScanClosed}
        onScanAgain={() => queueAfterScan({ type: 'scanAgain' })}
        onReceive={(found) => queueAfterScan({ type: 'receive', item: found })}
        onIssue={(found) => queueAfterScan({ type: 'issue', item: found })}
        onTransfer={(found) => queueAfterScan({ type: 'transfer', item: found })}
        onCount={(found) => queueAfterScan({ type: 'count', item: found })}
        onViewDetails={(found) => queueAfterScan({ type: 'details', itemId: found.id })}
        onQrCode={(found) =>
          queueAfterScan({ type: 'qr', item: qrItemFromApi(found, locale) })
        }
        onOpenPurchaseOrder={(purchaseOrderId) =>
          queueAfterScan({ type: 'purchasing', purchaseOrderId })
        }
      />
      <ActionSheet
        open={createSuccessOpen}
        onClose={() => setCreateSuccessOpen(false)}
        title={t('mobile.inventory.itemCreated')}
        cancelLabel={t('mobile.inventory.done')}
        actions={[
          {
            label: t('mobile.inventory.viewQr'),
            icon: 'qr-code-outline',
            deferUntilClosed: true,
            onPress: () => {
              const created = createdAfterSaveRef.current;
              if (created) setQrItem(qrItemFromApi(created, locale));
            },
          },
          {
            label: t('mobile.inventory.printLabel'),
            icon: 'print-outline',
            deferUntilClosed: true,
            onPress: () => {
              const created = createdAfterSaveRef.current;
              if (created) openQrLabelPdf(qrItemFromApi(created, locale));
            },
          },
          {
            label: t('mobile.inventory.viewDetails'),
            icon: 'open-outline',
            deferUntilClosed: true,
            onPress: () => {
              const created = createdAfterSaveRef.current;
              if (created) {
                router.push(`/(app)/(admin)/inventory/items/${created.id}` as Href);
              }
            },
          },
        ]}
      />
      <InventoryQrSheet
        open={Boolean(qrItem)}
        item={qrItem}
        onClose={() => {
          setQrItem(null);
          lotQrKindRef.current = null;
        }}
        onClosed={flushPendingPrint}
        onPrint={
          qrItem
            ? () => {
                const lotKind = lotQrKindRef.current;
                lotQrKindRef.current = null;
                if (lotKind) {
                  printLabelAfterQrCloses(lotKind);
                  return;
                }
                printLabelAfterQrCloses(qrItem);
              }
            : undefined
        }
      />
      <InventorySemiOrderDetailSheet
        open={Boolean(inspectKitId)}
        kitId={inspectKitId}
        seed={inspectKitSeed}
        onClose={() => {
          setInspectKitId(null);
        }}
        onClosed={flushAfterSemiDetailClosed}
        onShowQr={(kit) => openKitQr(kit)}
        onPrintQr={(kit) => printKitQr(kit)}
      />
      <InventoryLotInspectSheet
        open={Boolean(inspectLot)}
        lot={inspectLot}
        onClose={() => setInspectLot(null)}
        onShowQr={
          inspectLot && lotScanPayload(inspectLot)
            ? (lot) => openLotQr(lot)
            : undefined
        }
        onPrintQr={
          inspectLot && lotScanPayload(inspectLot)
            ? (lot) => printLotQr(lot)
            : undefined
        }
      />
      <InventoryFgLotInspectSheet
        open={Boolean(inspectFgLot)}
        lot={inspectFgLot}
        onClose={() => setInspectFgLot(null)}
        canTransfer={canCreateTransfer}
        canCount={canCreateCount}
        canReport={canLabelPdf}
        onTransfer={(lot) => {
          void getInventoryItem(lot.inventoryItem.id).then((item) => {
            setLifecycle('finished');
            setOpsItem(item);
            setOpsFromScan('transfer');
          });
        }}
        onCount={(lot) => {
          void getInventoryItem(lot.inventoryItem.id).then((item) => {
            setLifecycle('finished');
            setOpsItem(item);
            setOpsFromScan('count');
          });
        }}
        onReport={(lot) => {
          void openInventoryLabelPdf(lot.inventoryItem.id, lot.inventoryItem.sku).catch(() => {
            showToast({
              variant: 'error',
              message: t('mobile.inventory.labelPdfFailedBody'),
            });
          });
        }}
      />
      {pdfDownloadSheet}
    </AppScreen>
  );
}
