import * as SecureStore from 'expo-secure-store';

const PUSH_TOKEN_KEY = 'maher.expo_push_token';
const PENDING_INTENT_KEY = 'maher.pending_notification_intent';

export async function getStoredPushToken(): Promise<string | null> {
  return SecureStore.getItemAsync(PUSH_TOKEN_KEY);
}

export async function setStoredPushToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(PUSH_TOKEN_KEY, token);
}

export async function clearStoredPushToken(): Promise<void> {
  await SecureStore.deleteItemAsync(PUSH_TOKEN_KEY);
}

export async function getPendingNotificationIntentJson(): Promise<string | null> {
  return SecureStore.getItemAsync(PENDING_INTENT_KEY);
}

export async function setPendingNotificationIntentJson(value: string): Promise<void> {
  await SecureStore.setItemAsync(PENDING_INTENT_KEY, value);
}

export async function clearPendingNotificationIntent(): Promise<void> {
  await SecureStore.deleteItemAsync(PENDING_INTENT_KEY);
}
