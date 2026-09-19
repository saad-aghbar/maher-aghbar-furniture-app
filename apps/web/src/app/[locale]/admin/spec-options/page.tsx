'use client';

import { MasterCrudPage } from '@/components/admin/master-crud-page';
import { localizedName } from '@maher/i18n';
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
  const tCommon = useTranslations('common');
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
      queryKey="spec-option-groups"
      listPath="/api/v1/spec-option-groups?includeInactive=true"
      createPath="/api/v1/spec-option-groups"
      patchPath={(id) => `/api/v1/spec-option-groups/${id}`}
      activatePath={(id) => `/api/v1/spec-option-groups/${id}/activate`}
      deactivatePath={(id) => `/api/v1/spec-option-groups/${id}/deactivate`}
      emptyTitle={t('noSpecOptionGroups')}
      activeField="isActive"
      columns={[
        { key: 'code', header: t('code'), render: (r) => <span dir="ltr">{r.code}</span> },
        { key: 'name', header: t('name'), render: (r) => localizedName(locale, r) },
        { key: 'inputType', header: t('inputType'), render: (r) => inputLabel(r.inputType) },
        { key: 'appliesTo', header: t('appliesTo'), render: (r) => r.appliesTo || '—' },
        {
          key: 'active',
          header: t('active'),
          render: (r) => (r.isActive ? tCommon('yes') : tCommon('no')),
        },
      ]}
      fields={[
        { name: 'code', label: t('code'), required: true },
        { name: 'nameEn', label: t('nameEn'), required: true },
        { name: 'nameAr', label: t('nameAr'), required: true },
        { name: 'nameHe', label: t('nameHe') },
        {
          name: 'inputType',
          label: t('inputType'),
          type: 'select',
          options: INPUT_TYPES.map((code) => ({ value: code, label: inputLabel(code) })),
        },
        { name: 'appliesTo', label: t('appliesTo') },
        { name: 'sortOrder', label: t('sortOrder'), type: 'number' },
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
