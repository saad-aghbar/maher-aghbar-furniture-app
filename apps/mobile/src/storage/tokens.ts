import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const ACCESS_KEY = 'maher.accessToken';
const REFRESH_KEY = 'maher.refreshToken';

async function setItem(key: string, value: string) {
  if (Platform.OS === 'web') {
    globalThis.localStorage?.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function getItem(key: string) {
  if (Platform.OS === 'web') {
    return globalThis.localStorage?.getItem(key) ?? null;
  }
  return SecureStore.getItemAsync(key);
}

async function deleteItem(key: string) {
  if (Platform.OS === 'web') {
    globalThis.localStorage?.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export const tokenStorage = {
  async saveTokens(accessToken: string, refreshToken: string) {
    await setItem(ACCESS_KEY, accessToken);
    await setItem(REFRESH_KEY, refreshToken);
  },
  async getAccessToken() {
    return getItem(ACCESS_KEY);
  },
  async getRefreshToken() {
    return getItem(REFRESH_KEY);
  },
  async clear() {
    await deleteItem(ACCESS_KEY);
    await deleteItem(REFRESH_KEY);
  },
};
