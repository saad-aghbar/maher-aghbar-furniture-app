import { NativeModule, requireOptionalNativeModule } from 'expo-modules-core';

export type MaherWatchBridgeNativeModule = NativeModule & {
  publishContext(payload: Record<string, unknown>): Promise<void>;
  publishToken(accessToken: string, sessionEpoch: number): Promise<void>;
  clear(): Promise<void>;
};

export default requireOptionalNativeModule<MaherWatchBridgeNativeModule>('MaherWatchBridge');
