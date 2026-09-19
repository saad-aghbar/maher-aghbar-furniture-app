'use client';

import { SurfaceGate } from '@/session/surface-gate';
import type { ReactNode } from 'react';

export default function AdminSurfaceLayout({ children }: { children: ReactNode }) {
  return <SurfaceGate expected="admin">{children}</SurfaceGate>;
}
