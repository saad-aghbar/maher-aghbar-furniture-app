'use client';

import { useEffect, useState } from 'react';

export function useCountUp(target: number, enabled: boolean, durationMs = 900) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setValue(0);
      return;
    }
    const safe = Number.isFinite(target) ? target : 0;
    if (safe === 0) {
      setValue(0);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(safe * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, enabled, durationMs]);

  return value;
}
