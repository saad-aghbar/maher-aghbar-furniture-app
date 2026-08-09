import { type ReactNode } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '@/auth/AuthProvider';
import { NetworkProvider } from '@/components/network/NetworkProvider';
import { ToastProvider } from '@/components/feedback/Toast';
import { LocationMapVisibilityProvider } from '@/components/maps/LocationMapVisibility';
import { CodeScannerProvider } from '@/components/scan/CodeScannerProvider';
import { SheetOverlayYieldProvider } from '@/components/sheets/SheetOverlayYield';
import { AccessoryCameraProvider } from '@/features/inventory/components/AccessoryCameraProvider';
import { LocaleProvider } from '@/i18n';
import { ThemeProvider } from '@/theme';
import { FontProvider } from './FontProvider';
import { QueryProvider } from './QueryProvider';

/** Root composition of app-wide providers. */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <LocaleProvider>
          <FontProvider>
            <ThemeProvider>
              <NetworkProvider>
                <ToastProvider>
                  <QueryProvider>
                    <AuthProvider>
                      <CodeScannerProvider>
                        <AccessoryCameraProvider>
                          <LocationMapVisibilityProvider>
                            <SheetOverlayYieldProvider>{children}</SheetOverlayYieldProvider>
                          </LocationMapVisibilityProvider>
                        </AccessoryCameraProvider>
                      </CodeScannerProvider>
                    </AuthProvider>
                  </QueryProvider>
                </ToastProvider>
              </NetworkProvider>
            </ThemeProvider>
          </FontProvider>
        </LocaleProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
