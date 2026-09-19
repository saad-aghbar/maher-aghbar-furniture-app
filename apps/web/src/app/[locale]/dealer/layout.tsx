'use client';

import { SurfaceGate } from '@/session/surface-gate';
import type { ReactNode } from 'react';

export default function DealerSurfaceLayout({ children }: { children: ReactNode }) {
  return <SurfaceGate expected="dealer">{children}</SurfaceGate>;
}
