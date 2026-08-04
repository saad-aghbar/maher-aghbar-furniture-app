import type { AuthUser } from '@maher/types';
import { apiFetch } from './client';
import { tokenStorage } from '../storage/tokens';

export type MobileAuthResponse = {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
};

export async function loginWithPassword(input: {
  username: string;
  password: string;
}): Promise<AuthUser> {
  const data = await apiFetch<MobileAuthResponse>('/auth/login', {
    auth: false,
    body: { ...input, client: 'mobile' },
  });
  await tokenStorage.saveTokens(data.accessToken, data.refreshToken);
  return data.user;
}

export async function fetchMe(): Promise<AuthUser> {
  return apiFetch<AuthUser>('/auth/me');
}

export async function logout(): Promise<void> {
  const refreshToken = await tokenStorage.getRefreshToken();
  try {
    await apiFetch('/auth/logout', {
      method: 'POST',
      body: { refreshToken },
    });
  } catch {
    // still clear local tokens
  }
  await tokenStorage.clear();
}

export async function restoreSession(): Promise<AuthUser | null> {
  const access = await tokenStorage.getAccessToken();
  if (!access) return null;
  try {
    return await fetchMe();
  } catch {
    await tokenStorage.clear();
    return null;
  }
}
