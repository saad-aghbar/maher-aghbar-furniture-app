'use client';

import { useEffect, useState } from 'react';

export type WebWindowClass = 'COMPACT' | 'MEDIUM' | 'EXPANDED' | 'WIDE';
export type WebNavMode = 'bottom' | 'rail' | 'sidebar';

export function classifyWidth(width: number): WebWindowClass {
  if (width < 600) return 'COMPACT';
  if (width < 900) return 'MEDIUM';
  if (width < 1200) return 'EXPANDED';
  return 'WIDE';
}

export function navigationModeFor(surface: 'admin' | 'dealer' | 'worker', windowClass: WebWindowClass): WebNavMode {
  if (surface !== 'admin') return 'bottom';
  if (windowClass === 'COMPACT') return 'bottom';
  if (windowClass === 'MEDIUM') return 'rail';
  return 'sidebar';
}

export function useWebLayout(surface: 'admin' | 'dealer' | 'worker') {
  const [width, setWidth] = useState(1280);
  useEffect(() => {
    const update = () => setWidth(window.innerWidth);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  const windowClass = classifyWidth(width);
  return { width, windowClass, navigationMode: navigationModeFor(surface, windowClass) };
}
