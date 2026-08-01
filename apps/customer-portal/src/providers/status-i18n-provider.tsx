'use client';

import { StatusLabelProvider } from '@maher/ui';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

export function StatusI18nProvider({ children }: { children: ReactNode }) {
  const t = useTranslations('statuses');
  return (
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
  );
}
