'use client';

import { SurfaceGate } from '@/session/surface-gate';
import type { ReactNode } from 'react';

export default function WorkerSurfaceLayout({ children }: { children: ReactNode }) {
  return <SurfaceGate expected="worker">{children}</SurfaceGate>;
}
