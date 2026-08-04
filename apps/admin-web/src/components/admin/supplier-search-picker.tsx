'use client';

import { apiFetch } from '@/lib/api-client';
import { localizedName } from '@maher/i18n';
import { Button, Input } from '@maher/ui';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState } from 'react';

export type SupplierOption = {
  id: string;
  name: string;
  code?: string;
  nameAr?: string | null;
  nameEn?: string | null;
  nameHe?: string | null;
  isCertified?: boolean;
};

type Props = {
  value: string;
  onChange: (id: string, supplier?: SupplierOption | null) => void;
  label?: string;
  required?: boolean;
  /** When true, only show certified suppliers in results. */
  certifiedOnly?: boolean;
  /** Defaults to ACTIVE. Pass empty string to skip. */
  status?: string;
  className?: string;
  disabled?: boolean;
};

function supplierDisplayName(
  locale: string,
  s: Pick<SupplierOption, 'name' | 'nameAr' | 'nameEn' | 'nameHe'>,
) {
  return s.nameAr || s.nameEn || s.nameHe ? localizedName(locale, s, s.name) : s.name;
}

export function SupplierSearchPicker({
  value,
  onChange,
  label,
  required,
  certifiedOnly = false,
  status = 'ACTIVE',
  className,
  disabled,
}: Props) {
  const t = useTranslations('catalog');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<SupplierOption | null>(null);
  const selectedIdRef = useRef<string | null>(null);

  useEffect(() => {
    selectedIdRef.current = selected?.id ?? null;
  }, [selected]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQ(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!value) {
      setSelected(null);
      return;
    }
    if (selectedIdRef.current === value) return;
    let cancelled = false;
    void apiFetch<SupplierOption>(`/api/v1/suppliers/${value}`)
      .then((row) => {
        if (!cancelled) setSelected(row);
      })
      .catch(() => {
        /* keep prior selection if resolve fails */
      });
    return () => {
      cancelled = true;
    };
  }, [value]);

  const searchEnabled = open && !disabled;

  const resultsQuery = useQuery({
    queryKey: ['suppliers-search', debouncedQ, status, certifiedOnly],
    enabled: searchEnabled,
    queryFn: async () => {
      const params = new URLSearchParams({ pageSize: '20' });
      if (status) params.set('status', status);
      if (debouncedQ) params.set('q', debouncedQ);
      const res = await apiFetch<{ data: SupplierOption[] }>(`/api/v1/suppliers?${params}`);
      let rows = res.data ?? [];
      if (certifiedOnly) rows = rows.filter((s) => s.isCertified);
      return rows;
    },
  });

  const results = resultsQuery.data ?? [];

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  function pick(supplier: SupplierOption) {
    setSelected(supplier);
    onChange(supplier.id, supplier);
    setQuery('');
    setDebouncedQ('');
    setOpen(false);
  }

  function clear() {
    setSelected(null);
    onChange('', null);
    setQuery('');
    setDebouncedQ('');
    setOpen(false);
  }

  function startChange() {
    setQuery('');
    setDebouncedQ('');
    setOpen(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  const showSelected = Boolean(value && selected && selected.id === value && !open);

  return (
    <div ref={rootRef} className={`relative flex flex-col gap-1.5 ${className ?? ''}`}>
      {label ? (
        <label className="text-sm font-medium text-[var(--maher-text-primary)]">
          {label}
          {required ? (
            <span className="text-[var(--maher-error)]" aria-hidden>
              {' '}
              *
            </span>
          ) : null}
        </label>
      ) : null}

      {showSelected ? (
        <div className="flex h-10 items-center gap-2 rounded-[var(--maher-radius-md)] border border-[var(--maher-border)] bg-[var(--maher-surface)] px-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-[var(--maher-text-primary)]">
              {supplierDisplayName(locale, selected!)}
            </p>
            {selected?.code ? (
              <p className="truncate text-xs text-[var(--maher-text-tertiary)]">{selected.code}</p>
            ) : null}
          </div>
          <Button
            type="button"
            variant="ghost"
            className="shrink-0 !h-8 !px-2 text-xs"
            disabled={disabled}
            onClick={startChange}
          >
            {t('changeMaterial')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="shrink-0 !h-8 !px-2 text-xs"
            disabled={disabled}
            onClick={clear}
            aria-label={tCommon('close')}
          >
            ×
          </Button>
        </div>
      ) : (
        <>
          <Input
            ref={inputRef}
            withSearchIcon
            value={query}
            disabled={disabled}
            placeholder={t('searchSupplier')}
            autoComplete="off"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            onFocus={() => setOpen(true)}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                setOpen(false);
                return;
              }
              if (e.key === 'Enter' && open && results[0]) {
                e.preventDefault();
                pick(results[0]);
              }
            }}
          />
          {open ? (
            <div
              id={listId}
              role="listbox"
              className="absolute top-[calc(100%+4px)] z-30 max-h-56 w-full overflow-auto rounded-[var(--maher-radius-md)] border border-[var(--maher-border)] bg-[var(--maher-surface)] shadow-md"
            >
              {resultsQuery.isLoading ? (
                <p className="px-3 py-2 text-sm text-[var(--maher-text-secondary)]">
                  {tCommon('loading')}
                </p>
              ) : results.length === 0 ? (
                <p className="px-3 py-2 text-sm text-[var(--maher-text-secondary)]">
                  {tCommon('noResults')}
                </p>
              ) : (
                results.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    role="option"
                    className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-start hover:bg-[var(--maher-surface-muted)]"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(s)}
                  >
                    <span className="text-sm text-[var(--maher-text-primary)]">
                      {supplierDisplayName(locale, s)}
                    </span>
                    {s.code ? (
                      <span className="text-xs text-[var(--maher-text-tertiary)]">{s.code}</span>
                    ) : null}
                  </button>
                ))
              )}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
