'use client';

import { MasterCrudPage } from '@/components/admin/master-crud-page';
import { localizedName } from '@maher/i18n';
import { useLocale, useTranslations } from 'next-intl';

interface Category {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  nameHe?: string | null;
}

export default function CategoriesPage() {
  const t = useTranslations('catalog');
  const locale = useLocale();

  return (
    <MasterCrudPage<Category>
      title={t('categories')}
      queryKey="product-categories"
      listPath="/api/v1/product-categories"
      createPath="/api/v1/product-categories"
      patchPath={(id) => `/api/v1/product-categories/${id}`}
      deletePath={(id) => `/api/v1/product-categories/${id}`}
      emptyTitle={t('noCategories')}
      columns={[
        { key: 'code', header: t('code'), render: (r) => r.code },
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
