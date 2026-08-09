import { View, type StyleProp, type ViewStyle } from 'react-native';
import { AppText } from '@/components/AppText';
import { BackButton } from '@/components/BackButton';
import { useTheme } from '@/theme';

type LargeTitleHeaderProps = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function LargeTitleHeader({ title, subtitle, onBack, style }: LargeTitleHeaderProps) {
  const { theme } = useTheme();

  return (
    <View
      accessibilityRole="header"
      style={[{ gap: theme.spacing.sm, marginBottom: theme.spacing.lg }, style]}
    >
      {onBack ? <BackButton onPress={onBack} /> : null}
      <View style={{ gap: theme.spacing.xs }}>
        <AppText variant="largeTitle">{title}</AppText>
        {subtitle ? (
          <AppText variant="bodySecondary" color="secondary">
            {subtitle}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}
