'use client';

import { GlobalSearch } from '@/components/global-search';
import { FloorBoard, PageHero } from '@maher/ui';
import { useTranslations } from 'next-intl';

export default function AdminSearchPage() {
  const t = useTranslations('common');
  return (
    <div className="space-y-6">
      <PageHero title={t('search')} />
      <FloorBoard>
        <GlobalSearch />
      </FloorBoard>
    </div>
  );
}
