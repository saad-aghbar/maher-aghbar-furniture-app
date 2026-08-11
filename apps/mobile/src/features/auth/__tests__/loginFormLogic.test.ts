import {
  canSubmitLogin,
  mapLoginErrorMessage,
  runLoginSubmit,
} from '@/features/auth/hooks/useLoginForm';

describe('canSubmitLogin', () => {
  it('requires username and a non-empty password (no email field)', () => {
    expect(canSubmitLogin('', 'password1')).toBe(false);
    expect(canSubmitLogin('admin', '')).toBe(false);
    expect(canSubmitLogin('admin', '1')).toBe(true);
    expect(canSubmitLogin('admin', '123')).toBe(true);
    expect(canSubmitLogin('  admin  ', 'password')).toBe(true);
    // Shared login is username-based — email-shaped strings are allowed as usernames
    // but the form never requires or labels an email field.
    expect(canSubmitLogin('dealer.showroom', 'secret')).toBe(true);
  });
});

describe('mapLoginErrorMessage', () => {
  const t = (k: string) => k;
  it('maps known codes', () => {
    expect(mapLoginErrorMessage('invalid_credentials', t)).toBe('auth.loginError');
    expect(mapLoginErrorMessage('rate_limited', t)).toBe('auth.rateLimited');
    expect(mapLoginErrorMessage('network', t)).toBe('auth.networkError');
    expect(mapLoginErrorMessage(null, t)).toBeUndefined();
  });
});

describe('runLoginSubmit', () => {
  it('prevents duplicate submit', async () => {
    let resolveLogin!: (v: { ok: true }) => void;
    const login = jest.fn(
      () =>
        new Promise<{ ok: true }>((r) => {
          resolveLogin = r;
        }),
    );
    const submitting = { current: false };
    const onSuccess = jest.fn();
    const p1 = runLoginSubmit({
      username: 'admin',
      password: 'password',
      login,
      submitting,
      showOfflineBanner: false,
      onOffline: jest.fn(),
      onSuccess,
      onMfa: jest.fn(),
      onDisabled: jest.fn(),
      onFailure: jest.fn(),
    });
    const p2 = runLoginSubmit({
      username: 'admin',
      password: 'password',
      login,
      submitting,
      showOfflineBanner: false,
      onOffline: jest.fn(),
      onSuccess,
      onMfa: jest.fn(),
      onDisabled: jest.fn(),
      onFailure: jest.fn(),
    });
    expect(login).toHaveBeenCalledTimes(1);
    expect(await p2).toBe('skipped');
    resolveLogin({ ok: true });
    expect(await p1).toBe('success');
    expect(onSuccess).toHaveBeenCalled();
  });

  it('routes MFA, disabled, failure, offline', async () => {
    const onMfa = jest.fn();
    const onDisabled = jest.fn();
    const onFailure = jest.fn();
    const onOffline = jest.fn();

    expect(
      await runLoginSubmit({
        username: 'a',
        password: 'password',
        login: async () => ({ ok: false, error: 'mfa_required' }),
        submitting: { current: false },
        showOfflineBanner: false,
        onOffline,
        onSuccess: jest.fn(),
        onMfa,
        onDisabled,
        onFailure,
      }),
    ).toBe('mfa');

    expect(
      await runLoginSubmit({
        username: 'a',
        password: 'password',
        login: async () => ({ ok: false, error: 'disabled' }),
        submitting: { current: false },
        showOfflineBanner: false,
        onOffline,
        onSuccess: jest.fn(),
        onMfa,
        onDisabled,
        onFailure,
      }),
    ).toBe('disabled');

    expect(
      await runLoginSubmit({
        username: 'a',
        password: 'password',
        login: async () => ({ ok: false, error: 'invalid_credentials' }),
        submitting: { current: false },
        showOfflineBanner: false,
        onOffline,
        onSuccess: jest.fn(),
        onMfa,
        onDisabled,
        onFailure,
      }),
    ).toBe('failure');
    expect(onFailure).toHaveBeenCalled();

    expect(
      await runLoginSubmit({
        username: 'a',
        password: 'password',
        login: jest.fn(),
        submitting: { current: false },
        showOfflineBanner: true,
        onOffline,
        onSuccess: jest.fn(),
        onMfa,
        onDisabled,
        onFailure,
      }),
    ).toBe('offline');
  });
});
