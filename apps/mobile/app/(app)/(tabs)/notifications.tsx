import { localizedBody, localizedName } from '@maher/i18n';
import { BellOff } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { apiFetch } from '../../../src/api/client';
import { useAction, useArrayQuery } from '../../../src/api/hooks';
import { formatDateTime } from '../../../src/lib/format';
import { useI18n } from '../../../src/providers/i18n-provider';
import { colors, spacing } from '../../../src/theme/tokens';
import {
  Button,
  EmptyState,
  ErrorState,
  ListRow,
  ListSkeleton,
  Screen,
  ScreenHeader,
} from '../../../src/ui';

type NotificationRow = {
  id: string;
  titleEn: string;
  titleAr: string;
  bodyEn: string;
  bodyAr: string;
  readAt: string | null;
  createdAt: string;
};

export default function NotificationsScreen() {
  const { t, locale } = useI18n();
  const query = useArrayQuery<NotificationRow>(['notifications'], '/notifications');

  const markRead = useAction(
    (id: string) => apiFetch(`/notifications/${id}/read`, { method: 'POST' }),
    [['notifications']],
  );
  const markAllRead = useAction(
    () => apiFetch('/notifications/read-all', { method: 'POST' }),
    [['notifications']],
  );

  const unread = query.rows.filter((n) => !n.readAt).length;

  return (
    <Screen refreshing={query.isFetching} onRefresh={() => void query.refetch()}>
      <ScreenHeader
        title={t('navigation.notifications', 'Notifications')}
        subtitle={
          unread > 0
            ? `${unread} ${t('mobile.unread', 'unread')}`
            : t('mobile.allCaughtUp', 'All caught up')
        }
        actions={
          unread > 0 ? (
            <Button
              label={t('mobile.markAllRead', 'Mark all read')}
              variant="secondary"
              size="sm"
              loading={markAllRead.isPending}
              onPress={() => markAllRead.mutate()}
            />
          ) : undefined
        }
      />

      {query.isLoading ? (
        <ListSkeleton />
      ) : query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} />
      ) : query.rows.length === 0 ? (
        <EmptyState
          icon={<BellOff size={40} color={colors.textTertiary} />}
          title={t('common.noNotifications', 'No notifications')}
          description={t('mobile.noNotificationsHint', 'Updates about your work appear here.')}
        />
      ) : (
        <View style={styles.list}>
          {query.rows.map((item) => (
            <ListRow
              key={item.id}
              title={localizedName(locale, item)}
              description={localizedBody(locale, item)}
              meta={formatDateTime(item.createdAt)}
              accent={item.readAt ? undefined : colors.brand}
              onPress={item.readAt ? undefined : () => markRead.mutate(item.id)}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
});
