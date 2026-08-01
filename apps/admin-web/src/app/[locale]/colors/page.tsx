'use client';

import { MasterCrudPage } from '@/components/admin/master-crud-page';
import { localizedName } from '@maher/i18n';
import { useLocale, useTranslations } from 'next-intl';

interface Color {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  nameHe?: string | null;
  hex?: string | null;
}

export default function ColorsPage() {
  const t = useTranslations('catalog');
  const locale = useLocale();

  return (
    <MasterCrudPage<Color>
      title={t('colors')}
      queryKey="colors"
      listPath="/api/v1/colors"
      createPath="/api/v1/colors"
      patchPath={(id) => `/api/v1/colors/${id}`}
      deletePath={(id) => `/api/v1/colors/${id}`}
      emptyTitle={t('noColors')}
      columns={[
        { key: 'code', header: t('code'), render: (r) => r.code },
        { key: 'name', header: t('name'), render: (r) => localizedName(locale, r) },
        {
          key: 'hex',
          header: t('hex'),
          render: (r) =>
            r.hex ? (
              <span className="inline-flex items-center gap-2">
                <span
                  className="inline-block h-4 w-4 rounded border"
                  style={{ background: r.hex }}
                />
                {r.hex}
              </span>
            ) : (
              '—'
            ),
        },
      ]}
      fields={[
        { name: 'code', label: t('code'), required: true },
        { name: 'nameEn', label: t('nameEn'), required: true },
        { name: 'nameAr', label: t('nameAr'), required: true },
        { name: 'nameHe', label: t('nameHe') },
        { name: 'hex', label: t('hex'), hint: '#RRGGBB' },
      ]}
      mapRowToForm={(r) => ({
        code: r.code,
        nameEn: r.nameEn,
        nameAr: r.nameAr,
        nameHe: r.nameHe ?? '',
        hex: r.hex ?? '',
      })}
    />
  );
}
