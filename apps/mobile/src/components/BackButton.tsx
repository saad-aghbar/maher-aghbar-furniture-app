import { Pressable, View } from 'react-native';
import Animated, {
  FadeIn,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useLocale } from '@/i18n/useLocale';
import { haptics, useReducedMotion } from '@/motion';
import { useTheme } from '@/theme';

type BackButtonProps = {
  onPress?: () => void;
  label?: string;
};

/**
 * Circular return control — light press scale + fade-in, no idle fidget.
 */
export function BackButton({ onPress, label }: BackButtonProps) {
  const { colors, theme, colorScheme } = useTheme();
  const { isRTL, t } = useLocale();
  const reduce = useReducedMotion();
  const a11y = label ?? t('common.back');
  const press = useSharedValue(0);

  const shellStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(press.value, [0, 1], [1, 0.92]) }],
  }));

  const ink = colorScheme === 'dark' ? colors.onBrand : colors.brand;
  const fill = colorScheme === 'dark' ? colors.brand : colors.brandSoft;
  const ring = colors.brand;

  return (
    <Animated.View entering={reduce ? undefined : FadeIn.duration(220)}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={a11y}
        hitSlop={8}
        onPressIn={() => {
          if (!reduce) press.value = withSpring(1, { damping: 18, stiffness: 320 });
        }}
        onPressOut={() => {
          if (!reduce) press.value = withSpring(0, { damping: 16, stiffness: 260 });
        }}
        onPress={() => {
          void haptics.selection();
          onPress?.();
        }}
        style={{
          alignSelf: isRTL ? 'flex-end' : 'flex-start',
          minHeight: theme.sizes.touch.min,
          minWidth: theme.sizes.touch.min,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Animated.View
          style={[
            {
              width: 44,
              height: 44,
              alignItems: 'center',
              justifyContent: 'center',
            },
            shellStyle,
          ]}
        >
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: fill,
              borderWidth: 1,
              borderColor: ring,
              alignItems: 'center',
              justifyContent: 'center',
              ...theme.elevation.raised,
            }}
          >
            <View
              style={{
                width: 9,
                height: 9,
                borderLeftWidth: 2.4,
                borderBottomWidth: 2.4,
                borderColor: ink,
                marginLeft: isRTL ? -2 : 2,
                transform: [{ rotate: isRTL ? '225deg' : '45deg' }],
              }}
            />
          </View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}
