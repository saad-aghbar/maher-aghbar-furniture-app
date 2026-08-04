import 'react-native-gesture-handler';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../src/providers/auth-provider';
import { getUserSurface, surfaceHomeHref } from '../src/lib/surface';

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, bootstrapping } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (bootstrapping) return;

    const inAuth = segments[0] === '(auth)';
    const inApp = segments[0] === '(app)';

    if (!user && !inAuth) {
      router.replace('/(auth)/login');
      return;
    }

    if (user) {
      const home = surfaceHomeHref(getUserSurface(user));
      const current = segments[1];
      const expected = home.split('/').pop();
      if (inAuth || !inApp || current !== expected) {
        router.replace(home);
      }
    }
  }, [user, bootstrapping, segments, router]);

  if (bootstrapping) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator color="#d93a2b" size="large" />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <AuthGate>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#f5f2ee' } }}>
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(app)" />
            <Stack.Screen name="index" />
          </Stack>
        </AuthGate>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1c1612',
  },
});
