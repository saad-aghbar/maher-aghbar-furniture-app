'use client';

import { MasterCrudPage } from '@/components/admin/master-crud-page';
import { localizedName } from '@maher/i18n';
import { useLocale, useTranslations } from 'next-intl';

interface Unit {
  id: string;
  code: string;
  nameEn: string;
  nameAr: string;
  nameHe?: string | null;
}

export default function UnitsPage() {
  const t = useTranslations('catalog');
  const locale = useLocale();

  return (
    <MasterCrudPage<Unit>
      title={t('units')}
      queryKey="units"
      listPath="/api/v1/units"
      createPath="/api/v1/units"
      patchPath={(id) => `/api/v1/units/${id}`}
      deletePath={(id) => `/api/v1/units/${id}`}
      emptyTitle={t('noUnits')}
      columns={[
        { key: 'code', header: t('code'), render: (r) => <span dir="ltr">{r.code}</span> },
        { key: 'name', header: t('name'), render: (r) => localizedName(locale, r) },
      ]}
      fields={[
        { name: 'code', label: t('code'), required: true },
        { name: 'nameEn', label: t('nameEn'), required: true },
        { name: 'nameAr', label: t('nameAr'), required: true },
        { name: 'nameHe', label: t('nameHe') },
      ]}
      mapRowToForm={(r) => ({
        code: r.code,
        nameEn: r.nameEn,
        nameAr: r.nameAr,
        nameHe: r.nameHe ?? '',
      })}
    />
  );
}
