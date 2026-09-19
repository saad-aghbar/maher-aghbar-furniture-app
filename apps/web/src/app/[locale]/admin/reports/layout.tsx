'use client';

import { ReportsChrome } from '@/components/cost-performance/reports-chrome';
import type { ReactNode } from 'react';
import { Suspense } from 'react';

export default function ReportsLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense>
      <ReportsChrome>{children}</ReportsChrome>
    </Suspense>
  );
}
