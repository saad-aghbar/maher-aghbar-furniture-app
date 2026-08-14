import Constants from 'expo-constants';
import { NativeModules, Platform } from 'react-native';

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

function isLoopbackHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

function isLoopbackUrl(url: string): boolean {
  try {
    return isLoopbackHost(new URL(url).hostname);
  } catch {
    return false;
  }
}

/** Parse Metro / Expo Go host from hostUri, debuggerHost, linkingUri, or scriptURL. */
export function hostnameFromDevUri(uri: string | null | undefined): string | undefined {
  if (!uri) return undefined;
  const trimmed = uri.trim();
  if (!trimmed) return undefined;

  const withProto = /^\w+:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  try {
    const hostname = new URL(withProto).hostname;
    if (hostname) return hostname;
  } catch {
    // fall through
  }

  const stripped = trimmed.replace(/^\w+:\/\//i, '').split('/')[0] ?? '';
  const host = stripped.startsWith('[')
    ? stripped.slice(0, (stripped.indexOf(']') + 1) || undefined)
    : stripped.split(':')[0];
  return host || undefined;
}

function scriptUrlHost(): string | undefined {
  try {
    const scriptURL = NativeModules.SourceCode?.scriptURL as string | undefined;
    return hostnameFromDevUri(scriptURL);
  } catch {
    return undefined;
  }
}

type ExpoHostConstants = {
  expoGoConfig?: { debuggerHost?: string };
  manifest?: { debuggerHost?: string } | null;
};

/** Expo Metro host on the LAN (physical device / Expo Go). */
function expoDevHost(): string | undefined {
  const extra = Constants as unknown as ExpoHostConstants;
  const candidates = [
    Constants.expoConfig?.hostUri,
    extra.expoGoConfig?.debuggerHost,
    extra.manifest?.debuggerHost,
    Constants.linkingUri,
    scriptUrlHost(),
  ];
  for (const candidate of candidates) {
    const host = typeof candidate === 'string' ? hostnameFromDevUri(candidate) : candidate;
    if (host && !isLoopbackHost(host)) return host;
  }
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
