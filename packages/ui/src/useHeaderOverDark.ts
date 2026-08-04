'use client';

import { useEffect, useState, type RefObject } from 'react';

type Rgba = { r: number; g: number; b: number; a: number };

const ENTER_DARK_RATIO = 0.4;
const EXIT_DARK_RATIO = 0.28;
const DARK_LUMINANCE = 0.48;

function parseCssColor(input: string): Rgba | null {
  if (!input || input === 'transparent') return null;

  const comma = input.match(
    /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/i,
  );
  if (comma) {
    return {
      r: Number(comma[1]),
      g: Number(comma[2]),
      b: Number(comma[3]),
      a: comma[4] !== undefined ? Number(comma[4]) : 1,
    };
  }

  const space = input.match(
    /rgba?\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\s*\)/i,
  );
  if (space) {
    return {
      r: Number(space[1]),
      g: Number(space[2]),
      b: Number(space[3]),
      a: space[4] !== undefined ? Number(space[4]) : 1,
    };
  }

  const hex = input.trim().match(/^#([0-9a-f]{3,8})$/i);
  if (hex) {
    let h = hex[1]!;
    if (h.length === 3 || h.length === 4) {
      h = h
        .slice(0, 3)
        .split('')
        .map((c) => c + c)
        .join('');
    }
    if (h.length >= 6) {
      return {
        r: parseInt(h.slice(0, 2), 16),
        g: parseInt(h.slice(2, 4), 16),
        b: parseInt(h.slice(4, 6), 16),
        a: h.length >= 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1,
      };
    }
  }

  return null;
}

function relativeLuminance({ r, g, b }: Rgba): number {
  const lin = [r, g, b].map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lin[0]! + 0.7152 * lin[1]! + 0.0722 * lin[2]!;
}

function averageColor(colors: Rgba[]): Rgba | null {
  if (!colors.length) return null;
  const sum = colors.reduce(
    (acc, c) => ({ r: acc.r + c.r, g: acc.g + c.g, b: acc.b + c.b, a: acc.a + c.a }),
    { r: 0, g: 0, b: 0, a: 0 },
  );
  const n = colors.length;
  return { r: sum.r / n, g: sum.g / n, b: sum.b / n, a: sum.a / n };
}

/** Pull solid colors out of gradient / layered background-image strings. */
function colorsFromBackgroundImage(bgImage: string): Rgba[] {
  if (!bgImage || bgImage === 'none') return [];
  const found: Rgba[] = [];

  const hexMatches = bgImage.match(/#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})\b/gi) ?? [];
  for (const hex of hexMatches) {
    const parsed = parseCssColor(hex);
    if (parsed && parsed.a > 0.35) found.push(parsed);
  }

  const rgbMatches = bgImage.match(/rgba?\([^)]+\)/gi) ?? [];
  for (const rgb of rgbMatches) {
    const parsed = parseCssColor(rgb);
    if (parsed && parsed.a > 0.35) found.push(parsed);
  }

  return found;
}

function resolveBackdropColor(start: Element): Rgba | null {
  let node: Element | null = start;

  while (node && node !== document.documentElement) {
    if (node instanceof HTMLElement && node.dataset.headerContrast === 'dark') {
      return { r: 28, g: 22, b: 18, a: 1 };
    }

    const style = getComputedStyle(node);
    const solid = parseCssColor(style.backgroundColor);
    if (solid && solid.a >= 0.45) {
      return solid;
    }

    const fromImage = averageColor(colorsFromBackgroundImage(style.backgroundImage));
    if (fromImage && relativeLuminance(fromImage) < DARK_LUMINANCE + 0.08) {
      return fromImage;
    }

    node = node.parentElement;
  }

  return (
    parseCssColor(getComputedStyle(document.body).backgroundColor) ?? {
      r: 246,
      g: 245,
      b: 243,
      a: 1,
    }
  );
}

function sampleDarkRatio(header: HTMLElement): number {
  const rect = header.getBoundingClientRect();
  if (rect.width < 8 || rect.height < 8) return 0;

  // Sample the frosted band (lower half reads content behind most clearly).
  const xFracs = [0.08, 0.26, 0.5, 0.74, 0.92];
  const yFracs = [0.4, 0.72, 0.92];

  const prev = header.style.pointerEvents;
  header.style.pointerEvents = 'none';

  let dark = 0;
  let total = 0;

  try {
    for (const yf of yFracs) {
      for (const xf of xFracs) {
        const x = rect.left + rect.width * xf;
        const y = rect.top + rect.height * yf;
        if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) continue;

        const stack = document.elementsFromPoint(x, y);
        let hit: Element | null = null;
        for (let i = 0; i < stack.length; i += 1) {
          const el = stack[i]!;
          if (header.contains(el)) continue;
          hit = el;
          break;
        }
        if (!hit) continue;

        const color = resolveBackdropColor(hit);
        if (!color) continue;
        total += 1;
        if (relativeLuminance(color) < DARK_LUMINANCE) dark += 1;
      }
    }
  } finally {
    header.style.pointerEvents = prev;
  }

  return total === 0 ? 0 : dark / total;
}

/**
 * Scroll-aware: samples real backdrop luminance under the sticky header
 * and returns whether chrome should flip to the on-dark (white text) tone.
 */
export function useHeaderOverDark(
  headerRef: RefObject<HTMLElement | null>,
  watchKey?: string | number,
): boolean {
  const [overDark, setOverDark] = useState(false);

  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;

    let rafId = 0;

    const measure = () => {
      rafId = 0;
      const ratio = sampleDarkRatio(header);
      setOverDark((prev) => {
        if (prev) return ratio > EXIT_DARK_RATIO;
        return ratio >= ENTER_DARK_RATIO;
      });
    };

    const schedule = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(measure);
    };

    measure();
    const settleId = window.setTimeout(measure, 100);

    window.addEventListener('scroll', schedule, { passive: true, capture: true });
    window.addEventListener('resize', schedule);
    document.addEventListener('visibilitychange', schedule);

    const mutationObserver = new MutationObserver(schedule);
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'data-header-contrast'],
    });

    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedule) : null;
    ro?.observe(header);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.clearTimeout(settleId);
      window.removeEventListener('scroll', schedule, true);
      window.removeEventListener('resize', schedule);
      document.removeEventListener('visibilitychange', schedule);
      mutationObserver.disconnect();
      ro?.disconnect();
    };
  }, [headerRef, watchKey]);

  return overDark;
}
