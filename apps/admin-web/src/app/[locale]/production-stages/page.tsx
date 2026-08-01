'use client';

import { MasterCrudPage } from '@/components/admin/master-crud-page';
import { apiFetch } from '@/lib/api-client';
import { localizedName } from '@maher/i18n';
import { Alert } from '@maher/ui';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';

interface Stage {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  nameHe?: string | null;
  sortOrder: number;
  estimatedHours?: string | number | null;
  requiresInspection: boolean;
  requiresPhotos: boolean;
  responsibleDepartment?: string | null;
  isActive: boolean;
}

interface Department {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
}

const DEFAULT_PIPELINE = [
  'MATERIAL_PREP',
  'CARPENTRY',
  'PAINTING',
  'UPHOLSTERY',
  'ASSEMBLY',
  'INSPECTION',
  'PACKAGING',
  'DELIVERY',
] as const;

export default function ProductionStagesPage() {
  const t = useTranslations('catalog');
  const tCommon = useTranslations('common');
  const locale = useLocale();

  const departmentsQuery = useQuery({
    queryKey: ['departments-pick'],
    queryFn: () =>
      apiFetch<{ data: Department[] }>('/api/v1/departments?pageSize=100').then((r) => r.data),
  });

  const deptOptions = [
    { value: '', label: t('noneOption') },
    ...(departmentsQuery.data ?? []).map((d) => ({
      value: d.code,
      label: `${d.code} — ${localizedName(locale, d)}`,
    })),
  ];

  return (
    <div className="space-y-6">
      <Alert variant="info">
        <p className="font-medium">{t('defaultStagePipeline')}</p>
        <p className="mt-1 text-sm">{DEFAULT_PIPELINE.join(' → ')}</p>
        <p className="mt-2 text-sm text-text-secondary">{t('defaultStagePipelineHint')}</p>
      </Alert>
      <MasterCrudPage<Stage>
        title={t('stages')}
        queryKey="production-stages"
        listPath="/api/v1/production-stages"
        createPath="/api/v1/production-stages"
        patchPath={(id) => `/api/v1/production-stages/${id}`}
        activatePath={(id) => `/api/v1/production-stages/${id}/activate`}
        deactivatePath={(id) => `/api/v1/production-stages/${id}/deactivate`}
        deletePath={(id) => `/api/v1/production-stages/${id}`}
        emptyTitle={t('noStages')}
        activeField="isActive"
        columns={[
          { key: 'order', header: tCommon('number'), render: (r) => r.sortOrder },
          { key: 'code', header: t('code'), render: (r) => r.code },
          { key: 'name', header: t('name'), render: (r) => localizedName(locale, r) },
          {
            key: 'dept',
            header: t('department'),
            render: (r) => r.responsibleDepartment ?? '—',
          },
          {
            key: 'hours',
            header: t('estimatedHours'),
            render: (r) =>
              r.estimatedHours != null ? <span dir="ltr">{String(r.estimatedHours)}</span> : '—',
          },
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
          { name: 'sortOrder', label: tCommon('number'), type: 'number', required: true },
          { name: 'estimatedHours', label: t('estimatedHours'), type: 'number' },
          {
            name: 'responsibleDepartment',
            label: t('department'),
            type: 'select',
            options: deptOptions,
          },
          { name: 'requiresInspection', label: t('requiresInspection'), type: 'checkbox' },
          { name: 'requiresPhotos', label: t('photosRequired'), type: 'checkbox' },
          { name: 'isActive', label: t('active'), type: 'checkbox' },
        ]}
        mapRowToForm={(r) => ({
          code: r.code,
          nameEn: r.nameEn,
          nameAr: r.nameAr,
          nameHe: r.nameHe ?? '',
          sortOrder: r.sortOrder,
          estimatedHours: Number(r.estimatedHours ?? 0),
          responsibleDepartment: r.responsibleDepartment ?? '',
          requiresInspection: r.requiresInspection,
          requiresPhotos: r.requiresPhotos,
          isActive: r.isActive,
        })}
        buildPayload={(form) => ({
          code: String(form.code).trim(),
          nameEn: String(form.nameEn).trim(),
          nameAr: String(form.nameAr).trim(),
          nameHe: String(form.nameHe ?? '').trim() || undefined,
          sortOrder: Number(form.sortOrder),
          estimatedHours: Number(form.estimatedHours) || undefined,
          responsibleDepartment: String(form.responsibleDepartment ?? '').trim() || undefined,
          requiresInspection: Boolean(form.requiresInspection),
          requiresPhotos: Boolean(form.requiresPhotos),
          isActive: Boolean(form.isActive),
        })}
      />
    </div>
  );
}
