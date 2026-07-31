'use client';

import { useRouter } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api-client';
import { Button, Input, Alert } from '@maher/ui';
import type { AuthUser } from '@maher/types';
import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';

export function LoginForm() {
  const t = useTranslations('auth');
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await apiFetch<{ user: AuthUser }>('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      router.push('/dashboard');
      router.refresh();
    } catch {
      setError(t('loginError'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto w-full max-w-md space-y-4">
      {error ? <Alert variant="error">{error}</Alert> : null}
      <Input
        label={t('email')}
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        autoComplete="email"
      />
      <Input
        label={t('password')}
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        autoComplete="current-password"
      />
      <Button type="submit" loading={loading} className="w-full">
        {t('login')}
      </Button>
    </form>
  );
}
