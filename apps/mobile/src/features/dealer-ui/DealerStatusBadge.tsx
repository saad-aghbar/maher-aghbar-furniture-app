import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

type Props = {
  label: string;
  tone?: Tone;
};

export function DealerStatusBadge({ label, tone = 'neutral' }: Props) {
  const { isRTL } = useLocale();
  const { colors, theme } = useTheme();

  const bg =
    tone === 'success'
      ? colors.successSoft
      : tone === 'warning'
        ? colors.warningSoft
        : tone === 'danger'
          ? colors.errorSoft
          : tone === 'info'
            ? colors.infoSoft
            : colors.surfaceSecondary;
  const fg =
    tone === 'success'
      ? colors.success
      : tone === 'warning'
        ? colors.warning
        : tone === 'danger'
          ? colors.error
          : tone === 'info'
            ? colors.info
            : colors.textSecondary;

  return (
    <View
      style={{
        alignSelf: isRTL ? 'flex-end' : 'flex-start',
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: 4,
        borderRadius: theme.radius.sm,
        backgroundColor: bg,
      }}
    >
      <AppText variant="caption" weight="medium" style={{ color: fg }}>
        {label}
      </AppText>
    </View>
  );
}
