import { useEffect } from 'react';
import { useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { BrandMark } from '@/components/BrandMark';
import { useLocale } from '@/i18n';
import { useReducedMotion } from '@/motion';

type Props = {
  /** Optional scroll driver for a slight parallax lift. */
  scrollY?: SharedValue<number>;
  style?: StyleProp<ViewStyle>;
};

/**
 * Faint breathing M — admin / worker / dealer home language.
 */
export function HomeWatermark({ scrollY, style }: Props) {
  const { isRTL } = useLocale();
  const reduce = useReducedMotion();
  const { width } = useWindowDimensions();
  const markSize = Math.min(width * 0.48, 220);
  const breathe = useSharedValue(reduce ? 0.5 : 0);

  useEffect(() => {
    if (reduce) {
      breathe.value = 0.5;
      return;
    }
    breathe.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 5600, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 5600, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, [breathe, reduce]);

  const markStyle = useAnimatedStyle(() => {
    const scroll = scrollY?.value ?? 0;
    return {
      opacity: interpolate(breathe.value, [0, 1], [0.05, 0.12]),
      transform: [
        { translateY: interpolate(scroll, [0, 180], [0, 32]) },
        { scale: interpolate(breathe.value, [0, 1], [1, 1.05]) },
        { rotate: `${interpolate(breathe.value, [0, 1], [-7, -1])}deg` },
      ],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          ...(isRTL ? { left: markSize * 0.02 } : { right: -markSize * 0.2 }),
          top: 8,
          width: markSize,
          height: markSize,
          zIndex: 0,
        },
        markStyle,
        style,
      ]}
    >
      <BrandMark
        variant="monogram"
        size="hero"
        tone="auto"
        style={{ width: markSize, height: markSize }}
      />
    </Animated.View>
  );
}
