import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
  View,
} from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { AppText } from '@/components/AppText';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import { getButtonContainerStyle, getButtonLabelStyle } from '@/components/buttons/buttonStyles';

type HoldToConfirmButtonProps = {
  label: string;
  holdLabel?: string;
  holdMs?: number;
  onConfirm: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

/**
 * Hold-to-confirm primary action — fill progresses while pressed; releases cancel.
 */
export function HoldToConfirmButton({
  label,
  holdLabel,
  holdMs = 1200,
  onConfirm,
  disabled = false,
  loading = false,
  style,
  accessibilityLabel,
}: HoldToConfirmButtonProps) {
  const { colors, theme } = useTheme();
  const progress = useSharedValue(0);
  const [holding, setHolding] = useState(false);
  const confirmed = useRef(false);
  const isDisabled = disabled || loading;

  const finish = useCallback(() => {
    if (confirmed.current || isDisabled) return;
    confirmed.current = true;
    void haptics.completeStrong();
    onConfirm();
  }, [isDisabled, onConfirm]);

  useEffect(() => {
    if (!holding) {
      confirmed.current = false;
    }
  }, [holding]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${Math.min(100, progress.value * 100)}%`,
  }));

  function onPressIn(_e: GestureResponderEvent) {
    if (isDisabled) return;
    setHolding(true);
    void haptics.selection();
    progress.value = 0;
    progress.value = withTiming(1, { duration: holdMs }, (done) => {
      if (done) runOnJS(finish)();
    });
  }

  function onPressOut() {
    setHolding(false);
    progress.value = withTiming(0, { duration: 160 });
  }

  const container = getButtonContainerStyle(theme, 'primary', isDisabled);
  const labelStyle = getButtonLabelStyle(theme, 'primary', isDisabled);

  return (
    <AnimatedPressable
      variant="button"
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={holdLabel ?? `Hold to confirm`}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      onPress={() => undefined}
      style={[
        container,
        { overflow: 'hidden', minHeight: theme.sizes.touch.min + 8 },
        style,
      ]}
    >
      <View
        pointerEvents="none"
        style={{
          ...StyleSheetAbsoluteFill,
          backgroundColor: 'transparent',
        }}
      >
        <Animated.View
          style={[
            {
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              backgroundColor: colors.brand,
              opacity: 0.45,
            },
            fillStyle,
          ]}
        />
      </View>
      <AppText variant="label" style={labelStyle} align="center">
        {holding ? (holdLabel ?? label) : label}
      </AppText>
    </AnimatedPressable>
  );
}

const StyleSheetAbsoluteFill = {
  position: 'absolute' as const,
  left: 0,
  right: 0,
  top: 0,
  bottom: 0,
};
