import { type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { AppText } from '@/components/AppText';
import { BackButton } from '@/components/BackButton';
import { useLocale } from '@/i18n/useLocale';
import { useTheme } from '@/theme';

type AppHeaderProps = {
  title: string;
  onBack?: () => void;
  trailing?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function AppHeader({ title, onBack, trailing, style }: AppHeaderProps) {
  const { theme } = useTheme();
  const { isRTL } = useLocale();

  return (
    <View
      accessibilityRole="header"
      style={[
        {
          minHeight: theme.sizes.touch.min,
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
          marginBottom: theme.spacing.md,
        },
        style,
      ]}
    >
      {onBack ? <BackButton onPress={onBack} /> : <View style={{ width: theme.spacing.sm }} />}
      <AppText variant="heading" style={{ flex: 1 }} align="start" numberOfLines={1}>
        {title}
      </AppText>
      {trailing ?? <View style={{ width: theme.sizes.touch.min }} />}
    </View>
  );
}
