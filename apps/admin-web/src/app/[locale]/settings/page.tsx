'use client';

import { Card } from '@maher/ui';
import { useTranslations } from 'next-intl';

export default function SettingsPage() {
  const t = useTranslations('navigation');

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('settings')}</h1>
      <Card title="Company">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-[var(--maher-text-secondary)]">Name (AR)</dt>
            <dd className="font-medium">مفروشات ماهر الأغبر وأولاده</dd>
          </div>
          <div>
            <dt className="text-[var(--maher-text-secondary)]">Name (EN)</dt>
            <dd className="font-medium">Maher Al-Aghbar &amp; Sons Furniture</dd>
          </div>
          <div>
            <dt className="text-[var(--maher-text-secondary)]">Currency</dt>
            <dd className="font-medium">JOD</dd>
          </div>
          <div>
            <dt className="text-[var(--maher-text-secondary)]">Default VAT</dt>
            <dd className="font-medium">16%</dd>
          </div>
          <div>
            <dt className="text-[var(--maher-text-secondary)]">Timezone</dt>
            <dd className="font-medium">Asia/Amman</dd>
          </div>
        </dl>
      </Card>
    </div>
  );
}
