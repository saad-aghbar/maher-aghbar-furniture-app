'use client';

import { useRouter } from '@/i18n/navigation';
import { Button, PageHeader as UiPageHeader } from '@maher/ui';
import { ArrowLeft } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  /** Show a return button (uses browser history, falls back to this href). */
  backHref?: string;
  /** Force showing back even without backHref (history only). Default true when backHref set. */
  showBack?: boolean;
}

export function PageHeader({
  title,
  description,
  actions,
  backHref,
  showBack,
}: PageHeaderProps) {
  const router = useRouter();
  const t = useTranslations('common');
  const shouldShowBack = showBack ?? Boolean(backHref);

  function goBack() {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }
    if (backHref) {
      router.push(backHref);
    }
  }

  return (
    <UiPageHeader
      title={title}
      description={description}
      actions={actions}
      leading={
        shouldShowBack ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-ms-2 gap-1.5 text-text-secondary hover:text-text-primary"
            onClick={goBack}
            leadingIcon={<ArrowLeft className="h-4 w-4 rtl:rotate-180" />}
          >
            {t('back')}
          </Button>
        ) : null
      }
    />
  );
}
