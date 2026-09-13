import { parseBiometricCredentials, biometricLoginPresentation } from '../biometrics';

describe('parseBiometricCredentials', () => {
  it('reads a stored username and strips a leftover password blob', () => {
    expect(
      parseBiometricCredentials(JSON.stringify({ username: 'admin', password: 'secret' })),
    ).toEqual({ username: 'admin' });
  });

  it('trims username and rejects empty values', () => {
    expect(
      parseBiometricCredentials(JSON.stringify({ username: '  dealer  ' })),
    ).toEqual({ username: 'dealer' });
    expect(parseBiometricCredentials(JSON.stringify({ username: '' }))).toBeNull();
    expect(parseBiometricCredentials(JSON.stringify({ username: '  ' }))).toBeNull();
    expect(parseBiometricCredentials(null)).toBeNull();
    expect(parseBiometricCredentials('not-json')).toBeNull();
  });
});

describe('biometricLoginPresentation', () => {
  it('uses Face ID copy for facial recognition', () => {
    expect(biometricLoginPresentation('face').fallback).toBe('Face ID');
    expect(biometricLoginPresentation('face').labelKey).toBe('auth.loginWithFaceId');
  });

  it('uses Touch ID on iOS fingerprint hardware and Fingerprint elsewhere', () => {
    expect(biometricLoginPresentation('touchId').fallback).toBe('Touch ID');
    expect(biometricLoginPresentation('fingerprint').fallback).toBe('Fingerprint');
  });
});
