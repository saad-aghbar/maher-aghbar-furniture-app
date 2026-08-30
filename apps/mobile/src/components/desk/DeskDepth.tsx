import type { ReactNode } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';

type DeskPageProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** Level 1 — soft beige page canvas. */
export function DeskPage({ children, style }: DeskPageProps) {
  const { colors } = useTheme();
  return (
    <View style={[{ flex: 1, backgroundColor: colors.background }, style]}>{children}</View>
  );
}

type DeskSectionBandProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
};

/** Level 2 — cream/ivory grouped section surface. */
export function DeskSectionBand({ children, style, padded = true }: DeskSectionBandProps) {
  const { colors, theme } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: colors.surfaceElevated,
          borderRadius: theme.radius.xl,
          borderWidth: 1,
          borderColor: colors.borderMuted,
          overflow: 'hidden',
          ...(padded
            ? {
                paddingHorizontal: theme.spacing.md,
                paddingVertical: theme.spacing.md,
              }
            : null),
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

type DeskCardProps = {
  children: ReactNode;
  accent?: string;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  /** Nested inside a tray / section well — flatter paper, no double shadow. */
  embedded?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  disabled?: boolean;
};

/** Level 3 — elevated actionable card with optional status accent rail. */
export function DeskCard({
  children,
  accent,
  style,
  padded = true,
  embedded = false,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  disabled,
}: DeskCardProps) {
  const { isRTL } = useLocale();
  const { colors, theme } = useTheme();

  const body = (
    <View
      style={[
        {
          borderRadius: embedded ? theme.radius.lg : theme.radius.xl,
          borderWidth: 1,
          borderColor: embedded ? colors.borderMuted : colors.borderStrong,
          backgroundColor: colors.surface,
          overflow: 'hidden',
          ...(embedded ? null : theme.elevation.card),
        },
        style,
      ]}
    >
      {accent ? (
        <View
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            ...(isRTL ? { right: 0 } : { left: 0 }),
            width: 3,
            backgroundColor: accent,
            opacity: 0.6,
          }}
        />
      ) : null}
      <View
        style={{
          padding: padded ? theme.spacing.md : 0,
          gap: padded ? theme.spacing.sm : 0,
          ...(isRTL
            ? { paddingRight: accent && padded ? theme.spacing.md + 4 : undefined }
            : { paddingLeft: accent && padded ? theme.spacing.md + 4 : undefined }),
        }}
      >
        {children}
      </View>
    </View>
  );

  if (!onPress) return body;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: Boolean(disabled) }}
      style={({ pressed }) => [{ opacity: pressed || disabled ? 0.88 : 1 }]}
    >
      {body}
    </Pressable>
  );
}
