'use client';

import {
  useCallback,
  useRef,
  type MouseEvent,
  type RefObject,
} from 'react';

export function useCardMotion<T extends HTMLElement = HTMLElement>(maxTilt = 7) {
  const ref = useRef<T>(null);

  const onMove = useCallback(
    (e: MouseEvent<T>) => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      el.style.setProperty('--rx', `${(0.5 - y) * maxTilt}deg`);
      el.style.setProperty('--ry', `${(x - 0.5) * (maxTilt + 2)}deg`);
      el.style.setProperty('--mx', `${x * 100}%`);
      el.style.setProperty('--my', `${y * 100}%`);
    },
    [maxTilt],
  );

  const onLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
    el.style.setProperty('--mx', '50%');
    el.style.setProperty('--my', '40%');
  }, []);

  return { ref: ref as RefObject<T>, onMove, onLeave };
}
