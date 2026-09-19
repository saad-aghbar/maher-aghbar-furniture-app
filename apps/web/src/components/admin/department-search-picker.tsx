'use client';

import { apiFetch, ApiClientError } from '@/lib/api-client';
import { localizedName } from '@maher/i18n';
import { Alert, Button, EmptyState, Input, Modal, Skeleton } from '@maher/ui';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

export type DepartmentOption = {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
};

type Props = {
  value: string;
  onChange: (id: string, department?: DepartmentOption | null) => void;
  label?: string;
  className?: string;
  disabled?: boolean;
  /** Known department for immediate label when value is set (avoids flash). */
  selectedDepartment?: DepartmentOption | null;
};

export function DepartmentSearchPicker({
  value,
  onChange,
  label,
  className,
  disabled,
  selectedDepartment,
}: Props) {
  const t = useTranslations('users');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selected, setSelected] = useState<DepartmentOption | null>(selectedDepartment ?? null);
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [listKey, setListKey] = useState(0);

  useEffect(() => {
    if (selectedDepartment && selectedDepartment.id === value) {
      setSelected(selectedDepartment);
    }
  }, [selectedDepartment, value]);

  useEffect(() => {
    if (!value) {
      setSelected(null);
      return;
    }
    if (selected?.id === value) return;
    if (selectedDepartment?.id === value) {
      setSelected(selectedDepartment);
      return;
    }
    let cancelled = false;
    void apiFetch<{ data: DepartmentOption[] }>(
      `/api/v1/departments?pageSize=100`,
    )
      .then((res) => {
        if (cancelled) return;
        const match = (res.data ?? []).find((d) => d.id === value) ?? null;
        setSelected(match);
      })
      .catch(() => {
        /* keep prior selection */
      });
    return () => {
      cancelled = true;
    };
  }, [value, selected?.id, selectedDepartment]);

  useEffect(() => {
    if (!pickerOpen) return;
    const timer = setTimeout(() => setDebouncedQ(q.trim()), 250);
    return () => clearTimeout(timer);
  }, [q, pickerOpen]);

  useEffect(() => {
    if (!pickerOpen) {
      setQ('');
      setDebouncedQ('');
      setListKey(0);
    }
  }, [pickerOpen]);

  useEffect(() => {
    setListKey((k) => k + 1);
  }, [debouncedQ]);

  const departmentsQuery = useQuery({
    queryKey: ['departments-pick', debouncedQ],
    enabled: pickerOpen,
    queryFn: async () => {
      const params = new URLSearchParams({ pageSize: '100' });
      if (debouncedQ) params.set('q', debouncedQ);
      const res = await apiFetch<{ data: DepartmentOption[] }>(
        `/api/v1/departments?${params}`,
      );
      return res.data ?? [];
    },
  });

  const rows = departmentsQuery.data ?? [];
  const errorMessage =
    departmentsQuery.error instanceof ApiClientError
      ? departmentsQuery.error.message
      : departmentsQuery.isError
        ? tCommon('loadFailed')
        : null;

  function pick(dept: DepartmentOption | null) {
    setSelected(dept);
    onChange(dept?.id ?? '', dept);
    setPickerOpen(false);
  }

  const displayName = selected ? localizedName(locale, selected) : null;

  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ''}`}>
      {label ? (
        <span className="text-sm font-medium text-[var(--maher-text-primary)]">{label}</span>
      ) : null}

      {value && selected ? (
        <div className="maher-animate-rise flex h-10 items-center gap-2 rounded-[var(--maher-radius-md)] border border-[var(--maher-border)] bg-[var(--maher-surface)] px-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-[var(--maher-text-primary)]">{displayName}</p>
            {selected.code ? (
              <p className="truncate text-xs text-[var(--maher-text-tertiary)]" dir="ltr">
                {selected.code}
              </p>
            ) : null}
          </div>
          <Button
            type="button"
            variant="ghost"
            className="shrink-0 !h-8 !px-2 text-xs"
            disabled={disabled}
            onClick={() => setPickerOpen(true)}
          >
            {t('changeDepartment')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="shrink-0 !h-8 !px-2 text-xs"
            disabled={disabled}
            onClick={() => pick(null)}
            aria-label={t('noDepartment')}
          >
            ×
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="secondary"
          className="maher-animate-rise h-10 w-full justify-start font-normal text-text-secondary"
          disabled={disabled}
          onClick={() => setPickerOpen(true)}
        >
          {t('pickDepartment')}
        </Button>
      )}

      <Modal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title={t('pickDepartment')}
        size="lg"
      >
        <div className="bom-picker">
          <div className="maher-animate-rise">
            <Input
              withSearchIcon
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('searchDepartments')}
              autoFocus
            />
          </div>

          {errorMessage ? (
            <div className="maher-animate-shake">
              <Alert variant="error">{errorMessage}</Alert>
            </div>
          ) : null}

          <div key={listKey} className="bom-picker__list">
            {departmentsQuery.isLoading ? (
              <div className="maher-stagger space-y-2 p-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <ul>
                <li>
                  <button
                    type="button"
                    onClick={() => pick(null)}
                    className="bom-picker__row"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-text-primary">
                        {t('noDepartment')}
                      </span>
                    </span>
                    <span className="bom-picker__add-chip">{t('selectDepartment')}</span>
                  </button>
                </li>
                {rows.length === 0 ? (
                  <li className="maher-animate-pop p-4">
                    <EmptyState title={t('noDepartmentsFound')} />
                  </li>
                ) : (
                  rows.map((dept) => {
                    const active = dept.id === value;
                    return (
                      <li key={dept.id}>
                        <button
                          type="button"
                          onClick={() => pick(dept)}
                          className="bom-picker__row"
                        >
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-text-primary">
                              {localizedName(locale, dept)}
                            </span>
                            <span
                              className="block truncate text-xs text-text-secondary"
                              dir="ltr"
                            >
                              {dept.code}
                            </span>
                          </span>
                          <span className="bom-picker__add-chip">
                            {active ? t('selectedDepartment') : t('selectDepartment')}
                          </span>
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>
            )}
          </div>

          <div className="flex justify-end">
            <Button variant="ghost" onClick={() => setPickerOpen(false)}>
              {tCommon('cancel')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
