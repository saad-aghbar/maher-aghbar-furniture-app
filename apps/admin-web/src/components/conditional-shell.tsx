'use client';

import { usePathname } from '@/i18n/navigation';
import type { ReactNode } from 'react';
import { AppShell } from './app-shell';

export function ConditionalShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === '/login';

  if (isLogin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        {children}
      </div>
    );
  }

  return <AppShell>{children}</AppShell>;
}
