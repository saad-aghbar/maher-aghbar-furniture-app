'use client';

import {
  BomMaterialPicker,
  type PickedMaterial,
} from '@/components/admin/bom-material-picker';
import { InventoryItemThumb } from '@/components/admin/inventory-item-thumb';
import { localizedName } from '@maher/i18n';
import { Button, Input, StatusBadge } from '@maher/ui';
import { Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useId, useMemo, useState } from 'react';

export type OrderSetupMaterialRow = {
  key: string;
  inventoryItemId: string;
  sku: string;
  nameEn: string;
  nameAr: string;
  nameHe?: string;
  category?: string;
  unit: string;
  expectedQty: string;
  source?: string;
  needsReview?: boolean;
  imageUrl?: string | null;
  availabilityStatus?: string | null;
  shortQty?: number | null;
};

type Props = {
  rows: OrderSetupMaterialRow[];
  onChange: (rows: OrderSetupMaterialRow[]) => void;
  readOnly?: boolean;
};

export function emptyOrderSetupMaterials(): OrderSetupMaterialRow[] {
  return [];
}

export function OrderSetupMaterialsEditor({ rows, onChange, readOnly }: Props) {
  const t = useTranslations('sales');
  const tCatalog = useTranslations('catalog');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const idBase = useId();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [replaceIndex, setReplaceIndex] = useState<number | null>(null);

  const excludeSkus = useMemo(() => {
    if (replaceIndex == null) return rows.map((r) => r.sku);
    return rows.filter((_, i) => i !== replaceIndex).map((r) => r.sku);
  }, [rows, replaceIndex]);

  function openAdd() {
    setReplaceIndex(null);
    setPickerOpen(true);
  }

  function openReplace(index: number) {
    setReplaceIndex(index);
    setPickerOpen(true);
  }

  function onPick(mat: PickedMaterial) {
    if (!mat.inventoryItemId) return;
    const nextRow: OrderSetupMaterialRow = {
      key: `${idBase}-${mat.inventoryItemId}-${Date.now()}`,
      inventoryItemId: mat.inventoryItemId,
      sku: mat.sku,
      nameEn: mat.nameEn,
      nameAr: mat.nameAr,
      category: mat.category,
      unit: mat.unit?.trim() || 'pcs',
      expectedQty: '1',
      source: 'CUSTOM',
      needsReview: false,
      imageUrl: mat.imageUrl ?? null,
    };
    if (replaceIndex == null) {
      onChange([...rows, nextRow]);
    } else {
      const idx = replaceIndex;
      onChange(
        rows.map((row, i) =>
          i === idx
            ? {
                ...nextRow,
                key: row.key,
                expectedQty: row.expectedQty,
                source: row.source === 'CATALOG' ? 'FACTORY_MODIFIED' : row.source,
              }
            : row,
        ),
      );
    }
    setReplaceIndex(null);
  }

  function updateRow(index: number, patch: Partial<OrderSetupMaterialRow>) {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-text-primary">{t('orderSetup.materials')}</h3>
        {!readOnly ? (
          <Button type="button" variant="secondary" size="sm" onClick={openAdd}>
            <Plus className="size-4" aria-hidden />
            {tCatalog('addMaterial')}
          </Button>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-[var(--maher-surface-muted)]/40 px-4 py-6 text-center text-sm text-text-secondary">
          {t('orderSetup.materialsEmpty')}
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row, index) => {
            const displayName =
              localizedName(locale, { nameEn: row.nameEn, nameAr: row.nameAr, nameHe: row.nameHe }) ||
              row.sku;
            return (
              <li
                key={row.key}
                className="grid gap-3 rounded-xl border border-border bg-[var(--maher-surface-muted)]/30 p-3 sm:grid-cols-[minmax(0,1.6fr)_minmax(6rem,0.7fr)_auto] sm:items-end"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <InventoryItemThumb src={row.imageUrl} alt={displayName} size={40} />
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-text-primary">{displayName}</p>
                    <p className="truncate text-xs text-text-secondary" dir="ltr">
                      {row.sku}
                      {row.category ? ` · ${row.category}` : ''}
                      {row.unit ? ` · ${row.unit}` : ''}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {row.needsReview ? <StatusBadge status="NEEDS_REVIEW" /> : null}
                      {row.availabilityStatus === 'SHORTAGE' ? (
                        <StatusBadge status="WAITING_FOR_MATERIALS" />
                      ) : null}
                      {row.shortQty != null && row.shortQty > 0 ? (
                        <span className="text-[11px] text-text-tertiary" dir="ltr">
                          {t('orderSetup.shortBy', { qty: String(row.shortQty) })}
                        </span>
                      ) : null}
                    </div>
                    {!readOnly ? (
                      <button
                        type="button"
                        className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
                        onClick={() => openReplace(index)}
                      >
                        <RefreshCw className="size-3" aria-hidden />
                        {tCatalog('changeMaterial')}
                      </button>
                    ) : null}
                  </div>
                </div>

                <Input
                  label={tCatalog('qty')}
                  type="number"
                  min={0}
                  step="any"
                  value={row.expectedQty}
                  disabled={readOnly}
                  onChange={(e) => updateRow(index, { expectedQty: e.target.value })}
                  dir="ltr"
                  className="h-11"
                />

                {!readOnly ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="justify-self-end text-text-secondary"
                    onClick={() => onChange(rows.filter((r) => r.key !== row.key))}
                    aria-label={tCommon('delete')}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                ) : (
                  <span />
                )}
              </li>
            );
          })}
        </ul>
      )}

      {!readOnly ? (
        <BomMaterialPicker
          open={pickerOpen}
          onClose={() => {
            setPickerOpen(false);
            setReplaceIndex(null);
          }}
          onPick={onPick}
          excludeSkus={excludeSkus}
          source="inventory"
        />
      ) : null}
    </div>
  );
}
