'use client';

import { StatusLabelProvider, UiCopyProvider } from '@maher/ui';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

export function StatusI18nProvider({ children }: { children: ReactNode }) {
  const t = useTranslations('statuses');
  const tCommon = useTranslations('common');
  return (
    <UiCopyProvider retry={tCommon('retry')} loading={tCommon('loading')}>
      <StatusLabelProvider
        translate={(status) => {
          try {
            return t(status as never);
          } catch {
            return undefined;
          }
        }}
      >
        {children}
      </StatusLabelProvider>
    </UiCopyProvider>
  );
}
