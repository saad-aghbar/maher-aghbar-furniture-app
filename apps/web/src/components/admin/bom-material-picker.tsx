'use client';

import { apiFetch, ApiClientError } from '@/lib/api-client';
import { InventoryItemThumb } from '@/components/admin/inventory-item-thumb';
import { localizedName } from '@maher/i18n';
import { Alert, Button, EmptyState, Input, Modal, Skeleton } from '@maher/ui';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';

export type MaterialCategoryGroup = 'fabric' | 'foam' | 'wood' | 'accessories';

export type PickedMaterial = {
  id: string;
  /** Present when the row came from inventory items (preferred for purchasing). */
  inventoryItemId?: string;
  sku: string;
  nameAr: string;
  nameEn: string;
  category: string;
  unit?: string;
  /** Fixed purchase cost from inventory (standardCost). */
  standardCost?: number;
  imageUrl?: string | null;
};

const CATEGORY_TILES: Array<{ key: MaterialCategoryGroup; labelKey: string }> = [
  { key: 'fabric', labelKey: 'categoryFabric' },
  { key: 'foam', labelKey: 'categoryFoam' },
  { key: 'wood', labelKey: 'categoryWood' },
  { key: 'accessories', labelKey: 'categoryAccessories' },
];

type Props = {
  open: boolean;
  onClose: () => void;
  onPick: (material: PickedMaterial) => void;
  /** SKUs already on the BOM — shown disabled */
  excludeSkus?: string[];
  /** Override modal title (defaults to catalog.pickMaterial) */
  title?: string;
  /** Override row action chip (defaults to catalog.addMaterial) */
  actionLabel?: string;
  /**
   * `inventory` — only list inventory items and always set inventoryItemId.
   * `auto` — inventory first, materials catalog fallback (BOM behaviour).
   */
  source?: 'auto' | 'inventory';
};

type InventoryRow = {
  id: string;
  sku: string;
  nameAr: string;
  nameEn: string;
  category: string;
  unit?: string | null;
  standardCost?: string | number | null;
  materialId?: string | null;
  imageUrl?: string | null;
};

type MaterialRow = {
  id: string;
  sku: string;
  nameAr: string;
  nameEn: string;
  category: string;
  unit?: string | null;
};

export function BomMaterialPicker({
  open,
  onClose,
  onPick,
  excludeSkus = [],
  title,
  actionLabel,
  source = 'auto',
}: Props) {
  const t = useTranslations('catalog');
  const ti = useTranslations('inventory');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const [categoryGroup, setCategoryGroup] = useState<MaterialCategoryGroup>('fabric');
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [listKey, setListKey] = useState(0);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => setDebouncedQ(q.trim()), 250);
    return () => clearTimeout(timer);
  }, [q, open]);

  useEffect(() => {
    if (!open) {
      setQ('');
      setDebouncedQ('');
      setCategoryGroup('fabric');
      setListKey(0);
    }
  }, [open]);

  useEffect(() => {
    setListKey((k) => k + 1);
  }, [categoryGroup, debouncedQ]);

  const excluded = useMemo(() => new Set(excludeSkus.filter(Boolean)), [excludeSkus]);

  const materialsQuery = useQuery({
    queryKey: ['materials-bom-pick', source, categoryGroup, debouncedQ],
    queryFn: async (): Promise<PickedMaterial[]> => {
      const params = new URLSearchParams({
        pageSize: '100',
        categoryGroup,
      });
      if (debouncedQ) params.set('q', debouncedQ);

      // Prefer inventory items (same 4 sections as Inventory UI).
      try {
        const inv = await apiFetch<{ data: InventoryRow[] }>(
          `/api/v1/inventory/items?${params}`,
        );
        if (inv.data?.length || source === 'inventory') {
          return (inv.data ?? []).map((row) => ({
            id: row.materialId || row.id,
            inventoryItemId: row.id,
            sku: row.sku,
            nameAr: row.nameAr,
            nameEn: row.nameEn,
            category: row.category,
            unit: row.unit ?? 'pcs',
            standardCost: Number(row.standardCost ?? 0) || 0,
            imageUrl: row.imageUrl ?? null,
          }));
        }
      } catch (err) {
        if (source === 'inventory') throw err;
        /* fall through to catalog materials */
      }

      const matParams = new URLSearchParams(params);
      matParams.set('isActive', 'true');
      const mats = await apiFetch<{ data: MaterialRow[] }>(`/api/v1/materials?${matParams}`);
      return (mats.data ?? []).map((row) => ({
        id: row.id,
        sku: row.sku,
        nameAr: row.nameAr,
        nameEn: row.nameEn,
        category: row.category,
        unit: row.unit ?? 'pcs',
        standardCost: 0,
      }));
    },
    enabled: open,
    retry: 1,
  });

  const rows = materialsQuery.data ?? [];
  const errorMessage =
    materialsQuery.error instanceof ApiClientError
      ? materialsQuery.error.message
      : materialsQuery.isError
        ? tCommon('loadFailed')
        : null;

  return (
    <Modal open={open} onClose={onClose} title={title ?? t('pickMaterial')} size="lg">
      <div className="bom-picker">
        <div className="bom-picker__tiles">
          {CATEGORY_TILES.map((tile) => (
            <button
              key={tile.key}
              type="button"
              onClick={() => setCategoryGroup(tile.key)}
              className={`bom-picker__tile${
                categoryGroup === tile.key ? ' bom-picker__tile--active' : ''
              }`}
            >
              {ti(tile.labelKey as 'categoryFabric')}
            </button>
          ))}
        </div>

        <div className="maher-animate-rise">
          <Input
            withSearchIcon
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('searchMaterials')}
          />
        </div>

        {errorMessage ? (
          <div className="maher-animate-shake">
            <Alert variant="error">{errorMessage}</Alert>
          </div>
        ) : null}

        <div key={listKey} className="bom-picker__list">
          {materialsQuery.isLoading ? (
            <div className="maher-stagger space-y-2 p-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : rows.length === 0 ? (
            <div className="maher-animate-pop p-4">
              <EmptyState title={t('noMaterialsInSection')} />
            </div>
          ) : (
            <ul>
              {rows.map((m) => {
                const already = excluded.has(m.sku);
                return (
                  <li key={`${m.sku}-${m.id}`}>
                    <button
                      type="button"
                      disabled={already}
                      onClick={() => {
                        if (already) return;
                        onPick(m);
                        onClose();
                      }}
                      className="bom-picker__row"
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <InventoryItemThumb src={m.imageUrl} alt="" size={36} />
                        <span className="min-w-0">
                        <span className="block truncate font-medium text-text-primary">
                          {localizedName(locale, m)}
                        </span>
                        <span className="block truncate text-xs text-text-secondary" dir="ltr">
                          {m.sku}
                          {m.category ? ` · ${m.category}` : ''}
                        </span>
                        </span>
                      </span>
                      {already ? (
                        <span className="shrink-0 text-xs text-text-tertiary">
                          {t('materialAlreadyOnBom')}
                        </span>
                      ) : (
                        <span className="bom-picker__add-chip">
                          {actionLabel ?? t('addMaterial')}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex justify-end">
          <Button variant="ghost" onClick={onClose}>
            {tCommon('cancel')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
