'use client';

import { PageHeader } from '@/components/admin/page-header';
import { InventoryItemThumb } from '@/components/admin/inventory-item-thumb';
import { SupplierSearchPicker } from '@/components/admin/supplier-search-picker';
import { apiFetch, ApiClientError } from '@/lib/api-client';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import { takeDemandCart } from '@/lib/purchasing-demand-cart';
import {
  buildPurchaseOrderPayload,
  isFabricCategory,
  validatePurchaseBuilder,
  type BuilderLine,
} from '@/lib/purchase-order-payload';
import { useRouter } from '@/i18n/navigation';
import {
  Alert,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  NumberStepper,
  Select,
  Skeleton,
} from '@maher/ui';
import { localizedName } from '@maher/i18n';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';

type Warehouse = {
  id: string;
  code: string;
  nameEn: string;
  nameAr?: string;
  type?: string;
  locations?: Array<{
    id: string;
    code: string;
    name?: string | null;
    isDefault?: boolean;
    isActive?: boolean;
  }>;
};

function locationsForWarehouse(warehouses: Warehouse[], warehouseId?: string) {
  return (warehouses.find((w) => w.id === warehouseId)?.locations ?? []).filter(
    (loc) => loc.isActive !== false,
  );
}

function defaultLocationId(warehouses: Warehouse[], warehouseId?: string, current?: string) {
  const locs = locationsForWarehouse(warehouses, warehouseId);
  if (current && locs.some((loc) => loc.id === current)) return current;
  return locs.find((loc) => loc.isDefault)?.id ?? locs[0]?.id ?? '';
}

type InventoryItem = {
  id: string;
  sku: string;
  nameEn: string;
  nameAr?: string;
  category?: string | null;
  unit?: string | null;
  standardCost?: number | string | null;
  imageUrl?: string | null;
};

const CATEGORIES = [
  'WOOD',
  'FABRIC',
  'FOAM',
  'PAINT',
  'ADHESIVE',
  'METAL_ACCESSORY',
  'DECORATIVE_ACCESSORY',
  'PACKAGING',
  'OTHER',
] as const;

