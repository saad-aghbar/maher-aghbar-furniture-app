'use client';

import { apiFetch, apiUpload } from '@/lib/api-client';
import type { BasketLine, BasketMeasurement, BasketOption } from '@/lib/basket';
import { mediaSrc } from '@/lib/media';
import {
  Board,
  Button,
  CameraCapture,
  Combobox,
  Input,
  NumberField,
  Sheet,
  Stamp,
  TextArea,
} from '@maher/ui';
import { localizedName } from '@maher/i18n';
import { useQuery } from '@tanstack/react-query';
import { Armchair, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

const DEALER_NAMED_SPEC_GROUP = 'DEALER_SPEC';
const UNITS = ['cm', 'm', 'mm', 'in', 'pcs'] as const;

type SpecGroup = { id: string; code: string; nameEn: string; nameAr?: string | null; nameHe?: string | null };
type SpecValue = {
  id: string;
  groupId: string;
  code: string;
  nameEn: string;
  nameAr?: string | null;
  nameHe?: string | null;
};

type SpecSheet =
  | { kind: 'add' }
  | { kind: 'named'; code?: string };

type MeasureSheet = { kind: 'add' | 'edit'; id: string };

export function isNamedDealerSpec(opt: BasketOption): boolean {
  return !String(opt.specOptionValueId ?? '').trim() || opt.groupCode === DEALER_NAMED_SPEC_GROUP;
}

function specCode(name: string): string {
  const base = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 28);
  return base || `DEALER_${Date.now().toString(36).toUpperCase()}`;
}

