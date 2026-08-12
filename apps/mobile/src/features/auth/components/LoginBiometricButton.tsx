import { ActivityIndicator, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { AnimatedPressable, haptics } from '@/motion';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import type { LoginColors } from '../theme/loginColors';

type Props = {
  colors: LoginColors;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
};

/**
 * Outlined login control for Face ID / fingerprint — sits above Sign in.
 */
export function LoginBiometricButton({
  colors,
  label,
  icon,
  onPress,
  loading,
  disabled,
}: Props) {
  const { theme } = useTheme();
  const { isRTL } = useLocale();
  const isDisabled = Boolean(disabled || loading);

  return (
    <AnimatedPressable
      variant="button"
      testID="biometric-login-button"
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={() => {
        void haptics.selection();
        onPress();
      }}
      style={{
        minHeight: theme.sizes.touch.min + 8,
        borderRadius: theme.radius.full,
        borderWidth: 1.5,
        borderColor: colors.brandGold,
        backgroundColor: colors.brandGoldSoft,
        opacity: isDisabled && !loading ? 0.55 : 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: theme.spacing.xl,
      }}
    >
      {loading ? (
        <ActivityIndicator color={colors.brandGold} />
      ) : (
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: theme.spacing.sm,
          }}
        >
          <Ionicons name={icon} size={22} color={colors.brandGold} />
          <AppText variant="body" weight="semibold" style={{ color: colors.brandGold }}>
            {label}
          </AppText>
        </View>
      )}
    </AnimatedPressable>
  );
}
