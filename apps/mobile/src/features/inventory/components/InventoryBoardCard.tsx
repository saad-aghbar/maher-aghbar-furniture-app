import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';

type InventoryBoardCardProps = {
  children: ReactNode;
  accent?: string;
  style?: object;
  padded?: boolean;
};

/** Elevated inventory board — production floor language. */
export function InventoryBoardCard({
  children,
  accent,
  style,
  padded = true,
}: InventoryBoardCardProps) {
  const { isRTL } = useLocale();
  const { colors, theme } = useTheme();

  return (
    <View
      style={[
        {
          borderRadius: theme.radius.xl,
          borderWidth: 1,
          borderColor: colors.borderStrong,
          backgroundColor: colors.surface,
          overflow: 'hidden',
          ...theme.elevation.card,
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
          padding: padded ? theme.spacing.md : 0,
          gap: theme.spacing.sm,
          ...(isRTL
            ? { paddingRight: accent && padded ? theme.spacing.md + 4 : undefined }
            : { paddingLeft: accent && padded ? theme.spacing.md + 4 : undefined }),
        }}
      >
        {children}
      </View>
    </View>
  );
}

type InventorySectionHeaderProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  accent?: string;
  trailing?: ReactNode;
};

export function InventorySectionHeader({
  icon,
  label,
  accent,
  trailing,
}: InventorySectionHeaderProps) {
  const { isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();

  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
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
          textTransform: locale === 'ar' ? 'none' : 'uppercase',
          letterSpacing: locale === 'ar' ? 0 : 0.6,
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
