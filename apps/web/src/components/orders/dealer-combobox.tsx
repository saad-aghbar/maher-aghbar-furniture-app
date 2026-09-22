'use client';

import { apiFetch } from '@/lib/api-client';
import { unwrapList, type Paginated } from '@/lib/paginated';
import { useKitCopy } from '@/lib/kit-copy';
import { localizedName } from '@maher/i18n';
import { Combobox, type ComboboxOption } from '@maher/ui';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback } from 'react';

interface CustomerRow {
  id: string;
  code?: string | null;
  name?: string;
  nameEn?: string | null;
  nameAr?: string | null;
  nameHe?: string | null;
  city?: string | null;
  status?: string;
}

/**
 * Dealer picker: async Combobox over `/customers?q=`. Resolves the selected
 * dealer's label even when it is not in the current result set.
 */
export function DealerCombobox({
  value,
  onChange,
  label,
  placeholder,
  clearable = true,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
  label?: string;
  placeholder?: string;
  clearable?: boolean;
}) {
  const locale = useLocale();
  const t = useTranslations('customers');
  const kit = useKitCopy();

  const toOption = useCallback(
    (row: CustomerRow): ComboboxOption => ({
      value: row.id,
      label: localizedName(locale, row, row.name ?? row.code ?? row.id),
      description: [row.code, row.city].filter(Boolean).join(' · ') || undefined,
      tone: row.status === 'INACTIVE' ? 'neutral' : undefined,
    }),
    [locale],
  );

  const loadOptions = useCallback(
    async (q: string) => {
      const res = await apiFetch<Paginated<CustomerRow> | CustomerRow[]>(`/api/v1/customers?pageSize=20${q ? `&q=${encodeURIComponent(q)}` : ''}`);
      return unwrapList(res).rows.map(toOption);
    },
    [toOption],
  );

  const selected = useQuery({
    queryKey: ['customer-label', value],
    queryFn: () => apiFetch<CustomerRow>(`/api/v1/customers/${value}`),
    enabled: Boolean(value),
    staleTime: 5 * 60_000,
  });

  return (
    <Combobox
      value={value}
      onChange={(id) => onChange(id)}
      loadOptions={loadOptions}
      selectedLabel={selected.data ? toOption(selected.data).label : undefined}
      label={label}
      placeholder={placeholder ?? t('searchPlaceholder')}
      emptyText={kit.combobox.empty}
      loadingText={kit.combobox.loading}
      clearLabel={kit.combobox.clear}
      clearable={clearable}
    />
  );
}
