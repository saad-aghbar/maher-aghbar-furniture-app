import { type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n/useLocale';
import { rowDirection } from '@/i18n/rtl';
import { useTheme } from '@/theme';

type SectionHeaderProps = {
  title: string;
  /** Opposite-side count. Shown even when 0 — never hide backend zeros. */
  count?: number;
  countLabel?: string;
  action?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** Title sits on the start edge; count/action sit on the other side. */
export function sectionHeaderCountText(
  count?: number,
  countLabel?: string,
): string | null {
  if (countLabel != null) return countLabel;
  if (count != null) return String(count);
  return null;
}

export function SectionHeader({ title, count, countLabel, action, style }: SectionHeaderProps) {
  const { theme } = useTheme();
  const { isRTL } = useLocale();
  const trailing = sectionHeaderCountText(count, countLabel);

  return (
    <View
      style={[
        {
          minHeight: theme.sizes.touch.min,
          flexDirection: rowDirection(isRTL),
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
      {trailing != null ? (
        <AppText variant="caption" color="secondary" dir="ltr" style={{ fontVariant: ['tabular-nums'] }}>
          {trailing}
        </AppText>
      ) : null}
      {action}
    </View>
  );
}
