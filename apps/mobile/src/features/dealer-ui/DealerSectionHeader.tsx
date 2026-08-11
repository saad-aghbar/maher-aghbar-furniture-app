import type { ReactNode } from 'react';
import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';

type Props = {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  /** Override default bottom spacing under the title row. */
  compact?: boolean;
};

export function DealerSectionHeader({ title, subtitle, action, compact }: Props) {
  const { isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  return (
    <View
      style={{
        gap: theme.spacing.xs,
        marginBottom: compact ? 0 : theme.spacing.sm,
      }}
    >
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.md,
        }}
      >
        <AppText
          variant="heading"
          weight={titleWeight}
          style={{
            flex: 1,
            textAlign: isRTL ? 'right' : 'left',
            color: colors.textPrimary,
          }}
        >
          {title}
        </AppText>
        {action ?? null}
      </View>
      {subtitle ? (
        <AppText
          variant="caption"
          color="muted"
          style={{ textAlign: isRTL ? 'right' : 'left' }}
        >
          {subtitle}
        </AppText>
      ) : null}
    </View>
  );
}
