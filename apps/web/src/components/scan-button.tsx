'use client';

import { useRouter } from '@/i18n/navigation';
import { routeForScan, type ScanSurface } from '@/lib/scan-router';
import { cn, useOptionalCodeScanner, useOptionalToast } from '@maher/ui';
import { ScanLine } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

/**
 * Topbar scan entry (admin + worker). Opens the themed scanner, resolves the
 * code (bin → kit → lot → item → order number) and navigates.
 */
export function ScanButton({ surface = 'admin', className, inverted }: { surface?: ScanSurface; className?: string; inverted?: boolean }) {
  const t = useTranslations('common');
  const router = useRouter();
  const scanner = useOptionalCodeScanner();
  const toast = useOptionalToast();
  const [busy, setBusy] = useState(false);
  if (!scanner) return null;

  async function scan() {
    const code = await scanner!.openScanner({ title: t('scanTitle'), hint: t('scanHint') });
    if (!code) return;
    setBusy(true);
    try {
      const target = await routeForScan(code, surface);
      if (target.kind === 'route') {
        router.push(target.href);
      } else if (target.kind === 'unknown') {
        toast?.error(t('scanUnknownTitle'), t('scanUnknownBody', { code }));
      } else {
        toast?.error(t('scanFailed'));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void scan()}
      aria-label={t('scanTitle')}
      aria-busy={busy || undefined}
      className={cn(
        'maher-header-icon-btn maher-press group relative flex h-9 w-9 items-center justify-center rounded-[var(--maher-radius-md)]',
        inverted ? 'text-white hover:bg-white/10 hover:text-white' : 'text-text-secondary hover:bg-surface-muted hover:text-text-primary',
        className,
      )}
    >
      <ScanLine className={cn('h-[18px] w-[18px] transition-transform duration-300 ease-out group-hover:scale-110', busy && 'animate-pulse')} />
    </button>
  );
}
