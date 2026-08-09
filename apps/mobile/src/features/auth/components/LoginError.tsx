import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { useTheme } from '@/theme';
import type { LoginColors } from '../theme/loginColors';

type Props = {
  colors: LoginColors;
  message?: string;
};

export function LoginError({ colors, message }: Props) {
  const { theme } = useTheme();

  return (
    <View
      style={{
        minHeight: 40,
        justifyContent: 'center',
        paddingHorizontal: theme.spacing.sm,
      }}
      accessibilityLiveRegion="polite"
    >
      {message ? (
        <AppText
          variant="bodySecondary"
          align="center"
          accessibilityRole="alert"
          style={{ color: colors.error }}
        >
          {message}
        </AppText>
      ) : null}
    </View>
  );
}
