import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { can } from '@maher/permissions';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { BackButton } from '@/components/BackButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { AppScreen } from '@/components/layout/AppScreen';
import { Divider } from '@/components/layout/Divider';
import { useNetwork } from '@/components/network/NetworkProvider';
import { useLocale } from '@/i18n';
import { ListItemEnter, haptics } from '@/motion';
import { useSmartBack } from '@/navigation/useSmartBack';
import { useTheme } from '@/theme';
import { SURFACE_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { NotificationBoardCard } from './components/NotificationBoardCard';
import { NotificationsListSkeleton } from './components/NotificationsListSkeleton';
import {
  NotificationsSegmentRail,
  type NotificationsSegment,
} from './components/NotificationsSegmentRail';
import { mapNotificationLinkToHref } from './linkHref';
import {
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation,
  useNotificationsQuery,
} from './query';
import {
  normalizeNotificationList,
  selectNotificationCard,
} from './selectNotification';

const BACK_FALLBACK = '/(app)/(admin)/(tabs)' as Href;

function NotificationsScreenTitle({
  titleWeight,
  showBack,
}: {
  titleWeight: 'medium' | 'semibold';
  showBack: boolean;
}) {
  const { t, isRTL } = useLocale();
  const { theme } = useTheme();
  const onBack = useSmartBack(BACK_FALLBACK);
  const leadSize = theme.sizes.touch.min;

  return (
    <View style={{ minHeight: leadSize, justifyContent: 'center' }}>
      {showBack ? (
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
      ) : null}
      <AppText
        variant="largeTitle"
        weight={titleWeight}
        align={showBack ? 'center' : isRTL ? 'end' : 'start'}
        numberOfLines={1}
        style={{ paddingHorizontal: showBack ? leadSize + theme.spacing.sm : 0 }}
      >
        {t('mobile.notifications.title')}
      </AppText>
    </View>
  );
}

function NotificationsShell({
  titleWeight,
  showBack,
  children,
}: {
  titleWeight: 'medium' | 'semibold';
  showBack: boolean;
  children: ReactNode;
}) {
  return (
    <AppScreen>
      <NotificationsScreenTitle titleWeight={titleWeight} showBack={showBack} />
      {children}
    </AppScreen>
  );
}

type NotificationsInboxScreenProps = {
  /** When true (employee tab), hide stack back chrome — tab bar owns navigation. */
  embeddedInTabs?: boolean;
};

export function NotificationsInboxScreen({
  embeddedInTabs = false,
}: NotificationsInboxScreenProps = {}) {
  const { user } = useAuth();
  const { t, locale, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const { showOfflineBanner } = useNetwork();
  const router = useRouter();
  const allowed = can(user, 'notification.read');
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  const [segment, setSegment] = useState<NotificationsSegment>('all');
  const animateEnterRef = useRef(true);
  const [animateEnter, setAnimateEnter] = useState(true);

  const query = useNotificationsQuery(allowed);
  const markOne = useMarkNotificationReadMutation();
  const markAll = useMarkAllNotificationsReadMutation();

  const rows = useMemo(
    () =>
      normalizeNotificationList(query.data).map((n) =>
        selectNotificationCard(n, locale),
      ),
    [locale, query.data],
  );

  const unreadTotal = useMemo(() => rows.filter((r) => r.unread).length, [rows]);

  const visibleRows = useMemo(
    () => (segment === 'unread' ? rows.filter((r) => r.unread) : rows),
    [rows, segment],
  );

  useEffect(() => {
    if (!animateEnterRef.current) return;
    if (rows.length === 0) return;
    animateEnterRef.current = false;
    const id = setTimeout(() => setAnimateEnter(false), 900);
    return () => clearTimeout(id);
  }, [rows.length]);

  const showBack = !embeddedInTabs;

  if (!allowed) {
    return (
      <NotificationsShell titleWeight={titleWeight} showBack={showBack}>
        <EmptyState title={t('mobile.noModules')} description={t('mobile.noModulesHint')} />
      </NotificationsShell>
    );
  }

  if (query.isLoading && !query.data) {
    return (
      <NotificationsShell titleWeight={titleWeight} showBack={showBack}>
        <NotificationsListSkeleton />
      </NotificationsShell>
    );
  }

  if (query.isError && !query.data) {
    return (
      <NotificationsShell titleWeight={titleWeight} showBack={showBack}>
        {showOfflineBanner ? <OfflineBanner /> : null}
        <ErrorState
          title={t('mobile.notifications.errorTitle')}
          description={t('mobile.notifications.errorBody')}
          retryLabel={t('mobile.notifications.retry')}
          onRetry={() => void query.refetch()}
        />
      </NotificationsShell>
    );
  }

  const statusLine =
    unreadTotal > 0
      ? t('mobile.notifications.unreadCount', { count: unreadTotal })
      : t('mobile.notifications.subtitle');

  return (
    <NotificationsShell titleWeight={titleWeight} showBack={showBack}>
      {showOfflineBanner ? <OfflineBanner /> : null}
      <FlatList
        data={visibleRows}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          gap: theme.spacing.md,
          flexGrow: 1,
          paddingBottom: theme.spacing['3xl'] + SURFACE_TAB_BAR_CLEARANCE,
        }}
        refreshControl={
          <RefreshControl
            refreshing={Boolean(query.isRefetching && !query.isFetching)}
            onRefresh={() => void query.refetch()}
          />
        }
        ListHeaderComponent={
          <View style={{ gap: theme.spacing.md, marginBottom: theme.spacing.xs }}>
            <View
              style={{
                borderRadius: theme.radius.xl,
                borderWidth: 1,
                borderColor: colors.borderStrong,
                backgroundColor: colors.surface,
                overflow: 'hidden',
                ...orderBoardShadow(colorScheme),
              }}
            >
              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: theme.spacing.sm,
                  paddingHorizontal: theme.spacing.md,
                  paddingVertical: theme.spacing.sm + 2,
                  backgroundColor: colors.surfaceSecondary,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                }}
              >
                <AppText
                  variant="caption"
                  weight={titleWeight}
                  style={{
                    flex: 1,
                    textAlign: isRTL ? 'right' : 'left',
                    letterSpacing: locale === 'ar' ? 0 : 0.45,
                    textTransform: locale === 'ar' ? 'none' : 'uppercase',
                    fontSize: 11,
                    color: colors.brand,
                  }}
                >
                  {statusLine}
                </AppText>
              </View>

              <View style={{ padding: theme.spacing.md, gap: theme.spacing.md }}>
                <NotificationsSegmentRail
                  value={segment}
                  onChange={setSegment}
                  unreadCount={unreadTotal}
                />
                {unreadTotal > 0 ? (
                  <SecondaryButton
                    label={t('mobile.notifications.markAllRead')}
                    loading={markAll.isPending}
                    onPress={() => {
                      markAll.mutate(undefined, {
                        onSuccess: () => void haptics.confirmMedium(),
                      });
                    }}
                    style={{
                      borderRadius: theme.radius.full,
                      minHeight: theme.sizes.touch.min,
                      paddingVertical: 0,
                    }}
                  />
                ) : null}
              </View>
            </View>

            <Divider />
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            title={
              segment === 'unread'
                ? t('mobile.notifications.emptyUnreadTitle')
                : t('mobile.notifications.emptyTitle')
            }
            description={
              segment === 'unread'
                ? t('mobile.notifications.emptyUnreadBody')
                : t('mobile.notifications.emptyBody')
            }
          />
        }
        renderItem={({ item, index }) => (
          <ListItemEnter index={index} enabled={animateEnter}>
            <NotificationBoardCard
              item={item}
              onPress={() => {
                if (item.unread) {
                  markOne.mutate(item.id);
                }
                const href = mapNotificationLinkToHref(item.linkUrl);
                if (href) router.push(href);
              }}
            />
          </ListItemEnter>
        )}
      />
    </NotificationsShell>
  );
}
