'use client';

import { MasterCrudPage } from '@/components/admin/master-crud-page';
import { apiFetch } from '@/lib/api-client';
import { localizedName } from '@maher/i18n';
import { Ltr, Stamp } from '@maher/ui';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo } from 'react';

interface Fabric {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  nameHe?: string | null;
  color?: string | null;
  supplier?: string | null;
  isActive: boolean;
}

interface ColorRef {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  hex?: string | null;
}

interface Supplier {
  id: string;
  code: string;
  name: string;
  nameAr?: string | null;
  nameEn?: string | null;
}

/** Deterministic warm swatch for fabrics without a colour reference. */
function fallbackSwatch(code: string) {
  let h = 0;
  for (const ch of code) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `linear-gradient(135deg, hsl(${h} 28% 78%), hsl(${(h + 24) % 360} 24% 62%))`;
}

export default function FabricsPage() {
  const t = useTranslations('catalog');
  const locale = useLocale();

  const colorsQuery = useQuery({ queryKey: ['colors-pick'], queryFn: () => apiFetch<{ data: ColorRef[] }>('/api/v1/colors?pageSize=100').then((r) => r.data) });
  const suppliersQuery = useQuery({ queryKey: ['suppliers-pick-fabrics'], queryFn: () => apiFetch<{ data: Supplier[] }>('/api/v1/suppliers?pageSize=100&status=ACTIVE').then((r) => r.data) });

  const colorByCode = useMemo(() => new Map((colorsQuery.data ?? []).map((c) => [c.code, c])), [colorsQuery.data]);
  const colorOptions = [{ value: '', label: t('noneOption') }, ...(colorsQuery.data ?? []).map((c) => ({ value: c.code, label: localizedName(locale, c), description: c.code }))];
  const supplierOptions = [
    { value: '', label: t('noneOption') },
    ...(suppliersQuery.data ?? []).map((s) => ({ value: s.code, label: s.nameAr || s.nameEn ? localizedName(locale, s, s.name) : s.name, description: s.code })),
  ];

  const swatchStyle = (f: Fabric) => {
    const hex = f.color ? colorByCode.get(f.color)?.hex : null;
    return hex ? { backgroundColor: hex } : { backgroundImage: fallbackSwatch(f.code) };
  };

  return (
    <MasterCrudPage<Fabric>
      title={t('fabrics')}
      description={t('fabricsHint')}
      queryKey="fabrics"
      listPath="/api/v1/fabrics"
      createPath="/api/v1/fabrics"
      patchPath={(id) => `/api/v1/fabrics/${id}`}
      activatePath={(id) => `/api/v1/fabrics/${id}/activate`}
      deactivatePath={(id) => `/api/v1/fabrics/${id}/deactivate`}
      emptyTitle={t('noFabrics')}
      emptyDescription={t('fabricsHint')}
      activeField="isActive"
      activeFilter
      tone="warning"
      tile={(f, open) => (
        <button type="button" className="flex h-full w-full flex-col text-start" onClick={open}>
          <span className="relative block aspect-[4/3] w-full" style={swatchStyle(f)} aria-hidden>
            <span className="absolute inset-0 bg-[radial-gradient(120%_80%_at_20%_0%,rgba(255,255,255,0.28),transparent_60%)]" />
            {!f.isActive ? (
              <Stamp tone="neutral" size="sm" className="absolute start-2 top-2 bg-[var(--maher-surface)]">
                {t('inactive')}
              </Stamp>
            ) : null}
          </span>
          <span className="flex flex-1 flex-col gap-0.5 px-3 pb-3 pt-2.5">
            <span className="truncate text-[14px] font-semibold leading-5 text-[var(--maher-text-primary)]">{localizedName(locale, f)}</span>
            <Ltr className="block truncate text-[12px] leading-4 text-[var(--maher-text-tertiary)]">
              {f.code}
              {f.color ? ` · ${f.color}` : ''}
            </Ltr>
            {f.supplier ? <span className="truncate text-[12px] leading-4 text-[var(--maher-text-secondary)]">{f.supplier}</span> : null}
          </span>
        </button>
      )}
      columns={[
        { key: 'swatch', header: '', width: '44px', render: (f) => <span aria-hidden className="block h-7 w-7 rounded-[8px] border border-[var(--maher-border)]" style={swatchStyle(f)} /> },
        { key: 'code', header: t('code'), width: '140px', render: (f) => <Ltr className="text-[var(--maher-text-tertiary)]">{f.code}</Ltr> },
        { key: 'name', header: t('name'), render: (f) => <span className="font-semibold text-[var(--maher-text-primary)]">{localizedName(locale, f)}</span> },
        { key: 'color', header: t('color'), hideBelow: 'md', render: (f) => (f.color ? localizedName(locale, colorByCode.get(f.color) ?? { nameEn: f.color, nameAr: f.color }) : '—') },
        { key: 'supplier', header: t('supplier'), hideBelow: 'lg', render: (f) => f.supplier ?? '—' },
      ]}
      mobileRow={(f) => ({ leading: <span aria-hidden className="block h-9 w-9 rounded-[10px]" style={swatchStyle(f)} />, title: localizedName(locale, f), meta: `${f.code}${f.supplier ? ` · ${f.supplier}` : ''}` })}
      fields={[
        { name: 'code', label: t('code'), required: true, dir: 'ltr', half: true },
        { name: 'color', label: t('color'), type: 'select', half: true, options: colorOptions },
        { name: 'nameAr', label: t('nameAr'), required: true, dir: 'rtl', half: true },
        { name: 'nameEn', label: t('nameEn'), required: true, dir: 'ltr', half: true },
        { name: 'supplier', label: t('supplier'), type: 'select', options: supplierOptions },
        { name: 'isActive', label: t('active'), type: 'checkbox' },
      ]}
      mapRowToForm={(r) => ({ code: r.code, nameEn: r.nameEn, nameAr: r.nameAr, color: r.color ?? '', supplier: r.supplier ?? '', isActive: r.isActive })}
      buildPayload={(form) => ({
        code: String(form.code).trim(),
        nameEn: String(form.nameEn).trim(),
        nameAr: String(form.nameAr).trim(),
        color: String(form.color ?? '').trim() || undefined,
        supplier: String(form.supplier ?? '').trim() || undefined,
        isActive: Boolean(form.isActive),
      })}
    />
  );
}
