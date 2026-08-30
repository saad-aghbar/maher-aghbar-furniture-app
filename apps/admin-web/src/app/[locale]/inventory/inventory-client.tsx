'use client';

import { useRouter } from '@/i18n/navigation';
import { apiFetch, apiUpload, API_URL, ApiClientError } from '@/lib/api-client';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import { useAuthMe } from '@/hooks/use-auth-me';
import { FinishedOrderBoard } from '@/components/admin/finished-order-board';
import { FinishedOrderDetail } from '@/components/admin/finished-order-detail';
import { InventoryItemThumb } from '@/components/admin/inventory-item-thumb';
import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { SemiOrderBoard, boardQueryFromSemiFilter } from '@/components/admin/semi-order-board';
import {
  boardParamsForFinishedScope,
  selectFinishedOrders,
  type FinishedBoardScope,
  type FinishedOrderGroup,
  type FgFilter,
} from '@/lib/select-finished-orders';
import type { SemiOrderFilter } from '@/lib/select-semi-orders';
import {
  Alert,
  Button,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  PageHero,
  Select,
  Skeleton,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableNumericCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  ImageSourceField,
} from '@maher/ui';
import { localizedName } from '@maher/i18n';
import { can } from '@maher/permissions';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Fragment, useEffect, useMemo, useState } from 'react';

interface Balance {
  availableQty: string | number;
  reservedQty?: string | number;
  onHandQty?: number;
  freeQty?: number;
  warehouseId?: string;
  warehouse?: { id: string; code: string; nameEn?: string; nameAr?: string };
}

interface Row {
  id: string;
  sku: string;
  barcode?: string | null;
  nameAr: string;
  nameEn: string;
  unit: string;
  category?: string | null;
  itemClass?: string | null;
  color?: string | null;
  materialType?: string | null;
  size?: string | null;
  preferredSupplierId?: string | null;
  imageUrl?: string | null;
  minStock?: string | number;
  standardCost?: string | number;
  balances?: Balance[];
  quarantinedQty?: number | string;
  onHandQty?: number;
  reservedQty?: number;
  freeQty?: number;
}

type OpenReceipt = {
  purchaseOrderId: string;
  purchaseOrderNumber: string;
  supplierName: string;
  orderedQty: number | string;
  receivedQty: number | string;
  remainingQty: number | string;
  unit: string;
  expectedDeliveryDate?: string | null;
  suggestedWarehouseId?: string | null;
  status: string;
};

interface SemiLot {
  id: string;
  quantity: string | number;
  producedAt: string;
  status: string;
  inventoryItem: {
    id: string;
    sku: string;
    nameEn: string;
    nameAr: string;
    product?: { imageUrl?: string | null } | null;
  };
  warehouse: Warehouse;
  productionOrder?: { id: string; number: string } | null;
  stageInstance?: {
    stageDefinition?: { nameEn: string; nameAr: string; nameHe?: string | null } | null;
  } | null;
  productNameEn?: string | null;
  productNameAr?: string | null;
  productionOrderNumber?: string | null;
  producingStageNameEn?: string | null;
  producingStageNameAr?: string | null;
  laterMovements?: Array<{
    type: string;
    quantity: number;
    createdAt: string;
    warehouseNameEn: string;
    warehouseNameAr: string;
  }>;
}

interface FinishedLot extends SemiLot {
  daysWaiting?: number;
  agingBucket?: string;
  salesOrderNumber?: string | null;
  salesOrder?: {
    id: string;
    number?: string;
    projectName?: string | null;
    deliveries?: Array<{ id: string; number?: string; status?: string }>;
  } | null;
  projectName?: string | null;
  dealerNameEn?: string | null;
  dealerNameAr?: string | null;
  dealerNameHe?: string | null;
  deliveryId?: string | null;
  deliveryStatus?: string | null;
  deliveryNumber?: string | null;
  deliveryDate?: string | null;
  qcStatus?: string | null;
  qcInspectedAt?: string | null;
  packagingComplete?: boolean;
  finishedAt?: string | Date | null;
  packagesPerUnit?: number;
  packageCount?: number;
  pieceLabels?: Array<{ nameEn: string; nameAr: string; nameHe?: string | null }>;
  packageSummary?: string | null;
  loadChecked?: number;
  loadTotal?: number;
  enteredAt?: string | null;
  leftAt?: string | null;
}

function isFgInspectLot(lot: SemiLot): lot is FinishedLot {
  return 'deliveryStatus' in lot || Boolean((lot as FinishedLot).salesOrderNumber);
}

interface Overview {
  rawMaterials: { itemCount: number; lowStockCount: number };
  semiFinished: { itemCount: number; totalQty: number };
  finishedGoods: {
    availableQty: number;
    reservedQty: number;
    readyForDeliveryQty: number;
    onHandQty?: number;
    freeQty?: number;
  };
}

interface Warehouse {
  id: string;
  code: string;
  nameEn: string;
  nameAr?: string;
  type?: string;
  locations?: Array<{ id: string; code: string; name?: string | null }>;
}

interface LowStockItem {
  id: string;
  sku: string;
  nameAr: string;
  nameEn: string;
  unit: string;
  minStock: string | number;
  availableQty: number;
  onHandQty?: number;
}

interface TransferLine {
  id: string;
  inventoryItemId: string;
  quantity: string | number;
}

interface Transfer {
  id: string;
  number: string;
  status: string;
  notes?: string | null;
  fromWarehouse: Warehouse;
  toWarehouse: Warehouse;
  lines: TransferLine[];
}

interface CountLine {
  id: string;
  inventoryItemId: string;
  systemQty: string | number;
  countedQty?: string | number | null;
  inventoryItem?: { sku: string; nameEn: string; nameAr: string };
}

interface StockCount {
  id: string;
  number: string;
  status: string;
  warehouseId: string;
  /** Optional reason/notes captured at create — required again at post if missing. */
  notes?: string | null;
  lines: CountLine[];
}

type Tab = 'items' | 'transfers' | 'counts';
type CategoryGroup = 'fabric' | 'foam' | 'wood' | 'accessories';

