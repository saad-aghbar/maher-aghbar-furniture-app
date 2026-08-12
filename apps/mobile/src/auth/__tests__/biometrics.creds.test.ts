import { parseBiometricCredentials, biometricLoginPresentation } from '../biometrics';

describe('parseBiometricCredentials', () => {
  it('reads a stored username and password', () => {
    expect(
      parseBiometricCredentials(JSON.stringify({ username: 'admin', password: 'secret' })),
    ).toEqual({ username: 'admin', password: 'secret' });
  });

  it('trims username and rejects empty values', () => {
    expect(
      parseBiometricCredentials(JSON.stringify({ username: '  dealer  ', password: 'x' })),
    ).toEqual({ username: 'dealer', password: 'x' });
    expect(parseBiometricCredentials(JSON.stringify({ username: '', password: 'x' }))).toBeNull();
    expect(parseBiometricCredentials(JSON.stringify({ username: 'a', password: '' }))).toBeNull();
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

describe('parseBiometricCredentials', () => {
  it('reads a stored username and password', () => {
    expect(
      parseBiometricCredentials(JSON.stringify({ username: 'admin', password: 'secret' })),
    ).toEqual({ username: 'admin', password: 'secret' });
  });

  it('trims username and rejects empty values', () => {
    expect(
      parseBiometricCredentials(JSON.stringify({ username: '  dealer  ', password: 'x' })),
    ).toEqual({ username: 'dealer', password: 'x' });
    expect(parseBiometricCredentials(JSON.stringify({ username: '', password: 'x' }))).toBeNull();
    expect(parseBiometricCredentials(JSON.stringify({ username: 'a', password: '' }))).toBeNull();
    expect(parseBiometricCredentials(null)).toBeNull();
    expect(parseBiometricCredentials('not-json')).toBeNull();
  });
});
