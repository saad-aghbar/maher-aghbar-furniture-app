'use client';

import { MasterCrudPage } from '@/components/admin/master-crud-page';
import { localizedName } from '@maher/i18n';
import { useLocale, useTranslations } from 'next-intl';

interface Department {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
}

export default function DepartmentsPage() {
  const t = useTranslations('catalog');
  const locale = useLocale();

  return (
    <MasterCrudPage<Department>
      title={t('departments')}
      queryKey="departments"
      listPath="/api/v1/departments"
      createPath="/api/v1/departments"
      patchPath={(id) => `/api/v1/departments/${id}`}
      deletePath={(id) => `/api/v1/departments/${id}`}
      emptyTitle={t('noDepartments')}
      columns={[
        { key: 'code', header: t('code'), render: (r) => r.code },
        { key: 'name', header: t('name'), render: (r) => localizedName(locale, r) },
      ]}
      fields={[
        { name: 'code', label: t('code'), required: true },
        { name: 'nameEn', label: t('nameEn'), required: true },
        { name: 'nameAr', label: t('nameAr'), required: true },
      ]}
      mapRowToForm={(r) => ({ code: r.code, nameEn: r.nameEn, nameAr: r.nameAr })}
    />
  );
}
