'use client';

import {
  BomMaterialPicker,
  type PickedMaterial,
} from '@/components/admin/bom-material-picker';
import { InventoryItemThumb } from '@/components/admin/inventory-item-thumb';
import { localizedName } from '@maher/i18n';
import { Button, Input } from '@maher/ui';
import { Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useId, useMemo, useState } from 'react';

export type MaterialsListRow = {
  key: string;
  inventoryItemId: string;
  sku: string;
  nameEn: string;
  nameAr: string;
  category?: string;
  unit: string;
  quantity: string;
  unitPrice: string;
  imageUrl?: string | null;
};

type Props = {
  rows: MaterialsListRow[];
  onChange: (rows: MaterialsListRow[]) => void;
  /**
   * `order` — quantity + read-only unit cost / totals (purchase orders).
   * `request` — quantity + unit only (purchase requests; pricing comes later via offers).
   */
  variant?: 'order' | 'request';
};

const TAX_RATE = 0.16;

function money(n: number) {
  return Number.isFinite(n) ? n.toFixed(2) : '0.00';
}

export function emptyMaterialsList(): MaterialsListRow[] {
  return [];
}

export function MaterialsListEditor({ rows, onChange, variant = 'order' }: Props) {
  const t = useTranslations('catalog');
  const ti = useTranslations('inventory');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const idBase = useId();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [replaceIndex, setReplaceIndex] = useState<number | null>(null);
  const [removingKey, setRemovingKey] = useState<string | null>(null);
  const showCosts = variant === 'order';

  const excludeSkus = useMemo(() => {
    if (replaceIndex == null) return rows.map((r) => r.sku);
    return rows.filter((_, i) => i !== replaceIndex).map((r) => r.sku);
  }, [rows, replaceIndex]);

  const materialsCost = useMemo(
    () =>
      rows.reduce((sum, row) => {
        const qty = Number(row.quantity) || 0;
        const price = Number(row.unitPrice) || 0;
        return sum + qty * price;
      }, 0),
    [rows],
  );
  const grandTotal = materialsCost * (1 + TAX_RATE);
  const materialCount = rows.length;

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
    const nextRow: MaterialsListRow = {
      key: `${idBase}-${mat.inventoryItemId}-${Date.now()}`,
      inventoryItemId: mat.inventoryItemId,
      sku: mat.sku,
      nameEn: mat.nameEn,
      nameAr: mat.nameAr,
      category: mat.category,
      unit: mat.unit?.trim() || 'pcs',
      quantity: '1',
      unitPrice: String(Number(mat.standardCost ?? 0) || 0),
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
                quantity: row.quantity,
              }
            : row,
        ),
      );
    }
    setReplaceIndex(null);
  }

  function updateRow(index: number, patch: Partial<MaterialsListRow>) {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function removeRow(key: string) {
    setRemovingKey(key);
    window.setTimeout(() => {
      onChange(rows.filter((r) => r.key !== key));
      setRemovingKey(null);
    }, 220);
  }

  const rowGridClass = showCosts
    ? 'sm:grid-cols-[minmax(0,1.6fr)_minmax(5.5rem,0.7fr)_minmax(4.5rem,0.55fr)_minmax(6rem,0.8fr)_minmax(6rem,0.8fr)_auto]'
    : 'sm:grid-cols-[minmax(0,1.8fr)_minmax(6rem,0.8fr)_minmax(5rem,0.6fr)_auto]';

  return (
    <div className="maher-materials-list space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-[var(--maher-text-primary)]">
          {t('materialsList')}
        </h3>
        <Button type="button" variant="secondary" onClick={openAdd}>
          <Plus className="size-4" aria-hidden />
          {t('addMaterial')}
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="maher-animate-fade rounded-[var(--maher-radius-lg)] border border-dashed border-[var(--maher-border)] bg-[var(--maher-surface-muted)] px-4 py-8 text-center text-sm text-[var(--maher-text-secondary)]">
          {t('selectMaterialRequired')}
        </p>
      ) : (
        <div className="bom-lines">
          {rows.map((row, index) => {
            const qty = Number(row.quantity) || 0;
            const price = Number(row.unitPrice) || 0;
            const lineTotal = qty * price;
            const displayName =
              localizedName(locale, { nameEn: row.nameEn, nameAr: row.nameAr }) || row.sku;

            return (
              <div
                key={row.key}
                className={`bom-line-card grid gap-3 ${rowGridClass} sm:items-end${
                  removingKey === row.key ? ' maher-materials-row--out' : ''
                }`}
              >
                <div className="flex min-w-0 items-start gap-3">
                  <InventoryItemThumb src={row.imageUrl} alt={displayName} size={40} />
                  <div className="min-w-0">
                  <p className="mb-1 text-xs text-[var(--maher-text-secondary)]">
                    {t('material')}
                  </p>
                  <p className="truncate text-base font-semibold text-[var(--maher-text-primary)]">
                    {displayName}
                  </p>
                  <p className="truncate text-xs text-[var(--maher-text-secondary)]" dir="ltr">
                    {row.sku}
                    {row.category ? ` · ${row.category}` : ''}
                  </p>
                  <button
                    type="button"
                    className="bom-change-btn"
                    onClick={() => openReplace(index)}
                  >
                    <RefreshCw className="bom-change-btn__icon" aria-hidden />
                    {t('changeMaterial')}
                  </button>
                  </div>
                </div>

                <Input
                  label={t('qty')}
                  type="number"
                  min={0}
                  step="any"
                  value={row.quantity}
                  onChange={(e) => updateRow(index, { quantity: e.target.value })}
                  dir="ltr"
                  className="h-11 text-base"
                />

                <div>
                  <p className="mb-1 text-xs text-[var(--maher-text-secondary)]">{ti('unit')}</p>
                  <p className="flex h-11 items-center text-sm font-medium capitalize tabular-nums">
                    {row.unit}
                  </p>
                </div>

                {showCosts ? (
                  <>
                    <div>
                      <p className="mb-1 text-xs text-[var(--maher-text-secondary)]">{t('unitCost')}</p>
                      <p className="flex h-11 items-center text-sm font-medium tabular-nums" dir="ltr">
                        {money(Number(row.unitPrice) || 0)} {tCommon('currency')}
                      </p>
                    </div>

                    <div>
                      <p className="mb-1 text-xs text-[var(--maher-text-secondary)]">{t('totalCost')}</p>
                      <p
                        className="flex h-11 items-center text-base font-semibold tabular-nums"
                        dir="ltr"
                      >
                        {money(lineTotal)} {tCommon('currency')}
                      </p>
                    </div>
                  </>
                ) : null}

                <div className="flex items-end pb-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    aria-label={tCommon('delete')}
                    onClick={() => removeRow(row.key)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCosts ? (
        <div className="maher-materials-totals maher-animate-rise grid gap-2 rounded-[var(--maher-radius-lg)] border border-[var(--maher-border)] bg-[var(--maher-surface-muted)] px-4 py-3 sm:grid-cols-3">
          <div>
            <p className="text-xs text-[var(--maher-text-secondary)]">{t('materialCount')}</p>
            <p className="text-lg font-semibold tabular-nums" dir="ltr">
              {materialCount}
            </p>
          </div>
          <div>
            <p className="text-xs text-[var(--maher-text-secondary)]">{t('totalMaterialsCost')}</p>
            <p className="text-lg font-semibold tabular-nums" dir="ltr">
              {money(materialsCost)} {tCommon('currency')}
            </p>
          </div>
          <div>
            <p className="text-xs text-[var(--maher-text-secondary)]">
              {t('grandTotal')}{' '}
              <span className="text-[10px] font-normal">({t('inclTax')})</span>
            </p>
            <p className="text-lg font-bold tabular-nums text-[var(--maher-brand)]" dir="ltr">
              {money(grandTotal)} {tCommon('currency')}
            </p>
          </div>
        </div>
      ) : (
        <div className="maher-materials-totals maher-animate-rise rounded-[var(--maher-radius-lg)] border border-[var(--maher-border)] bg-[var(--maher-surface-muted)] px-4 py-3">
          <p className="text-xs text-[var(--maher-text-secondary)]">{t('materialCount')}</p>
          <p className="text-lg font-semibold tabular-nums" dir="ltr">
            {materialCount}
          </p>
        </div>
      )}

      <BomMaterialPicker
        open={pickerOpen}
        onClose={() => {
          setPickerOpen(false);
          setReplaceIndex(null);
        }}
        onPick={onPick}
        excludeSkus={excludeSkus}
        source="inventory"
        title={t('pickMaterial')}
        actionLabel={t('addMaterial')}
      />
    </div>
  );
}