function defaultHistoryFrom(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

function defaultHistoryTo(): string {
  return new Date().toISOString().slice(0, 10);
}

const CATEGORY_TILES: Array<{ key: CategoryGroup; labelKey: string }> = [
  { key: 'fabric', labelKey: 'categoryFabric' },
  { key: 'foam', labelKey: 'categoryFoam' },
  { key: 'wood', labelKey: 'categoryWood' },
  { key: 'accessories', labelKey: 'categoryAccessories' },
];

const CATEGORY_FOR_CREATE: Record<CategoryGroup, string> = {
  fabric: 'FABRIC',
  foam: 'FOAM',
  wood: 'WOOD',
  accessories: 'METAL_ACCESSORY',
};

function warehouseTypeForItemClass(itemClass?: string | null, category?: string | null): string {
  const cls = (itemClass ?? '').toUpperCase();
  if (cls === 'SEMI_FINISHED_GOOD' || cls === 'SEMI_FINISHED') return 'SEMI_FINISHED';
  if (cls === 'FINISHED_GOOD' || cls === 'FINISHED_GOODS') return 'FINISHED_GOODS';
  if (cls === 'RAW_MATERIAL') return 'RAW_MATERIALS';
  const cat = (category ?? '').toUpperCase();
  if (cat === 'FINISHED' || cat === 'FINISHED_GOODS') return 'FINISHED_GOODS';
  if (cat === 'SEMI_FINISHED') return 'SEMI_FINISHED';
  return 'RAW_MATERIALS';
}

function warehouseMatchesLifecycleType(wh: Warehouse, required: string): boolean {
  const type = (wh.type ?? '').toUpperCase();
  const code = (wh.code ?? '').toUpperCase();
  if (required === 'RAW_MATERIALS') {
    return type === 'RAW_MATERIALS' || type === 'RAW' || code === 'RAW';
  }
  if (required === 'SEMI_FINISHED') {
    return type === 'SEMI_FINISHED' || type === 'SEMI' || code === 'SEMI';
  }
  if (required === 'FINISHED_GOODS') {
    return (
      type === 'FINISHED_GOODS' ||
      type === 'FINISHED' ||
      code === 'FIN' ||
      code === 'FINISHED'
    );
  }
  return type === required || code === required;
}

function warehousesForItem(
  list: Warehouse[],
  item?: Pick<Row, 'itemClass' | 'category'> | null,
): Warehouse[] {
  if (!item) return list;
  const required = warehouseTypeForItemClass(item.itemClass, item.category);
  return list.filter((wh) => warehouseMatchesLifecycleType(wh, required));
}

async function uploadInventorySkuPhoto(file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  const res = await apiUpload<{ downloadPath: string }>(
    '/api/v1/uploads?category=INVENTORY_IMAGE',
    form,
  );
  return `${API_URL}${res.downloadPath}`;
}

export default function InventoryPage() {
  const locale = useLocale();
  const t = useTranslations('navigation');
  const ti = useTranslations('inventory');
  const tc = useTranslations('catalog');
  const tl = useTranslations('lifecycle');
  const tCommon = useTranslations('common');
  const queryClient = useQueryClient();
  const me = useAuthMe();
  const canReceive = can(me.data, 'inventory.receive');
  const canIssue = can(me.data, 'inventory.issue');
  const canTransfer = can(me.data, 'inventory.transfer');
  const canCount = can(me.data, 'inventory.count');
  const canAdjust = can(me.data, 'inventory.adjust');
  const canRead = can(me.data, 'inventory.read');
  const canManageWarehouse = can(me.data, 'warehouse.manage');

  const [tab, setTab] = useState<Tab>('items');
  const [lifecycle, setLifecycle] = useState<'materials' | 'semiFinished' | 'finished'>('materials');
  const [semiFilter, setSemiFilter] = useState<SemiOrderFilter>('active');
  const [categoryGroup, setCategoryGroup] = useState<'fabric' | 'foam' | 'wood' | 'accessories'>('fabric');
  const router = useRouter();
  const [q, setQ] = useState('');
  const [fgSearch, setFgSearch] = useState('');
  const [fgFilter, setFgFilter] = useState<FgFilter>('all');
  const [fgScope, setFgScope] = useState<FinishedBoardScope>('inWarehouse');
  const [fgHistoryFrom, setFgHistoryFrom] = useState(defaultHistoryFrom);
  const [fgHistoryTo, setFgHistoryTo] = useState(defaultHistoryTo);
  const [fgWarehouseId, setFgWarehouseId] = useState('');
  const [fgPage, setFgPage] = useState(1);
  const [inspectFinishedOrder, setInspectFinishedOrder] = useState<FinishedOrderGroup | null>(null);
  const [page, setPage] = useState(1);
  const [banner, setBanner] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [moveOpen, setMoveOpen] = useState<'receive' | 'issue' | null>(null);
  const [selectedItem, setSelectedItem] = useState<Row | null>(null);
  const [warehouseId, setWarehouseId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const [transferOpen, setTransferOpen] = useState(false);
  const [fromWarehouseId, setFromWarehouseId] = useState('');
  const [toWarehouseId, setToWarehouseId] = useState('');
  const [transferItemId, setTransferItemId] = useState('');
  const [transferQty, setTransferQty] = useState('1');
  const [transferNotes, setTransferNotes] = useState('');
  const [transferPage, setTransferPage] = useState(1);

  const [countOpen, setCountOpen] = useState(false);
  const [countWarehouseId, setCountWarehouseId] = useState('');
  const [countNotes, setCountNotes] = useState('');
  const [countLines, setCountLines] = useState<Array<{ itemId: string; qty: string }>>([
    { itemId: '', qty: '' },
  ]);
  const [countPage, setCountPage] = useState(1);
  /** Confirm before posting a count (creates INVENTORY_ADJUSTMENT txs). */
  const [postCountConfirm, setPostCountConfirm] = useState<StockCount | null>(null);

  const [itemOpen, setItemOpen] = useState(false);
  const [itemSku, setItemSku] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [editItem, setEditItem] = useState<Row | null>(null);
  const [editNameEn, setEditNameEn] = useState('');
  const [editNameAr, setEditNameAr] = useState('');
  const [editMinStock, setEditMinStock] = useState('0');
  const [editStandardCost, setEditStandardCost] = useState('0');
  const [itemNameEn, setItemNameEn] = useState('');
  const [itemNameAr, setItemNameAr] = useState('');
  const [itemUnit, setItemUnit] = useState('pcs');
  const [itemMinStock, setItemMinStock] = useState('0');
  const [itemStandardCost, setItemStandardCost] = useState('0');
  const [itemBarcode, setItemBarcode] = useState('');
  const [itemColor, setItemColor] = useState('');
  const [itemMaterialType, setItemMaterialType] = useState('');
  const [itemSize, setItemSize] = useState('');
  const [itemSupplierId, setItemSupplierId] = useState('');
  const [editBarcode, setEditBarcode] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editMaterialType, setEditMaterialType] = useState('');
  const [editSize, setEditSize] = useState('');
  const [editSupplierId, setEditSupplierId] = useState('');
  const [itemImageUrl, setItemImageUrl] = useState('');
  const [editImageUrl, setEditImageUrl] = useState('');
  const [inspectLot, setInspectLot] = useState<SemiLot | null>(null);
  const [scanCode, setScanCode] = useState('');
  const [receiptKind, setReceiptKind] = useState<'po' | 'manual'>('po');
  const [selectedPoId, setSelectedPoId] = useState('');
  const [countKind, setCountKind] = useState<'periodic' | 'surprise'>('periodic');

  const listParams = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: '20' });
    if (q.trim()) params.set('q', q.trim());
    if (lifecycle === 'materials') params.set('categoryGroup', categoryGroup);
    if (lifecycle === 'semiFinished') params.set('itemClass', 'SEMI_FINISHED_GOOD');
    if (lifecycle === 'finished') params.set('itemClass', 'FINISHED_GOOD');
    return params.toString();
  }, [q, page, categoryGroup, lifecycle]);

  const itemsQuery = useQuery({
    queryKey: ['inventory-items', listParams],
    queryFn: () =>
      apiFetch<{ data: Row[]; meta: { page: number; totalPages: number } }>(
        `/api/v1/inventory/items?${listParams}`,
      ),
    placeholderData: keepPreviousData,
    enabled: tab === 'items' && lifecycle === 'materials',
  });

  const wipQuery = useQuery({
    queryKey: ['inventory-semi-finished', listParams],
    queryFn: () =>
      apiFetch<{ data: SemiLot[]; meta: { page: number; totalPages: number } }>(
        `/api/v1/inventory/semi-finished?${listParams}`,
      ),
    placeholderData: keepPreviousData,
    enabled: tab === 'items' && lifecycle === 'semiFinished',
  });

  const wipBoardQuery = useQuery({
    queryKey: ['inventory-wip-kit-board', semiFilter, q],
    queryFn: () => {
      const params = boardQueryFromSemiFilter(semiFilter, q);
      const qs = new URLSearchParams();
      if (params.scope) qs.set('scope', params.scope);
      if (params.q) qs.set('q', params.q);
      if (params.from) qs.set('from', params.from);
      if (params.to) qs.set('to', params.to);
      if (params.warehouseId) qs.set('warehouseId', params.warehouseId);
      const suffix = qs.toString() ? `?${qs}` : '';
      return apiFetch<{
        sections: Array<{
          stageCode: string;
          stageNameEn: string;
          stageNameAr: string;
          stageNameHe: string | null;
          kits: Array<{
            id: string;
            status: string;
            qrCode: string;
            expectedPieceCount: number;
            custody?: string | null;
            handoffCount?: number;
            materialOverageNotes?: string | null;
            location?: { id: string; code: string; name?: string | null } | null;
            claimedByUser?: { firstName: string; lastName: string } | null;
            productionOrder: {
              id: string;
              number: string;
              productDescription: string;
              product?: {
                nameEn: string;
                nameAr: string;
                nameHe?: string | null;
                sku?: string | null;
                imageUrl?: string | null;
              } | null;
              salesOrder?: {
                number: string;
                customer?: {
                  code?: string | null;
                  name?: string | null;
                  nameEn?: string | null;
                  nameAr?: string | null;
                } | null;
              } | null;
            };
            stageInstance: {
              stageDefinition: {
                code: string;
                nameEn: string;
                nameAr: string;
                nameHe?: string | null;
              };
            };
            pieces: Array<{ id: string; label: string | null; qrCode: string | null }>;
          }>;
        }>;
        totalKits: number;
      }>(`/api/v1/inventory/wip-kits/board${suffix}`);
    },
    enabled: tab === 'items' && lifecycle === 'semiFinished',
  });

  const wipStageBinsQuery = useQuery({
    queryKey: ['inventory-wip-stage-bins'],
    queryFn: () =>
      apiFetch<{
        warehouse: { id: string; code: string; nameEn: string; nameAr?: string } | null;
        locations: Array<{ id: string; code: string; name: string | null }>;
      }>('/api/v1/inventory/wip-kits/stage-bins'),
    enabled: tab === 'items' && lifecycle === 'semiFinished',
  });

  const [inspectKitId, setInspectKitId] = useState<string | null>(null);
  const [kitLocationId, setKitLocationId] = useState('');
  const inspectKitQuery = useQuery({
    queryKey: ['inventory-wip-kit', inspectKitId],
    queryFn: () =>
      apiFetch<{
        id: string;
        status: string;
        qrCode: string;
        expectedPieceCount: number;
        materialOverageNotes?: string | null;
        locationId?: string | null;
        location?: { id: string; code: string; name?: string | null } | null;
        productionOrder?: { number?: string };
        pieces?: Array<{ id: string; label?: string | null; qrCode?: string | null }>;
      }>(`/api/v1/inventory/wip-kits/${inspectKitId}`),
    enabled: Boolean(inspectKitId),
  });

  useEffect(() => {
    if (inspectKitQuery.data) {
      setKitLocationId(inspectKitQuery.data.locationId ?? inspectKitQuery.data.location?.id ?? '');
    }
  }, [inspectKitQuery.data]);

  const finishedLotsParams = useMemo(() => {
    const board = boardParamsForFinishedScope(fgScope, {
      q: fgSearch.trim() || undefined,
      warehouseId: fgWarehouseId || undefined,
      from: fgScope === 'history' ? fgHistoryFrom || undefined : undefined,
      to: fgScope === 'history' ? fgHistoryTo || undefined : undefined,
    });
    const params = new URLSearchParams({
      page: String(fgPage),
      pageSize: '100',
      scope: board.scope,
    });
    if (board.q) params.set('q', board.q);
    if (board.warehouseId) params.set('warehouseId', board.warehouseId);
    if (board.from) params.set('from', board.from);
    if (board.to) params.set('to', board.to);
    return params.toString();
  }, [fgScope, fgSearch, fgWarehouseId, fgHistoryFrom, fgHistoryTo, fgPage]);

  const finishedLotsQuery = useQuery({
    queryKey: ['inventory-finished-lots', finishedLotsParams],
    queryFn: () =>
      apiFetch<{
        data: FinishedLot[];
        meta: { page: number; totalPages: number; totalItems: number };
      }>(`/api/v1/inventory/finished-lots?${finishedLotsParams}`),
    placeholderData: keepPreviousData,
    enabled: tab === 'items' && lifecycle === 'finished',
  });

  const overviewQuery = useQuery({
    queryKey: ['inventory-overview'],
    queryFn: () => apiFetch<Overview>('/api/v1/inventory/overview'),
    staleTime: 30_000,
  });

  const itemOptionsQuery = useQuery({
    queryKey: ['inventory-items-options'],
    queryFn: () =>
      apiFetch<{ data: Row[] }>('/api/v1/inventory/items?pageSize=100').then((r) => r.data),
    enabled: transferOpen || countOpen,
  });

  const warehousesQuery = useQuery({
    queryKey: ['inventory-warehouses'],
    queryFn: () => apiFetch<Warehouse[]>('/api/v1/inventory/warehouses'),
  });

  const openReceiptsQuery = useQuery({
    queryKey: ['inventory-open-receipts', selectedItem?.id],
    queryFn: () =>
      apiFetch<OpenReceipt[]>(
        `/api/v1/inventory/items/${selectedItem!.id}/open-receipts`,
      ),
    enabled: moveOpen === 'receive' && Boolean(selectedItem?.id) && canReceive,
  });
  const openReceipts = openReceiptsQuery.data ?? [];
  const receiptKey = `${selectedItem?.id ?? ''}:${openReceipts.map((row) => row.purchaseOrderId).join(',')}`;

  useEffect(() => {
    if (moveOpen !== 'receive') return;
    if (openReceipts.length === 1) {
      const only = openReceipts[0]!;
      setSelectedPoId(only.purchaseOrderId);
      setReceiptKind('po');
      if (only.suggestedWarehouseId) {
        setWarehouseId(only.suggestedWarehouseId);
      }
    } else if (openReceipts.length === 0) {
      setSelectedPoId('');
      setReceiptKind('manual');
    } else {
      setSelectedPoId('');
      setReceiptKind('po');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- receiptKey
  }, [moveOpen, receiptKey]);

  const suppliersQuery = useQuery({
    queryKey: ['suppliers-pick-inv'],
    queryFn: () =>
      apiFetch<{ data: Array<{ id: string; name: string; nameAr?: string; nameEn?: string }> }>(
        '/api/v1/suppliers?pageSize=100',
      ).then((r) => r.data),
  });

  const lowStockQuery = useQuery({
    queryKey: ['inventory-low-stock'],
    queryFn: () => apiFetch<LowStockItem[]>('/api/v1/inventory/low-stock'),
  });

  const transfersQuery = useQuery({
    queryKey: ['inventory-transfers', transferPage],
    queryFn: () =>
      apiFetch<{ data: Transfer[]; meta: { page: number; totalPages: number } }>(
        `/api/v1/inventory/transfers?page=${transferPage}&pageSize=20`,
      ),
    enabled: tab === 'transfers',
  });

  const countsQuery = useQuery({
    queryKey: ['inventory-counts', countPage],
    queryFn: () =>
      apiFetch<{ data: StockCount[]; meta: { page: number; totalPages: number } }>(
        `/api/v1/inventory/counts?page=${countPage}&pageSize=20`,
      ),
    enabled: tab === 'counts',
  });

  const createItemMutation = useMutation({
    mutationFn: async () => {
      if (!itemSku.trim() || !itemNameEn.trim() || !itemNameAr.trim()) {
        throw new ApiClientError(tCommon('required'), 400);
      }
      return apiFetch('/api/v1/inventory/items', {
        method: 'POST',
        body: JSON.stringify({
          sku: itemSku.trim(),
          nameEn: itemNameEn.trim(),
          nameAr: itemNameAr.trim(),
          unit: itemUnit.trim() || 'pcs',
          minStock: Number(itemMinStock) || 0,
          standardCost: Number(itemStandardCost) || 0,
          barcode: itemBarcode.trim() || undefined,
          color: itemColor.trim() || undefined,
          materialType: itemMaterialType.trim() || undefined,
          size: itemSize.trim() || undefined,
          preferredSupplierId: itemSupplierId || undefined,
          category: CATEGORY_FOR_CREATE[categoryGroup],
          imageUrl: itemImageUrl.trim() || undefined,
        }),
      });
    },
    onSuccess: async () => {
      setItemOpen(false);
      setBanner(ti('itemCreated'));
      await queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      await queryClient.invalidateQueries({ queryKey: ['inventory-low-stock'] });
      await queryClient.invalidateQueries({ queryKey: ['inventory-overview'] });
      await queryClient.invalidateQueries({ queryKey: ['inventory-semi-finished'] });
    },
    onError: (err) => setFormError(mutationErrorMessage(err)),
  });

  const syncMaterialsMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ created: number }>('/api/v1/inventory/items/sync-from-materials', {
        method: 'POST',
      }),
    onSuccess: async (res) => {
      setBanner(`${ti('materialsSynced')} (${res.created})`);
      await queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      await queryClient.invalidateQueries({ queryKey: ['inventory-low-stock'] });
      await queryClient.invalidateQueries({ queryKey: ['inventory-overview'] });
      await queryClient.invalidateQueries({ queryKey: ['inventory-semi-finished'] });
    },
    onError: (err) => setActionError(mutationErrorMessage(err)),
  });

  const updateItemMutation = useMutation({
    mutationFn: async () => {
      if (!editItem) return;
      return apiFetch(`/api/v1/inventory/items/${editItem.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          nameEn: editNameEn.trim(),
          nameAr: editNameAr.trim(),
          minStock: Number(editMinStock) || 0,
          standardCost: Number(editStandardCost) || 0,
          barcode: editBarcode.trim() || undefined,
          color: editColor.trim() || undefined,
          materialType: editMaterialType.trim() || undefined,
          size: editSize.trim() || undefined,
          preferredSupplierId: editSupplierId || null,
          imageUrl: editImageUrl.trim() || null,
        }),
      });
    },
    onSuccess: async () => {
      setEditOpen(false);
      setBanner(tCommon('saved'));
      await queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
    },
    onError: (err) => setFormError(mutationErrorMessage(err)),
  });

  const orderMaterialsMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ id: string }>('/api/v1/purchase-requests/from-low-stock', { method: 'POST' }),
    onSuccess: async (created) => {
      setActionError(null);
      setBanner(ti('orderMaterialsCreated'));
      await queryClient.invalidateQueries({ queryKey: ['purchase-requests'] });
      await queryClient.invalidateQueries({ queryKey: ['inventory-low-stock'] });
      if (created?.id) router.push(`/purchasing/requests/${created.id}`);
    },
    onError: (err) => setActionError(mutationErrorMessage(err)),
  });

  const moveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedItem || !warehouseId || !Number(quantity)) {
        throw new ApiClientError(ti('moveRequired'), 400);
      }
      if (moveOpen === 'receive' && openReceipts.length > 0 && receiptKind !== 'manual') {
        if (!selectedPoId) {
          throw new ApiClientError(ti('choosePurchaseOrder'), 400);
        }
        const selectedPo = openReceipts.find((row) => row.purchaseOrderId === selectedPoId);
        return apiFetch(`/api/v1/purchase-orders/${selectedPoId}/goods-receipts`, {
          method: 'POST',
          body: JSON.stringify({
            warehouseId,
            notes: notes.trim() || undefined,
            lines: [
              {
                inventoryItemId: selectedItem.id,
                orderedQty: Number(selectedPo?.orderedQty ?? quantity),
                receivedQty: Number(quantity),
              },
            ],
          }),
        });
      }
      const path = moveOpen === 'receive' ? '/api/v1/inventory/receipts' : '/api/v1/inventory/issues';
      return apiFetch(path, {
        method: 'POST',
        body: JSON.stringify({
          inventoryItemId: selectedItem.id,
          warehouseId,
          quantity: Number(quantity),
          notes: notes.trim() || undefined,
        }),
      });
    },
    onSuccess: async () => {
      setFormError(null);
      const kind = moveOpen;
      await queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      await queryClient.invalidateQueries({ queryKey: ['inventory-low-stock'] });
      await queryClient.invalidateQueries({ queryKey: ['inventory-overview'] });
      await queryClient.invalidateQueries({ queryKey: ['inventory-semi-finished'] });
      await queryClient.invalidateQueries({ queryKey: ['inventory-open-receipts'] });
      await queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      setMoveOpen(null);
      setBanner(kind === 'receive' ? ti('stockReceived') : ti('stockIssued'));
    },
    onError: (err) => setFormError(mutationErrorMessage(err)),
  });

  const createTransferMutation = useMutation({
    mutationFn: async () => {
      if (!fromWarehouseId || !toWarehouseId || !transferItemId || !Number(transferQty)) {
        throw new ApiClientError(ti('transferRequired'), 400);
      }
      return apiFetch('/api/v1/inventory/transfers', {
        method: 'POST',
        body: JSON.stringify({
          fromWarehouseId,
          toWarehouseId,
          notes: transferNotes.trim() || undefined,
          lines: [{ inventoryItemId: transferItemId, quantity: Number(transferQty) }],
        }),
      });
    },
    onSuccess: async () => {
      setFormError(null);
      setTransferOpen(false);
      setBanner(ti('transferCreated'));
      await queryClient.invalidateQueries({ queryKey: ['inventory-transfers'] });
    },
    onError: (err) => setFormError(mutationErrorMessage(err)),
  });

  const completeTransferMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/v1/inventory/transfers/${id}/complete`, { method: 'POST' }),
    onSuccess: async () => {
      setActionError(null);
      setBanner(ti('transferCompleted'));
      await queryClient.invalidateQueries({ queryKey: ['inventory-transfers'] });
      await queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      await queryClient.invalidateQueries({ queryKey: ['inventory-low-stock'] });
      await queryClient.invalidateQueries({ queryKey: ['inventory-overview'] });
      await queryClient.invalidateQueries({ queryKey: ['inventory-semi-finished'] });
    },
    onError: (err) => setActionError(mutationErrorMessage(err)),
  });

  const createCountMutation = useMutation({
    mutationFn: async () => {
      const lines = countLines
        .filter((l) => l.itemId && l.qty.trim())
        .map((l) => ({
          inventoryItemId: l.itemId,
          countedQty: Number(l.qty),
        }));
      if (!countWarehouseId || lines.length === 0) {
        throw new ApiClientError(ti('countRequired'), 400);
      }
      const reason = countNotes.trim();
      if (!reason) {
        throw new ApiClientError(ti('countReasonRequired'), 400);
      }
      return apiFetch('/api/v1/inventory/counts', {
        method: 'POST',
        body: JSON.stringify({
          warehouseId: countWarehouseId,
          notes: [countKind === 'surprise' ? 'SURPRISE' : 'PERIODIC', reason]
            .filter(Boolean)
            .join(' — '),
          lines,
        }),
      });
    },
    onSuccess: async () => {
      setFormError(null);
      setCountOpen(false);
      setBanner(ti('countCreated'));
      await queryClient.invalidateQueries({ queryKey: ['inventory-counts'] });
    },
    onError: (err) => setFormError(mutationErrorMessage(err)),
  });

  const postCountMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/v1/inventory/counts/${id}/post`, { method: 'POST' }),
    onSuccess: async () => {
      setActionError(null);
      setPostCountConfirm(null);
      setBanner(ti('countPosted'));
      await queryClient.invalidateQueries({ queryKey: ['inventory-counts'] });
      await queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      await queryClient.invalidateQueries({ queryKey: ['inventory-low-stock'] });
      await queryClient.invalidateQueries({ queryKey: ['inventory-overview'] });
      await queryClient.invalidateQueries({ queryKey: ['inventory-semi-finished'] });
    },
    onError: (err) => setActionError(mutationErrorMessage(err)),
  });

  const ensureWipBinsMutation = useMutation({
    mutationFn: () => apiFetch('/api/v1/inventory/wip-kits/ensure-stage-bins', { method: 'POST' }),
    onSuccess: async () => {
      setBanner(ti('wipBinsReady'));
      setActionError(null);
      await queryClient.invalidateQueries({ queryKey: ['inventory-wip-stage-bins'] });
      await queryClient.invalidateQueries({ queryKey: ['inventory-warehouses'] });
    },
    onError: (err) => setActionError(mutationErrorMessage(err)),
  });

  const setWipKitLocationMutation = useMutation({
    mutationFn: (vars: { kitId: string; locationId: string | null }) =>
      apiFetch(`/api/v1/inventory/wip-kits/${vars.kitId}/location`, {
        method: 'PATCH',
        body: JSON.stringify({ locationId: vars.locationId }),
      }),
    onSuccess: async () => {
      setBanner(ti('wipLocationSaved'));
      setActionError(null);
      await queryClient.invalidateQueries({ queryKey: ['inventory-wip-kit', inspectKitId] });
      await queryClient.invalidateQueries({ queryKey: ['inventory-wip-kit-board'] });
    },
    onError: (err) => setActionError(mutationErrorMessage(err)),
  });

  const itemsBusy =
    tab === 'items' &&
    (lifecycle === 'semiFinished'
      ? wipQuery.isLoading && !wipQuery.data
      : lifecycle === 'finished'
        ? finishedLotsQuery.isLoading && !finishedLotsQuery.data
        : itemsQuery.isLoading && !itemsQuery.data);
  const itemsFailed =
    tab === 'items' &&
    (lifecycle === 'semiFinished'
      ? wipQuery.isError && !wipQuery.data
      : lifecycle === 'finished'
        ? finishedLotsQuery.isError && !finishedLotsQuery.data
        : itemsQuery.isError && !itemsQuery.data);

  const finishedLotsRaw = finishedLotsQuery.data?.data ?? [];
  const finishedMeta = finishedLotsQuery.data?.meta;
  const fgTotalPages = Math.max(1, finishedMeta?.totalPages ?? 1);
  const fgSafePage = Math.min(fgPage, fgTotalPages);
  const finishedBoardOrders = useMemo(
    () =>
      selectFinishedOrders(finishedLotsRaw, {
        fgFilter,
        scope: fgScope,
      }),
    [finishedLotsRaw, fgFilter, fgScope],
  );
  /** Lots for secondary drill-in — only lots in the current board groups. */
  const finishedLots = useMemo(() => {
    const ids = new Set(finishedBoardOrders.flatMap((g) => g.lots.map((l) => l.id)));
    return finishedLotsRaw.filter((lot) => ids.has(lot.id));
  }, [finishedLotsRaw, finishedBoardOrders]);

  if (itemsBusy) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (itemsFailed) {
    return (
      <ErrorState
        title={t('inventory')}
        onRetry={() =>
          lifecycle === 'semiFinished'
            ? wipQuery.refetch()
            : lifecycle === 'finished'
              ? finishedLotsQuery.refetch()
              : itemsQuery.refetch()
        }
        retryLabel={tCommon('retry')}
      />
    );
  }

  const rows = itemsQuery.data?.data ?? [];
  const meta =
    lifecycle === 'semiFinished'
      ? wipQuery.data?.meta
      : lifecycle === 'finished'
        ? finishedMeta
          ? { page: finishedMeta.page, totalPages: finishedMeta.totalPages }
          : { page: fgSafePage, totalPages: fgTotalPages }
        : itemsQuery.data?.meta;
  const wipLots = wipQuery.data?.data ?? [];
  const overview = overviewQuery.data;
  const warehouses = warehousesQuery.data ?? [];
  const lowStock = lowStockQuery.data ?? [];
  const transfers = transfersQuery.data?.data ?? [];
  const transferMeta = transfersQuery.data?.meta;
  const itemOptions = itemOptionsQuery.data ?? rows;
  const moveWarehouses = warehousesForItem(warehouses, selectedItem);

  function openMove(kind: 'receive' | 'issue', row: Row) {
    setSelectedItem(row);
    setWarehouseId(warehousesForItem(warehouses, row)[0]?.id ?? '');
    setQuantity('1');
    setNotes('');
    setScanCode('');
    setFormError(null);
    setReceiptKind('po');
    setSelectedPoId('');
    setMoveOpen(kind);
  }

  function openTransfer() {
    setFromWarehouseId(warehouses[0]?.id ?? '');
    setToWarehouseId(warehouses[1]?.id ?? warehouses[0]?.id ?? '');
    setTransferItemId('');
    setTransferQty('1');
    setTransferNotes('');
    setFormError(null);
    setTransferOpen(true);
  }

  return (
    <div className="space-y-6">
      <PageHero
        title={t('inventory')}
        tone="soft"
        actions={
          tab === 'transfers' && canTransfer ? (
            <Button size="sm" onClick={openTransfer}>
              {ti('newTransfer')}
            </Button>
          ) : tab === 'counts' && canCount ? (
            <Button
              size="sm"
              onClick={() => {
                setCountWarehouseId(warehouses[0]?.id ?? '');
                setCountNotes('');
                setCountLines([{ itemId: '', qty: '' }]);
                setFormError(null);
                setCountOpen(true);
              }}
            >
              {ti('newCount')}
            </Button>
          ) : tab === 'items' && lifecycle === 'materials' && canAdjust ? (
            <Button
              size="sm"
              variant="secondary"
              loading={syncMaterialsMutation.isPending}
              onClick={() => syncMaterialsMutation.mutate()}
            >
              {ti('syncFromMaterials')}
            </Button>
          ) : null
        }
      />
      {banner ? <Alert variant="success">{banner}</Alert> : null}
      {actionError ? <Alert variant="error">{actionError}</Alert> : null}

      {overview ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-[var(--maher-radius-md)] border border-border bg-surface p-4">
            <p className="text-xs text-text-secondary">{ti('overviewRaw')}</p>
            <p className="mt-1 text-lg font-semibold text-text-primary" dir="ltr">
              {overview.rawMaterials.itemCount}
            </p>
            {overview.rawMaterials.lowStockCount > 0 ? (
              <p className="text-xs text-amber-700">
                {ti('lowStock')}: {overview.rawMaterials.lowStockCount}
              </p>
            ) : null}
          </div>
          <div className="rounded-[var(--maher-radius-md)] border border-border bg-surface p-4">
            <p className="text-xs text-text-secondary">{ti('overviewSemi')}</p>
            <p className="mt-1 text-lg font-semibold text-text-primary" dir="ltr">
              {overview.semiFinished.itemCount}
            </p>
            <p className="text-xs text-text-secondary" dir="ltr">
              {overview.semiFinished.totalQty}
            </p>
          </div>
          <div className="rounded-[var(--maher-radius-md)] border border-border bg-surface p-4">
            <p className="text-xs text-text-secondary">{ti('overviewFinished')}</p>
            <p className="mt-1 text-lg font-semibold text-text-primary" dir="ltr">
              {overview.finishedGoods.onHandQty ?? overview.finishedGoods.availableQty}
            </p>
            <p className="text-xs text-text-secondary">
              {ti('reserved')} {overview.finishedGoods.reservedQty} · {ti('available')}{' '}
              {overview.finishedGoods.freeQty ?? overview.finishedGoods.readyForDeliveryQty}
            </p>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={tab === 'items' ? 'primary' : 'subtle'}
          onClick={() => setTab('items')}
        >
          {ti('items')}
        </Button>
        {canTransfer || canReceive ? (
          <Button
            size="sm"
            variant={tab === 'transfers' ? 'primary' : 'subtle'}
            onClick={() => setTab('transfers')}
          >
            {ti('transfers')}
          </Button>
        ) : null}
        {canCount ? (
          <Button
            size="sm"
            variant={tab === 'counts' ? 'primary' : 'subtle'}
            onClick={() => setTab('counts')}
          >
            {ti('counts')}
          </Button>
        ) : null}
      </div>

      {tab === 'items' ? (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={lifecycle === 'materials' ? 'primary' : 'subtle'}
            onClick={() => {
              setLifecycle('materials');
              setPage(1);
            }}
          >
            {ti('lifecycleMaterials')}
          </Button>
          <Button
            size="sm"
            variant={lifecycle === 'semiFinished' ? 'primary' : 'subtle'}
            onClick={() => {
              setLifecycle('semiFinished');
              setPage(1);
            }}
          >
            {ti('lifecycleSemi')}
          </Button>
          <Button
            size="sm"
            variant={lifecycle === 'finished' ? 'primary' : 'subtle'}
            onClick={() => {
              setLifecycle('finished');
              setPage(1);
              setFgPage(1);
              setFgSearch('');
              setFgFilter('all');
              setFgScope('inWarehouse');
              setFgWarehouseId('');
            }}
          >
            {ti('lifecycleFinished')}
          </Button>
        </div>
      ) : null}

      {tab === 'items' ? (
        <>
          {lifecycle === 'materials' ? (
            <>
          <div className="maher-stagger grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {CATEGORY_TILES.map((tile) => (
              <button
                key={tile.key}
                type="button"
                onClick={() => {
                  setCategoryGroup(tile.key);
                  setPage(1);
                }}
                className={`maher-list-card rounded-[var(--maher-radius-lg)] border p-4 text-start shadow-card transition-all hover:shadow-elevated ${
                  categoryGroup === tile.key
                    ? 'border-brand bg-brand/5'
                    : 'border-border bg-surface'
                }`}
              >
                <p className="font-semibold text-text-primary">{ti(tile.labelKey as 'categoryFabric')}</p>
                <p className="mt-1 text-xs text-text-secondary">{ti('categoryTileHint')}</p>
              </button>
            ))}
          </div>

          {lowStock.length > 0 ? (
            <div className="space-y-2 rounded-[var(--maher-radius-md)] border border-border border-s-4 border-s-amber-600 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <h2 className="text-sm font-semibold text-text-primary">{ti('lowStock')}</h2>
                  <p className="text-sm text-text-secondary">{ti('lowStockHint')}</p>
                </div>
                <Button
                  size="sm"
                  className="shrink-0"
                  loading={orderMaterialsMutation.isPending}
                  onClick={() => {
                    setActionError(null);
                    orderMaterialsMutation.mutate();
                  }}
                >
                  {ti('orderMaterials')}
                </Button>
              </div>
              <ul className="divide-y divide-border">
                {lowStock.slice(0, 8).map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
                  >
                    <span>
                      <span className="font-medium">{item.sku}</span>
                      {' — '}
                      {localizedName(locale, item)}
                    </span>
                    <span className="text-text-secondary" dir="ltr">
                      {item.onHandQty ?? item.availableQty} / {Number(item.minStock)} {item.unit}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
            </>
          ) : null}

          <div className="flex flex-wrap items-end gap-3">
            <label className="relative min-w-[220px] flex-1">
              <Input
                withSearchIcon
                value={lifecycle === 'finished' ? fgSearch : q}
                onChange={(e) => {
                  if (lifecycle === 'finished') {
                    setFgPage(1);
                    setFgSearch(e.target.value);
                  } else {
                    setPage(1);
                    setQ(e.target.value);
                  }
                }}
                placeholder={
                  lifecycle === 'finished' ? tl('searchOrders') : ti('searchPlaceholder')
                }
              />
            </label>
            {lifecycle === 'materials' && canAdjust ? (
            <Button
              size="sm"
              onClick={() => {
                setItemSku('');
                setItemNameEn('');
                setItemNameAr('');
                setItemUnit('pcs');
                setItemMinStock('0');
                setItemStandardCost('0');
                setItemBarcode('');
                setItemColor('');
                setItemMaterialType('');
                setItemSize('');
                setItemSupplierId('');
                setItemImageUrl('');
                setFormError(null);
                setItemOpen(true);
              }}
            >
              {ti('newItem')}
            </Button>
            ) : null}
          </div>

          {lifecycle === 'semiFinished' ? (
            <>
              <SemiOrderBoard
                sections={wipBoardQuery.data?.sections ?? []}
                filter={semiFilter}
                search={q}
                onFilterChange={(f) => setSemiFilter(f)}
                onInspectKit={(id) => setInspectKitId(id)}
                ensureBinsSlot={
                  canManageWarehouse ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      loading={ensureWipBinsMutation.isPending}
                      onClick={() => ensureWipBinsMutation.mutate()}
                    >
                      {ti('wipEnsureBins')}
                    </Button>
                  ) : null
                }
              />
            {wipLots.length === 0 && !(wipBoardQuery.data?.totalKits) ? (
              <EmptyState title={ti('emptySemi')} />
            ) : wipLots.length === 0 ? null : (
              <>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-tertiary">
                  {ti('semiLotsSecondary')}
                </p>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeaderCell>{ti('sku')}</TableHeaderCell>
                      <TableHeaderCell>{tc('name')}</TableHeaderCell>
                      <TableHeaderCell>{ti('productionOrder')}</TableHeaderCell>
                      <TableHeaderCell>{ti('stage')}</TableHeaderCell>
                      <TableHeaderCell>{ti('lotQty')}</TableHeaderCell>
                      <TableHeaderCell>{ti('warehouse')}</TableHeaderCell>
                      <TableHeaderCell>{tCommon('status')}</TableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {wipLots.map((lot) => (
                      <TableRow key={lot.id} className="cursor-pointer" onClick={() => setInspectLot(lot)}>
                        <TableCell>{lot.inventoryItem.sku}</TableCell>
                        <TableCell>{localizedName(locale, lot.inventoryItem)}</TableCell>
                        <TableCell>{lot.productionOrder?.number ?? '—'}</TableCell>
                        <TableCell>
                          {lot.stageInstance?.stageDefinition
                            ? localizedName(locale, lot.stageInstance.stageDefinition)
                            : '—'}
                        </TableCell>
                        <TableCell dir="ltr">{Number(lot.quantity)}</TableCell>
                        <TableCell>
                          {lot.warehouse.code} — {localizedName(locale, lot.warehouse)}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={lot.status} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {meta && meta.totalPages > 1 ? (
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      {tCommon('previous')}
                    </Button>
                    <span className="text-sm text-text-secondary" dir="ltr">
                      {page} / {meta.totalPages}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={page >= meta.totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      {tCommon('next')}
                    </Button>
                  </div>
                ) : null}
              </>
            )}
            </>
          ) : lifecycle === 'finished' ? (
            <>
              <FinishedOrderBoard
                lots={finishedLotsRaw}
                scope={fgScope}
                filter={fgFilter}
                search={fgSearch}
                serverTotalLots={finishedMeta?.totalItems}
                onScopeChange={(s) => {
                  setFgScope(s);
                  setFgPage(1);
                  setFgFilter('all');
                }}
                onFilterChange={(f) => {
                  setFgFilter(f);
                }}
                onOpenOrder={(order) => setInspectFinishedOrder(order)}
                historyFrom={fgHistoryFrom}
                historyTo={fgHistoryTo}
                onHistoryFromChange={(v) => {
                  setFgHistoryFrom(v);
                  setFgPage(1);
                }}
                onHistoryToChange={(v) => {
                  setFgHistoryTo(v);
                  setFgPage(1);
                }}
                warehouseId={fgWarehouseId}
                warehouses={warehouses.filter((wh) =>
                  warehouseMatchesLifecycleType(wh, 'FINISHED_GOODS'),
                )}
                onWarehouseChange={(id) => {
                  setFgWarehouseId(id);
                  setFgPage(1);
                }}
              />
              {finishedLots.length === 0 ? null : (
                <>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-tertiary">
                    {ti('finishedLotsSecondary')}
                  </p>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableHeaderCell className="w-12">{ti('itemPhoto')}</TableHeaderCell>
                        <TableHeaderCell>{ti('sku')}</TableHeaderCell>
                        <TableHeaderCell>{tc('name')}</TableHeaderCell>
                        <TableHeaderCell>{ti('salesOrder')}</TableHeaderCell>
                        <TableHeaderCell>{ti('lotQty')}</TableHeaderCell>
                        <TableHeaderCell>{ti('warehouse')}</TableHeaderCell>
                        <TableHeaderCell>{tCommon('status')}</TableHeaderCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {finishedLots.map((lot) => (
                        <TableRow
                          key={lot.id}
                          className="cursor-pointer"
                          onClick={() => setInspectLot(lot)}
                        >
                          <TableCell>
                            <InventoryItemThumb
                              src={lot.inventoryItem.product?.imageUrl}
                              alt={localizedName(locale, lot.inventoryItem)}
                            />
                          </TableCell>
                          <TableCell>{lot.inventoryItem.sku}</TableCell>
                          <TableCell>{localizedName(locale, lot.inventoryItem)}</TableCell>
                          <TableCell dir="ltr">{lot.salesOrderNumber ?? '—'}</TableCell>
                          <TableCell dir="ltr">{Number(lot.quantity)}</TableCell>
                          <TableCell>
                            {lot.warehouse.code} — {localizedName(locale, lot.warehouse)}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={lot.status} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {fgTotalPages > 1 ? (
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={fgSafePage <= 1}
                        onClick={() => setFgPage((p) => Math.max(1, p - 1))}
                      >
                        {tCommon('previous')}
                      </Button>
                      <span className="text-sm text-text-secondary" dir="ltr">
                        {fgSafePage} / {fgTotalPages}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={fgSafePage >= fgTotalPages}
                        onClick={() => setFgPage((p) => p + 1)}
                      >
                        {tCommon('next')}
                      </Button>
                    </div>
                  ) : null}
                </>
              )}
              <FinishedOrderDetail
                order={inspectFinishedOrder}
                open={Boolean(inspectFinishedOrder)}
                onClose={() => setInspectFinishedOrder(null)}
              />
            </>
          ) : rows.length === 0 ? (
            <EmptyState title={ti('empty')} />
          ) : (
            <>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeaderCell className="w-8" />
                    {lifecycle === 'materials' ? (
                      <TableHeaderCell className="w-12">{ti('itemPhoto')}</TableHeaderCell>
                    ) : null}
                    <TableHeaderCell>{ti('sku')}</TableHeaderCell>
                    <TableHeaderCell>{tc('name')}</TableHeaderCell>
                    <TableHeaderCell>{tc('unit')}</TableHeaderCell>
                    <TableHeaderCell>{ti('standardCost')}</TableHeaderCell>
                    <TableHeaderCell>{ti('onHand')}</TableHeaderCell>
                    <TableHeaderCell>{ti('reserved')}</TableHeaderCell>
                    <TableHeaderCell>{ti('available')}</TableHeaderCell>
                    <TableHeaderCell>{tCommon('actions')}</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((row) => {
                    const total = (row.balances ?? []).reduce(
                      (s, b) => s + Number(b.availableQty),
                      0,
                    );
                    const reserved = (row.balances ?? []).reduce(
                      (s, b) => s + Number(b.reservedQty ?? 0),
                      0,
                    );
                    const onHand = Number(row.onHandQty ?? total);
                    const reservedQty = Number(row.reservedQty ?? reserved);
                    const freeQty = Number(row.freeQty ?? onHand - reservedQty);
                    const expanded = expandedId === row.id;
                    return (
                      <Fragment key={row.id}>
                        <TableRow>
                          <TableCell>
                            <button
                              type="button"
                              className="rounded p-1 text-text-secondary hover:bg-surface-muted"
                              aria-expanded={expanded}
                              aria-label={ti('balances')}
                              onClick={() => setExpandedId(expanded ? null : row.id)}
                            >
                              {expanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </button>
                          </TableCell>
                          {lifecycle === 'materials' ? (
                            <TableCell>
                              <InventoryItemThumb
                                src={row.imageUrl}
                                alt={localizedName(locale, row)}
                                size={36}
                              />
                            </TableCell>
                          ) : null}
                          <TableCell>
                            <button
                              type="button"
                              className="font-medium text-brand hover:underline"
                              onClick={() => setExpandedId(expanded ? null : row.id)}
                            >
                              {row.sku}
                            </button>
                          </TableCell>
                          <TableCell>{localizedName(locale, row)}</TableCell>
                          <TableCell>{row.unit}</TableCell>
                          <TableCell dir="ltr">
                            {Number(row.standardCost ?? 0).toFixed(2)}
                          </TableCell>
                          <TableCell dir="ltr">{String(onHand)}</TableCell>
                          <TableCell dir="ltr">{String(reservedQty)}</TableCell>
                          <TableCell dir="ltr">{String(freeQty)}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap items-center gap-1.5">
                              {lifecycle === 'materials' ? (
                                <>
                              {canReceive && row.itemClass !== 'FINISHED_GOOD' ? (
                              <Button
                                size="sm"
                                variant="subtle"
                                onClick={() => openMove('receive', row)}
                              >
                                {ti('receive')}
                              </Button>
                              ) : null}
                              {canIssue && row.itemClass !== 'FINISHED_GOOD' ? (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => openMove('issue', row)}
                              >
                                {ti('issue')}
                              </Button>
                              ) : null}
                              {canAdjust ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setEditItem(row);
                                  setEditNameEn(row.nameEn);
                                  setEditNameAr(row.nameAr);
                                  setEditMinStock(String(row.minStock ?? 0));
                                  setEditStandardCost(String(row.standardCost ?? 0));
                                  setEditBarcode(row.barcode ?? '');
                                  setEditColor(row.color ?? '');
                                  setEditMaterialType(row.materialType ?? '');
                                  setEditSize(row.size ?? '');
                                  setEditSupplierId(row.preferredSupplierId ?? '');
                                  setEditImageUrl(row.imageUrl ?? '');
                                  setFormError(null);
                                  setEditOpen(true);
                                }}
                              >
                                {tCommon('edit')}
                              </Button>
                              ) : null}
                                </>
                              ) : null}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  const API =
                                    process.env.NEXT_PUBLIC_API_URL ??
                                    'http://localhost:4000';
                                  window.open(
                                    `${API}/api/v1/inventory/items/${row.id}/label`,
                                    '_blank',
                                  );
                                }}
                              >
                                {ti('labelPdf')}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                        {expanded ? (
                          <TableRow>
                            <td className="px-4 py-3 align-middle" colSpan={11}>
                              <div className="space-y-3 ps-8 text-sm text-text-secondary">
                                {lifecycle === 'materials' ? (
                                  <InventoryItemThumb
                                    src={row.imageUrl}
                                    alt={localizedName(locale, row)}
                                    size={96}
                                  />
                                ) : null}
                                <p className="font-medium text-text-primary">
                                  {ti('balancesByWarehouse')}
                                </p>
                                {(row.balances ?? []).length === 0 ? (
                                  <p>—</p>
                                ) : (
                                  <ul className="space-y-1">
                                    {(row.balances ?? []).map((b, idx) => (
                                      <li
                                        key={b.warehouse?.id ?? b.warehouseId ?? idx}
                                        className="flex gap-3"
                                      >
                                        <span>
                                          {b.warehouse
                                            ? `${b.warehouse.code} — ${localizedName(locale, b.warehouse)}`
                                            : (b.warehouseId ?? '—')}
                                        </span>
                                        <span dir="ltr">
                                          {ti('onHand')} {Number(b.onHandQty ?? b.availableQty)} · {ti('reserved')} {Number(b.reservedQty ?? 0)} · {ti('available')} {Number(b.freeQty ?? Number(b.availableQty) - Number(b.reservedQty ?? 0))}
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            </td>
                          </TableRow>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>

              {meta && meta.totalPages > 1 ? (
                <div className="flex items-center justify-end gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    {tCommon('previous')}
                  </Button>
                  <span className="text-sm text-text-secondary" dir="ltr">
                    {page} / {meta.totalPages}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={page >= meta.totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    {tCommon('next')}
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </>
      ) : tab === 'transfers' ? (
        <>
          {transfersQuery.isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : transfers.length === 0 ? (
            <EmptyState title={ti('noTransfers')} />
          ) : (
            <>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>{tCommon('number')}</TableHeaderCell>
                    <TableHeaderCell>{ti('fromWarehouse')}</TableHeaderCell>
                    <TableHeaderCell>{ti('toWarehouse')}</TableHeaderCell>
                    <TableHeaderCell>{ti('lines')}</TableHeaderCell>
                    <TableHeaderCell>{tCommon('status')}</TableHeaderCell>
                    <TableHeaderCell>{tCommon('actions')}</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {transfers.map((tr) => (
                    <TableRow key={tr.id}>
                      <TableCell>{tr.number}</TableCell>
                      <TableCell>
                        {tr.fromWarehouse.code} — {localizedName(locale, tr.fromWarehouse)}
                      </TableCell>
                      <TableCell>
                        {tr.toWarehouse.code} — {localizedName(locale, tr.toWarehouse)}
                      </TableCell>
                      <TableCell dir="ltr">{tr.lines?.length ?? 0}</TableCell>
                      <TableCell>
                        <StatusBadge status={tr.status} />
                      </TableCell>
                      <TableCell>
                        {canTransfer && (tr.status === 'DRAFT' || tr.status === 'IN_TRANSIT') ? (
                          <Button
                            size="sm"
                            variant="subtle"
                            loading={completeTransferMutation.isPending}
                            onClick={() => {
                              setActionError(null);
                              completeTransferMutation.mutate(tr.id);
                            }}
                          >
                            {ti('completeTransfer')}
                          </Button>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {transferMeta && transferMeta.totalPages > 1 ? (
                <div className="flex items-center justify-end gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={transferPage <= 1}
                    onClick={() => setTransferPage((p) => Math.max(1, p - 1))}
                  >
                    {tCommon('previous')}
                  </Button>
                  <span className="text-sm text-text-secondary" dir="ltr">
                    {transferPage} / {transferMeta.totalPages}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={transferPage >= transferMeta.totalPages}
                    onClick={() => setTransferPage((p) => p + 1)}
                  >
                    {tCommon('next')}
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </>
      ) : (
        <>
          {countsQuery.isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : (countsQuery.data?.data ?? []).length === 0 ? (
            <EmptyState title={ti('noCounts')} />
          ) : (
            <>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>{tCommon('number')}</TableHeaderCell>
                    <TableHeaderCell>{ti('lines')}</TableHeaderCell>
                    <TableHeaderCell>{tCommon('status')}</TableHeaderCell>
                    <TableHeaderCell>{tCommon('actions')}</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(countsQuery.data?.data ?? []).map((count) => (
                    <TableRow key={count.id}>
                      <TableCell>{count.number}</TableCell>
                      <TableCell dir="ltr">{count.lines?.length ?? 0}</TableCell>
                      <TableCell>
                        <StatusBadge status={count.status} />
                      </TableCell>
                      <TableCell>
                        {canCount && count.status === 'DRAFT' ? (
                          <Button
                            size="sm"
                            variant="subtle"
                            loading={
                              postCountMutation.isPending &&
                              postCountConfirm?.id === count.id
                            }
                            onClick={() => {
                              setActionError(null);
                              setPostCountConfirm(count);
                            }}
                          >
                            {ti('postCount')}
                          </Button>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </>
      )}

      <Modal
        open={countOpen}
        onClose={() => !createCountMutation.isPending && setCountOpen(false)}
        title={ti('newCount')}
        footer={
          <>
            <Button
              variant="ghost"
              disabled={createCountMutation.isPending}
              onClick={() => setCountOpen(false)}
            >
              {tCommon('cancel')}
            </Button>
            <Button loading={createCountMutation.isPending} onClick={() => createCountMutation.mutate()}>
              {tCommon('confirm')}
            </Button>
          </>
        }
      >
        <div className="maher-form-section grid gap-3">
          {formError ? <Alert variant="error">{formError}</Alert> : null}
          <Select
            label={ti('countKind')}
            value={countKind}
            onChange={(e) => setCountKind(e.target.value as 'periodic' | 'surprise')}
          >
            <option value="periodic">{ti('countPeriodic')}</option>
            <option value="surprise">{ti('countSurprise')}</option>
          </Select>
          <Select
            label={ti('warehouse')}
            value={countWarehouseId}
            onChange={(e) => setCountWarehouseId(e.target.value)}
          >
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.code} — {localizedName(locale, w)}
              </option>
            ))}
          </Select>
          {countLines.map((line, idx) => (
            <div key={idx} className="grid gap-2 sm:grid-cols-2">
              <Select
                label={ti('item')}
                value={line.itemId}
                onChange={(e) =>
                  setCountLines((prev) =>
                    prev.map((l, i) => (i === idx ? { ...l, itemId: e.target.value } : l)),
                  )
                }
              >
                <option value="">{tc('select')}</option>
                {itemOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.sku} — {localizedName(locale, item)}
                  </option>
                ))}
              </Select>
              <Input
                label={ti('countedQty')}
                type="number"
                dir="ltr"
                value={line.qty}
                onChange={(e) =>
                  setCountLines((prev) =>
                    prev.map((l, i) => (i === idx ? { ...l, qty: e.target.value } : l)),
                  )
                }
              />
            </div>
          ))}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setCountLines((prev) => [...prev, { itemId: '', qty: '' }])}
          >
            {tc('addChecklistItem')}
          </Button>
          <Input
            label={ti('countReason')}
            value={countNotes}
            onChange={(e) => setCountNotes(e.target.value)}
            placeholder={ti('countReasonPlaceholder')}
          />
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(postCountConfirm)}
        onClose={() => !postCountMutation.isPending && setPostCountConfirm(null)}
        title={ti('postCountConfirmTitle')}
        description={ti('postCountConfirmBody', {
          number: postCountConfirm?.number ?? '',
        })}
        confirmLabel={ti('postCount')}
        loading={postCountMutation.isPending}
        error={actionError}
        withReason={!postCountConfirm?.notes?.trim()}
        reasonRequired={!postCountConfirm?.notes?.trim()}
        reasonLabel={ti('countReason')}
        reasonPlaceholder={ti('countReasonPlaceholder')}
        onConfirm={() => {
          if (!postCountConfirm) return;
          // Soft polish: reason already lives on create (`notes`). Posting posts
          // INVENTORY_ADJUSTMENT txs server-side; extra post-time reason is UX-only
          // when notes were missing (API post does not accept a body today).
          setActionError(null);
          postCountMutation.mutate(postCountConfirm.id);
        }}
      />

      <Modal
        open={!!moveOpen}
        onClose={() => !moveMutation.isPending && setMoveOpen(null)}
        title={moveOpen === 'receive' ? ti('receiveStock') : ti('issueStock')}
        footer={
          <>
            <Button
              variant="ghost"
              disabled={moveMutation.isPending}
              onClick={() => setMoveOpen(null)}
            >
              {tCommon('cancel')}
            </Button>
            <Button loading={moveMutation.isPending} onClick={() => moveMutation.mutate()}>
              {tCommon('confirm')}
            </Button>
          </>
        }
      >
        <div className="maher-form-section grid gap-3">
          {formError ? <Alert variant="error">{formError}</Alert> : null}
          <div className="flex flex-wrap items-end gap-2">
            <label className="min-w-[180px] flex-1">
              <Input
                label={selectedItem ? ti('scanConfirmOptional') : ti('scanBarcode')}
                value={scanCode}
                onChange={(e) => setScanCode(e.target.value)}
                onKeyDown={async (e) => {
                  if (e.key !== 'Enter' || !scanCode.trim()) return;
                  e.preventDefault();
                  try {
                    const found = await apiFetch<Row>(
                      `/api/v1/inventory/items/by-code/${encodeURIComponent(scanCode.trim())}`,
                    );
                    setSelectedItem(found);
                    setWarehouseId(warehousesForItem(warehouses, found)[0]?.id ?? '');
                    setScanCode('');
                    setFormError(null);
                  } catch (err) {
                    setFormError(mutationErrorMessage(err));
                  }
                }}
                dir="ltr"
                placeholder={ti('scanBarcodeHint')}
              />
            </label>
            <Button
              size="sm"
              variant="secondary"
              onClick={async () => {
                if (!scanCode.trim()) return;
                try {
                  const found = await apiFetch<Row>(
                    `/api/v1/inventory/items/by-code/${encodeURIComponent(scanCode.trim())}`,
                  );
                  setSelectedItem(found);
                  setWarehouseId(warehousesForItem(warehouses, found)[0]?.id ?? '');
                  setScanCode('');
                  setFormError(null);
                } catch (err) {
                  setFormError(mutationErrorMessage(err));
                }
              }}
            >
              {ti('lookup')}
            </Button>
          </div>
          <p className="text-sm">
            {ti('item')}: <strong>{selectedItem?.sku ?? '—'}</strong>
            {selectedItem ? ` — ${localizedName(locale, selectedItem)}` : null}
          </p>
          {moveOpen === 'receive' && openReceipts.length > 0 ? (
            <div className="grid gap-2">
              {openReceipts.map((row) => (
                <label
                  key={row.purchaseOrderId}
                  className="flex cursor-pointer items-start gap-2 rounded-[var(--maher-radius-md)] border border-border bg-surface p-3 text-sm"
                >
                  <input
                    type="radio"
                    name="inventory-receipt-kind"
                    checked={receiptKind === 'po' && selectedPoId === row.purchaseOrderId}
                    onChange={() => {
                      setReceiptKind('po');
                      setSelectedPoId(row.purchaseOrderId);
                      if (row.suggestedWarehouseId) setWarehouseId(row.suggestedWarehouseId);
                    }}
                  />
                  <span>
                    <span className="block font-medium">{ti('receiveAgainstPo')}</span>
                    <span className="block">
                      {row.purchaseOrderNumber} — {row.supplierName}
                    </span>
                    <span className="block text-text-secondary" dir="ltr">
                      {ti('remaining')}: {row.remainingQty} {row.unit}
                    </span>
                  </span>
                </label>
              ))}
              <label className="flex cursor-pointer items-start gap-2 rounded-[var(--maher-radius-md)] border border-border bg-surface p-3 text-sm">
                <input
                  type="radio"
                  name="inventory-receipt-kind"
                  checked={receiptKind === 'manual'}
                  onChange={() => {
                    setReceiptKind('manual');
                    setSelectedPoId('');
                  }}
                />
                <span className="font-medium">{ti('manualReceipt')}</span>
              </label>
            </div>
          ) : null}
          <Select
            label={ti('warehouse')}
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
          >
            {moveWarehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.code} — {localizedName(locale, w)}
              </option>
            ))}
          </Select>
          <Input
            label={ti('quantity')}
            type="number"
            dir="ltr"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
          <Input label={ti('notes')} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </Modal>

      <Modal
        open={transferOpen}
        onClose={() => !createTransferMutation.isPending && setTransferOpen(false)}
        title={ti('newTransfer')}
        footer={
          <>
            <Button
              variant="ghost"
              disabled={createTransferMutation.isPending}
              onClick={() => setTransferOpen(false)}
            >
              {tCommon('cancel')}
            </Button>
            <Button
              loading={createTransferMutation.isPending}
              onClick={() => createTransferMutation.mutate()}
            >
              {tCommon('confirm')}
            </Button>
          </>
        }
      >
        <div className="maher-form-section grid gap-3">
          {formError ? <Alert variant="error">{formError}</Alert> : null}
          <Select
            label={ti('fromWarehouse')}
            value={fromWarehouseId}
            onChange={(e) => setFromWarehouseId(e.target.value)}
          >
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.code} — {localizedName(locale, w)}
              </option>
            ))}
          </Select>
          <Select
            label={ti('toWarehouse')}
            value={toWarehouseId}
            onChange={(e) => setToWarehouseId(e.target.value)}
          >
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.code} — {localizedName(locale, w)}
              </option>
            ))}
          </Select>
          <Select
            label={ti('item')}
            value={transferItemId}
            onChange={(e) => setTransferItemId(e.target.value)}
          >
            <option value="">{tc('select')}</option>
            {itemOptions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.sku} — {localizedName(locale, item)}
              </option>
            ))}
          </Select>
          <Input
            label={ti('quantity')}
            type="number"
            dir="ltr"
            value={transferQty}
            onChange={(e) => setTransferQty(e.target.value)}
          />
          <Input
            label={ti('notes')}
            value={transferNotes}
            onChange={(e) => setTransferNotes(e.target.value)}
          />
        </div>
      </Modal>

      <Modal
        open={itemOpen}
        onClose={() => !createItemMutation.isPending && setItemOpen(false)}
        title={ti('newItem')}
        footer={
          <>
            <Button
              variant="ghost"
              disabled={createItemMutation.isPending}
              onClick={() => setItemOpen(false)}
            >
              {tCommon('cancel')}
            </Button>
            <Button loading={createItemMutation.isPending} onClick={() => createItemMutation.mutate()}>
              {tCommon('save')}
            </Button>
          </>
        }
      >
        <div className="maher-form-section grid gap-3">
          {formError ? <Alert variant="error">{formError}</Alert> : null}
          <Input
            label={ti('sku')}
            value={itemSku}
            onChange={(e) => setItemSku(e.target.value)}
            dir="ltr"
          />
          <Input
            label={ti('supplierBarcode')}
            value={itemBarcode}
            onChange={(e) => setItemBarcode(e.target.value)}
            dir="ltr"
          />
          <Input
            label={tc('nameEn')}
            value={itemNameEn}
            onChange={(e) => setItemNameEn(e.target.value)}
          />
          <Input
            label={tc('nameAr')}
            value={itemNameAr}
            onChange={(e) => setItemNameAr(e.target.value)}
          />
          <Input
            label={ti('materialType')}
            value={itemMaterialType}
            onChange={(e) => setItemMaterialType(e.target.value)}
          />
          <Input
            label={ti('color')}
            value={itemColor}
            onChange={(e) => setItemColor(e.target.value)}
          />
          <Input
            label={ti('size')}
            value={itemSize}
            onChange={(e) => setItemSize(e.target.value)}
            dir="ltr"
          />
          <Select
            label={ti('preferredSupplier')}
            value={itemSupplierId}
            onChange={(e) => setItemSupplierId(e.target.value)}
          >
            <option value="">{tc('select')}</option>
            {(suppliersQuery.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {localizedName(locale, s, s.name)}
              </option>
            ))}
          </Select>
          <Input
            label={ti('unit')}
            value={itemUnit}
            onChange={(e) => setItemUnit(e.target.value)}
            dir="ltr"
          />
          <Input
            label={ti('standardCost')}
            type="number"
            value={itemStandardCost}
            onChange={(e) => setItemStandardCost(e.target.value)}
            dir="ltr"
          />
          <Input
            label={ti('minStock')}
            type="number"
            value={itemMinStock}
            onChange={(e) => setItemMinStock(e.target.value)}
            dir="ltr"
          />
          <div className="space-y-2">
            <ImageSourceField
              label={ti('itemPhoto')}
              value={itemImageUrl}
              onChange={setItemImageUrl}
              hint={ti('itemPhotoHint')}
              uploadLabel={itemImageUrl.trim() ? ti('replacePhoto') : ti('uploadPhoto')}
              uploadingLabel={tCommon('uploading')}
              allowUrl={false}
              onUploadFile={uploadInventorySkuPhoto}
            />
            {itemImageUrl.trim() ? (
              <Button type="button" size="sm" variant="ghost" onClick={() => setItemImageUrl('')}>
                {ti('removePhoto')}
              </Button>
            ) : null}
          </div>
        </div>
      </Modal>

      <Modal
        open={editOpen}
        onClose={() => !updateItemMutation.isPending && setEditOpen(false)}
        title={tCommon('edit')}
        footer={
          <>
            <Button
              variant="ghost"
              disabled={updateItemMutation.isPending}
              onClick={() => setEditOpen(false)}
            >
              {tCommon('cancel')}
            </Button>
            <Button loading={updateItemMutation.isPending} onClick={() => updateItemMutation.mutate()}>
              {tCommon('save')}
            </Button>
          </>
        }
      >
        <div className="maher-form-section grid gap-3">
          {formError ? <Alert variant="error">{formError}</Alert> : null}
          <Input label={tc('nameEn')} value={editNameEn} onChange={(e) => setEditNameEn(e.target.value)} />
          <Input label={tc('nameAr')} value={editNameAr} onChange={(e) => setEditNameAr(e.target.value)} />
          <Input
            label={ti('supplierBarcode')}
            value={editBarcode}
            onChange={(e) => setEditBarcode(e.target.value)}
            dir="ltr"
          />
          <Input
            label={ti('materialType')}
            value={editMaterialType}
            onChange={(e) => setEditMaterialType(e.target.value)}
          />
          <Input label={ti('color')} value={editColor} onChange={(e) => setEditColor(e.target.value)} />
          <Input
            label={ti('size')}
            value={editSize}
            onChange={(e) => setEditSize(e.target.value)}
            dir="ltr"
          />
          <Select
            label={ti('preferredSupplier')}
            value={editSupplierId}
            onChange={(e) => setEditSupplierId(e.target.value)}
          >
            <option value="">{tc('select')}</option>
            {(suppliersQuery.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {localizedName(locale, s, s.name)}
              </option>
            ))}
          </Select>
          <Input
            label={ti('minStock')}
            type="number"
            value={editMinStock}
            onChange={(e) => setEditMinStock(e.target.value)}
            dir="ltr"
          />
          <Input
            label={ti('standardCost')}
            type="number"
            value={editStandardCost}
            onChange={(e) => setEditStandardCost(e.target.value)}
            dir="ltr"
          />
          <div className="space-y-2">
            <ImageSourceField
              label={ti('itemPhoto')}
              value={editImageUrl}
              onChange={setEditImageUrl}
              hint={ti('itemPhotoHint')}
              uploadLabel={editImageUrl.trim() ? ti('replacePhoto') : ti('uploadPhoto')}
              uploadingLabel={tCommon('uploading')}
              allowUrl={false}
              onUploadFile={uploadInventorySkuPhoto}
            />
            {editImageUrl.trim() ? (
              <Button type="button" size="sm" variant="ghost" onClick={() => setEditImageUrl('')}>
                {ti('removePhoto')}
              </Button>
            ) : null}
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(inspectKitId)}
        onClose={() => setInspectKitId(null)}
        title={ti('wipKitDetail')}
      >
        {inspectKitQuery.data ? (
          <div className="space-y-3 text-sm">
            <p className="font-semibold text-text-primary">
              {inspectKitQuery.data.productionOrder?.number ?? '—'}
            </p>
            <p className="text-text-secondary" dir="ltr">
              {ti('wipQr')}: {inspectKitQuery.data.qrCode}
            </p>
            <StatusBadge status={inspectKitQuery.data.status ?? 'READY'} />
            <div className="flex flex-wrap gap-2">
              {canRead ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    window.open(
                      `${API_URL}/api/v1/inventory/wip-kits/${inspectKitQuery.data!.id}/qr-label?lang=${locale}`,
                      '_blank',
                    );
                  }}
                >
                  {ti('wipPrintKitLabel')}
                </Button>
              ) : null}
            </div>
            <div>
              <Select
                label={ti('wipLocation')}
                value={kitLocationId}
                onChange={(e) => setKitLocationId(e.target.value)}
                disabled={!canAdjust}
              >
                <option value="">{tc('select')}</option>
                {(wipStageBinsQuery.data?.locations ?? []).map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name?.trim() || loc.code}
                  </option>
                ))}
              </Select>
              {canAdjust ? (
                <Button
                  type="button"
                  size="sm"
                  className="mt-2"
                  loading={setWipKitLocationMutation.isPending}
                  onClick={() => {
                    if (!inspectKitId) return;
                    setWipKitLocationMutation.mutate({
                      kitId: inspectKitId,
                      locationId: kitLocationId || null,
                    });
                  }}
                >
                  {ti('wipAssignBin')}
                </Button>
              ) : null}
            </div>
            <div>
              <p className="mb-1 font-medium">{ti('wipPieces')}</p>
              <ul className="space-y-2 text-text-secondary">
                {(inspectKitQuery.data.pieces ?? []).map((p, i) => (
                  <li key={p.id} className="flex flex-wrap items-center gap-2">
                    <span dir="ltr">
                      {p.label ?? `Piece ${i + 1}`}
                      {p.qrCode ? ` · ${p.qrCode}` : ''}
                    </span>
                    {canRead ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          window.open(
                            `${API_URL}/api/v1/inventory/wip-pieces/${p.id}/qr-label?lang=${locale}`,
                            '_blank',
                          );
                        }}
                      >
                        {ti('wipPrintPieceLabel')}
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
            {inspectKitQuery.data.materialOverageNotes ? (
              <p className="text-amber-700">
                {ti('wipOverageNotes')}: {inspectKitQuery.data.materialOverageNotes}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-text-secondary">…</p>
        )}
      </Modal>

      <Modal
        open={Boolean(inspectLot)}
        onClose={() => setInspectLot(null)}
        title={
          inspectLot && isFgInspectLot(inspectLot)
            ? tl('finishedGoodsInspect')
            : ti('inspectLot')
        }
      >
        {inspectLot && isFgInspectLot(inspectLot) ? (
          <div className="space-y-4 text-sm">
            <div className="flex items-start gap-3">
              <InventoryItemThumb
                src={inspectLot.inventoryItem.product?.imageUrl}
                alt={localizedName(locale, inspectLot.inventoryItem)}
                size={64}
              />
              <div className="min-w-0 flex-1 space-y-1">
                <p className="font-semibold text-text-primary">
                  {localizedName(locale, inspectLot.inventoryItem)}
                </p>
                {inspectLot.projectName ? (
                  <p className="text-text-secondary">{inspectLot.projectName}</p>
                ) : null}
                {!inspectLot.deliveryStatus ? (
                  <span className="inline-flex rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
                    {tl('waitingForTruck')}
                  </span>
                ) : (
                  <StatusBadge status={inspectLot.deliveryStatus} />
                )}
              </div>
              <span className="font-semibold tabular-nums text-text-primary" dir="ltr">
                {Number(inspectLot.quantity)}
              </span>
            </div>
            <div className="grid gap-2 rounded-lg border border-border bg-surface-secondary p-3">
              <p>
                <span className="text-text-tertiary">{ti('salesOrder')}: </span>
                {inspectLot.salesOrderNumber ?? '—'}
              </p>
              <p>
                <span className="text-text-tertiary">{ti('productionOrder')}: </span>
                {inspectLot.productionOrderNumber ?? inspectLot.productionOrder?.number ?? '—'}
              </p>
              <p>
                <span className="text-text-tertiary">{ti('dealer')}: </span>
                {locale === 'ar'
                  ? inspectLot.dealerNameAr ?? inspectLot.dealerNameEn ?? '—'
                  : inspectLot.dealerNameEn ?? inspectLot.dealerNameAr ?? '—'}
              </p>
              <p>
                <span className="text-text-tertiary">{ti('delivery')}: </span>
                {inspectLot.deliveryNumber ?? '—'}
                {inspectLot.deliveryDate ? (
                  <span className="text-text-secondary"> · {inspectLot.deliveryDate.slice(0, 10)}</span>
                ) : null}
              </p>
              <p>
                <span className="text-text-tertiary">{ti('daysWaiting')}: </span>
                {inspectLot.daysWaiting ?? 0}
              </p>
              <p>
                <span className="text-text-tertiary">{tl('qcPassed')}: </span>
                {String(inspectLot.qcStatus ?? 'PASS')
                  .toUpperCase()
                  .includes('FAIL')
                  ? tl('qcFailed')
                  : tl('qcPassed')}
              </p>
              <p>
                <span className="text-text-tertiary">{tl('packagingComplete')}: </span>
                {inspectLot.packagingComplete !== false ? tl('packagingComplete') : '—'}
              </p>
              <p>
                <span className="text-text-tertiary">{tl('finishedAt')}: </span>
                {new Date(
                  inspectLot.finishedAt ?? inspectLot.producedAt,
                ).toLocaleString(locale)}
              </p>
              <p>
                <span className="text-text-tertiary">{ti('warehouse')}: </span>
                {localizedName(locale, inspectLot.warehouse)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {inspectLot.salesOrder?.id ? (
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => {
                    setInspectLot(null);
                    router.push(`/sales-orders/${inspectLot.salesOrder!.id}`);
                  }}
                >
                  {tl('viewOrder')}
                </Button>
              ) : null}
              {inspectLot.salesOrder?.deliveries?.[0]?.id ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    const deliveryId = inspectLot.salesOrder!.deliveries![0]!.id;
                    setInspectLot(null);
                    router.push(`/deliveries/${deliveryId}`);
                  }}
                >
                  {tl('viewDelivery')}
                </Button>
              ) : null}
              {canTransfer ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setTransferItemId(inspectLot.inventoryItem.id);
                    setFromWarehouseId(inspectLot.warehouse.id);
                    setTransferQty(String(inspectLot.quantity));
                    setTransferNotes('');
                    setInspectLot(null);
                    setTransferOpen(true);
                  }}
                >
                  {ti('newTransfer')}
                </Button>
              ) : null}
              {canCount ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setCountWarehouseId(inspectLot.warehouse.id);
                    setCountLines([
                      { itemId: inspectLot.inventoryItem.id, qty: String(inspectLot.quantity) },
                    ]);
                    setCountNotes('');
                    setInspectLot(null);
                    setCountOpen(true);
                  }}
                >
                  {ti('newCount')}
                </Button>
              ) : null}
              {canRead ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    window.open(
                      `${API_URL}/api/v1/inventory/items/${inspectLot.inventoryItem.id}/label`,
                      '_blank',
                    );
                  }}
                >
                  {ti('labelPdf')}
                </Button>
              ) : null}
            </div>
          </div>
        ) : inspectLot ? (
          <div className="space-y-2 text-sm">
            <p className="font-semibold">{localizedName(locale, inspectLot.inventoryItem)}</p>
            <p>
              {ti('lotProduct')}:{' '}
              {inspectLot.productNameEn
                ? locale === 'ar'
                  ? inspectLot.productNameAr
                  : inspectLot.productNameEn
                : '—'}
            </p>
            <p>
              {ti('productionOrder')}:{' '}
              {inspectLot.productionOrderNumber ?? inspectLot.productionOrder?.number ?? '—'}
            </p>
            <p>
              {ti('stage')}:{' '}
              {inspectLot.producingStageNameEn
                ? locale === 'ar'
                  ? inspectLot.producingStageNameAr
                  : inspectLot.producingStageNameEn
                : inspectLot.stageInstance?.stageDefinition
                  ? localizedName(locale, inspectLot.stageInstance.stageDefinition)
                  : '—'}
            </p>
            <p>
              {ti('producedAt')}: {new Date(inspectLot.producedAt).toLocaleString()}
            </p>
            <p>
              {ti('warehouse')}: {localizedName(locale, inspectLot.warehouse)}
            </p>
            <p className="pt-2 font-semibold">{ti('laterMovements')}</p>
            {(inspectLot.laterMovements ?? []).length === 0 ? (
              <p className="text-text-tertiary">{ti('noLaterMovements')}</p>
            ) : (
              <ul className="space-y-1">
                {inspectLot.laterMovements!.map((m, i) => (
                  <li key={`${m.type}-${i}`}>
                    {ti(
                      m.type === 'SEMI_FINISHED_ISSUE'
                        ? 'movementIssue'
                        : m.type === 'FINISHED_GOODS_RECEIPT'
                          ? 'movementFinishedReceipt'
                          : m.type === 'DELIVERY_ISSUE'
                            ? 'movementDelivery'
                            : m.type === 'DELIVERY_RESTORE'
                              ? 'movementRestore'
                              : m.type === 'CUSTOMER_RETURN'
                                ? 'movementReturn'
                                : m.type === 'SCRAP'
                                  ? 'movementScrap'
                                  : m.type === 'DAMAGE'
                                    ? 'movementDamage'
                                    : m.type === 'PRODUCTION_RETURN'
                                      ? 'movementProductionReturn'
                                      : 'laterMovements',
                    )}{' '}
                    · {m.quantity} · {locale === 'ar' ? m.warehouseNameAr : m.warehouseNameEn}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
