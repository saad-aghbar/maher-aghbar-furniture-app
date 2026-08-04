'use client';

import { useRouter } from '@/i18n/navigation';
import { Button } from '@maher/ui';
import { ArrowLeft } from 'lucide-react';
import { useTranslations } from 'next-intl';

export function BackButton({ fallbackHref = '/orders' }: { fallbackHref?: string }) {
  const router = useRouter();
  const t = useTranslations('common');

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="-ms-2 mb-2 gap-1.5 text-text-secondary hover:text-text-primary"
      leadingIcon={<ArrowLeft className="h-4 w-4 rtl:rotate-180" />}
      onClick={() => {
        if (typeof window !== 'undefined' && window.history.length > 1) {
          router.back();
          return;
        }
        router.push(fallbackHref);
      }}
    >
      {t('back')}
    </Button>
  );
}
