'use client';

import { usePathname, useRouter } from '@/i18n/navigation';
import { cn } from '@maher/ui';
import { Check, Globe } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState, useTransition } from 'react';

const LOCALES = [
  { code: 'ar', label: 'العربية', short: 'AR' },
  { code: 'en', label: 'English', short: 'EN' },
  { code: 'he', label: 'עברית', short: 'HE' },
] as const;

type LocaleCode = (typeof LOCALES)[number]['code'];

export interface LanguageSwitcherProps {
  /** Pins the control to the top corner of the viewport (used on the login screens). */
  floating?: boolean;
  /** Light chrome for use over dark frosted headers. */
  inverted?: boolean;
  className?: string;
}

export function LanguageSwitcher({ floating, inverted, className }: LanguageSwitcherProps) {
  const t = useTranslations('navigation');
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const current = LOCALES.find((item) => item.code === locale) ?? LOCALES[1];

  const pick = (code: LocaleCode) => {
    setOpen(false);
    if (code === locale) return;
    startTransition(() => {
      router.replace(pathname, { locale: code });
    });
  };

  return (
    <div
      ref={rootRef}
      className={cn(
        floating ? 'fixed end-4 top-4 z-50 sm:end-6 sm:top-6' : 'relative',
        className,
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t('language')}
        title={t('language')}
        className={cn(
          'maher-lang-switch maher-press group flex h-10 items-center gap-2 rounded-full border px-3.5 text-sm font-semibold tracking-[0.08em] shadow-card backdrop-blur-md transition-colors duration-200',
          'hover:-translate-y-0.5 hover:shadow-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
          inverted
            ? open
              ? 'border-white/40 bg-white/15 text-white shadow-elevated'
              : 'border-white/25 bg-white/10 text-white hover:border-white/40 hover:bg-white/15'
            : open
              ? 'border-brand/50 bg-surface/80 text-text-primary shadow-elevated'
              : 'border-border bg-surface/80 text-text-secondary hover:border-brand/40 hover:text-text-primary',
        )}
      >
        <Globe
          className={cn(
            'h-4 w-4 text-brand transition-transform duration-500 ease-out',
            isPending ? 'animate-spin' : open ? 'rotate-180' : 'group-hover:rotate-180',
          )}
        />
        {current.short}
      </button>

      {open ? (
        <ul
          role="listbox"
          aria-label={t('language')}
          className="maher-animate-pop absolute end-0 top-[calc(100%+0.5rem)] z-50 w-44 rounded-[var(--maher-radius-lg)] border border-border bg-surface p-1.5 shadow-float"
        >
          {LOCALES.map((item, index) => {
            const selected = item.code === locale;
            return (
              <li key={item.code}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => pick(item.code)}
                  style={{ animationDelay: `${index * 45}ms`, animationFillMode: 'backwards' }}
                  className={cn(
                    'maher-animate-in-start flex w-full items-center justify-between gap-2 rounded-[var(--maher-radius-md)] px-3 py-2 text-sm hover:bg-brand-soft',
                    selected
                      ? 'font-semibold text-brand'
                      : 'text-text-secondary hover:text-text-primary',
                  )}
                >
                  {item.label}
                  <Check
                    className={cn(
                      'h-4 w-4 transition-all duration-200 ease-out',
                      selected ? 'scale-100 opacity-100' : 'scale-50 opacity-0',
                    )}
                  />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
