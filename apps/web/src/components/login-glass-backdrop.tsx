'use client';

import { useEffect, useRef } from 'react';
import { loadLiquidGlass } from './login-liquid-glass';

/** Restrained liquid-glass wash on the login hero only — parchment floors stay parchment. */
export function LoginGlassBackdrop() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let cancelled = false;
    let instance: { element: HTMLElement } | null = null;

    void loadLiquidGlass()
      .then(({ Container }) => {
        if (cancelled || !hostRef.current) return;
        const glass = new Container({ borderRadius: 48, type: 'rounded', tintOpacity: 0.12 });
        glass.element.style.width = '100%';
        glass.element.style.height = '100%';
        host.appendChild(glass.element);
        instance = glass;
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
      instance?.element.remove();
    };
  }, []);

  return (
    <div
      ref={hostRef}
      className="pointer-events-none absolute inset-8 overflow-hidden rounded-[48px] opacity-70"
      aria-hidden
    />
  );
}
