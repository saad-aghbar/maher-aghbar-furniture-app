import type { AuthUser, Locale } from '@maher/types';
import { clearSession } from '@/auth/session';
import { setTokens, getRefreshToken } from '@/storage/tokens';
import { apiGet, apiPatch, apiPost } from '../client';
import type { MobileAuthResponse } from '../refresh';

export type LoginInput = {
  username: string;
  password: string;
  mfaCode?: string;
};

export type MeResponse = AuthUser & {
  mfaEnabled: boolean;
  mfaPending: boolean;
  /** Dealer portal password (assigned by admin). Omitted for staff. */
  portalPassword?: string | null;
};

export type UpdateMeInput = {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  preferredLanguage?: Locale;
};

export type ChangePasswordInput = {
  currentPassword: string;
  newPassword: string;
};

export type MfaEnableResponse = {
  mfaEnabled: boolean;
  pending: boolean;
  secret: string;
  otpauthUrl: string;
};

export async function login(input: LoginInput): Promise<MobileAuthResponse> {
  const result = await apiPost<MobileAuthResponse>(
    '/auth/mobile/login',
    {
      username: input.username,
      password: input.password,
      mfaCode: input.mfaCode,
    },
    { auth: false, skipRefresh: true },
  );

  await setTokens({
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
  });
  return result;
}

export async function logout(): Promise<void> {
  const refreshToken = await getRefreshToken();
  try {
    if (refreshToken) {
      await apiPost<{ ok: true }>(
        '/auth/mobile/logout',
        { refreshToken },
        { auth: false, skipRefresh: true },
      );
    }
  } catch {
    // Still clear local session
  }
  await clearSession();
}

export async function getMe(): Promise<MeResponse> {
  return apiGet<MeResponse>('/auth/me');
}

export async function updateMe(input: UpdateMeInput): Promise<MeResponse> {
  return apiPatch<MeResponse>('/auth/me', input);
}

export async function changePassword(
  input: ChangePasswordInput,
): Promise<{ ok: true }> {
  return apiPost<{ ok: true }>('/auth/change-password', input);
}

export async function enableMfa(): Promise<MfaEnableResponse> {
  return apiPost<MfaEnableResponse>('/auth/mfa/enable', {});
}

export async function confirmMfa(code: string): Promise<{ mfaEnabled: boolean }> {
  return apiPost<{ mfaEnabled: boolean }>('/auth/mfa/confirm', { code });
}

export async function disableMfa(): Promise<{ mfaEnabled: boolean }> {
  return apiPost<{ mfaEnabled: boolean }>('/auth/mfa/disable', {});
}
