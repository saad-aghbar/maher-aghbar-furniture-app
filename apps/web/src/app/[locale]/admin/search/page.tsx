'use client';

import { SearchDesk } from '@/components/global-search';
import { useRouter } from '@/i18n/navigation';
import { Board } from '@maher/ui';
import { useTranslations } from 'next-intl';

export default function AdminSearchPage() {
  const t = useTranslations('common');
  const tm = useTranslations('mobile');
  const router = useRouter();
  return (
    <div className="maher-stagger space-y-5">
      <Board tone="brand" wash="top" as="section">
        <div className="px-5 py-5 sm:px-6">
          <h1 className="text-[24px] font-semibold leading-8 tracking-[-0.02em] text-[var(--maher-text-primary)] sm:text-[28px] sm:leading-9 rtl:tracking-normal">{t('search')}</h1>
          <p className="mt-1 max-w-[56ch] text-[14px] leading-5 text-[var(--maher-text-secondary)]">{tm('search.hintBody')}</p>
        </div>
      </Board>
      <SearchDesk autoFocus onNavigate={(href) => router.push(href)} />
    </div>
  );
}
