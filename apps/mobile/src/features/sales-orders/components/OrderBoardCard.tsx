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
  accent?: string;
  style?: object;
};

/** Elevated board card — production floor language for order detail sections. */
export function OrderBoardCard({
  children,
  accent,
  style,
}: OrderBoardCardProps) {
  const { isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();

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
      {accent ? (
        <View
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            ...(isRTL ? { right: 0 } : { left: 0 }),
            width: 3,
            backgroundColor: accent,
            opacity: 0.55,
          }}
        />
      ) : null}
      <View
        style={{
          padding: theme.spacing.md,
          gap: theme.spacing.sm,
          ...(isRTL
            ? { paddingRight: accent ? theme.spacing.md + 4 : theme.spacing.md }
            : { paddingLeft: accent ? theme.spacing.md + 4 : theme.spacing.md }),
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
  /** Floor boards default to uppercase. Quotation detail uses sentence-case. */
  uppercase?: boolean;
};

export function OrderSectionHeader({
  icon,
  label,
  accent,
  trailing,
  uppercase = true,
}: OrderSectionHeaderProps) {
  const { isRTL } = useLocale();
  const { colors, theme } = useTheme();

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
          textTransform: uppercase ? 'uppercase' : 'none',
          letterSpacing: uppercase ? 0.6 : 0,
          fontSize: 11,
          lineHeight: 14,
        }}
      >
        {label}
      </AppText>
      {trailing}
    </View>
  );
}
