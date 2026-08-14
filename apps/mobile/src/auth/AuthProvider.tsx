import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { AuthUser } from '@maher/types';
import { login as apiLogin, logout as apiLogout, getMe, type LoginInput, type MeResponse } from '@/api/modules/auth';
import { isApiError } from '@/api/errors';
import { queryKeys } from '@/api/queryKeys';
import { onSessionExpired, clearSession } from '@/auth/session';
import { mapLoginError, type AuthStatus, type LoginUiError } from '@/auth/mapAuthError';
import { restoreSession } from '@/auth/sessionRestore';
import { resetQueryClientOnLogout } from '@/auth/resetQueryClientOnLogout';
import {
  clearBiometricCredentials,
  isBiometricUnlockEnabled,
  saveBiometricCredentials,
  shouldRequireBiometricGate,
} from '@/auth/biometrics';
import { registerPushDevice } from '@/features/notifications/registerPushDevice';

type AuthContextValue = {
  status: AuthStatus;
  user: MeResponse | null;
  lastLoginError: LoginUiError | null;
  pendingMfa: { username: string; password: string } | null;
  bootstrap: () => Promise<void>;
  login: (input: LoginInput) => Promise<{ ok: true } | { ok: false; error: LoginUiError }>;
  completeBiometric: () => void;
  failBiometricToPassword: () => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<MeResponse | null>;
  applyUser: (next: MeResponse) => void;
  clearLoginError: () => void;
  setStatus: (status: AuthStatus) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AuthStatus>('bootstrapping');
  const [user, setUser] = useState<MeResponse | null>(null);
  const [lastLoginError, setLastLoginError] = useState<LoginUiError | null>(null);
  const [pendingMfa, setPendingMfa] = useState<{ username: string; password: string } | null>(
    null,
  );

  const applyUser = useCallback(
    (next: MeResponse) => {
      setUser(next);
      queryClient.setQueryData(queryKeys.auth.me(), next);
    },
    [queryClient],
  );

  const bootstrap = useCallback(async () => {
    setStatus('bootstrapping');
    const result = await restoreSession();
    if (result.status === 'authenticated' && result.user) {
      applyUser(result.user);
      const needBio = await shouldRequireBiometricGate();
      setStatus(needBio ? 'needs_biometric' : 'authenticated');
      if (!needBio) void registerPushDevice(result.user);
      return;
    }
    setUser(null);
    setStatus(result.status);
  }, [applyUser]);

  useEffect(() => {
    void bootstrap();
    return onSessionExpired(() => {
      setUser(null);
      void resetQueryClientOnLogout(queryClient);
      setStatus('session_expired');
    });
  }, [bootstrap, queryClient]);

  const login = useCallback(
    async (input: LoginInput) => {
      setStatus('authenticating');
      setLastLoginError(null);
      try {
        const result = await apiLogin(input);
        const me = result.user
          ? ({ ...result.user, mfaEnabled: false, mfaPending: false } as MeResponse)
          : await getMe();
        // Prefer fresh /me for permissions
        let profile: MeResponse;
        try {
          profile = await getMe();
        } catch {
          profile = me;
        }
        applyUser(profile);
        setPendingMfa(null);
        setStatus('authenticated');
        void saveBiometricCredentials(input.username, input.password);
        void registerPushDevice(profile);
        return { ok: true as const };
      } catch (error) {
        const mapped = mapLoginError(error);
        setLastLoginError(mapped);
        if (mapped === 'mfa_required') {
          setPendingMfa({ username: input.username, password: input.password });
          setStatus('unauthenticated');
          return { ok: false as const, error: mapped };
        }
        if (mapped === 'disabled') {
          setStatus('disabled');
          return { ok: false as const, error: mapped };
        }
        setStatus('unauthenticated');
        return { ok: false as const, error: mapped };
      }
    },
    [applyUser],
  );

  const completeBiometric = useCallback(() => {
    setStatus('authenticated');
    void registerPushDevice(user);
  }, [user]);

  const failBiometricToPassword = useCallback(async () => {
    await clearSession();
    setUser(null);
    await resetQueryClientOnLogout(queryClient);
    setStatus('unauthenticated');
  }, [queryClient]);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } catch {
      await clearSession();
    }
    setUser(null);
    await resetQueryClientOnLogout(queryClient);
    setStatus('unauthenticated');
    const bioOn = await isBiometricUnlockEnabled();
    if (!bioOn) await clearBiometricCredentials();
    const { requestShortBrandIntro } = await import('@/theme/brandIntroMotion');
    requestShortBrandIntro();
  }, [queryClient]);

  const refreshUser = useCallback(async () => {
    try {
      const profile = await getMe();
      applyUser(profile);
      return profile;
    } catch {
      return null;
    }
  }, [applyUser]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      lastLoginError,
      pendingMfa,
      bootstrap,
      login,
      completeBiometric,
      failBiometricToPassword,
      logout,
      refreshUser,
      applyUser,
      clearLoginError: () => setLastLoginError(null),
      setStatus,
    }),
    [
      status,
      user,
      lastLoginError,
      pendingMfa,
      bootstrap,
      login,
      completeBiometric,
      failBiometricToPassword,
      logout,
      refreshUser,
      applyUser,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function useAuthUser(): AuthUser | null {
  return useAuth().user;
}

export function isAuthenticatedStatus(status: AuthStatus): boolean {
  return status === 'authenticated';
}

export { isApiError };
