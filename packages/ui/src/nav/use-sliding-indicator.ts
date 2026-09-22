'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type IndicatorRect = { left: number; width: number } | null;

/**
 * Measures the active child (`[data-active="true"]`) inside a container and
 * returns a physical left/width so a sliding indicator can follow it.
 * Physical pixels work identically in LTR and RTL.
 */
export function useSlidingIndicator<T extends HTMLElement>(activeKey: string | number | null | undefined) {
  const containerRef = useRef<T>(null);
  const [rect, setRect] = useState<IndicatorRect>(null);
  const [scrollable, setScrollable] = useState(false);

  const measure = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const active = container.querySelector<HTMLElement>('[data-active="true"]');
    setScrollable(container.scrollWidth > container.clientWidth + 1);
    if (!active) {
      setRect(null);
      return;
    }
    setRect({ left: active.offsetLeft, width: active.offsetWidth });
    // Keep the active tab in view on compact screens.
    const viewStart = container.scrollLeft;
    const viewEnd = viewStart + container.clientWidth;
    if (active.offsetLeft < viewStart || active.offsetLeft + active.offsetWidth > viewEnd) {
      container.scrollTo({ left: active.offsetLeft - 16, behavior: 'smooth' });
    }
  }, []);

  useEffect(() => {
    measure();
  }, [measure, activeKey]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => measure());
    ro.observe(container);
    Array.from(container.children).forEach((child) => ro.observe(child));
    return () => ro.disconnect();
  }, [measure]);

  // Fonts can load after first paint and change tab widths.
  useEffect(() => {
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    if (!fonts?.ready) return undefined;
    let cancelled = false;
    void fonts.ready.then(() => {
      if (!cancelled) measure();
    });
    return () => {
      cancelled = true;
    };
  }, [measure]);

  return { containerRef, rect, scrollable, measure };
}
