import Constants from 'expo-constants';
import { Platform } from 'react-native';

const API_PORT = 4000;
const DEFAULT_API_BASE_URL = `http://localhost:${API_PORT}`;

function isEasCloudBuild(): boolean {
  return process.env.EAS_BUILD === 'true';
}

function easProfile(): string {
  return (
    process.env.EAS_BUILD_PROFILE ??
    (Constants.expoConfig?.extra as { easBuildProfile?: string } | undefined)?.easBuildProfile ??
    'development'
  );
}

function isLoopbackUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return hostname === 'localhost' || hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

/** Expo Metro host on the LAN (physical device / Expo Go). */
function expoDevHost(): string | undefined {
  const hostUri = Constants.expoConfig?.hostUri ?? Constants.linkingUri;
  const host = hostUri?.replace(/^\w+:\/\//, '').split(/[:/]/)[0];
  if (host && host !== 'localhost' && host !== '127.0.0.1') return host;
  return undefined;
}

/**
 * Public API origin only (`EXPO_PUBLIC_API_BASE_URL`).
 * Never put secrets in EXPO_PUBLIC_* variables.
 *
 * Preview/production EAS builds must set an https:// URL — no silent localhost fallback.
 * When unset in local/dev, reuses the Expo dev-server host (LAN / emulator-friendly).
 * Loopback URLs are ignored on physical devices so Expo Go can reach the Mac API.
 */
export function getApiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  const fromExtra = (
    Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined
  )?.apiBaseUrl?.trim();
  const configured = (fromEnv || fromExtra || '').replace(/\/$/, '');

  const profile = easProfile();
  if (isEasCloudBuild() && (profile === 'preview' || profile === 'production')) {
    if (!configured || !/^https:\/\//i.test(configured)) {
      throw new Error(
        `Missing HTTPS EXPO_PUBLIC_API_BASE_URL for EAS ${profile} build (got: ${configured || 'empty'}).`,
      );
    }
    return configured;
  }

  const lanHost = expoDevHost();

  // Explicit non-loopback wins (LAN IP, staging, etc.).
  if (configured && !isLoopbackUrl(configured)) return configured;

  // Physical device / Expo Go: Metro is on the LAN — API is too.
  if (lanHost) return `http://${lanHost}:${API_PORT}`;

  // Simulator / no Expo host: honor localhost from env, or platform defaults.
  if (configured) return configured;

  if (Platform.OS === 'android') {
    return `http://10.0.2.2:${API_PORT}`;
  }

  return DEFAULT_API_BASE_URL;
}

/** Nest global prefix — used by the API client. */
export function getApiV1Url(): string {
  return `${getApiBaseUrl()}/api/v1`;
}