export default function PurchaseOrderBuilderPage() {
  const locale = useLocale();
  const router = useRouter();
  const tc = useTranslations('catalog');
  const tPurchasing = useTranslations('purchasing');
  const tCommon = useTranslations('common');
  const tNav = useTranslations('navigation');

  const [supplierId, setSupplierId] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [lines, setLines] = useState<BuilderLine[]>([]);
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const warehousesQuery = useQuery({
    queryKey: ['warehouses-pick'],
    queryFn: () =>
      apiFetch<{ data: Warehouse[] }>('/api/v1/warehouses?pageSize=50').then((r) => r.data),
  });
  const itemsQuery = useQuery({
    queryKey: ['inventory-items-po-builder', search, category],
    queryFn: () => {
      const params = new URLSearchParams({
        pageSize: '40',
        isPurchasable: 'true',
      });
      if (search.trim()) params.set('q', search.trim());
      if (category) params.set('category', category);
      return apiFetch<{ data: InventoryItem[] }>(`/api/v1/inventory/items?${params}`).then(
        (r) => r.data,
      );
    },
  });

  const warehouses = useMemo(
    () => (warehousesQuery.data ?? []).filter((w) => !w.type || w.type === 'RAW_MATERIALS'),
    [warehousesQuery.data],
  );
  const defaultWarehouseId = warehouses[0]?.id ?? '';

  useEffect(() => {
    const pending = takeDemandCart();
    if (pending.length === 0) return;
    setLines((prev) => {
      const next = [...prev];
      for (const row of pending) {
        if (next.some((line) => line.inventoryItemId === row.inventoryItemId)) continue;
        next.push({
          inventoryItemId: row.inventoryItemId,
          description: row.nameEn || row.sku,
          quantity: row.quantity,
          unitPrice: row.unitPrice,
          unit: row.unit,
          warehouseId: defaultWarehouseId,
          locationId: defaultLocationId(warehouses, defaultWarehouseId),
          category: row.category ?? null,
        });
      }
      return next;
    });
  }, [defaultWarehouseId]);

  const create = useMutation({
    mutationFn: async () => {
      const issue = validatePurchaseBuilder({ supplierId, lines });
      if (issue === 'supplier') throw new ApiClientError(tc('selectSupplierRequired'), 400);
      if (issue === 'lines') throw new ApiClientError(tc('selectMaterialRequired'), 400);
      if (issue === 'qty') throw new ApiClientError(tc('selectInventoryItemRequired'), 400);
      if (issue === 'holding') throw new ApiClientError(tPurchasing('holdingLocation'), 400);
      return apiFetch<{ id: string }>(
        '/api/v1/purchase-orders',
        {
          method: 'POST',
          body: JSON.stringify(
            buildPurchaseOrderPayload({
              supplierId,
              warehouseId: defaultWarehouseId,
              notes,
              expectedDeliveryDate: expectedDeliveryDate || undefined,
              lines,
            }),
          ),
        },
      );
    },
    onSuccess: (created) => {
      router.push(`/purchasing/${created.id}`);
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  const selectedIds = new Set(lines.map((line) => line.inventoryItemId));
  const subtotal = lines.reduce(
    (sum, line) => sum + (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0),
    0,
  );
  const tax = subtotal * 0.16;
  const locationsFor = (warehouseId?: string) => locationsForWarehouse(warehouses, warehouseId);

  function toggleItem(item: InventoryItem) {
    setLines((prev) => {
      const existing = prev.find((line) => line.inventoryItemId === item.id);
      if (existing) return prev.filter((line) => line.inventoryItemId !== item.id);
      return [
        ...prev,
        {
          inventoryItemId: item.id,
          description: localizedName(locale, item, item.sku),
          quantity: '1',
          unitPrice: String(Number(item.standardCost) || 0),
          unit: item.unit || 'pcs',
          warehouseId: defaultWarehouseId,
          locationId: defaultLocationId(warehouses, defaultWarehouseId),
          category: item.category ?? null,
        },
      ];
    });
  }

  function updateLine(id: string, patch: Partial<BuilderLine>) {
    setLines((prev) => prev.map((line) => (line.inventoryItemId === id ? { ...line, ...patch } : line)));
  }

  if (warehousesQuery.isError) {
    return (
      <ErrorState
        title={tNav('purchasing')}
        onRetry={() => warehousesQuery.refetch()}
        retryLabel={tCommon('retry')}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader backHref="/purchasing" title={tPurchasing('newOrder')} />
      {error ? <Alert variant="error">{error}</Alert> : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-4 p-4">
          <h2 className="text-base font-semibold">{tc('materialsList')}</h2>
          <div className="flex flex-wrap items-end gap-3">
            <label className="min-w-[180px] flex-1">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={tc('purchasingSearchPlaceholder')}
                withSearchIcon
              />
            </label>
            <Select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="min-w-[160px]"
              aria-label={tc('category')}
            >
              <option value="">{tCommon('all')}</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {tc(`materialCategories.${cat}`)}
                </option>
              ))}
            </Select>
          </div>
          {itemsQuery.isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : itemsQuery.isError ? (
            <ErrorState title={tCommon('error')} onRetry={() => itemsQuery.refetch()} />
          ) : (itemsQuery.data ?? []).length === 0 ? (
            <EmptyState title={tc('selectMaterialRequired')} />
          ) : (
            <ul className="max-h-[32rem] space-y-2 overflow-auto">
              {(itemsQuery.data ?? []).map((item) => {
                const selected = selectedIds.has(item.id);
                const name = localizedName(locale, item, item.sku);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => toggleItem(item)}
                      className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-start ${
                        selected
                          ? 'border-brand bg-[var(--maher-brand-soft)]'
                          : 'border-border bg-surface'
                      }`}
                    >
                      <InventoryItemThumb src={item.imageUrl} alt={name} size={40} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{name}</span>
                        <span className="block text-xs text-text-secondary" dir="ltr">
                          {item.sku}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <div className="space-y-4">
          <Card className="space-y-3 p-4">
            <SupplierSearchPicker
              label={tc('supplier')}
              required
              value={supplierId}
              onChange={setSupplierId}
            />
            <Input
              type="date"
              label={tPurchasing('expectedDate')}
              value={expectedDeliveryDate}
              onChange={(e) => setExpectedDeliveryDate(e.target.value)}
            />
            <Input
              label={tc('notes')}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Card>

          {lines.length === 0 ? (
            <EmptyState title={tc('selectMaterialRequired')} />
          ) : (
            lines.map((line) => {
              const fabric = isFabricCategory(line.category);
              return (
                <Card key={line.inventoryItemId} className="space-y-3 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">{line.description}</p>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setLines((prev) =>
                          prev.filter((row) => row.inventoryItemId !== line.inventoryItemId),
                        )
                      }
                    >
                      {tCommon('delete')}
                    </Button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <NumberStepper
                      label={tc('qty')}
                      value={line.quantity}
                      min={0}
                      onChange={(quantity) => updateLine(line.inventoryItemId, { quantity })}
                    />
                    <div className="space-y-1">
                      <p className="text-xs text-text-secondary">{tc('unitPrice')}</p>
                      <p className="text-sm" dir="ltr">
                        {Number(line.unitPrice).toFixed(2)}
                      </p>
                    </div>
                    <Select
                      label={tPurchasing('destination')}
                      value={line.warehouseId ?? ''}
                      onChange={(e) =>
                        updateLine(line.inventoryItemId, {
                          warehouseId: e.target.value,
                          locationId: defaultLocationId(warehouses, e.target.value),
                        })
                      }
                    >
                      {warehouses.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.code} — {localizedName(locale, w)}
                        </option>
                      ))}
                    </Select>
                    <Select
                      label={fabric ? tPurchasing('holdingLocation') : tPurchasing('bin')}
                      value={line.locationId ?? ''}
                      onChange={(e) =>
                        updateLine(line.inventoryItemId, { locationId: e.target.value })
                      }
                    >
                      {locationsFor(line.warehouseId).map((loc) => (
                        <option key={loc.id} value={loc.id}>
                          {loc.code}
                          {loc.name ? ` — ${loc.name}` : ''}
                        </option>
                      ))}
                    </Select>
                  </div>
                </Card>
              );
            })
          )}

          <Card className="space-y-2 p-4">
            <div className="flex justify-between text-sm">
              <span>{tc('subtotal')}</span>
              <span dir="ltr">{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>{tc('taxAmount')}</span>
              <span dir="ltr">{tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span>{tCommon('total')}</span>
              <span dir="ltr">{(subtotal + tax).toFixed(2)}</span>
            </div>
            <Button
              className="mt-2 w-full"
              loading={create.isPending}
              disabled={create.isPending}
              onClick={() => create.mutate()}
            >
              {tPurchasing('createDraft')}
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
