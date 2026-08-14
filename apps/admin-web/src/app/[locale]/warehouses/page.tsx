'use client';

import { MasterCrudPage } from '@/components/admin/master-crud-page';
import { useAuthMe } from '@/hooks/use-auth-me';
import { StatusBadge } from '@maher/ui';
import { localizedName } from '@maher/i18n';
import { can } from '@maher/permissions';
import { useLocale, useTranslations } from 'next-intl';

interface Warehouse {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  type: string;
  isActive: boolean;
  isDefault?: boolean;
}

const WAREHOUSE_TYPES = [
  { value: 'RAW_MATERIALS', labelKey: 'warehouseTypeRaw' as const },
  { value: 'SEMI_FINISHED', labelKey: 'warehouseTypeSemi' as const },
  { value: 'FINISHED_GOODS', labelKey: 'warehouseTypeFinished' as const },
];

export default function WarehousesPage() {
  const t = useTranslations('catalog');
  const ti = useTranslations('inventory');
  const tNav = useTranslations('navigation');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const me = useAuthMe();
  const canManage = can(me.data, 'warehouse.manage');

  const typeLabel = (type: string) => {
    const found = WAREHOUSE_TYPES.find((t) => t.value === type);
    return found ? ti(found.labelKey) : type;
  };

  return (
    <MasterCrudPage<Warehouse>
      title={tNav('warehouses')}
      queryKey="warehouses"
      listPath="/api/v1/warehouses"
      createPath={canManage ? '/api/v1/warehouses' : undefined}
      patchPath={canManage ? (id) => `/api/v1/warehouses/${id}` : undefined}
      activatePath={canManage ? (id) => `/api/v1/warehouses/${id}/activate` : undefined}
      deactivatePath={canManage ? (id) => `/api/v1/warehouses/${id}/deactivate` : undefined}
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
          key: 'isDefault',
          header: ti('isDefault'),
          render: (r) => (r.isDefault ? tCommon('yes') : tCommon('no')),
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
        {
          name: 'isDefault',
          label: ti('isDefault'),
          type: 'checkbox',
        },
      ]}
      mapRowToForm={(r) => ({
        code: r.code,
        nameEn: r.nameEn,
        nameAr: r.nameAr,
        type: r.type || 'RAW_MATERIALS',
        isDefault: Boolean(r.isDefault),
      })}
      buildPayload={(form) => ({
        code: String(form.code).trim(),
        nameEn: String(form.nameEn).trim(),
        nameAr: String(form.nameAr).trim(),
        type: String(form.type || 'RAW_MATERIALS'),
        isDefault: Boolean(form.isDefault),
      })}
    />
  );
}
