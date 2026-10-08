'use client';

/**
 * @shadergradient/react and R3F still construct THREE.Clock. Three r183+ warns
 * on every `new Clock()`, which floods the console on each canvas mount.
 */
declare global {
  interface Window {
    __maherSilenceThreeClock?: boolean;
  }
}

if (typeof window !== 'undefined' && !window.__maherSilenceThreeClock) {
  window.__maherSilenceThreeClock = true;
  const orig = console.warn.bind(console);
  console.warn = (...args: unknown[]) => {
    const text = args.map(String).join(' ');
    if (text.includes('THREE.Clock') || text.includes('Clock: This module has been deprecated')) {
      return;
    }
    orig(...args);
  };
}
