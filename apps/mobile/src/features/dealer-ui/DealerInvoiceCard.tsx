import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { AnimatedPressable } from '@/motion';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import { DealerStatusBadge } from './DealerStatusBadge';

type Props = {
  title: string;
  amountLabel?: string;
  dueLabel?: string;
  statusLabel?: string;
  statusTone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
  onPress: () => void;
};

export function DealerInvoiceCard({
  title,
  amountLabel,
  dueLabel,
  statusLabel,
  statusTone = 'neutral',
  onPress,
}: Props) {
  const { isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  return (
    <AnimatedPressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={{
        padding: theme.spacing.md,
        borderRadius: theme.radius.lg,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderStartWidth: 4,
        borderStartColor: colors.brand,
        gap: theme.spacing.sm,
        alignItems: isRTL ? 'flex-end' : 'flex-start',
        minWidth: 220,
      }}
    >
      <AppText
        variant="body"
        weight={titleWeight}
        style={{ color: colors.textPrimary, textAlign: isRTL ? 'right' : 'left', alignSelf: 'stretch' }}
      >
        {title}
      </AppText>
      {statusLabel ? <DealerStatusBadge label={statusLabel} tone={statusTone} /> : null}
      {amountLabel ? (
        <AppText variant="heading" weight={titleWeight} style={{ color: colors.textPrimary }}>
          {amountLabel}
        </AppText>
      ) : null}
      {dueLabel ? (
        <AppText variant="caption" color="muted">
          {dueLabel}
        </AppText>
      ) : null}
    </AnimatedPressable>
  );
}
