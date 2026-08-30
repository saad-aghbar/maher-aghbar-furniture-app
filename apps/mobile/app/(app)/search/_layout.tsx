import { Stack } from 'expo-router';
import { useStackMotionOptions } from '@/navigation/stackMotion';

/** Own stack so `/(app)/search` is a real destination, not a missing child of index. */
export default function SearchLayout() {
  const stackMotion = useStackMotionOptions();
  return (
    <Stack screenOptions={{ ...stackMotion, animation: 'slide_from_bottom' }}>
      <Stack.Screen name="index" />
    </Stack>
  );
}
