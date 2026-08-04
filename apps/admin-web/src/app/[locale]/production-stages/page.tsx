'use client';

import { MasterCrudPage } from '@/components/admin/master-crud-page';
import { useLocale, useTranslations } from 'next-intl';
import { localizedName } from '@maher/i18n';

interface StageRow {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  nameHe?: string | null;
  sortOrder: number;
  estimatedHours?: number | null;
  requiresInspection: boolean;
  requiresPhotos: boolean;
  responsibleDepartment?: string | null;
  isActive: boolean;
}

export default function ProductionStagesPage() {
  const t = useTranslations('navigation');
  const tc = useTranslations('catalog');
  const tCommon = useTranslations('common');
  const locale = useLocale();

  return (
    <MasterCrudPage<StageRow>
      title={t('productionStages')}
      queryKey="production-stages"
      listPath="/api/v1/production-stages"
      createPath="/api/v1/production-stages"
      patchPath={(id) => `/api/v1/production-stages/${id}`}
      activatePath={(id) => `/api/v1/production-stages/${id}/activate`}
      deactivatePath={(id) => `/api/v1/production-stages/${id}/deactivate`}
      deletePath={(id) => `/api/v1/production-stages/${id}`}
      emptyTitle={tc('noProductionStages')}
      activeField="isActive"
      columns={[
        { key: 'code', header: tc('stageCode'), render: (r) => <span dir="ltr">{r.code}</span> },
        { key: 'name', header: tc('name'), render: (r) => localizedName(locale, r) },
        {
          key: 'sort',
          header: tc('sortOrder'),
          render: (r) => <span dir="ltr">{r.sortOrder}</span>,
        },
        {
          key: 'hours',
          header: tc('estimatedHours'),
          render: (r) => <span dir="ltr">{r.estimatedHours ?? '—'}</span>,
        },
        {
          key: 'photos',
          header: tc('photos'),
          render: (r) => (r.requiresPhotos ? tCommon('yes') : tCommon('no')),
        },
        {
          key: 'inspection',
          header: tc('requiresInspection'),
          render: (r) => (r.requiresInspection ? tCommon('yes') : tCommon('no')),
        },
        {
          key: 'active',
          header: tc('active'),
          render: (r) => (r.isActive ? tCommon('yes') : tCommon('no')),
        },
      ]}
      fields={[
        { name: 'code', label: tc('stageCode'), required: true },
        { name: 'nameEn', label: tc('nameEn'), required: true },
        { name: 'nameAr', label: tc('nameAr'), required: true },
        { name: 'nameHe', label: tc('nameHe') },
        { name: 'sortOrder', label: tc('sortOrder'), type: 'number', required: true },
        { name: 'estimatedHours', label: tc('estimatedHours'), type: 'number' },
        { name: 'responsibleDepartment', label: tc('responsibleDepartment') },
        { name: 'requiresPhotos', label: tc('photos'), type: 'checkbox' },
        { name: 'requiresInspection', label: tc('requiresInspection'), type: 'checkbox' },
        { name: 'isActive', label: tc('active'), type: 'checkbox' },
      ]}
      mapRowToForm={(row) => ({
        code: row.code,
        nameEn: row.nameEn,
        nameAr: row.nameAr,
        nameHe: row.nameHe ?? '',
        sortOrder: row.sortOrder,
        estimatedHours: row.estimatedHours ?? '',
        responsibleDepartment: row.responsibleDepartment ?? '',
        requiresPhotos: row.requiresPhotos,
        requiresInspection: row.requiresInspection,
        isActive: row.isActive,
      })}
      buildPayload={(form) => ({
        code: String(form.code).trim(),
        nameEn: String(form.nameEn).trim(),
        nameAr: String(form.nameAr).trim(),
        nameHe: String(form.nameHe || '').trim() || undefined,
        sortOrder: Number(form.sortOrder),
        estimatedHours:
          form.estimatedHours === '' || form.estimatedHours == null
            ? undefined
            : Number(form.estimatedHours),
        responsibleDepartment: String(form.responsibleDepartment || '').trim() || undefined,
        requiresPhotos: Boolean(form.requiresPhotos),
        requiresInspection: Boolean(form.requiresInspection),
        isActive: form.isActive === undefined ? true : Boolean(form.isActive),
      })}
    />
  );
}
