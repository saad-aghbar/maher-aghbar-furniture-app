'use client';

import { MasterCrudPage } from '@/components/admin/master-crud-page';
import { StatusBadge } from '@maher/ui';
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

const WAREHOUSE_TYPES = [
  { value: 'RAW', labelKey: 'warehouseTypeRaw' as const },
  { value: 'SEMI', labelKey: 'warehouseTypeSemi' as const },
  { value: 'FINISHED', labelKey: 'warehouseTypeFinished' as const },
];

export default function WarehousesPage() {
  const t = useTranslations('catalog');
  const ti = useTranslations('inventory');
  const tNav = useTranslations('navigation');
  const tCommon = useTranslations('common');
  const locale = useLocale();

  const typeLabel = (type: string) => {
    const found = WAREHOUSE_TYPES.find((t) => t.value === type);
    return found ? ti(found.labelKey) : type;
  };

  return (
    <MasterCrudPage<Warehouse>
      title={tNav('warehouses')}
      queryKey="warehouses"
      listPath="/api/v1/warehouses"
      createPath="/api/v1/warehouses"
      patchPath={(id) => `/api/v1/warehouses/${id}`}
      activatePath={(id) => `/api/v1/warehouses/${id}/activate`}
      deactivatePath={(id) => `/api/v1/warehouses/${id}/deactivate`}
      emptyTitle={ti('noWarehouses')}
      activeField="isActive"
      columns={[
        { key: 'code', header: t('code'), render: (r) => <span dir="ltr">{r.code}</span> },
        {
          key: 'name',
          header: t('name'),
          render: (r) => localizedName(locale, r),
        },
        {
          key: 'type',
          header: ti('warehouseType'),
          render: (r) => typeLabel(r.type),
        },
        {
          key: 'status',
          header: tCommon('status'),
          render: (r) => <StatusBadge status={r.isActive ? 'ACTIVE' : 'INACTIVE'} />,
        },
      ]}
      fields={[
        { name: 'code', label: t('code'), required: true },
        { name: 'nameEn', label: t('nameEn'), required: true },
        { name: 'nameAr', label: t('nameAr'), required: true },
        {
          name: 'type',
          label: ti('warehouseType'),
          type: 'select',
          required: true,
          options: WAREHOUSE_TYPES.map((wt) => ({
            value: wt.value,
            label: ti(wt.labelKey),
          })),
        },
      ]}
      mapRowToForm={(r) => ({
        code: r.code,
        nameEn: r.nameEn,
        nameAr: r.nameAr,
        type: r.type || 'RAW',
      })}
      buildPayload={(form) => ({
        code: String(form.code).trim(),
        nameEn: String(form.nameEn).trim(),
        nameAr: String(form.nameAr).trim(),
        type: String(form.type || 'RAW'),
      })}
    />
  );
}
