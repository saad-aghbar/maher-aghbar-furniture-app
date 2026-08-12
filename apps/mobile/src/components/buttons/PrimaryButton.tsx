import { type ReactNode } from 'react';
import {
  ActivityIndicator,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { AppText } from '@/components/AppText';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import {
  getButtonContainerStyle,
  getButtonLabelStyle,
  type ButtonVariant,
} from './buttonStyles';

type SharedButtonProps = {
  label: string;
  onPress?: (e: GestureResponderEvent) => void;
  disabled?: boolean;
  loading?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  leading?: ReactNode;
  trailing?: ReactNode;
  haptic?: 'none' | 'selection' | 'light' | 'medium';
};

function BaseButton({
  variant,
  label,
  onPress,
  disabled = false,
  loading = false,
  accessibilityLabel,
  style,
  leading,
  trailing,
  haptic = 'medium',
}: SharedButtonProps & { variant: ButtonVariant }) {
  const { theme } = useTheme();
  const isDisabled = disabled || loading;
  const container = getButtonContainerStyle(theme, variant, isDisabled);
  const labelStyle = getButtonLabelStyle(theme, variant, isDisabled);

  return (
    <AnimatedPressable
      variant="button"
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={(e) => {
        if (haptic === 'selection') void haptics.selection();
        else if (haptic === 'light') void haptics.confirmLight();
        else if (haptic === 'medium') void haptics.confirmMedium();
        onPress?.(e);
      }}
      style={[container, style]}
    >
      {loading ? (
        <ActivityIndicator color={labelStyle.color} />
      ) : (
        <>
          {leading}
          <AppText variant="label" weight="medium" style={labelStyle} align="center">
            {label}
          </AppText>
          {trailing}
        </>
      )}
    </AnimatedPressable>
  );
}

export function PrimaryButton(props: SharedButtonProps) {
  return <BaseButton variant="primary" haptic={props.haptic ?? 'medium'} {...props} />;
}

export function SecondaryButton(props: SharedButtonProps) {
  return <BaseButton variant="secondary" haptic={props.haptic ?? 'selection'} {...props} />;
}

export function TertiaryButton(props: SharedButtonProps) {
  return <BaseButton variant="tertiary" haptic={props.haptic ?? 'selection'} {...props} />;
}

export function DestructiveButton(props: SharedButtonProps) {
  return <BaseButton variant="destructive" haptic={props.haptic ?? 'medium'} {...props} />;
}

export function SuccessButton(props: SharedButtonProps) {
  return <BaseButton variant="success" haptic={props.haptic ?? 'medium'} {...props} />;
}
