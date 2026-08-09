import Constants from 'expo-constants';
import { getApiBaseUrl, getApiV1Url } from '../config';

jest.mock('expo-constants', () => ({
  expoConfig: {
    hostUri: undefined as string | undefined,
    extra: {} as Record<string, unknown>,
  },
  linkingUri: undefined as string | undefined,
}));

const constants = Constants as unknown as {
  expoConfig: { hostUri?: string; extra: Record<string, unknown> };
  linkingUri?: string;
};

describe('api config', () => {
  const originalUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  const originalEas = process.env.EAS_BUILD;
  const originalProfile = process.env.EAS_BUILD_PROFILE;

  afterEach(() => {
    if (originalUrl === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
    else process.env.EXPO_PUBLIC_API_BASE_URL = originalUrl;
    if (originalEas === undefined) delete process.env.EAS_BUILD;
    else process.env.EAS_BUILD = originalEas;
    if (originalProfile === undefined) delete process.env.EAS_BUILD_PROFILE;
    else process.env.EAS_BUILD_PROFILE = originalProfile;
    constants.expoConfig.hostUri = undefined;
    constants.expoConfig.extra = {};
    constants.linkingUri = undefined;
  });

  it('uses EXPO_PUBLIC_API_BASE_URL when set and strips trailing slash', () => {
    process.env.EXPO_PUBLIC_API_BASE_URL = 'http://192.168.1.10:4000/';
    expect(getApiBaseUrl()).toBe('http://192.168.1.10:4000');
    expect(getApiV1Url()).toBe('http://192.168.1.10:4000/api/v1');
  });

  it('overrides loopback with Expo LAN host on physical devices', () => {
    process.env.EXPO_PUBLIC_API_BASE_URL = 'http://localhost:4000';
    constants.expoConfig.hostUri = '172.20.10.2:8082';
    expect(getApiBaseUrl()).toBe('http://172.20.10.2:4000');
  });

  it('keeps loopback when Expo host is also loopback (simulator)', () => {
    process.env.EXPO_PUBLIC_API_BASE_URL = 'http://localhost:4000';
    constants.expoConfig.hostUri = 'localhost:8081';
    expect(getApiBaseUrl()).toBe('http://localhost:4000');
  });

  it('requires https URL on EAS preview builds', () => {
    process.env.EAS_BUILD = 'true';
    process.env.EAS_BUILD_PROFILE = 'preview';
    process.env.EXPO_PUBLIC_API_BASE_URL = 'http://localhost:4000';
    expect(() => getApiBaseUrl()).toThrow(/HTTPS/);
  });

  it('accepts https URL on EAS production builds', () => {
    process.env.EAS_BUILD = 'true';
    process.env.EAS_BUILD_PROFILE = 'production';
    process.env.EXPO_PUBLIC_API_BASE_URL = 'https://api.example.com/';
    expect(getApiBaseUrl()).toBe('https://api.example.com');
  });
});
