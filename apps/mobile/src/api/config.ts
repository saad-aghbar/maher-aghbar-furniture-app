import Constants from 'expo-constants';
import { Platform } from 'react-native';

const API_PORT = 4000;

/**
 * Resolves the API host for the device running the bundle.
 * Set EXPO_PUBLIC_API_BASE_URL to pin a host; otherwise reuse the Expo dev host.
 */
export function getApiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (fromEnv && fromEnv.length > 0) return fromEnv.replace(/\/$/, '');

  const hostUri = Constants.expoConfig?.hostUri ?? Constants.experienceUrl;
  const host = hostUri?.replace(/^\w+:\/\//, '').split(/[:/]/)[0];

  if (host && host !== 'localhost' && host !== '127.0.0.1') {
    return `http://${host}:${API_PORT}`;
  }

  if (Platform.OS === 'android') return `http://10.0.2.2:${API_PORT}`;

  return `http://localhost:${API_PORT}`;
}

export const API_PREFIX = '/api/v1';
