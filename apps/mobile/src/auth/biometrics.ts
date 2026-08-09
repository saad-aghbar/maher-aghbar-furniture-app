import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';

export const BIOMETRIC_PREF_KEY = 'maher.biometric_unlock';

export async function isBiometricUnlockEnabled(): Promise<boolean> {
  const v = await SecureStore.getItemAsync(BIOMETRIC_PREF_KEY);
  return v === '1';
}

export async function setBiometricUnlockEnabled(enabled: boolean): Promise<void> {
  if (enabled) {
    await SecureStore.setItemAsync(BIOMETRIC_PREF_KEY, '1');
  } else {
    await SecureStore.deleteItemAsync(BIOMETRIC_PREF_KEY);
  }
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

export async function promptBiometricUnlock(promptMessage: string): Promise<boolean> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel: 'Cancel',
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
