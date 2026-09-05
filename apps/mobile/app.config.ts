import type { ConfigContext, ExpoConfig } from 'expo/config';

const APP_VERSION = '0.1.0';
const BUNDLE_ID = 'jo.maheraghbar.furniture';
const SPLASH_BG = '#E1DFD3';
/** Saad Aghbar Personal Team on this Mac. Paid / EAS teams override via APPLE_TEAM_ID. */
const PERSONAL_TEAM_ID = 'NR2ZFUP7R7';
/** @saad-aghbar/maher-aghbar-furniture — set via `eas init` (2026-08-05). Override with EAS_PROJECT_ID. */
const DEFAULT_EAS_PROJECT_ID = 'bd5ccf7c-9b99-4bc5-a0bc-2a52d781c023';

/**
 * Dynamic Expo config for development / preview / production EAS profiles.
 * Prefer this over static app.json so env + permissions stay profile-aware.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim().replace(/\/$/, '') ?? '';
  const easProjectId = process.env.EAS_PROJECT_ID?.trim() || DEFAULT_EAS_PROJECT_ID;
  const associatedDomain = process.env.EXPO_ASSOCIATED_DOMAIN?.trim();
  const isEasBuild = process.env.EAS_BUILD === 'true';
  const profile = process.env.EAS_BUILD_PROFILE ?? 'development';
  const appleTeamId = process.env.APPLE_TEAM_ID?.trim() || PERSONAL_TEAM_ID;
  /**
   * Free Personal Teams cannot create an iOS App Development profile that includes
   * Push Notifications. Keep APNs on EAS / paid teams. In-app inbox still uses the API.
   */
  const stripIosPush = !isEasBuild && appleTeamId === PERSONAL_TEAM_ID;

  if (isEasBuild && (profile === 'preview' || profile === 'production')) {
    if (!apiBaseUrl || !/^https:\/\//i.test(apiBaseUrl)) {
      throw new Error(
        `EAS ${profile} builds require EXPO_PUBLIC_API_BASE_URL to be an https:// URL (got: ${apiBaseUrl || 'empty'}).`,
      );
    }
  }

  return {
    ...config,
    name: 'Maher Al-Aghbar Furniture',
    slug: 'maher-aghbar-furniture',
    version: APP_VERSION,
    orientation: 'portrait',
    icon: './assets/icon.png',
    scheme: 'maher',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    platforms: ['ios', 'android'],
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: SPLASH_BG,
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: BUNDLE_ID,
      appleTeamId,
      infoPlist: {
        NSCameraUsageDescription:
          'Allow Maher Al-Aghbar Furniture to use the camera for QR/barcode scanning, order photos, and returns.',
        NSPhotoLibraryUsageDescription:
          'Allow Maher Al-Aghbar Furniture to access your photos for order attachments and returns.',
        NSLocationWhenInUseUsageDescription:
          'Allow Maher Al-Aghbar Furniture to use your location for delivery pins on new orders.',
        NSFaceIDUsageDescription:
          'Allow Maher Al-Aghbar Furniture to unlock the app with Face ID.',
        NSLocalNetworkUsageDescription:
          'Allow Maher Al-Aghbar Furniture to reach the factory API on your local network.',
        NSAppTransportSecurity: {
          NSAllowsLocalNetworking: true,
        },
        ...(stripIosPush ? {} : { UIBackgroundModes: ['remote-notification'] }),
      },
      ...(associatedDomain
        ? { associatedDomains: [`applinks:${associatedDomain}`] }
        : {}),
    },
    android: {
      package: BUNDLE_ID,
      adaptiveIcon: {
        foregroundImage: './assets/android-icon-foreground.png',
        backgroundImage: './assets/android-icon-background.png',
        monochromeImage: './assets/android-icon-monochrome.png',
        backgroundColor: SPLASH_BG,
      },
      edgeToEdgeEnabled: true,
      permissions: [
        'CAMERA',
        'READ_MEDIA_IMAGES',
        'READ_EXTERNAL_STORAGE',
        'POST_NOTIFICATIONS',
        'ACCESS_COARSE_LOCATION',
        'ACCESS_FINE_LOCATION',
      ],
      ...(associatedDomain
        ? {
            intentFilters: [
              {
                action: 'VIEW',
                autoVerify: true,
                data: [
                  {
                    scheme: 'https',
                    host: associatedDomain,
                    pathPrefix: '/',
                  },
                ],
                category: ['BROWSABLE', 'DEFAULT'],
              },
            ],
          }
        : {}),
    },
    plugins: [
      'expo-router',
      'expo-secure-store',
      [
        'expo-localization',
        { supportsRTL: false },
      ],
      'expo-local-authentication',
      [
        'expo-location',
        {
          locationWhenInUsePermission:
            'Allow Maher Al-Aghbar Furniture to use your location for delivery pins on new orders.',
        },
      ],
      [
        'expo-image-picker',
        {
          photosPermission:
            'Allow Maher Al-Aghbar Furniture to access your photos for order attachments and returns.',
          cameraPermission:
            'Allow Maher Al-Aghbar Furniture to use the camera for QR/barcode scanning, order photos, and returns.',
        },
      ],
      [
        'expo-camera',
        {
          cameraPermission:
            'Allow Maher Al-Aghbar Furniture to use the camera for QR/barcode scanning, order photos, and returns.',
          microphonePermission: false,
          recordAudioAndroid: false,
        },
      ],
      [
        'expo-document-picker',
        {
          iCloudContainerEnvironment: 'Production',
        },
      ],
      ...(stripIosPush
        ? ['./plugins/withPersonalTeamIosCapabilities']
        : [
            [
              'expo-notifications',
              {
                icon: './assets/icon.png',
                color: '#776245',
                defaultChannel: 'default',
              },
            ],
          ]),
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      apiBaseUrl: apiBaseUrl || undefined,
      easBuildProfile: profile,
      eas: {
        projectId: easProjectId,
      },
      router: {},
    },
  };
};
