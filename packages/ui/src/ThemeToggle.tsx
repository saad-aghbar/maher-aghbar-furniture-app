'use client';

import { useEffect, useState, type ButtonHTMLAttributes } from 'react';
import { cn } from './cn';
import { useTheme } from './ThemeProvider';

export interface ThemeToggleProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Pins the control near the floating language switcher (login screens). */
  floating?: boolean;
  /** Light chrome for use over dark frosted headers. */
  inverted?: boolean;
  /** Accessible label when current theme is light (action: switch to dark). */
  labelToDark?: string;
  /** Accessible label when current theme is dark (action: switch to light). */
  labelToLight?: string;
}

export function ThemeToggle({
  floating,
  inverted,
  labelToDark = 'Switch to dark mode',
  labelToLight = 'Switch to light mode',
  className,
  onClick,
  ...rest
}: ThemeToggleProps) {
  const { resolvedTheme, toggleTheme } = useTheme();
  const [animating, setAnimating] = useState(false);
  const [settling, setSettling] = useState(false);
  const isDark = resolvedTheme === 'dark';
  const label = isDark ? labelToLight : labelToDark;

  useEffect(() => {
    if (!animating) return undefined;
    const settleTimer = window.setTimeout(() => {
      setAnimating(false);
      setSettling(true);
    }, 560);
    return () => window.clearTimeout(settleTimer);
  }, [animating]);

  useEffect(() => {
    if (!settling) return undefined;
    const done = window.setTimeout(() => setSettling(false), 560);
    return () => window.clearTimeout(done);
  }, [settling]);

  return (
    <button
      type="button"
      {...rest}
      // Icon is driven by html[data-theme] CSS (FOUC-safe). Labels catch up after layout sync.
      suppressHydrationWarning
      aria-label={label}
      title={label}
      className={cn(
        'maher-theme-toggle maher-press',
        floating && 'maher-theme-toggle--floating',
        animating && 'maher-theme-toggle--animating',
        settling && 'maher-theme-toggle--settling',
        inverted && 'border-white/30 bg-white/10 text-white',
        className,
      )}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        setAnimating(true);
        toggleTheme();
      }}
    >
      <span className="maher-theme-toggle__glow" aria-hidden />
      <svg
        className="maher-theme-toggle__svg"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <line className="maher-theme-toggle__ray" x1="12" y1="2.5" x2="12" y2="5" strokeWidth="1.75" strokeLinecap="round" />
        <line className="maher-theme-toggle__ray" x1="12" y1="19" x2="12" y2="21.5" strokeWidth="1.75" strokeLinecap="round" />
        <line className="maher-theme-toggle__ray" x1="2.5" y1="12" x2="5" y2="12" strokeWidth="1.75" strokeLinecap="round" />
        <line className="maher-theme-toggle__ray" x1="19" y1="12" x2="21.5" y2="12" strokeWidth="1.75" strokeLinecap="round" />
        <line className="maher-theme-toggle__ray" x1="5.05" y1="5.05" x2="6.8" y2="6.8" strokeWidth="1.75" strokeLinecap="round" />
        <line className="maher-theme-toggle__ray" x1="17.2" y1="17.2" x2="18.95" y2="18.95" strokeWidth="1.75" strokeLinecap="round" />
        <line className="maher-theme-toggle__ray" x1="18.95" y1="5.05" x2="17.2" y2="6.8" strokeWidth="1.75" strokeLinecap="round" />
        <line className="maher-theme-toggle__ray" x1="6.8" y1="17.2" x2="5.05" y2="18.95" strokeWidth="1.75" strokeLinecap="round" />
        <circle className="maher-theme-toggle__sun-core" cx="12" cy="12" r="4.25" />
        <path
          className="maher-theme-toggle__moon"
          d="M13.2 4.2a7.8 7.8 0 1 0 6.6 11.8A6.4 6.4 0 0 1 13.2 4.2Z"
        />
      </svg>
    </button>
  );
}
