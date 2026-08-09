import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { AppText } from '@/components/AppText';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import type { LoginColors } from '../theme/loginColors';

type Props = {
  colors: LoginColors;
  label: string;
  loadingLabel: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  success?: boolean;
  testID?: string;
};

export function LoginButton({
  colors,
  label,
  loadingLabel,
  onPress,
  disabled,
  loading,
  success,
  testID,
}: Props) {
  const { theme } = useTheme();
  const check = useSharedValue(0);

  useEffect(() => {
    check.value = success
      ? withTiming(1, { duration: 280, easing: Easing.out(Easing.cubic) })
      : 0;
  }, [check, success]);

  const checkStyle = useAnimatedStyle(() => ({
    opacity: check.value,
    transform: [{ scale: 0.92 + check.value * 0.08 }],
  }));

  const isDisabled = Boolean(disabled || loading || success);
  const bg = colors.brandGold;
  const fg = colors.onBrand;

  return (
    <AnimatedPressable
      variant="button"
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={loading ? loadingLabel : label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={() => {
        void haptics.confirmLight();
        onPress();
      }}
      style={{
        minHeight: theme.sizes.touch.min + 8,
        borderRadius: theme.radius.full,
        backgroundColor: bg,
        opacity: disabled && !loading && !success ? 0.88 : 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: theme.spacing.xl,
        ...theme.elevation.raised,
        shadowColor: colors.brandGold,
        shadowOpacity: isDisabled && !loading ? 0.12 : 0.35,
      }}
    >
      {success ? (
        <Animated.View style={checkStyle}>
          <AppText variant="heading" weight="semibold" style={{ color: colors.onBrand }}>
            ✓
          </AppText>
        </Animated.View>
      ) : loading ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <ActivityIndicator color={colors.onBrand} />
          <AppText variant="body" weight="semibold" style={{ color: colors.onBrand }}>
            {loadingLabel}
          </AppText>
        </View>
      ) : (
        <AppText variant="body" weight="semibold" style={{ color: fg }}>
          {label}
        </AppText>
      )}
    </AnimatedPressable>
  );
}
