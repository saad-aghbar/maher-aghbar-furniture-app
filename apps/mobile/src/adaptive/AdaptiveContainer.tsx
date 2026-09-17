import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useMaherDensity } from './density';

type AdaptiveContainerProps = {
  children: ReactNode;
  /** Cap width to the density `contentMaxWidth` and center. Default true. Compact is never capped. */
  constrain?: boolean;
  /** Apply density horizontal padding. Off by default — existing screens keep their own padding. */
  padded?: boolean;
  /** Flex-fill the parent. Turn off inside ScrollViews. Default true. */
  fill?: boolean;
  /** Override the max width (dp). */
  maxWidth?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * Centers screen content at a sensible reading width on large windows so a
 * 380px phone canvas is never stretched to 1400px. On COMPACT it is a plain
 * full-width `View`.
 */
export function AdaptiveContainer({
  children,
  constrain = true,
  padded = false,
  fill = true,
  maxWidth,
  style,
  testID,
}: AdaptiveContainerProps) {
  const density = useMaherDensity();
  const cap = maxWidth ?? density.contentMaxWidth;
  return (
    <View
      testID={testID}
      style={[
        {
          flex: fill ? 1 : undefined,
          width: '100%',
          alignSelf: 'center',
          maxWidth: constrain && cap ? cap : undefined,
          paddingHorizontal: padded ? density.pagePaddingH : undefined,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
