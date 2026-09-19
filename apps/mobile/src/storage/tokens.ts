import * as SecureStore from 'expo-secure-store';
import { invalidateWatchAccessToken, mirrorWatchAccessToken } from '@/watch/sessionSync';

export const ACCESS_TOKEN_KEY = 'maher.access_token';
export const REFRESH_TOKEN_KEY = 'maher.refresh_token';

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
};

export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function setTokens(pair: TokenPair): Promise<void> {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, pair.accessToken);
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, pair.refreshToken);
  void mirrorWatchAccessToken(pair.accessToken);
}

export async function clearTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  void invalidateWatchAccessToken();
}

export async function getTokenPair(): Promise<TokenPair | null> {
  const [accessToken, refreshToken] = await Promise.all([getAccessToken(), getRefreshToken()]);
  if (!accessToken || !refreshToken) return null;
  return { accessToken, refreshToken };
}
