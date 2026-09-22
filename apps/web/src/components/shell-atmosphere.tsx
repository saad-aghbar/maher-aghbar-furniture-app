'use client';

import { useTheme } from '@maher/ui';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';
import dynamic from 'next/dynamic';
import './shell-atmosphere.css';

const BrandShaderWash = dynamic(
  () => import('@/components/brand-shader-wash').then((mod) => mod.BrandShaderWash),
  { ssr: false },
);

/** Quiet field behind admin chrome. Wash stays in the gutters, not under type. */
export function ShellAtmosphere() {
  const { resolvedTheme } = useTheme();
  const reduce = usePrefersReducedMotion();
  const dark = resolvedTheme === 'dark';

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      <div
        className="absolute inset-0"
        style={{ backgroundColor: dark ? '#0a0a0c' : '#f5f5f3' }}
      />
      <div
        className="absolute inset-0"
        style={{ backgroundColor: dark ? '#1e1a1b' : '#e1dfd3', opacity: 0.97 }}
      />
      <div className="absolute inset-0 opacity-40">
        <BrandShaderWash variant="shell" />
      </div>
      <div
        className="absolute inset-0"
        style={{ backgroundColor: dark ? '#1e1a1b' : '#e1dfd3', opacity: 0.76 }}
      />
      <div className="absolute inset-0 overflow-hidden" style={{ direction: 'ltr' }}>
        <div
          className={
            reduce ? 'maher-shell-watermark-row maher-shell-watermark-row--static' : 'maher-shell-watermark-row'
          }
        >
          {[0, 1, 2].map((index) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={index}
              src="/brand/watermark-field-on-dark.png"
              alt=""
              draggable={false}
              style={{
                opacity: 0.1,
                filter: dark ? undefined : 'invert(1) hue-rotate(180deg)',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
