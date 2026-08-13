'use client';

import { apiFetch } from '@/lib/api-client';
import type { AuthUser } from '@maher/types';
import { Alert, Button, Card, ErrorState, Input, PageHero, Skeleton } from '@maher/ui';
import { translateApiError } from '@maher/i18n';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { LanguageSwitcher } from '@/components/language-switcher';
import { AppThemeToggle } from '@/components/theme-toggle';

export default function EmployeeProfilePage() {
  const locale = useLocale();
  const t = useTranslations('navigation');
  const tAuth = useTranslations('auth');
  const tUsers = useTranslations('users');
  const tMobile = useTranslations('mobile');
  const qc = useQueryClient();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const me = useQuery({
    queryKey: ['auth-me'],
    queryFn: () => apiFetch<AuthUser>('/api/v1/auth/me'),
  });

  const changePassword = useMutation({
    mutationFn: () =>
      apiFetch('/api/v1/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      }),
    onSuccess: async () => {
      setError(null);
      setMessage(tUsers('passwordChanged'));
      setCurrentPassword('');
      setNewPassword('');
      await qc.invalidateQueries({ queryKey: ['auth-me'] });
    },
    onError: (err) => {
      setMessage(null);
      setError(translateApiError(locale, err, tAuth('passwordChangeFailed')));
    },
  });

  if (me.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 w-full rounded-[var(--maher-radius-xl)]" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  if (me.isError || !me.data) {
    return <ErrorState title={t('profile')} onRetry={() => me.refetch()} />;
  }

  return (
    <div className="space-y-6">
      <PageHero tone="soft" title={tMobile('workerProfile.title')} description={tMobile('workerProfile.subtitle')} />

      <Card title={me.data.name}>
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-text-secondary">{tAuth('username')}</dt>
            <dd className="font-medium">{me.data.username ?? '—'}</dd>
          </div>
          {me.data.roles?.length ? (
            <div>
              <dt className="text-text-secondary">{tUsers('roles')}</dt>
              <dd className="font-medium">{me.data.roles.join(' · ')}</dd>
            </div>
          ) : null}
        </dl>
      </Card>

      <Card title={tMobile('workerProfile.appearanceSection')}>
        <p className="mb-3 text-sm text-text-secondary">{tMobile('workerProfile.themeHint')}</p>
        <div className="flex flex-wrap items-center gap-3">
          <AppThemeToggle />
          <LanguageSwitcher />
        </div>
      </Card>

      <Card title={tAuth('changePassword')}>
        {message ? <Alert variant="success">{message}</Alert> : null}
        {error ? <Alert variant="error">{error}</Alert> : null}
        <form
          className="mt-3 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            changePassword.mutate();
          }}
        >
          <Input
            type="password"
            label={tAuth('currentPassword')}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
          />
          <Input
            type="password"
            label={tAuth('newPassword')}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
          />
          <Button type="submit" loading={changePassword.isPending} disabled={!currentPassword || !newPassword}>
            {tAuth('changePassword')}
          </Button>
        </form>
      </Card>
    </div>
  );
}
