'use client';

import { apiFetch, ApiClientError } from '@/lib/api-client';
import { redirectAfterLogin } from '@/lib/post-login';
import { Button, Input, Alert } from '@maher/ui';
import type { AuthUser } from '@maher/types';
import { Eye, EyeOff, Lock, Shield, User } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';

export function LoginForm() {
  const t = useTranslations('auth');
  const locale = useLocale();
  const search = useSearchParams();
  const nextPath = search.get('next');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaRequired, setMfaRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiFetch<{ user: AuthUser }>('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          username: username.trim(),
          password,
          ...(mfaRequired || mfaCode ? { mfaCode: mfaCode.trim() } : {}),
        }),
      });
      await new Promise((resolve) => window.setTimeout(resolve, 400));
      redirectAfterLogin(res.user, locale, nextPath);
    } catch (err) {
      if (err instanceof ApiClientError && err.body?.code === 'MFA_REQUIRED') {
        setMfaRequired(true);
        setError(t('mfaRequired'));
      } else if (err instanceof ApiClientError && err.body?.code === 'MFA_INVALID') {
        setMfaRequired(true);
        setError(t('mfaInvalid'));
      } else {
        setError(t('loginError'));
      }
      setShakeKey((key) => key + 1);
      setLoading(false);
    }
  }

  return (
    <form
      key={shakeKey}
      onSubmit={onSubmit}
      className={`maher-stagger space-y-5 ${shakeKey > 0 ? 'maher-animate-shake' : ''}`}
    >
      {error ? <Alert variant="error">{error}</Alert> : null}
      <Input
        id="username"
        label={t('username')}
        type="text"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        required
        autoComplete="username"
        placeholder="admin"
        leadingIcon={<User className="h-4 w-4" />}
        className="h-12 text-base"
      />
      <Input
        id="password"
        label={t('password')}
        type={showPassword ? 'text' : 'password'}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        autoComplete="current-password"
        placeholder="••••••••"
        leadingIcon={<Lock className="h-4 w-4" />}
        trailingIcon={
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? t('hidePassword') : t('showPassword')}
            className="flex h-8 w-8 items-center justify-center rounded-[var(--maher-radius-sm)] text-[var(--maher-text-tertiary)] hover:bg-[var(--maher-surface-muted)] hover:text-[var(--maher-text-primary)]"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        }
        className="h-12 text-base"
      />
      {mfaRequired ? (
        <Input
          label={t('mfaCode')}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={mfaCode}
          onChange={(e) => setMfaCode(e.target.value)}
          required
          placeholder="123456"
          leadingIcon={<Shield className="h-4 w-4" />}
        />
      ) : null}
      <Button type="submit" size="lg" loading={loading} className="w-full">
        {loading ? t('signingIn') : t('login')}
      </Button>
    </form>
  );
}
