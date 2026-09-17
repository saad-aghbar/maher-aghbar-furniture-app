import { Camera } from 'expo-camera';

/**
 * True when a capture camera is actually present. Designed-for-iPad on Mac
 * and some tablets report no camera — callers should offer the library /
 * file-picker / typed-code path instead of opening a dead shutter.
 */
export async function isCaptureCameraAvailable(): Promise<boolean> {
  try {
    const maybe = Camera as typeof Camera & {
      isAvailableAsync?: () => Promise<boolean>;
    };
    if (typeof maybe.isAvailableAsync === 'function') {
      return await maybe.isAvailableAsync();
    }
    return true;
  } catch {
    return false;
  }
}
