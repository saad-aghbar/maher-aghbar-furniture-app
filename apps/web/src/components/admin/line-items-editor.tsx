'use client';

import { Button, Input } from '@maher/ui';
import { Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

export type LineItemDraft = {
  key: string;
  description: string;
  quantity: string;
  unitPrice: string;
  notes?: string;
};

export function emptyLineItem(partial?: Partial<LineItemDraft>): LineItemDraft {
  return {
    key: partial?.key ?? `line-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    description: partial?.description ?? '',
    quantity: partial?.quantity ?? '1',
    unitPrice: partial?.unitPrice ?? '0',
    notes: partial?.notes ?? '',
  };
}

export function LineItemsEditor({
  lines,
  onChange,
  showUnitPrice = true,
  showNotes = false,
  minLines = 1,
}: {
  lines: LineItemDraft[];
  onChange: (lines: LineItemDraft[]) => void;
  showUnitPrice?: boolean;
  showNotes?: boolean;
  minLines?: number;
}) {
  const t = useTranslations('catalog');
  const tCommon = useTranslations('common');

  const update = (key: string, patch: Partial<LineItemDraft>) => {
    onChange(lines.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  };

  const remove = (key: string) => {
    if (lines.length <= minLines) return;
    onChange(lines.filter((line) => line.key !== key));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-text-primary">{t('lineItems')}</p>
        <Button
          type="button"
          size="sm"
          variant="subtle"
          onClick={() => onChange([...lines, emptyLineItem()])}
        >
          <Plus className="ms-0 me-1 h-3.5 w-3.5" />
          {tCommon('add')}
        </Button>
      </div>

      <div className="space-y-2">
        {lines.map((line, index) => (
          <div
            key={line.key}
            className="grid gap-2 rounded-lg border border-border bg-surface-muted/40 p-3 md:grid-cols-[minmax(0,2fr)_5rem_7rem_auto]"
          >
            <Input
              value={line.description}
              onChange={(e) => update(line.key, { description: e.target.value })}
              placeholder={`${t('productItem')} ${index + 1}`}
              required
            />
            <Input
              type="number"
              min="0"
              step="any"
              value={line.quantity}
              onChange={(e) => update(line.key, { quantity: e.target.value })}
              placeholder={t('qty')}
              required
            />
            {showUnitPrice ? (
              <Input
                type="number"
                min="0"
                step="any"
                value={line.unitPrice}
                onChange={(e) => update(line.key, { unitPrice: e.target.value })}
                placeholder={t('price')}
              />
            ) : (
              <div />
            )}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={lines.length <= minLines}
              onClick={() => remove(line.key)}
              aria-label={tCommon('delete')}
            >
              <Trash2 className="h-4 w-4 text-error" />
            </Button>
            {showNotes ? (
              <Input
                className="md:col-span-4"
                value={line.notes ?? ''}
                onChange={(e) => update(line.key, { notes: e.target.value })}
                placeholder={t('notes')}
              />
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Map drafts into API payloads, dropping blank rows. */
export function serializeLineItems(lines: LineItemDraft[], opts?: { includePrice?: boolean }) {
  return lines
    .filter((line) => line.description.trim())
    .map((line, index) => ({
      description: line.description.trim(),
      quantity: Number(line.quantity) || 0,
      ...(opts?.includePrice !== false
        ? { unitPrice: Number(line.unitPrice) || 0 }
        : {}),
      ...(line.notes?.trim() ? { notes: line.notes.trim() } : {}),
      sortOrder: index,
    }));
}