function newMeasureId(): string {
  return `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function patchLine(line: BasketLine, patch: Partial<BasketLine>): BasketLine {
  return { ...line, ...patch, modifiedByDealer: line.productId.trim() ? true : line.modifiedByDealer };
}

export function DealerLineDetails({
  line,
  onChange,
  mode,
}: {
  line: BasketLine;
  onChange: (next: BasketLine) => void;
  mode: 'modify' | 'custom';
}) {
  const locale = useLocale();
  const tc = useTranslations('catalog');
  const tn = useTranslations('mobile.newOrder');
  const tCommon = useTranslations('common');
  const tu = useTranslations('catalog.measurementUnits');
  const groupsQuery = useQuery({
    queryKey: ['spec-option-groups'],
    queryFn: () =>
      apiFetch<{ data: SpecGroup[] }>('/api/v1/spec-option-groups?pageSize=100').then((r) => r.data ?? []),
    retry: false,
    staleTime: 60_000,
  });
  const valuesQuery = useQuery({
    queryKey: ['spec-option-values'],
    queryFn: () =>
      apiFetch<{ data: SpecValue[] }>('/api/v1/spec-option-values?pageSize=200').then((r) => r.data ?? []),
    retry: false,
    staleTime: 60_000,
  });
  const groups = groupsQuery.data ?? [];
  const values = valuesQuery.data ?? [];

  const named = line.options.filter(isNamedDealerSpec);
  const library = line.options.filter((opt) => !isNamedDealerSpec(opt));
  const usedGroupIds = new Set(library.map((opt) => opt.groupId).filter(Boolean));
  const unused = groups.filter((group) => !usedGroupIds.has(group.id) && !library.some((opt) => opt.groupCode === group.code));

  const num = (raw: string) => (raw.trim() === '' ? null : Number(raw));
  const str = (value: number | null) => (value == null ? '' : String(value));

  function setCore(key: 'dimWidth' | 'dimHeight' | 'dimDepth' | 'dimSeat', value: number | null) {
    onChange(patchLine(line, { [key]: str(value) }));
  }

  function setLibrary(group: SpecGroup, valueId: string | null) {
    const value = values.find((row) => row.id === valueId) ?? null;
    const options = line.options.filter(
      (opt) => isNamedDealerSpec(opt) || (opt.groupId !== group.id && opt.groupCode !== group.code),
    );
    if (value) {
      options.push({
        specOptionValueId: value.id,
        groupId: group.id,
        groupCode: group.code,
        code: value.code,
        nameEn: value.nameEn,
        nameAr: value.nameAr ?? undefined,
      });
    }
    onChange(patchLine(line, { options }));
  }

  function removeNamed(code: string) {
    onChange(
      patchLine(line, {
        options: line.options.filter((opt) => !(isNamedDealerSpec(opt) && opt.code === code)),
      }),
    );
  }

  function saveNamed(label: string, value: string, replaceCode?: string) {
    const name = label.trim();
    const nextValue = value.trim();
    if (!name || !nextValue) return;
    const code = specCode(name);
    const options = line.options.filter((opt) => {
      if (!isNamedDealerSpec(opt)) return true;
      if (replaceCode && opt.code === replaceCode) return false;
      if (opt.code === code) return false;
      return true;
    });
    options.push({
      specOptionValueId: '',
      groupCode: DEALER_NAMED_SPEC_GROUP,
      code,
      nameEn: name,
      nameAr: name,
      note: nextValue,
    });
    onChange(patchLine(line, { options }));
  }

  function saveMeasurement(row: BasketMeasurement) {
    const label = row.label.trim();
    const value = row.value.trim();
    if (!label || !value) return;
    const next = { ...row, label, value, unit: row.unit || 'cm' };
    const exists = line.customMeasurements.some((item) => item.id === row.id);
    onChange(
      patchLine(line, {
        customMeasurements: exists
          ? line.customMeasurements.map((item) => (item.id === row.id ? next : item))
          : [...line.customMeasurements, next],
      }),
    );
  }

  return (
    <>
      {mode === 'custom' ? (
        <CustomIdentity
          line={line}
          onChange={(next) => onChange(patchLine(next, {}))}
        />
      ) : null}
      {mode === 'custom' ? <CustomPhotos line={line} onChange={(next) => onChange(patchLine(next, {}))} /> : null}

      <SpecsBoard
        groups={groups}
        values={values}
        unused={unused}
        library={library}
        named={named}
        locale={locale}
        onSetLibrary={setLibrary}
        onRemoveNamed={removeNamed}
        onSaveNamed={saveNamed}
        labels={{
          title: tc('specs'),
          hint: tn('modifySpecsHint'),
          add: tc('addSpec'),
          empty: tn('modifyNoSpecsBody'),
          own: tn('ownSpec'),
          ownHint: tn('ownSpecHint'),
          ownName: tn('ownSpecName'),
          ownNamePlaceholder: tn('ownSpecNamePlaceholder'),
          ownValue: tn('ownSpecValue'),
          ownValuePlaceholder: tn('ownSpecValuePlaceholder'),
          saveOwn: tn('saveOwnSpec'),
          editOwn: tn('editOwnSpec'),
          pickLibrary: tn('pickLibrarySpecHint'),
          noUnused: tn('noUnusedLibrarySpecs'),
          remove: tCommon('remove'),
          emptyValue: tc('emptyValue'),
        }}
      />

      <MeasurementsBoard
        line={line}
        showQuantity={mode === 'modify'}
        onCore={setCore}
        onQuantity={(quantity) => onChange(patchLine(line, { quantity }))}
        onSave={saveMeasurement}
        onRemove={(id) =>
          onChange(patchLine(line, { customMeasurements: line.customMeasurements.filter((row) => row.id !== id) }))
        }
        num={num}
        unitLabel={(unit) => tu(unit as (typeof UNITS)[number])}
        labels={{
          title: tn('dimensionsSection'),
          hint: tn('modifyMeasurementsHint'),
          add: tn('addMeasurement'),
          empty: tn('noCustomMeasurements'),
          width: tc('dimWidth'),
          height: tc('dimHeight'),
          depth: tc('dimDepth'),
          seat: tc('seatHeight'),
          quantity: tc('quantity'),
          name: tc('dimensionLabel'),
          namePlaceholder: tc('dimensionLabelPlaceholder'),
          value: tc('dimensionValue'),
          unit: tc('measurementType'),
          save: tCommon('save'),
          remove: tCommon('remove'),
          edit: tCommon('edit'),
        }}
      />

      <Board tone={line.notes.trim() ? 'brand' : 'neutral'}>
        <Board.Header
          title={tn('itemNotes')}
          description={mode === 'custom' ? tn('customNotesHint') : tn('modifyNotesHint')}
        />
        <Board.Body>
          <TextArea
            autoGrow
            label={tn('itemNotes')}
            value={line.notes}
            placeholder={mode === 'custom' ? tn('customNotesPlaceholder') : tn('modifyNotesPlaceholder')}
            rows={3}
            onChange={(event) => onChange(patchLine(line, { notes: event.target.value }))}
          />
        </Board.Body>
      </Board>
    </>
  );
}

function CustomIdentity({ line, onChange }: { line: BasketLine; onChange: (next: BasketLine) => void }) {
  const tn = useTranslations('mobile.newOrder');
  const tc = useTranslations('catalog');
  return (
    <Board tone="info" wash="top">
      <Board.Header
        title={tn('customItemTitle')}
        description={tn('customItemHint')}
        meta={<Stamp tone="info" size="sm">{tn('waitingForFactoryPrice')}</Stamp>}
      />
      <Board.Body className="grid gap-4 md:grid-cols-2">
        <Input
          label={tn('modelName')}
          value={line.customProductName}
          placeholder={tn('modelNamePlaceholder')}
          onChange={(event) => onChange({ ...line, customProductName: event.target.value, productId: '' })}
          required
        />
        <NumberField
          label={tc('quantity')}
          value={Math.max(1, Number(line.quantity) || 1)}
          min={1}
          step={1}
          decimals={0}
          onChange={(value) => onChange({ ...line, quantity: String(Math.max(1, Math.round(value ?? 1))) })}
        />
      </Board.Body>
    </Board>
  );
}

function CustomPhotos({ line, onChange }: { line: BasketLine; onChange: (next: BasketLine) => void }) {
  const tn = useTranslations('mobile.newOrder');
  const tCommon = useTranslations('common');
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const ids = line.photoDocumentIds.filter(Boolean);
  const missing = ids.filter((id) => !previews[id]).join('|');

  useEffect(() => {
    if (!missing) return;
    let cancel = false;
    void Promise.all(
      missing.split('|').map(async (id) => {
        try {
          const res = await apiFetch<{ downloadPath: string }>(`/api/v1/uploads/documents/${id}/link`);
          return [id, mediaSrc(res.downloadPath) ?? ''] as const;
        } catch {
          return [id, ''] as const;
        }
      }),
    ).then((rows) => {
      if (cancel) return;
      setPreviews((prev) => {
        const next = { ...prev };
        for (const [id, src] of rows) if (src) next[id] = src;
        return next;
      });
    });
    return () => {
      cancel = true;
    };
  }, [missing]);

  async function onUpload(file: File) {
    const blob = URL.createObjectURL(file);
    const form = new FormData();
    form.append('file', file);
    const res = await apiUpload<{ document: { id: string } }>('/api/v1/uploads?category=ORDER_IMAGE', form);
    setPreviews((prev) => ({ ...prev, [res.document.id]: blob }));
    const photoDocumentIds = [...ids, res.document.id];
    onChange({
      ...line,
      productId: '',
      imageUrl: '',
      photoDocumentIds,
      primaryImageDocumentId: line.primaryImageDocumentId || res.document.id,
    });
  }

  function remove(id: string) {
    const photoDocumentIds = ids.filter((row) => row !== id);
    onChange({
      ...line,
      imageUrl: '',
      photoDocumentIds,
      primaryImageDocumentId: photoDocumentIds[0] ?? '',
    });
  }

  return (
    <Board tone={ids.length ? 'success' : 'neutral'}>
      <Board.Header
        title={tn('customPhotos')}
        description={tn('customPhotosHint')}
        meta={<Stamp tone={ids.length ? 'success' : 'neutral'} size="sm">{ids.length}</Stamp>}
      />
      <Board.Body className="space-y-4">
        {ids.length === 0 ? (
          <p className="text-[14px] leading-5 text-[var(--maher-text-secondary)]">{tn('customPhotosEmpty')}</p>
        ) : (
          <ul className="flex flex-wrap gap-3">
            {ids.map((id) => (
              <li key={id} className="relative h-24 w-24 overflow-hidden rounded-[12px] bg-[var(--maher-surface-muted)]">
                {previews[id] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previews[id]} alt="" className="h-full w-full object-cover" />
                ) : null}
                <button
                  type="button"
                  className="absolute end-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--maher-surface)] text-[var(--maher-text-secondary)] shadow-sm"
                  aria-label={tCommon('delete')}
                  onClick={() => remove(id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <CameraCapture label={tn('addLinePhoto')} hint={tn('customPhotosHint')} onUploadFile={onUpload} />
      </Board.Body>
    </Board>
  );
}

function SpecsBoard({
  groups,
  values,
  unused,
  library,
  named,
  locale,
  onSetLibrary,
  onRemoveNamed,
  onSaveNamed,
  labels,
}: {
  groups: SpecGroup[];
  values: SpecValue[];
  unused: SpecGroup[];
  library: BasketOption[];
  named: BasketOption[];
  locale: string;
  onSetLibrary: (group: SpecGroup, valueId: string | null) => void;
  onRemoveNamed: (code: string) => void;
  onSaveNamed: (label: string, value: string, replaceCode?: string) => void;
  labels: {
    title: string;
    hint: string;
    add: string;
    empty: string;
    own: string;
    ownHint: string;
    ownName: string;
    ownNamePlaceholder: string;
    ownValue: string;
    ownValuePlaceholder: string;
    saveOwn: string;
    editOwn: string;
    pickLibrary: string;
    noUnused: string;
    remove: string;
    emptyValue: string;
  };
}) {
  const [sheet, setSheet] = useState<SpecSheet | null>(null);
  const editing = sheet?.kind === 'named' ? named.find((opt) => opt.code === sheet.code) : undefined;
  const count = library.length + named.length;

  return (
    <>
      <Board tone={count ? 'brand' : 'neutral'}>
        <Board.Header
          title={labels.title}
          description={labels.hint}
          meta={<Stamp tone={count ? 'brand' : 'neutral'} size="sm">{count}</Stamp>}
          actions={
            <Button size="sm" variant="secondary" onClick={() => setSheet({ kind: 'add' })}>
              {labels.add}
            </Button>
          }
        />
        <Board.Body className="space-y-3">
          {count === 0 ? <p className="text-[14px] leading-5 text-[var(--maher-text-secondary)]">{labels.empty}</p> : null}
          {library.map((opt) => {
            const group = groups.find((row) => row.id === opt.groupId || row.code === opt.groupCode);
            const opts = values.filter((row) => row.groupId === (group?.id ?? opt.groupId));
            if (!group) {
              return (
                <div key={opt.specOptionValueId || opt.code} className="flex items-center justify-between gap-3">
                  <p className="text-[14px] text-[var(--maher-text-primary)]">{opt.nameEn || opt.code}</p>
                </div>
              );
            }
            return (
              <div key={group.id} className="grid items-end gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                <Combobox<string>
                  label={localizedName(locale, group)}
                  value={opt.specOptionValueId || null}
                  clearable
                  placeholder={labels.emptyValue}
                  options={opts.map((row) => ({ value: row.id, label: localizedName(locale, row) }))}
                  onChange={(value) => onSetLibrary(group, value)}
                />
                <Button size="sm" variant="ghost" aria-label={labels.remove} onClick={() => onSetLibrary(group, null)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
          {named.map((opt) => (
            <div key={opt.code} className="flex items-center justify-between gap-3 rounded-[12px] bg-[var(--maher-surface-muted)] px-3 py-2">
              <div className="min-w-0">
                <p className="text-[12px] text-[var(--maher-text-tertiary)]">{opt.nameEn || labels.own}</p>
                <p className="truncate text-[14px] text-[var(--maher-text-primary)]">{opt.note || '—'}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button size="sm" variant="ghost" onClick={() => setSheet({ kind: 'named', code: opt.code })}>
                  {labels.editOwn}
                </Button>
                <Button size="sm" variant="ghost" aria-label={labels.remove} onClick={() => onRemoveNamed(opt.code ?? '')}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </Board.Body>
      </Board>
      <SpecEditorSheet
        open={sheet != null}
        unused={sheet?.kind === 'named' ? [] : unused}
        values={values}
        locale={locale}
        editing={editing ? { label: editing.nameEn || editing.nameAr || '', value: editing.note || '', code: editing.code } : null}
        labels={labels}
        onClose={() => setSheet(null)}
        onPickLibrary={(group, valueId) => {
          onSetLibrary(group, valueId);
          setSheet(null);
        }}
        onSaveNamed={(label, value) => {
          onSaveNamed(label, value, editing?.code);
          setSheet(null);
        }}
      />
    </>
  );
}

function SpecEditorSheet({
  open,
  unused,
  values,
  locale,
  editing,
  labels,
  onClose,
  onPickLibrary,
  onSaveNamed,
}: {
  open: boolean;
  unused: SpecGroup[];
  values: SpecValue[];
  locale: string;
  editing: { label: string; value: string; code?: string } | null;
  labels: {
    add: string;
    own: string;
    ownHint: string;
    ownName: string;
    ownNamePlaceholder: string;
    ownValue: string;
    ownValuePlaceholder: string;
    saveOwn: string;
    editOwn: string;
    pickLibrary: string;
    noUnused: string;
    emptyValue: string;
  };
  onClose: () => void;
  onPickLibrary: (group: SpecGroup, valueId: string) => void;
  onSaveNamed: (label: string, value: string) => void;
}) {
  const [groupId, setGroupId] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [value, setValue] = useState('');

  useEffect(() => {
    if (!open) return;
    setGroupId(null);
    setLabel(editing?.label ?? '');
    setValue(editing?.value ?? '');
  }, [open, editing?.code, editing?.label, editing?.value]);

  const group = unused.find((row) => row.id === groupId) ?? null;
  const opts = group ? values.filter((row) => row.groupId === group.id) : [];

  return (
    <Sheet open={open} onClose={onClose} title={editing ? labels.editOwn : labels.add} side="auto">
      <div className="space-y-4">
        {!editing ? (
          <div className="space-y-3">
            <p className="text-[14px] leading-5 text-[var(--maher-text-secondary)]">{labels.pickLibrary}</p>
            {unused.length === 0 ? (
              <p className="text-[14px] leading-5 text-[var(--maher-text-secondary)]">{labels.noUnused}</p>
            ) : (
              <>
                <Combobox<string>
                  label={labels.add}
                  value={groupId}
                  placeholder={labels.emptyValue}
                  options={unused.map((row) => ({ value: row.id, label: localizedName(locale, row) }))}
                  onChange={(next) => setGroupId(next)}
                />
                {group ? (
                  <Combobox<string>
                    label={localizedName(locale, group)}
                    value={null}
                    placeholder={labels.emptyValue}
                    options={opts.map((row) => ({ value: row.id, label: localizedName(locale, row) }))}
                    onChange={(next) => {
                      if (next) onPickLibrary(group, next);
                    }}
                  />
                ) : null}
              </>
            )}
          </div>
        ) : null}
        <div className="space-y-3 border-t border-[var(--maher-border)] pt-4">
          <p className="text-[14px] font-medium text-[var(--maher-text-primary)]">{labels.own}</p>
          <p className="text-[14px] leading-5 text-[var(--maher-text-secondary)]">{labels.ownHint}</p>
          <Input label={labels.ownName} value={label} placeholder={labels.ownNamePlaceholder} onChange={(event) => setLabel(event.target.value)} />
          <Input label={labels.ownValue} value={value} placeholder={labels.ownValuePlaceholder} onChange={(event) => setValue(event.target.value)} />
          <Button disabled={!label.trim() || !value.trim()} onClick={() => onSaveNamed(label, value)}>
            {labels.saveOwn}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

function MeasurementsBoard({
  line,
  showQuantity,
  onCore,
  onQuantity,
  onSave,
  onRemove,
  num,
  unitLabel,
  labels,
}: {
  line: BasketLine;
  showQuantity: boolean;
  onCore: (key: 'dimWidth' | 'dimHeight' | 'dimDepth' | 'dimSeat', value: number | null) => void;
  onQuantity: (quantity: string) => void;
  onSave: (row: BasketMeasurement) => void;
  onRemove: (id: string) => void;
  num: (raw: string) => number | null;
  unitLabel: (unit: string) => string;
  labels: {
    title: string;
    hint: string;
    add: string;
    empty: string;
    width: string;
    height: string;
    depth: string;
    seat: string;
    quantity: string;
    name: string;
    namePlaceholder: string;
    value: string;
    unit: string;
    save: string;
    remove: string;
    edit: string;
  };
}) {
  const [sheet, setSheet] = useState<MeasureSheet | null>(null);
  const editing = sheet?.kind === 'edit' ? line.customMeasurements.find((row) => row.id === sheet.id) : undefined;
  const draft: BasketMeasurement = editing ?? {
    id: sheet?.id ?? 'closed',
    label: '',
    value: '',
    unit: 'cm',
  };

  return (
    <>
      <Board tone="neutral">
        <Board.Header
          title={labels.title}
          description={labels.hint}
          actions={
            <Button size="sm" variant="secondary" onClick={() => setSheet({ kind: 'add', id: newMeasureId() })}>
              {labels.add}
            </Button>
          }
        />
        <Board.Body className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <NumberField label={labels.width} unit="cm" min={0} value={num(line.dimWidth)} onChange={(value) => onCore('dimWidth', value)} />
            <NumberField label={labels.height} unit="cm" min={0} value={num(line.dimHeight)} onChange={(value) => onCore('dimHeight', value)} />
            <NumberField label={labels.depth} unit="cm" min={0} value={num(line.dimDepth)} onChange={(value) => onCore('dimDepth', value)} />
            <NumberField label={labels.seat} unit="cm" min={0} value={num(line.dimSeat)} onChange={(value) => onCore('dimSeat', value)} />
            {showQuantity ? (
              <NumberField
                label={labels.quantity}
                min={1}
                step={1}
                decimals={0}
                value={Math.max(1, Number(line.quantity) || 1)}
                onChange={(value) => onQuantity(String(Math.max(1, Math.round(value ?? 1))))}
              />
            ) : null}
          </div>
          {line.customMeasurements.length === 0 ? (
            <p className="text-[14px] leading-5 text-[var(--maher-text-secondary)]">{labels.empty}</p>
          ) : (
            <ul className="space-y-2">
              {line.customMeasurements.map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-3 rounded-[12px] bg-[var(--maher-surface-muted)] px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-medium text-[var(--maher-text-primary)]">{row.label}</p>
                    <p className="text-[13px] text-[var(--maher-text-secondary)]" dir="ltr">
                      {row.value} {unitLabel(row.unit || 'cm')}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setSheet({ kind: 'edit', id: row.id })}>
                      {labels.edit}
                    </Button>
                    <Button size="sm" variant="ghost" aria-label={labels.remove} onClick={() => onRemove(row.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Board.Body>
      </Board>
      <MeasureEditorSheet
        open={sheet != null}
        title={sheet?.kind === 'edit' ? labels.edit : labels.add}
        initial={draft}
        labels={labels}
        unitLabel={unitLabel}
        onClose={() => setSheet(null)}
        onSave={(row) => {
          onSave(row);
          setSheet(null);
        }}
      />
    </>
  );
}

function MeasureEditorSheet({
  open,
  title,
  initial,
  labels,
  unitLabel,
  onClose,
  onSave,
}: {
  open: boolean;
  title: string;
  initial: BasketMeasurement;
  labels: { name: string; namePlaceholder: string; value: string; unit: string; save: string };
  unitLabel: (unit: string) => string;
  onClose: () => void;
  onSave: (row: BasketMeasurement) => void;
}) {
  const [row, setRow] = useState(initial);
  const draftKey = `${initial.id}|${initial.label}|${initial.value}|${initial.unit ?? ''}`;
  useEffect(() => {
    if (!open) return;
    setRow(initial);
    // Reset when the sheet opens onto a different measurement, not on each keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, draftKey]);

  return (
    <Sheet open={open} onClose={onClose} title={title} side="auto">
      <div className="space-y-3">
        <Input
          label={labels.name}
          value={row.label}
          placeholder={labels.namePlaceholder}
          onChange={(event) => setRow({ ...row, label: event.target.value })}
        />
        <NumberField
          label={labels.value}
          min={0}
          value={row.value.trim() === '' ? null : Number(row.value)}
          onChange={(value) => setRow({ ...row, value: value == null ? '' : String(value) })}
        />
        <Combobox<string>
          label={labels.unit}
          value={row.unit || 'cm'}
          options={UNITS.map((unit) => ({ value: unit, label: unitLabel(unit) }))}
          onChange={(value) => setRow({ ...row, unit: value || 'cm' })}
        />
        <Button disabled={!row.label.trim() || !row.value.trim()} onClick={() => onSave(row)}>
          {labels.save}
        </Button>
      </div>
    </Sheet>
  );
}

export function BasketLinePhoto({ line }: { line: BasketLine }) {
  const catalog = line.productId.trim() ? mediaSrc(line.imageUrl) : null;
  const photoId = line.photoDocumentIds.find(Boolean) ?? '';
  const [src, setSrc] = useState<string | null>(catalog);
  useEffect(() => {
    if (catalog) {
      setSrc(catalog);
      return;
    }
    if (!photoId) {
      setSrc(mediaSrc(line.imageUrl));
      return;
    }
    let cancel = false;
    void apiFetch<{ downloadPath: string }>(`/api/v1/uploads/documents/${photoId}/link`)
      .then((res) => {
        if (!cancel) setSrc(mediaSrc(res.downloadPath));
      })
      .catch(() => {
        if (!cancel) setSrc(null);
      });
    return () => {
      cancel = true;
    };
  }, [catalog, photoId, line.imageUrl]);
  if (!src) {
    return (
      <div className="flex h-full w-full items-center justify-center text-[var(--maher-text-tertiary)]">
        <Armchair className="h-6 w-6 opacity-40" />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className="h-full w-full object-cover" />
  );
}
