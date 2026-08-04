export type ThemeMode = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'maher-theme';

export function getSystemTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function getStoredTheme(): ThemeMode | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (value === 'light' || value === 'dark') return value;
  } catch {
    /* ignore quota / private mode */
  }
  return null;
}

export function resolveTheme(stored: ThemeMode | null = getStoredTheme()): ThemeMode {
  return stored ?? getSystemTheme();
}

export function applyTheme(theme: ThemeMode): void {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', theme);
}

/** Live theme on `<html>` (FOUC script / applyTheme). Falls back to resolveTheme. */
export function getAppliedTheme(): ThemeMode {
  if (typeof document !== 'undefined') {
    const attr = document.documentElement.getAttribute('data-theme');
    if (attr === 'light' || attr === 'dark') return attr;
  }
  return resolveTheme();
}

export function persistTheme(theme: ThemeMode): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* ignore */
  }
}

/** Inline script for layouts — runs before paint to prevent FOUC. */
export const THEME_FOUC_SCRIPT = `(function(){try{var k='${THEME_STORAGE_KEY}';var s=localStorage.getItem(k);var t=(s==='light'||s==='dark')?s:(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','light');}})();`;

const ANIM_MS = 300;
const FADE_MS = 140;

export function animateThemeChange(next: ThemeMode): void {
  if (typeof document === 'undefined') return;

  const reduced =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const root = document.documentElement;

  if (reduced) {
    applyTheme(next);
    return;
  }

  root.classList.add('maher-theme-animating', 'maher-theme-fade');

  window.setTimeout(() => {
    applyTheme(next);
    root.classList.remove('maher-theme-fade');
  }, FADE_MS);

  window.setTimeout(() => {
    root.classList.remove('maher-theme-animating');
  }, ANIM_MS);
}
