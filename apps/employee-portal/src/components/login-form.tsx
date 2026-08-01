'use client';

import { apiFetch } from '@/lib/api-client';
import { redirectAfterLogin } from '@/lib/post-login';
import { Button, Input, Alert } from '@maher/ui';
import type { AuthUser } from '@maher/types';
import { Lock, Mail } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';

export function LoginForm() {
  const t = useTranslations('auth');
  const locale = useLocale();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiFetch<{ user: AuthUser }>('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      redirectAfterLogin(res.user, locale);
    } catch {
      setError(t('loginError'));
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error ? <Alert variant="error">{error}</Alert> : null}
      <Input
        label={t('email')}
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        autoComplete="email"
        placeholder="name@example.com"
        leadingIcon={<Mail className="h-4 w-4" />}
      />
      <Input
        label={t('password')}
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        autoComplete="current-password"
        placeholder="••••••••"
        leadingIcon={<Lock className="h-4 w-4" />}
      />
      <Button type="submit" size="lg" loading={loading} className="w-full">
        {t('login')}
      </Button>
    </form>
  );
}
