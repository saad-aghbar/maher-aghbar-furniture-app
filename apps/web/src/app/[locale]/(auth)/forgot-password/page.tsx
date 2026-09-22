'use client';

import { AuthPanelLayout } from '@/components/auth/auth-panel-layout';
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
      await apiFetch('/api/v1/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email: email.trim() }) });
      setSent(true);
    } catch {
      setError(t('loginError'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthPanelLayout title={t('forgotPassword')} hint={t('forgotPasswordHint')} panelTitle={t('resetPassword')} stamp={sent ? { label: t('resetLinkSent'), tone: 'success' } : undefined}>
      <form onSubmit={onSubmit} className="space-y-4">
        {error ? <Alert variant="error">{error}</Alert> : null}
        {sent ? <Alert variant="success">{t('resetLinkSent')}</Alert> : null}
        <Input label={t('email')} type="email" inputMode="email" autoComplete="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={sent} />
        <Button type="submit" size="lg" loading={loading} className="w-full" disabled={sent}>
          {t('resetPassword')}
        </Button>
        <Link href="/login" className="block text-center text-sm font-medium text-[var(--maher-brand)] hover:underline">
          {t('login')}
        </Link>
      </form>
    </AuthPanelLayout>
  );
}
