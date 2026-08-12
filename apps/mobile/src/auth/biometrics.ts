import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

export const BIOMETRIC_PREF_KEY = 'maher.biometric_unlock';
export const BIOMETRIC_CREDS_KEY = 'maher.biometric_creds';

export type BiometricKind = 'face' | 'touchId' | 'fingerprint' | 'generic';

export type BiometricCredentials = {
  username: string;
  password: string;
};

export async function isBiometricUnlockEnabled(): Promise<boolean> {
  const v = await SecureStore.getItemAsync(BIOMETRIC_PREF_KEY);
  return v === '1';
}

export async function setBiometricUnlockEnabled(enabled: boolean): Promise<void> {
  if (enabled) {
    await SecureStore.setItemAsync(BIOMETRIC_PREF_KEY, '1');
    return;
  }
  await SecureStore.deleteItemAsync(BIOMETRIC_PREF_KEY);
  await clearBiometricCredentials();
}

export async function canUseBiometrics(): Promise<boolean> {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    return hasHardware && enrolled;
  } catch {
    return false;
  }
}

export async function getBiometricKind(): Promise<BiometricKind> {
  try {
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      return 'face';
    }
    if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      return Platform.OS === 'ios' ? 'touchId' : 'fingerprint';
    }
  } catch {
    /* fall through */
  }
  return 'generic';
}

/** Icon + copy for the login biometric button, based on this device’s sensor. */
export function biometricLoginPresentation(kind: BiometricKind): {
  icon: 'scan-outline' | 'finger-print-outline' | 'shield-checkmark-outline';
  labelKey:
    | 'auth.loginWithFaceId'
    | 'auth.loginWithTouchId'
    | 'auth.loginWithFingerprint'
    | 'auth.loginWithBiometrics';
  fallback: string;
} {
  if (kind === 'face') {
    return { icon: 'scan-outline', labelKey: 'auth.loginWithFaceId', fallback: 'Face ID' };
  }
  if (kind === 'touchId') {
    return {
      icon: 'finger-print-outline',
      labelKey: 'auth.loginWithTouchId',
      fallback: 'Touch ID',
    };
  }
  if (kind === 'fingerprint') {
    return {
      icon: 'finger-print-outline',
      labelKey: 'auth.loginWithFingerprint',
      fallback: 'Fingerprint',
    };
  }
  return {
    icon: 'shield-checkmark-outline',
    labelKey: 'auth.loginWithBiometrics',
    fallback: 'Biometrics',
  };
}

export function parseBiometricCredentials(
  raw: string | null,
): BiometricCredentials | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { username?: unknown; password?: unknown };
    if (
      typeof parsed.username === 'string' &&
      typeof parsed.password === 'string' &&
      parsed.username.trim().length > 0 &&
      parsed.password.length > 0
    ) {
      return { username: parsed.username.trim(), password: parsed.password };
    }
  } catch {
    return null;
  }
  return null;
}

export async function saveBiometricCredentials(
  username: string,
  password: string,
): Promise<void> {
  const creds = parseBiometricCredentials(
    JSON.stringify({ username: username.trim(), password }),
  );
  if (!creds) return;
  await SecureStore.setItemAsync(BIOMETRIC_CREDS_KEY, JSON.stringify(creds));
}

export async function getBiometricCredentials(): Promise<BiometricCredentials | null> {
  try {
    const raw = await SecureStore.getItemAsync(BIOMETRIC_CREDS_KEY);
    return parseBiometricCredentials(raw);
  } catch {
    return null;
  }
}

export async function clearBiometricCredentials(): Promise<void> {
  await SecureStore.deleteItemAsync(BIOMETRIC_CREDS_KEY);
}

export async function promptBiometricUnlock(
  promptMessage: string,
  cancelLabel = 'Cancel',
): Promise<boolean> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel,
      disableDeviceFallback: false,
    });
    return result.success;
  } catch {
    return false;
  }
}

/** Whether bootstrap should gate on biometrics before entering the app. */
export async function shouldRequireBiometricGate(): Promise<boolean> {
  const [enabled, available] = await Promise.all([
    isBiometricUnlockEnabled(),
    canUseBiometrics(),
  ]);
  return enabled && available;
}

/** Login-screen Face ID / fingerprint control — needs a saved account. */
export async function canShowBiometricLogin(): Promise<boolean> {
  const [enabled, available, creds] = await Promise.all([
    isBiometricUnlockEnabled(),
    canUseBiometrics(),
    getBiometricCredentials(),
  ]);
  return enabled && available && creds != null;
}
