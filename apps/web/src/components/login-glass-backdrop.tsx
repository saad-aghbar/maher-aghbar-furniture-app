'use client';

import { useEffect, useRef } from 'react';
import { loadLiquidGlass, recaptureGlassSnapshot } from './login-liquid-glass';

function ensureGlassStylesheet() {
  const href = '/liquid-glass/glass.css';
  if (document.querySelector(`link[href="${href}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

/** Liquid-glass veil over the login surface — samples the shader + watermark behind it. */
export function LoginGlassBackdrop({ className }: { className?: string }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let cancelled = false;
    let instance: { element: HTMLElement } | null = null;
    let resizeTimer: number | undefined;

    ensureGlassStylesheet();

    void loadLiquidGlass()
      .then(({ Container }) => {
        if (cancelled || !hostRef.current) return;
        const glass = new Container({ borderRadius: 0, type: 'rounded', tintOpacity: 0.1 });
        glass.element.style.width = '100%';
        glass.element.style.height = '100%';
        host.appendChild(glass.element);
        instance = glass;
        window.setTimeout(() => {
          if (!cancelled) recaptureGlassSnapshot();
        }, 600);
      })
      .catch(() => undefined);

    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        if (!cancelled) recaptureGlassSnapshot();
      }, 300);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelled = true;
      window.removeEventListener('resize', onResize);
      window.clearTimeout(resizeTimer);
      instance?.element.remove();
    };
  }, []);

  return (
    <div
      ref={hostRef}
      className={className ?? 'pointer-events-none absolute inset-0 overflow-hidden opacity-60'}
      aria-hidden
    />
  );
}
