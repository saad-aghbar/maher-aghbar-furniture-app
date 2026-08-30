import { type ReactNode } from 'react';
import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';

type Props = {
  title: string;
  children: ReactNode;
  viewAllLabel?: string;
  onViewAll?: () => void;
};

/** ATTENTION stack — taupe eyebrow, dark cards, “View all (n)” footer. */
export function AttentionSection({ title, children, viewAllLabel, onViewAll }: Props) {
  const { isRTL } = useLocale();
  const { colors, theme } = useTheme();

  return (
    <View style={{ gap: theme.spacing.md }}>
      <AppText
        variant="caption"
        weight="semibold"
        style={{
          letterSpacing: 2,
          textTransform: 'uppercase',
          color: colors.textMuted,
          textAlign: isRTL ? 'right' : 'left',
        }}
      >
        {title}
      </AppText>
      <View style={{ gap: theme.spacing.sm }}>{children}</View>
      {viewAllLabel && onViewAll ? (
        <AnimatedPressable
          variant="button"
          accessibilityRole="button"
          accessibilityLabel={viewAllLabel}
          onPress={() => {
            void haptics.selection();
            onViewAll();
          }}
          style={{ alignItems: 'center', paddingVertical: theme.spacing.sm }}
        >
          <AppText variant="caption" weight="medium" style={{ color: colors.textMuted }}>
            {viewAllLabel}
          </AppText>
        </AnimatedPressable>
      ) : null}
    </View>
  );
}
