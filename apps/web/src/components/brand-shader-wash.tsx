'use client';

import '@/lib/silence-three-clock';
import { useTheme } from '@maher/ui';
import { ShaderGradient, ShaderGradientCanvas } from '@shadergradient/react';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';
import { useEffect, useState } from 'react';

/** Always the dark mesh. Light mode flips these stops in CSS. */
const MESH = {
  color1: '#1e1a1b',
  color2: '#a8906c',
  color3: '#776245',
} as const;

interface Preset {
  pixelDensity: number;
  uSpeed: number;
  uStrength: number;
  uDensity: number;
  grain: 'on' | 'off';
  brightness: number;
  cDistance: number;
  cPolarAngle: number;
  colors: { color1: string; color2: string; color3: string };
}

const PRESETS: Record<'login' | 'shell' | 'hero', Preset> = {
  login: {
    pixelDensity: 1.4,
    uSpeed: 0.12,
    uStrength: 0.85,
    uDensity: 1.1,
    grain: 'on',
    brightness: 0.85,
    cDistance: 3.2,
    cPolarAngle: 115,
    colors: MESH,
  },
  shell: {
    pixelDensity: 1.0,
    uSpeed: 0.06,
    uStrength: 0.55,
    uDensity: 1.1,
    grain: 'off',
    brightness: 0.85,
    cDistance: 3.2,
    cPolarAngle: 115,
    colors: MESH,
  },
  /**
   * Ink hero board. Always dark (never flipped in light mode), framed closer so the
   * gold ridges fill a short wide box, no grain because the box is small.
   */
  hero: {
    pixelDensity: 1.2,
    uSpeed: 0.1,
    uStrength: 0.9,
    uDensity: 1.4,
    grain: 'off',
    brightness: 1.15,
    cDistance: 2.2,
    cPolarAngle: 100,
    colors: { color1: '#2a2224', color2: '#a8906c', color3: '#5c4a38' },
  },
};

type Variant = keyof typeof PRESETS;

function useDocumentHidden() {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const sync = () => setHidden(document.hidden);
    sync();
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, []);

  return hidden;
}

/** Shared water-plane. Login is full; shell is calmer; hero stays dark in both themes. */
export function BrandShaderWash({ variant = 'login' }: { variant?: Variant }) {
  const { resolvedTheme } = useTheme();
  const reduce = usePrefersReducedMotion();
  const hidden = useDocumentHidden();
  const dark = resolvedTheme === 'dark' || variant === 'hero';
  const preset = PRESETS[variant];
  const animateOff = reduce || hidden;

  return (
    <div
      className="pointer-events-none absolute inset-0"
      style={dark ? undefined : { filter: 'invert(1) hue-rotate(180deg)' }}
      aria-hidden
    >
      <ShaderGradientCanvas
        style={{ position: 'absolute', inset: 0 }}
        pixelDensity={preset.pixelDensity}
        fov={45}
        pointerEvents="none"
        lazyLoad={false}
      >
        <ShaderGradient
          type="waterPlane"
          animate={animateOff ? 'off' : 'on'}
          lightType="3d"
          grain={preset.grain}
          uSpeed={animateOff ? 0 : preset.uSpeed}
          uStrength={preset.uStrength}
          uDensity={preset.uDensity}
          cDistance={preset.cDistance}
          cPolarAngle={preset.cPolarAngle}
          brightness={preset.brightness}
          color1={preset.colors.color1}
          color2={preset.colors.color2}
          color3={preset.colors.color3}
        />
      </ShaderGradientCanvas>
    </div>
  );
}
