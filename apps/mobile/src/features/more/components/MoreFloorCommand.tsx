import { View } from 'react-native';
import { useTheme } from '@/theme';
import { MoreAiSpotlight } from './MoreAiSpotlight';
import { MorePlacesDock } from './MorePlacesDock';

/**
 * Floor command — places dock + automation spotlight.
 */
export function MoreFloorCommand() {
  const { theme } = useTheme();

  return (
    <View style={{ gap: theme.spacing.xl }}>
      <MorePlacesDock />
      <MoreAiSpotlight />
    </View>
  );
}
