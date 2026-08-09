import { useCallback, useRef, useState } from 'react';
import type { Href } from 'expo-router';
import type { LoginUiError } from '@/auth/mapAuthError';

export type LoginSubmitResult =
  | { ok: true }
  | { ok: false; error: LoginUiError };

type LoginFn = (input: {
  username: string;
  password: string;
}) => Promise<LoginSubmitResult>;

export function mapLoginErrorMessage(
  code: LoginUiError | null,
  t: (k: string) => string,
): string | undefined {
  if (!code) return undefined;
  switch (code) {
    case 'invalid_credentials':
      return t('auth.loginError');
    case 'rate_limited':
      return t('auth.rateLimited');
    case 'network':
      return t('auth.networkError');
    case 'locked':
      return t('auth.accountLocked');
    case 'mfa_invalid':
      return t('auth.mfaInvalid');
    case 'disabled':
      return t('auth.accountDisabled');
    default:
      return t('auth.loginError');
  }
}

export function canSubmitLogin(username: string, password: string): boolean {
  return username.trim().length > 0 && password.length >= 1;
}

/**
 * Pure submit orchestrator — shared by the hook and unit tests.
 */
export async function runLoginSubmit(args: {
  username: string;
  password: string;
  login: LoginFn;
  submitting: { current: boolean };
  showOfflineBanner: boolean;
  onOffline: () => void;
  onSuccess: () => void | Promise<void>;
  onMfa: () => void;
  onDisabled: () => void;
  onFailure: () => void;
}): Promise<'success' | 'mfa' | 'disabled' | 'offline' | 'failure' | 'skipped'> {
  if (args.submitting.current) return 'skipped';
  if (!canSubmitLogin(args.username, args.password)) return 'skipped';
  if (args.showOfflineBanner) {
    args.onOffline();
    return 'offline';
  }
  args.submitting.current = true;
  try {
    const result = await args.login({
      username: args.username.trim(),
      password: args.password,
    });
    if (result.ok) {
      await args.onSuccess();
      return 'success';
    }
    if (result.error === 'mfa_required') {
      args.onMfa();
      return 'mfa';
    }
    if (result.error === 'disabled') {
      args.onDisabled();
      return 'disabled';
    }
    args.onFailure();
    return 'failure';
  } finally {
    args.submitting.current = false;
  }
}

type UseLoginFormArgs = {
  login: LoginFn;
  clearLoginError: () => void;
  lastLoginError: LoginUiError | null;
  authenticating: boolean;
  showOfflineBanner: boolean;
  onOffline: () => void;
  onSuccess: () => void | Promise<void>;
  onMfa: () => void;
  onDisabled: () => void;
};

export function useLoginForm({
  login,
  clearLoginError,
  lastLoginError,
  authenticating,
  showOfflineBanner,
  onOffline,
  onSuccess,
  onMfa,
  onDisabled,
}: UseLoginFormArgs) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [shakeKey, setShakeKey] = useState(0);
  const [buttonState, setButtonState] = useState<'idle' | 'loading' | 'success'>('idle');
  const submittingRef = useRef(false);

  const rateLimited = lastLoginError === 'rate_limited';
  const disabled =
    rateLimited || !canSubmitLogin(username, password) || buttonState === 'success';

  const onSubmit = useCallback(async () => {
    if (authenticating || buttonState === 'success') return;
    clearLoginError();
    setButtonState('loading');
    const outcome = await runLoginSubmit({
      username,
      password,
      login,
      submitting: submittingRef,
      showOfflineBanner,
      onOffline,
      onSuccess: async () => {
        setButtonState('success');
        await onSuccess();
      },
      onMfa,
      onDisabled,
      onFailure: () => {
        setShakeKey((k) => k + 1);
      },
    });
    if (outcome !== 'success') {
      setButtonState('idle');
    }
  }, [
    authenticating,
    buttonState,
    clearLoginError,
    login,
    onDisabled,
    onMfa,
    onOffline,
    onSuccess,
    password,
    showOfflineBanner,
    username,
  ]);

  return {
    username,
    setUsername,
    password,
    setPassword,
    shakeKey,
    buttonState,
    setButtonState,
    rateLimited,
    disabled,
    loading: authenticating || buttonState === 'loading',
    success: buttonState === 'success',
    onSubmit,
    errorCode: lastLoginError,
  };
}

export type LoginNavHref = Href;
