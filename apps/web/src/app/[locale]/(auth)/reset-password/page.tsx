'use client';

import { AuthPanelLayout } from '@/components/auth/auth-panel-layout';
import { apiFetch } from '@/lib/api-client';
import { Link, useRouter } from '@/i18n/navigation';
import { Alert, Button, Input } from '@maher/ui';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Suspense, useState, type FormEvent } from 'react';

function ResetPasswordForm() {
  const t = useTranslations('auth');
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await apiFetch('/api/v1/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, newPassword: password }) });
      router.push('/login');
    } catch {
      setError(t('passwordChangeFailed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {!token ? <Alert variant="warning">{t('resetLinkInvalid')}</Alert> : null}
      {error ? <Alert variant="error">{error}</Alert> : null}
      <Input label={t('newPassword')} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={!token} hint={t('passwordHint')} />
      <Button type="submit" size="lg" loading={loading} className="w-full" disabled={!token || password.length < 8}>
        {t('resetPassword')}
      </Button>
      <Link href={token ? '/login' : '/forgot-password'} className="block text-center text-sm font-medium text-[var(--maher-brand)] hover:underline">
        {token ? t('login') : t('forgotPassword')}
      </Link>
    </form>
  );
}

export default function ResetPasswordPage() {
  const t = useTranslations('auth');
  return (
    <AuthPanelLayout title={t('resetPassword')} hint={t('resetPasswordHint')} panelTitle={t('newPassword')}>
      <Suspense fallback={null}>
        <ResetPasswordForm />
      </Suspense>
    </AuthPanelLayout>
  );
}
