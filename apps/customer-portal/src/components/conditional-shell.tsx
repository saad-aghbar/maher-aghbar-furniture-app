'use client';

import { usePathname } from '@/i18n/navigation';
import type { ReactNode } from 'react';
import { PortalShell } from './portal-shell';

export function ConditionalShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === '/login') {
    return <>{children}</>;
  }
  return <PortalShell>{children}</PortalShell>;
}
