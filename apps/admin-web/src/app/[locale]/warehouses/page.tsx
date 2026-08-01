'use client';

import { MasterCrudPage } from '@/components/admin/master-crud-page';
import { localizedName } from '@maher/i18n';
import { useLocale, useTranslations } from 'next-intl';

interface Warehouse {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  type: string;
  isActive: boolean;
}

export default function WarehousesPage() {
  const t = useTranslations('catalog');
  const tCommon = useTranslations('common');
  const locale = useLocale();

  return (
    <MasterCrudPage<Warehouse>
      title={t('warehouses')}
      queryKey="warehouses"
      listPath="/api/v1/warehouses"
      createPath="/api/v1/warehouses"
      patchPath={(id) => `/api/v1/warehouses/${id}`}
      activatePath={(id) => `/api/v1/warehouses/${id}/activate`}
      deactivatePath={(id) => `/api/v1/warehouses/${id}/deactivate`}
      deletePath={(id) => `/api/v1/warehouses/${id}`}
      emptyTitle={t('noWarehouses')}
      activeField="isActive"
      columns={[
        { key: 'code', header: t('code'), render: (r) => r.code },
        { key: 'name', header: t('name'), render: (r) => localizedName(locale, r) },
        {
          key: 'type',
          header: t('type'),
          render: (r) =>
            r.type === 'RAW'
              ? t('typeRaw')
              : r.type === 'SEMI'
                ? t('typeSemi')
                : r.type === 'FINISHED'
                  ? t('typeFinished')
                  : r.type,
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
        {
          name: 'type',
          label: t('type'),
          type: 'select',
          options: [
            { value: 'RAW', label: t('typeRaw') },
            { value: 'SEMI', label: t('typeSemi') },
            { value: 'FINISHED', label: t('typeFinished') },
          ],
        },
        { name: 'isActive', label: t('active'), type: 'checkbox' },
      ]}
      mapRowToForm={(r) => ({
        code: r.code,
        nameEn: r.nameEn,
        nameAr: r.nameAr,
        type: r.type,
        isActive: r.isActive,
      })}
    />
  );
}
