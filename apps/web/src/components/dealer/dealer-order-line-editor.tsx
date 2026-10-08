'use client';

import { BasketLinePhoto } from '@/components/dealer/dealer-line-details';
import { apiFetch } from '@/lib/api-client';
import { basketLineKind, lineFabricHint, type BasketFabric, type BasketLine } from '@/lib/basket';
import { Board, Button, Combobox, Input, Ltr, NumberField, Stamp, TextArea } from '@maher/ui';
import { localizedName } from '@maher/i18n';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';

type NamedRow = {
  id: string;
  code: string;
  nameEn: string;
  nameAr?: string | null;
  nameHe?: string | null;
};

function newFabricKey() {
  return `fab-${Math.random().toString(36).slice(2, 10)}`;
}

function fabricRows(line: BasketLine): BasketFabric[] {
  return line.fabrics.length
    ? line.fabrics
    : [{ key: newFabricKey(), type: '', color: '', role: '', notes: '' }];
}

function lineTitle(line: BasketLine) {
  return line.customProductName.trim() || line.variantLabel.trim() || line.productId;
}

export function DealerOrderLineEditor({
  lines,
  selectedId,
  onSelect,
  onPatch,
  onEditDetails,
  disabled,
}: {
  lines: BasketLine[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onPatch: (id: string, patch: Partial<BasketLine>) => void;
  onEditDetails: (line: BasketLine) => void;
  disabled?: boolean;
}) {
  const locale = useLocale();
  const tc = useTranslations('catalog');
  const tn = useTranslations('mobile.newOrder');
  const selected = lines.find((line) => line.id === selectedId) ?? lines[0] ?? null;
  const fabricsQuery = useQuery({
    queryKey: ['dealer-order-fabrics'],
    queryFn: () => apiFetch<{ data: NamedRow[] }>('/api/v1/fabrics?page=1&pageSize=200').then((res) => res.data),
  });
  const colorsQuery = useQuery({
    queryKey: ['dealer-order-colors'],
    queryFn: () => apiFetch<{ data: NamedRow[] }>('/api/v1/colors?page=1&pageSize=200').then((res) => res.data),
  });

  if (!selected) return null;

  const rows = fabricRows(selected);
  const kind = basketLineKind(selected);
  const kindLabel =
    kind === 'custom' ? tc('basketLineCustom') : kind === 'customized' ? tc('basketLineModified') : tc('basketLineStandard');

  function patchRow(index: number, partial: Partial<BasketFabric>) {
    onPatch(selected!.id, {
      fabrics: rows.map((row, i) => (i === index ? { ...row, ...partial } : row)),
    });
  }

  return (
    <div className="space-y-5">
      <Board tone="brand">
        <Board.Header title={tn('basket')} meta={<Stamp tone="brand" size="sm">{lines.length}</Stamp>} />
        <div className="flex gap-2 overflow-x-auto px-5 pb-4">
          {lines.map((line) => {
            const active = line.id === selected.id;
            const lineKind = basketLineKind(line);
            const stamp =
              lineKind === 'custom'
                ? tc('basketLineCustom')
                : lineKind === 'customized'
                  ? tc('basketLineModified')
                  : tc('basketLineStandard');
            const hint = lineFabricHint(line);
            return (
              <button
                key={line.id}
                type="button"
                aria-pressed={active}
                disabled={disabled}
                onClick={() => onSelect(line.id)}
                className={`flex w-44 shrink-0 flex-col gap-2 rounded-[14px] border p-2 text-start transition ${
                  active
                    ? 'border-[var(--maher-brand)] bg-[var(--maher-brand-soft)]'
                    : 'border-[var(--maher-border)] bg-[var(--maher-surface)] hover:border-[var(--maher-brand)]'
                }`}
              >
                <div className="h-16 overflow-hidden rounded-[10px] bg-[var(--maher-surface-muted)]">
                  <BasketLinePhoto line={line} />
                </div>
                <span className="line-clamp-2 text-[13px] font-medium leading-4 text-[var(--maher-text-primary)]">
                  {lineTitle(line)}
                </span>
                <span className="flex flex-wrap items-center gap-1.5">
                  <Stamp
                    tone={lineKind === 'custom' ? 'info' : lineKind === 'customized' ? 'warning' : 'neutral'}
                    size="sm"
                  >
                    {stamp}
                  </Stamp>
                  <Ltr className="text-[12px] text-[var(--maher-text-secondary)]">× {line.quantity}</Ltr>
                </span>
                <span className="line-clamp-2 min-h-8 text-[12px] leading-4 text-[var(--maher-text-tertiary)]">
                  {hint || tn('fabricSection')}
                </span>
              </button>
            );
          })}
        </div>
      </Board>

      <Board tone={kind === 'custom' ? 'info' : kind === 'customized' ? 'warning' : 'brand'}>
        <Board.Header
          title={lineTitle(selected)}
          meta={<Stamp tone={kind === 'custom' ? 'info' : kind === 'customized' ? 'warning' : 'neutral'} size="sm">{kindLabel}</Stamp>}
          actions={
            <Button size="sm" variant="secondary" disabled={disabled} onClick={() => onEditDetails(selected)}>
              {selected.productId.trim() ? tn('customize') : tn('editCustomItem')}
            </Button>
          }
        />
        <Board.Body className="space-y-4">
          <NumberField
            label={tc('quantity')}
            value={Math.max(1, Math.round(Number(selected.quantity) || 1))}
            min={1}
            step={1}
            decimals={0}
            disabled={disabled}
            onChange={(value) =>
              onPatch(selected.id, { quantity: String(Math.max(1, Math.round(value ?? 1))) })
            }
          />
          {rows.map((row, index) => (
            <div key={row.key} className="space-y-3 rounded-[12px] border border-[var(--maher-border)] p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12px] font-semibold text-[var(--maher-text-secondary)]">
                  {tn('fabricN', { n: index + 1 })}
                </span>
                {rows.length > 1 ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={disabled}
                    onClick={() => onPatch(selected.id, { fabrics: rows.filter((_, i) => i !== index) })}
                  >
                    {tn('removeFabric')}
                  </Button>
                ) : null}
              </div>
              <Combobox
                label={tn('catalogFabricSection')}
                value={row.fabricId || null}
                selectedLabel={row.fabricId ? row.type : undefined}
                placeholder={tn('fabricNamePlaceholder')}
                clearable
                disabled={disabled}
                options={(fabricsQuery.data ?? []).map((fabric) => ({
                  value: fabric.id,
                  label: localizedName(locale, fabric) || fabric.code,
                  description: fabric.code,
                }))}
                onChange={(id, option) =>
                  patchRow(index, {
                    fabricId: id ?? '',
                    type: option?.label ?? '',
                    code: option?.description ?? '',
                  })
                }
              />
              <Input
                label={tn('typedFabricSection')}
                value={row.type}
                placeholder={tn('typedFabricPlaceholder')}
                disabled={disabled}
                onChange={(event) => patchRow(index, { type: event.target.value, fabricId: '' })}
              />
              <Combobox
                label={tn('catalogColorSection')}
                value={row.colorId || null}
                selectedLabel={row.colorId ? row.color : undefined}
                placeholder={tn('fabricColorPlaceholder')}
                clearable
                disabled={disabled}
                options={(colorsQuery.data ?? []).map((color) => ({
                  value: color.id,
                  label: localizedName(locale, color) || color.code,
                  description: color.code,
                }))}
                onChange={(id, option) =>
                  patchRow(index, { colorId: id ?? '', color: option?.label ?? '' })
                }
              />
              <Input
                label={tn('typedColorSection')}
                value={row.color}
                placeholder={tn('typedColorPlaceholder')}
                disabled={disabled}
                onChange={(event) => patchRow(index, { color: event.target.value, colorId: '' })}
              />
              <div className="grid gap-3 sm:grid-cols-3">
                <Input
                  label={tn('fabricCode')}
                  value={row.code ?? ''}
                  placeholder={tn('fabricCodePlaceholder')}
                  disabled={disabled}
                  onChange={(event) => patchRow(index, { code: event.target.value })}
                />
                <Input
                  label={tn('fabricRole')}
                  value={row.role}
                  placeholder={tn('fabricRolePlaceholder')}
                  disabled={disabled}
                  onChange={(event) => patchRow(index, { role: event.target.value })}
                />
                <Input
                  label={tn('fabricQty')}
                  value={row.quantity ?? ''}
                  placeholder={tn('fabricQtyPlaceholder')}
                  type="number"
                  min="0"
                  step="0.5"
                  dir="ltr"
                  disabled={disabled}
                  onChange={(event) => patchRow(index, { quantity: event.target.value })}
                />
              </div>
            </div>
          ))}
          <Button
            type="button"
            variant="ghost"
            disabled={disabled}
            onClick={() =>
              onPatch(selected.id, {
                fabrics: [...rows, { key: newFabricKey(), type: '', color: '', role: '', notes: '' }],
              })
            }
          >
            {tn('addFabric')}
          </Button>
          <TextArea
            autoGrow
            label={tn('itemNotes')}
            value={selected.notes}
            rows={3}
            disabled={disabled}
            onChange={(event) => onPatch(selected.id, { notes: event.target.value })}
          />
        </Board.Body>
      </Board>
    </div>
  );
}
