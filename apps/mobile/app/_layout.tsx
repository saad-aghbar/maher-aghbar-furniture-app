import 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useStackMotionOptions } from '@/navigation/stackMotion';
import { AppProviders } from '@/providers/AppProviders';
import { useTheme } from '@/theme';

function RootNavigator() {
  const { colorScheme } = useTheme();
  const stackMotion = useStackMotionOptions();

  return (
    <>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={stackMotion}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
        <Stack.Screen name="dev" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <AppProviders>
      <RootNavigator />
    </AppProviders>
  );
}
