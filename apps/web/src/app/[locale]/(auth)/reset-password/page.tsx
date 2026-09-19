'use client';

import { apiFetch } from '@/lib/api-client';
import { Link, useRouter } from '@/i18n/navigation';
import { Alert, Button, Input } from '@maher/ui';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';

export default function ResetPasswordPage() {
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
      await apiFetch('/api/v1/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, newPassword: password }),
      });
      router.push('/login');
    } catch {
      setError(t('passwordChangeFailed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md items-center px-6">
      <form onSubmit={onSubmit} className="w-full space-y-4 rounded-[var(--maher-radius-xl)] border border-border bg-surface p-8">
        <h1 className="text-2xl font-semibold">{t('resetPassword')}</h1>
        {error ? <Alert variant="error">{error}</Alert> : null}
        <Input
          label={t('newPassword')}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <Button type="submit" loading={loading} className="w-full" disabled={!token}>
          {t('resetPassword')}
        </Button>
        <Link href="/login" className="block text-sm text-brand">
          {t('login')}
        </Link>
      </form>
    </div>
  );
}
