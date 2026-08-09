import NetInfo from '@react-native-community/netinfo';

/** Snapshot connectivity for the API client (null = unknown → allow attempt). */
export async function getIsConnected(): Promise<boolean | null> {
  try {
    const state = await NetInfo.fetch();
    return state.isConnected;
  } catch {
    return null;
  }
}
