'use client';

import { useRouter } from '@/i18n/navigation';
import { apiFetch, ApiClientError } from '@/lib/api-client';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
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
} from '@maher/ui';
import { localizedName } from '@maher/i18n';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Fragment, useMemo, useState } from 'react';

interface Balance {
  availableQty: string | number;
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
  color?: string | null;
  materialType?: string | null;
  size?: string | null;
  preferredSupplierId?: string | null;
  minStock?: string | number;
  balances?: Balance[];
}

interface Warehouse {
  id: string;
  code: string;
  nameEn: string;
  nameAr?: string;
}

interface LowStockItem {
  id: string;
  sku: string;
  nameAr: string;
  nameEn: string;
  unit: string;
  minStock: string | number;
  availableQty: number;
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
  lines: CountLine[];
}

type Tab = 'items' | 'transfers' | 'counts';
type CategoryGroup = 'fabric' | 'foam' | 'wood' | 'accessories';

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

export default function InventoryPage() {
  const locale = useLocale();
  const t = useTranslations('navigation');
  const ti = useTranslations('inventory');
  const tc = useTranslations('catalog');
  const tCommon = useTranslations('common');
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<Tab>('items');
  const [categoryGroup, setCategoryGroup] = useState<'fabric' | 'foam' | 'wood' | 'accessories'>('fabric');
  const router = useRouter();
  const [q, setQ] = useState('');
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

  const [itemOpen, setItemOpen] = useState(false);
  const [itemSku, setItemSku] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [editItem, setEditItem] = useState<Row | null>(null);
  const [editNameEn, setEditNameEn] = useState('');
  const [editNameAr, setEditNameAr] = useState('');
  const [editMinStock, setEditMinStock] = useState('0');
  const [itemNameEn, setItemNameEn] = useState('');
  const [itemNameAr, setItemNameAr] = useState('');
  const [itemUnit, setItemUnit] = useState('pcs');
  const [itemMinStock, setItemMinStock] = useState('0');
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
  const [scanCode, setScanCode] = useState('');
  const [countKind, setCountKind] = useState<'periodic' | 'surprise'>('periodic');

  const listParams = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: '20' });
    if (q.trim()) params.set('q', q.trim());
    params.set('categoryGroup', categoryGroup);
    return params.toString();
  }, [q, page, categoryGroup]);

  const itemsQuery = useQuery({
    queryKey: ['inventory-items', listParams],
    queryFn: () =>
      apiFetch<{ data: Row[]; meta: { page: number; totalPages: number } }>(
        `/api/v1/inventory/items?${listParams}`,
      ),
    placeholderData: keepPreviousData,
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
          barcode: itemBarcode.trim() || undefined,
          color: itemColor.trim() || undefined,
          materialType: itemMaterialType.trim() || undefined,
          size: itemSize.trim() || undefined,
          preferredSupplierId: itemSupplierId || undefined,
          category: CATEGORY_FOR_CREATE[categoryGroup],
        }),
      });
    },
    onSuccess: async () => {
      setItemOpen(false);
      setBanner(ti('itemCreated'));
      await queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      await queryClient.invalidateQueries({ queryKey: ['inventory-low-stock'] });
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
          barcode: editBarcode.trim() || undefined,
          color: editColor.trim() || undefined,
          materialType: editMaterialType.trim() || undefined,
          size: editSize.trim() || undefined,
          preferredSupplierId: editSupplierId || null,
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
      return apiFetch('/api/v1/inventory/counts', {
        method: 'POST',
        body: JSON.stringify({
          warehouseId: countWarehouseId,
          notes: [countKind === 'surprise' ? 'SURPRISE' : 'PERIODIC', countNotes.trim()].filter(Boolean).join(' — ') || undefined,
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
      setBanner(ti('countPosted'));
      await queryClient.invalidateQueries({ queryKey: ['inventory-counts'] });
      await queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      await queryClient.invalidateQueries({ queryKey: ['inventory-low-stock'] });
    },
    onError: (err) => setActionError(mutationErrorMessage(err)),
  });

  if (itemsQuery.isLoading && !itemsQuery.data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (itemsQuery.isError && !itemsQuery.data) {
    return (
      <ErrorState
        title={t('inventory')}
        onRetry={() => itemsQuery.refetch()}
        retryLabel={tCommon('retry')}
      />
    );
  }

  const rows = itemsQuery.data?.data ?? [];
  const meta = itemsQuery.data?.meta;
  const warehouses = warehousesQuery.data ?? [];
  const lowStock = lowStockQuery.data ?? [];
  const transfers = transfersQuery.data?.data ?? [];
  const transferMeta = transfersQuery.data?.meta;
  const itemOptions = itemOptionsQuery.data ?? rows;

  function openMove(kind: 'receive' | 'issue', row: Row) {
    setSelectedItem(row);
    setWarehouseId(warehouses[0]?.id ?? '');
    setQuantity('1');
    setNotes('');
    setScanCode('');
    setFormError(null);
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
          tab === 'transfers' ? (
            <Button size="sm" onClick={openTransfer}>
              {ti('newTransfer')}
            </Button>
          ) : tab === 'counts' ? (
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
          ) : (
            <Button
              size="sm"
              variant="secondary"
              loading={syncMaterialsMutation.isPending}
              onClick={() => syncMaterialsMutation.mutate()}
            >
              {ti('syncFromMaterials')}
            </Button>
          )
        }
      />
      {banner ? <Alert variant="success">{banner}</Alert> : null}
      {actionError ? <Alert variant="error">{actionError}</Alert> : null}

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={tab === 'items' ? 'primary' : 'subtle'}
          onClick={() => setTab('items')}
        >
          {ti('items')}
        </Button>
        <Button
          size="sm"
          variant={tab === 'transfers' ? 'primary' : 'subtle'}
          onClick={() => setTab('transfers')}
        >
          {ti('transfers')}
        </Button>
        <Button
          size="sm"
          variant={tab === 'counts' ? 'primary' : 'subtle'}
          onClick={() => setTab('counts')}
        >
          {ti('counts')}
        </Button>
      </div>

      {tab === 'items' ? (
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
                      {item.availableQty} / {Number(item.minStock)} {item.unit}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex flex-wrap items-end gap-3">
            <label className="relative min-w-[220px] flex-1">
              <Input
                withSearchIcon
                value={q}
                onChange={(e) => {
                  setPage(1);
                  setQ(e.target.value);
                }}
                placeholder={ti('searchPlaceholder')}
              />
            </label>
            <Button
              size="sm"
              onClick={() => {
                setItemSku('');
                setItemNameEn('');
                setItemNameAr('');
                setItemUnit('pcs');
                setItemMinStock('0');
                setItemBarcode('');
                setItemColor('');
                setItemMaterialType('');
                setItemSize('');
                setItemSupplierId('');
                setFormError(null);
                setItemOpen(true);
              }}
            >
              {ti('newItem')}
            </Button>
          </div>

          {rows.length === 0 ? (
            <EmptyState title={ti('empty')} />
          ) : (
            <>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeaderCell className="w-8" />
                    <TableHeaderCell>{ti('sku')}</TableHeaderCell>
                    <TableHeaderCell>{tc('name')}</TableHeaderCell>
                    <TableHeaderCell>{tc('unit')}</TableHeaderCell>
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
                          <TableCell dir="ltr">{String(total)}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <Button
                                size="sm"
                                variant="subtle"
                                onClick={() => openMove('receive', row)}
                              >
                                {ti('receive')}
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => openMove('issue', row)}
                              >
                                {ti('issue')}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setEditItem(row);
                                  setEditNameEn(row.nameEn);
                                  setEditNameAr(row.nameAr);
                                  setEditMinStock(String(row.minStock ?? 0));
                                  setEditBarcode(row.barcode ?? '');
                                  setEditColor(row.color ?? '');
                                  setEditMaterialType(row.materialType ?? '');
                                  setEditSize(row.size ?? '');
                                  setEditSupplierId(row.preferredSupplierId ?? '');
                                  setFormError(null);
                                  setEditOpen(true);
                                }}
                              >
                                {tCommon('edit')}
                              </Button>
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
                            <td className="px-4 py-3 align-middle" colSpan={7}>
                              <div className="space-y-1 ps-8 text-sm text-text-secondary">
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
                                        <span dir="ltr">{Number(b.availableQty)}</span>
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
                        {tr.status === 'DRAFT' || tr.status === 'IN_TRANSIT' ? (
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
                        {count.status === 'DRAFT' ? (
                          <Button
                            size="sm"
                            variant="subtle"
                            loading={postCountMutation.isPending}
                            onClick={() => {
                              setActionError(null);
                              postCountMutation.mutate(count.id);
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
          <Input label={ti('notes')} value={countNotes} onChange={(e) => setCountNotes(e.target.value)} />
        </div>
      </Modal>

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
                label={ti('scanBarcode')}
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
          <Select
            label={ti('warehouse')}
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
          >
            {warehouses.map((w) => (
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
            label={ti('barcode')}
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
            label={ti('minStock')}
            type="number"
            value={itemMinStock}
            onChange={(e) => setItemMinStock(e.target.value)}
            dir="ltr"
          />
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
            label={ti('barcode')}
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
        </div>
      </Modal>
    </div>
  );
}
