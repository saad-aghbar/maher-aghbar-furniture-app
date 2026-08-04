import type { AuthUser } from '@maher/types';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import * as authApi from '../api/auth';

type AuthContextValue = {
  user: AuthUser | null;
  bootstrapping: boolean;
  login: (input: { username: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [bootstrapping, setBootstrapping] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const restored = await authApi.restoreSession();
      if (!cancelled) {
        setUser(restored);
        setBootstrapping(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (input: { username: string; password: string }) => {
    const next = await authApi.loginWithPassword(input);
    setUser(next);
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, bootstrapping, login, logout }),
    [user, bootstrapping, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
