'use client';

import { SecurityDesk } from '@/components/account/security-desk';
import { apiFetch } from '@/lib/api-client';
import type { AuthUser } from '@maher/types';
import { Board, Ltr, Stamp } from '@maher/ui';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

export default function AdminAccountPage() {
  const t = useTranslations('auth');
  const me = useQuery({
    queryKey: ['auth-me'],
    queryFn: () => apiFetch<AuthUser & { mfaEnabled?: boolean }>('/api/v1/auth/me'),
  });
  const initials = (me.data?.name ?? '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');

  return (
    <div className="maher-stagger space-y-5">
      <Board tone="brand" wash="top" as="section">
        <div className="flex flex-wrap items-center gap-4 px-5 py-5 sm:px-6">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--maher-brand-soft)] text-[18px] font-semibold text-[var(--maher-brand)]">{initials || '·'}</span>
          <div className="min-w-0 flex-1">
            <h1 className="text-[24px] font-semibold leading-8 tracking-[-0.02em] text-[var(--maher-text-primary)] sm:text-[28px] sm:leading-9 rtl:tracking-normal">{me.data?.name ?? t('account')}</h1>
            <p className="mt-0.5 text-[14px] leading-5 text-[var(--maher-text-secondary)]">
              <Ltr>{me.data?.username ?? ''}</Ltr>
              <span className="mx-2 text-[var(--maher-text-tertiary)]">·</span>
              {t('securityHint')}
            </p>
          </div>
          <Stamp tone={me.data?.mfaEnabled ? 'success' : 'warning'} size="sm">{me.data?.mfaEnabled ? t('mfaEnabled') : t('mfaDisabled')}</Stamp>
        </div>
      </Board>
      <SecurityDesk />
    </div>
  );
}
