import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { rowDirection } from '@/i18n/rtl';
import { useTheme } from '@/theme';
import { orderBoardShadow } from './orderFloorStyle';

type OrderBoardCardProps = {
  children: ReactNode;
  /** Start-edge accent rail. Defaults to brand @ 0.55. */
  accent?: string;
  /** Soft fill wash (banners). */
  style?: object;
  /** Optional header band above body (status / title strip). */
  header?: ReactNode;
};

/**
 * Orders floor board — parchment surface, start rail, optional header band.
 * Matches dealers / invoices / production board recipe.
 */
export function OrderBoardCard({
  children,
  accent,
  style,
  header,
}: OrderBoardCardProps) {
  const { isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const rail = accent ?? colors.brand;
  const urgent = rail === colors.warning || rail === colors.error;
  const railOpacity = urgent ? 0.9 : 0.55;

  return (
    <View
      style={[
        {
          borderRadius: theme.radius.xl,
          borderWidth: 1,
          borderColor: urgent ? rail : colors.borderStrong,
          backgroundColor: colors.surface,
          overflow: 'hidden',
          ...orderBoardShadow(colorScheme),
        },
        style,
      ]}
    >
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
      {header ? (
        <View
          style={{
            paddingHorizontal: theme.spacing.lg,
            paddingVertical: theme.spacing.md,
            ...(isRTL
              ? { paddingRight: theme.spacing.lg + 4 }
              : { paddingLeft: theme.spacing.lg + 4 }),
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            backgroundColor: colors.surfaceSecondary,
          }}
        >
          {header}
        </View>
      ) : null}
      <View
        style={{
          padding: theme.spacing.lg,
          gap: theme.spacing.sm,
          ...(isRTL
            ? { paddingRight: theme.spacing.lg + 4 }
            : { paddingLeft: theme.spacing.lg + 4 }),
        }}
      >
        {children}
      </View>
    </View>
  );
}

type OrderSectionHeaderProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  accent?: string;
  trailing?: ReactNode;
  /** Floor boards default to uppercase (skipped for Arabic). */
  uppercase?: boolean;
};

export function OrderSectionHeader({
  icon,
  label,
  accent,
  trailing,
  uppercase = true,
}: OrderSectionHeaderProps) {
  const { isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const useUpper = uppercase && locale !== 'ar';

  return (
    <View
      style={{
        flexDirection: rowDirection(isRTL),
        alignItems: 'center',
        gap: theme.spacing.sm,
      }}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.surfaceSecondary,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Ionicons name={icon} size={16} color={accent ?? colors.brand} />
      </View>
      <AppText
        variant="caption"
        color="muted"
        style={{
          flex: 1,
          textTransform: useUpper ? 'uppercase' : 'none',
          letterSpacing: useUpper ? 0.55 : 0,
          fontSize: 11,
          lineHeight: 14,
          textAlign: isRTL ? 'right' : 'left',
        }}
      >
        {label}
      </AppText>
      {trailing}
    </View>
  );
}
