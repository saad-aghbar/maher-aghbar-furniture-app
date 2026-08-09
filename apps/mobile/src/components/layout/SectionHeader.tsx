import { type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n/useLocale';
import { useTheme } from '@/theme';

type SectionHeaderProps = {
  title: string;
  action?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function SectionHeader({ title, action, style }: SectionHeaderProps) {
  const { theme } = useTheme();
  const { isRTL } = useLocale();

  return (
    <View
      style={[
        {
          minHeight: theme.sizes.touch.min,
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.md,
          marginBottom: theme.spacing.sm,
        },
        style,
      ]}
    >
      <AppText variant="heading" style={{ flex: 1 }} align="start">
        {title}
      </AppText>
      {action}
    </View>
  );
}
