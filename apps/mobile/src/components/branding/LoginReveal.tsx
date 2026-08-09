import Animated, {
  type SharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated';
import type { ReactNode } from 'react';

type Props = {
  opacity: SharedValue<number>;
  translateY: SharedValue<number>;
  children: ReactNode;
  testID?: string;
  pointerEvents?: 'none' | 'auto' | 'box-none';
};

/** Staggered entrance wrapper for login groups (title, fields, button). */
export function LoginReveal({
  opacity,
  translateY,
  children,
  testID,
  pointerEvents = 'auto',
}: Props) {
  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View testID={testID} style={style} pointerEvents={pointerEvents}>
      {children}
    </Animated.View>
  );
}
