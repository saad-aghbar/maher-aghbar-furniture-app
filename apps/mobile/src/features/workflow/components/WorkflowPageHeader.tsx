import type { ReactNode } from 'react';
import { View } from 'react-native';
import type { Href } from 'expo-router';
import { AppText } from '@/components/AppText';
import { BackButton } from '@/components/BackButton';
import { useLocale } from '@/i18n';
import { useSmartBack } from '@/navigation/useSmartBack';
import { useTheme } from '@/theme';

type Props = {
  fallback: Href;
  title: string;
  /** Supporting line under the title row. */
  subtitle?: string;
  /** Optional status chip / meta row under the title. */
  status?: ReactNode;
};

/**
 * Dealers-style header: back + title on one line (scrolls with content).
 */
export function WorkflowPageHeader({ fallback, title, subtitle, status }: Props) {
  const { theme } = useTheme();
  const { locale, isRTL } = useLocale();
  const onBack = useSmartBack(fallback);
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const leadSize = theme.sizes.touch.min;

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <View style={{ minHeight: leadSize, justifyContent: 'center' }}>
        <View
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            ...(isRTL ? { right: 0 } : { left: 0 }),
            zIndex: 1,
            justifyContent: 'center',
          }}
        >
          <BackButton onPress={onBack} />
        </View>
        <AppText
          variant="largeTitle"
          weight={titleWeight}
          align="center"
          numberOfLines={2}
          style={{
            paddingHorizontal: leadSize + theme.spacing.sm,
            fontSize: 26,
            lineHeight: 32,
          }}
        >
          {title}
        </AppText>
      </View>
      {status}
      {subtitle ? (
        <AppText
          variant="body"
          color="secondary"
          align="center"
          style={{ paddingHorizontal: theme.spacing.sm }}
        >
          {subtitle}
        </AppText>
      ) : null}
    </View>
  );
}

type StatusPillProps = {
  label: string;
  active?: boolean;
  /** Cream fill + wood-brown ink instead of gray muted chrome. */
  branded?: boolean;
};

export function WorkflowStatusPill({
  label,
  active = false,
  branded = false,
}: StatusPillProps) {
  const { theme, colors } = useTheme();
  const chrome = active || branded;
  return (
    <View
      style={{
        alignSelf: 'center',
        borderRadius: theme.radius.full,
        borderWidth: 1,
        borderColor: chrome ? colors.brand : colors.border,
        backgroundColor: chrome ? colors.brandSoft : colors.surfaceSecondary,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.xs,
      }}
    >
      <AppText
        variant="caption"
        weight="semibold"
        style={{
          color: active
            ? colors.brand
            : branded
              ? colors.brandActive
              : colors.textSecondary,
        }}
      >
        {label}
      </AppText>
    </View>
  );
}
