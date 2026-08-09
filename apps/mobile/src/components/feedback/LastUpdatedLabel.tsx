import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';

type Props = {
  updatedAt?: number;
};

/** Shows when cache was last refreshed — useful offline / after pull-to-refresh. */
export function LastUpdatedLabel({ updatedAt }: Props) {
  const { t, formatDateTime } = useLocale();
  const { theme } = useTheme();
  if (!updatedAt) return null;
  return (
    <AppText
      variant="caption"
      color="muted"
      accessibilityLabel={t('mobile.lastUpdatedA11y', {
        time: formatDateTime(updatedAt),
      })}
      style={{ marginBottom: theme.spacing.xs }}
    >
      {t('mobile.lastUpdated', { time: formatDateTime(updatedAt) })}
    </AppText>
  );
}
