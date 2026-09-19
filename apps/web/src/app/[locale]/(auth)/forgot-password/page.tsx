'use client';

import { apiFetch } from '@/lib/api-client';
import { Link } from '@/i18n/navigation';
import { Alert, Button, Input } from '@maher/ui';
import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';

export default function ForgotPasswordPage() {
  const t = useTranslations('auth');
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await apiFetch('/api/v1/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim() }),
      });
      setSent(true);
    } catch {
      setError(t('loginError'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md items-center px-6">
      <form onSubmit={onSubmit} className="w-full space-y-4 rounded-[var(--maher-radius-xl)] border border-border bg-surface p-8">
        <h1 className="text-2xl font-semibold">{t('forgotPassword')}</h1>
        {error ? <Alert variant="error">{error}</Alert> : null}
        {sent ? <Alert variant="success">{t('forgotPassword')}</Alert> : null}
        <Input label={t('email')} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Button type="submit" loading={loading} className="w-full">
          {t('resetPassword')}
        </Button>
        <Link href="/login" className="block text-sm text-brand">
          {t('login')}
        </Link>
      </form>
    </div>
  );
}
