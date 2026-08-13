import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { SurfaceCard } from '@/components/surfaces/SurfaceCard';
import { useLocale } from '@/i18n';
import { ListItemEnter } from '@/motion';
import { useTheme } from '@/theme';
import type { AdminHomeActivity } from '../api';
import { activityLabel } from '../activityLabel';

type RecentActivityListProps = {
  activity: AdminHomeActivity[] | null;
};

export function RecentActivityList({ activity }: RecentActivityListProps) {
  const { t, formatDateTime } = useLocale();
  const { theme } = useTheme();

  if (activity == null) return null;

  return (
    <View style={{ marginBottom: theme.spacing.xl, gap: theme.spacing.md }}>
      <SectionHeader title={t('mobile.adminHome.recentActivityTitle')} />
      {activity.length === 0 ? (
        <AppText variant="bodySecondary" color="secondary">
          {t('mobile.adminHome.activityEmpty')}
        </AppText>
      ) : (
        activity.map((row, index) => (
          <ListItemEnter key={row.id} index={index}>
            <SurfaceCard>
              <View style={{ gap: theme.spacing.xs }}>
                <AppText variant="label" weight="medium" numberOfLines={2}>
                  {activityLabel(t, row.action, row.entityType)}
                </AppText>
                <AppText variant="caption" color="secondary">
                  {row.actorName ? `${row.actorName} · ` : ''}
                  {formatDateTime(row.createdAt)}
                </AppText>
              </View>
            </SurfaceCard>
          </ListItemEnter>
        ))
      )}
    </View>
  );
}
