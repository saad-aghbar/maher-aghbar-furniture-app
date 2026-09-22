'use client';

import { SecurityDesk } from '@/components/account/security-desk';
import { apiFetch } from '@/lib/api-client';
import { Link } from '@/i18n/navigation';
import type { AuthUser } from '@maher/types';
import { Board, BoardSkeleton, ErrorBoard, KeyFacts, Ledger, LedgerRow, Ltr, SectionTabs, Stamp } from '@maher/ui';
import { useQuery } from '@tanstack/react-query';
import { Bell, ShieldCheck, User } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

type ProfileTab = 'profile' | 'security';

export default function ProfilePage() {
  const t = useTranslations('navigation');
  const tc = useTranslations('catalog');
  const tAuth = useTranslations('auth');
  const tCustomers = useTranslations('customers');
  const tCommon = useTranslations('common');
  const [tab, setTab] = useState<ProfileTab>('profile');

  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['auth-me'], queryFn: () => apiFetch<AuthUser & { mfaEnabled?: boolean }>('/api/v1/auth/me') });
  const companyQuery = useQuery({
    queryKey: ['customer-company', data?.customerId],
    enabled: Boolean(data?.customerId),
    queryFn: () => apiFetch<{ code?: string; fax?: string | null; phone?: string | null; email?: string | null; address?: string | null; nameEn?: string | null; name?: string | null; status?: string | null }>(`/api/v1/customers/${data!.customerId}`),
  });

  if (isLoading && !data) {
    return (
      <div className="space-y-5">
        <BoardSkeleton rows={2} />
        <BoardSkeleton rows={5} />
      </div>
    );
  }
  if (isError || !data) return <ErrorBoard title={t('profile')} description={tCommon('loadFailed')} onRetry={() => refetch()} retryLabel={tCommon('retry')} />;

  const company = companyQuery.data;
  const initials = (data.name ?? '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');

  return (
    <div className="maher-stagger space-y-5">
      <Board tone="brand" wash="top" as="section">
        <div className="flex flex-wrap items-center gap-4 px-5 py-5 sm:px-6">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--maher-brand-soft)] text-[18px] font-semibold text-[var(--maher-brand)]">{initials || <User className="h-5 w-5" />}</span>
          <div className="min-w-0 flex-1">
            <h1 className="text-[24px] font-semibold leading-8 tracking-[-0.02em] text-[var(--maher-text-primary)] sm:text-[28px] sm:leading-9 rtl:tracking-normal">{data.name}</h1>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[14px] leading-5 text-[var(--maher-text-secondary)]">
              <Ltr>{data.username ?? ''}</Ltr>
              {company?.name || company?.nameEn ? (
                <>
                  <span className="text-[var(--maher-text-tertiary)]">·</span>
                  <span>{company.nameEn || company.name}</span>
                </>
              ) : null}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {company?.code ? <Stamp tone="neutral" size="sm"><Ltr>{company.code}</Ltr></Stamp> : null}
            <Stamp tone={data.mfaEnabled ? 'success' : 'warning'} size="sm">{data.mfaEnabled ? tAuth('mfaEnabled') : tAuth('mfaDisabled')}</Stamp>
          </div>
        </div>
      </Board>

      <SectionTabs
        aria-label={t('profile')}
        value={tab}
        onChange={(id) => setTab(id as ProfileTab)}
        items={[
          { id: 'profile', label: t('profile'), icon: <User className="h-4 w-4" /> },
          { id: 'security', label: tAuth('mfaSetup'), icon: <ShieldCheck className="h-4 w-4" /> },
          { id: 'notifications', label: t('notifications'), icon: <Bell className="h-4 w-4" />, href: '/dealer/notifications' },
        ]}
        LinkComponent={Link}
      />

      {tab === 'profile' ? (
        <div className="grid gap-5 xl:grid-cols-12">
          <Board tone="neutral" className="xl:col-span-7">
            <Board.Header title={data.name} description={tAuth('account')} />
            <KeyFacts
              className="px-5 pb-5"
              columns={2}
              facts={[
                { label: tAuth('username'), value: data.username ?? '—', ltr: true },
                { label: tc('email'), value: data.email || '—', ltr: true },
                { label: tc('phone'), value: data.phone || '—', ltr: true },
                { label: tCustomers('fax'), value: company?.fax?.trim() || '—', ltr: true },
                ...(company?.address ? [{ label: tCommon('address'), value: company.address, wide: true }] : []),
                ...(data.roles?.length ? [{ label: tc('rolesTitle'), value: data.roles.join(', ') }] : []),
              ]}
            />
          </Board>
          <Board tone="brand" className="xl:col-span-5">
            <Board.Header title={tCommon('quickActions')} />
            <Ledger className="px-5 pb-3">
              {(
                [
                  { href: '/dealer/quotations', label: t('quotations') },
                  { href: '/dealer/invoices', label: t('invoices') },
                  { href: '/dealer/payments', label: t('payments') },
                  { href: '/dealer/statement', label: t('statement') },
                  { href: '/dealer/returns', label: t('returns') },
                  { href: '/dealer/deliveries', label: t('schedule') },
                ] as const
              ).map((place) => (
                <LedgerRow key={place.href} label={place.label} value="" href={place.href} LinkComponent={Link} />
              ))}
            </Ledger>
          </Board>
        </div>
      ) : (
        <SecurityDesk />
      )}
    </div>
  );
}
