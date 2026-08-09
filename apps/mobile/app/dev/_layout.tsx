import { Redirect, Stack } from 'expo-router';

/** Dev-only routes — production builds redirect home. */
export default function DevLayout() {
  if (!__DEV__) {
    return <Redirect href="/" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        title: 'Dev',
      }}
    />
  );
}
