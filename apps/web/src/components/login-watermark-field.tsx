'use client';

import { useTheme } from '@maher/ui';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';
import './login-watermark-field.css';

/** Same gold M sheet as dark. Light inverts it so the marks become ink. */
export function LoginWatermarkField() {
  const { resolvedTheme } = useTheme();
  const reduce = usePrefersReducedMotion();
  const dark = resolvedTheme === 'dark';

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ direction: 'ltr' }}
      aria-hidden
    >
      <div
        className={reduce ? 'maher-login-watermark-row maher-login-watermark-row--static' : 'maher-login-watermark-row'}
      >
        {[0, 1, 2].map((index) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={index}
            src="/brand/watermark-field-on-dark.png"
            alt=""
            draggable={false}
            style={{
              opacity: 0.36,
              filter: dark ? undefined : 'invert(1) hue-rotate(180deg)',
            }}
          />
        ))}
      </div>
    </div>
  );
}
