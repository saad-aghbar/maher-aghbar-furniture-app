import 'react-native-gesture-handler';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../src/providers/auth-provider';
import { I18nProvider, useI18n } from '../src/providers/i18n-provider';
import { QueryProvider } from '../src/providers/query-provider';
import { colors } from '../src/theme/tokens';

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, bootstrapping } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (bootstrapping) return;
    const inAuth = segments[0] === '(auth)';
    if (!user && !inAuth) {
      router.replace('/(auth)/login');
    } else if (user && inAuth) {
      router.replace('/(app)/(tabs)' as never);
    }
  }, [user, bootstrapping, segments, router]);

  if (bootstrapping) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator color={colors.brand} size="large" />
      </View>
    );
  }

  return <>{children}</>;
}

function RootNav() {
  const { direction } = useI18n();
  return (
    <>
      <StatusBar style="dark" />
      <AuthGate>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
            animation: direction === 'rtl' ? 'slide_from_left' : 'slide_from_right',
          }}
        >
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(app)" />
        </Stack>
      </AuthGate>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryProvider>
        <I18nProvider>
          <AuthProvider>
            <RootNav />
          </AuthProvider>
        </I18nProvider>
      </QueryProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
