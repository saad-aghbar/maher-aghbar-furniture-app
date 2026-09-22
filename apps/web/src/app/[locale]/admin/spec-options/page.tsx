'use client';

import { MasterCrudPage } from '@/components/admin/master-crud-page';
import { localizedName } from '@maher/i18n';
import { Ltr, Stamp } from '@maher/ui';
import { useLocale, useTranslations } from 'next-intl';

interface SpecOptionGroup {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  nameHe?: string | null;
  inputType: 'SELECT' | 'SELECT_WITH_QTY' | 'DIMENSION' | 'COLOR';
  appliesTo?: string | null;
  isActive: boolean;
  sortOrder: number;
}

const INPUT_TYPES = ['SELECT', 'SELECT_WITH_QTY', 'DIMENSION', 'COLOR'] as const;

export default function SpecOptionGroupsPage() {
  const t = useTranslations('catalog');
  const locale = useLocale();

  const inputLabel = (code: string) => {
    if (code === 'SELECT_WITH_QTY') return t('inputTypeSelectWithQty');
    if (code === 'DIMENSION') return t('inputTypeDimension');
    if (code === 'COLOR') return t('inputTypeColor');
    return t('inputTypeSelect');
  };

  return (
    <MasterCrudPage<SpecOptionGroup>
      title={t('specOptionGroups')}
      description={t('specOptionGroupsHint')}
      queryKey="spec-option-groups"
      listPath="/api/v1/spec-option-groups?includeInactive=true"
      createPath="/api/v1/spec-option-groups"
      patchPath={(id) => `/api/v1/spec-option-groups/${id}`}
      activatePath={(id) => `/api/v1/spec-option-groups/${id}/activate`}
      deactivatePath={(id) => `/api/v1/spec-option-groups/${id}/deactivate`}
      emptyTitle={t('noSpecOptionGroups')}
      emptyDescription={t('specOptionGroupsHint')}
      activeField="isActive"
      tone="info"
      columns={[
        { key: 'code', header: t('code'), width: '140px', render: (r) => <Ltr className="text-[var(--maher-text-tertiary)]">{r.code}</Ltr> },
        { key: 'name', header: t('name'), render: (r) => <span className="font-semibold text-[var(--maher-text-primary)]">{localizedName(locale, r)}</span> },
        { key: 'inputType', header: t('inputType'), hideBelow: 'md', render: (r) => <Stamp tone="info" size="sm">{inputLabel(r.inputType)}</Stamp> },
        { key: 'appliesTo', header: t('appliesTo'), hideBelow: 'lg', render: (r) => r.appliesTo || '—' },
        { key: 'sort', header: t('sortOrder'), numeric: true, hideBelow: 'xl', render: (r) => String(r.sortOrder) },
      ]}
      mobileRow={(r) => ({ title: localizedName(locale, r), meta: `${r.code} · ${inputLabel(r.inputType)}` })}
      fields={[
        { name: 'code', label: t('code'), required: true, dir: 'ltr', half: true },
        { name: 'inputType', label: t('inputType'), type: 'select', half: true, options: INPUT_TYPES.map((code) => ({ value: code, label: inputLabel(code) })) },
        { name: 'nameAr', label: t('nameAr'), required: true, dir: 'rtl', half: true },
        { name: 'nameEn', label: t('nameEn'), required: true, dir: 'ltr', half: true },
        { name: 'nameHe', label: t('nameHe'), dir: 'rtl', half: true },
        { name: 'appliesTo', label: t('appliesTo'), half: true },
        { name: 'sortOrder', label: t('sortOrder'), type: 'number', half: true },
        { name: 'isActive', label: t('active'), type: 'checkbox' },
      ]}
      mapRowToForm={(r) => ({
        code: r.code,
        nameEn: r.nameEn,
        nameAr: r.nameAr,
        nameHe: r.nameHe ?? '',
        inputType: r.inputType,
        appliesTo: r.appliesTo ?? '',
        sortOrder: r.sortOrder,
        isActive: r.isActive,
      })}
      buildPayload={(form) => ({
        code: String(form.code).trim(),
        nameEn: String(form.nameEn).trim(),
        nameAr: String(form.nameAr).trim(),
        nameHe: String(form.nameHe ?? '').trim() || undefined,
        inputType: String(form.inputType || 'SELECT'),
        appliesTo: String(form.appliesTo ?? '').trim() || undefined,
        sortOrder: Number(form.sortOrder) || 0,
        isActive: Boolean(form.isActive),
      })}
    />
  );
}
