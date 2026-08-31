import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { AppText } from '@/components/AppText';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';

type Props = {
  children: ReactNode;
  title?: string;
  titleWeight?: 'medium' | 'semibold';
  trailing?: ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  /** Skip brand rail (rare nested panels). */
  hideAccent?: boolean;
  /** Override brand edge (late / blockers use error). */
  accentColor?: string;
};

/** Parchment floor section board — header band + body, matches invoice/return language. */
export function DealerBoard({
  children,
  title,
  titleWeight,
  trailing,
  style,
  contentStyle,
  hideAccent = false,
  accentColor,
}: Props) {
  const { isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const rail = accentColor ?? colors.brand;
  const railOpacity = accentColor && accentColor !== colors.brand ? 0.9 : 0.55;

  return (
    <View
      style={[
        {
          borderRadius: theme.radius.xl,
          borderWidth: 1,
          borderColor: colors.borderStrong,
          backgroundColor: colors.surface,
          overflow: 'hidden',
          ...orderBoardShadow(colorScheme),
        },
        style,
      ]}
    >
      {hideAccent ? null : (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            ...(isRTL ? { right: 0 } : { left: 0 }),
            width: 3,
            backgroundColor: rail,
            opacity: railOpacity,
          }}
        />
      )}
      {title || trailing ? (
        <View
          style={{
            paddingVertical: theme.spacing.md,
            paddingHorizontal: theme.spacing.lg,
            ...(isRTL
              ? { paddingRight: theme.spacing.lg + 4 }
              : { paddingLeft: theme.spacing.lg + 4 }),
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: theme.spacing.sm,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            backgroundColor: colors.surfaceSecondary,
          }}
        >
          {title ? (
            <AppText
              variant="label"
              weight={titleWeight ?? 'semibold'}
              numberOfLines={1}
              style={{ flex: 1, textAlign: isRTL ? 'right' : 'left', fontSize: 15 }}
            >
              {title}
            </AppText>
          ) : (
            <View style={{ flex: 1 }} />
          )}
          {trailing}
        </View>
      ) : null}
      <View
        style={[
          {
            padding: theme.spacing.lg,
            gap: theme.spacing.md,
            ...(isRTL
              ? { paddingRight: theme.spacing.lg + 4 }
              : { paddingLeft: theme.spacing.lg + 4 }),
          },
          contentStyle,
        ]}
      >
        {children}
      </View>
    </View>
  );
}
