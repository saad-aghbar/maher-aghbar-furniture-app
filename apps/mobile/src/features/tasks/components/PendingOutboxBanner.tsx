import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { SurfaceCard } from '@/components/surfaces/SurfaceCard';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import { pendingCount, type TaskOutboxItem } from '../outbox';

type PendingOutboxBannerProps = {
  items: TaskOutboxItem[];
  syncing?: boolean;
  onRetry: () => void;
};

export function PendingOutboxBanner({
  items,
  syncing = false,
  onRetry,
}: PendingOutboxBannerProps) {
  const { t } = useLocale();
  const { colors, theme } = useTheme();
  const count = pendingCount(items);
  if (count === 0 && !items.some((i) => i.status === 'conflict')) return null;

  const conflicts = items.filter((i) => i.status === 'conflict').length;
  const failed = items.filter((i) => i.status === 'failed').length;

  return (
    <SurfaceCard
      style={{
        gap: theme.spacing.sm,
        borderColor: conflicts || failed ? colors.error : colors.warning,
        backgroundColor: conflicts || failed ? colors.errorSoft : colors.warningSoft,
      }}
    >
      <AppText variant="label" weight="semibold">
        {conflicts
          ? t('mobile.tasks.outboxConflict', { n: conflicts })
          : t('mobile.tasks.outboxPending', { n: count })}
      </AppText>
      <AppText variant="caption" color="secondary">
        {t('mobile.tasks.outboxHint')}
      </AppText>
      <View>
        <SecondaryButton
          label={syncing ? t('mobile.tasks.outboxSyncing') : t('mobile.tasks.outboxRetry')}
          onPress={onRetry}
          disabled={syncing}
          style={{ minHeight: theme.sizes.touch.min }}
        />
      </View>
    </SurfaceCard>
  );
}
