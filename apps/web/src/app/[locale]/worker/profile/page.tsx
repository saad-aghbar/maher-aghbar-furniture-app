'use client';

import { apiFetch } from '@/lib/api-client';
import type { AuthUser } from '@maher/types';
import { Board, BoardSkeleton, ErrorBoard, KeyFacts, Ltr, Stamp } from '@maher/ui';
import { SecurityDesk } from '@/components/account/security-desk';
import { User } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { LanguageSwitcher } from '@/components/language-switcher';
import { AppThemeToggle } from '@/components/theme-toggle';

export default function EmployeeProfilePage() {
  const t = useTranslations('navigation');
  const tAuth = useTranslations('auth');
  const tUsers = useTranslations('users');
  const tMobile = useTranslations('mobile');
  const me = useQuery({
    queryKey: ['auth-me'],
    queryFn: () => apiFetch<AuthUser>('/api/v1/auth/me'),
  });

  if (me.isLoading) {
    return (
      <div className="space-y-5">
        <BoardSkeleton rows={2} />
        <BoardSkeleton rows={4} />
      </div>
    );
  }

  if (me.isError || !me.data) {
    return <ErrorBoard title={t('profile')} onRetry={() => me.refetch()} />;
  }

  const initials = (me.data.name ?? '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');

  return (
    <div className="maher-stagger space-y-5">
      <Board variant="ink" tone="brand" wash="top" as="section">
        <div className="flex flex-wrap items-center gap-4 px-5 py-5 sm:px-6">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--maher-brand-soft)] text-[18px] font-semibold text-[var(--maher-brand)]">{initials || <User className="h-5 w-5" />}</span>
          <div className="min-w-0 flex-1">
            <h1 className="text-[24px] font-semibold leading-8 tracking-[-0.02em] sm:text-[28px] sm:leading-9 rtl:tracking-normal">{me.data.name}</h1>
            <p className="mt-0.5 text-[14px] leading-5 text-[var(--maher-text-secondary)]">{tMobile('workerProfile.subtitle')}</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(me.data.roles ?? []).slice(0, 3).map((role) => (
              <Stamp key={role} tone="brand" size="sm">{role.replaceAll('_', ' ').toLowerCase()}</Stamp>
            ))}
          </div>
        </div>
      </Board>

      <div className="grid gap-5 xl:grid-cols-12">
        <Board tone="neutral" className="xl:col-span-7">
          <Board.Header title={tMobile('workerProfile.title')} />
          <KeyFacts
            className="px-5 pb-5"
            columns={2}
            facts={[
              { label: tAuth('username'), value: <Ltr>{me.data.username ?? '—'}</Ltr> },
              ...(me.data.roles?.length ? [{ label: tUsers('roles'), value: me.data.roles.join(' · ') }] : []),
            ]}
          />
        </Board>
        <Board tone="neutral" className="xl:col-span-5">
          <Board.Header title={tMobile('workerProfile.appearanceSection')} description={tMobile('workerProfile.themeHint')} />
          <Board.Body className="flex flex-wrap items-center gap-3">
            <AppThemeToggle />
            <LanguageSwitcher />
          </Board.Body>
        </Board>
      </div>

      <SecurityDesk />
    </div>
  );
}
