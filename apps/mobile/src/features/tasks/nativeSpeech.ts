import { requireOptionalNativeModule } from 'expo';

export function hasNativeExpoSpeech(): boolean {
  return (
    requireOptionalNativeModule('ExpoSpeech') != null ||
    requireOptionalNativeModule('ExponentSpeech') != null
  );
}

export async function loadExpoSpeech(): Promise<typeof import('expo-speech') | null> {
  if (!hasNativeExpoSpeech()) return null;
  try {
    return await import('expo-speech');
  } catch {
    return null;
  }
}
