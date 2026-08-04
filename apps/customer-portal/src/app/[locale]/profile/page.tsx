'use client';

import { apiFetch } from '@/lib/api-client';
import type { AuthUser } from '@maher/types';
import { Card, ErrorState, MotionSection, PageHero, Skeleton } from '@maher/ui';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

export default function ProfilePage() {
  const t = useTranslations('navigation');
  const tc = useTranslations('catalog');
  const tAuth = useTranslations('auth');
  const tCustomers = useTranslations('customers');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['auth-me'],
    queryFn: () => apiFetch<AuthUser>('/api/v1/auth/me'),
  });

  const companyQuery = useQuery({
    queryKey: ['customer-company', data?.customerId],
    enabled: Boolean(data?.customerId),
    queryFn: () =>
      apiFetch<{ fax?: string | null; phone?: string | null; nameEn?: string | null; name?: string | null }>(
        `/api/v1/customers/${data!.customerId}`,
      ),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-28 w-full rounded-[var(--maher-radius-xl)]" />
        <Skeleton className="h-40 w-full max-w-lg rounded-xl" />
      </div>
    );
  }

  if (isError || !data) {
    return <ErrorState title={t('profile')} onRetry={() => refetch()} />;
  }

  const companyFax = companyQuery.data?.fax?.trim();

  return (
    <div className="space-y-6">
      <PageHero tone="soft" title={t('profile')} />

      <MotionSection delayMs={60}>
        <Card title={data.name} className="maher-form-section max-w-lg">
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-text-secondary">{tAuth('username')}</dt>
              <dd className="font-medium">{data.username ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-text-secondary">{tc('email')}</dt>
              <dd className="font-medium">{data.email || '—'}</dd>
            </div>
            {data.phone ? (
              <div>
                <dt className="text-text-secondary">{tc('phone')}</dt>
                <dd className="font-medium" dir="ltr">
                  {data.phone}
                </dd>
              </div>
            ) : null}
            <div>
              <dt className="text-text-secondary">{tCustomers('fax')}</dt>
              <dd className="font-medium" dir="ltr">
                {companyFax || '—'}
              </dd>
            </div>
            {data.roles?.length ? (
              <div>
                <dt className="text-text-secondary">{tc('rolesTitle')}</dt>
                <dd className="font-medium">{data.roles.join(', ')}</dd>
              </div>
            ) : null}
          </dl>
        </Card>
      </MotionSection>
    </div>
  );
}
