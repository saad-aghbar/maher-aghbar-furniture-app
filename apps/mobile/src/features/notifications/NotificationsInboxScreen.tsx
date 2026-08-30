import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { RefreshControl, SectionList, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { can, resolveAppSurface } from '@maher/permissions';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { BackButton } from '@/components/BackButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { AppScreen } from '@/components/layout/AppScreen';
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
  NOTIFICATION_LTR_TREE,
  notificationLeadEdge,
  notificationRowDirection,
  notificationStartAlign,
} from './notificationLayout';
import {
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation,
  useNotificationsQuery,
} from './query';
import {
  groupNotificationsByDay,
  normalizeNotificationList,
  selectNotificationCard,
} from './selectNotification';

const BACK_FALLBACK_ADMIN = '/(app)/(admin)/(tabs)' as Href;
const BACK_FALLBACK_CUSTOMER = '/(app)/(customer)/(tabs)' as Href;
const BACK_FALLBACK_EMPLOYEE = '/(app)/(employee)/(tabs)' as Href;

function backFallbackForSurface(surface: ReturnType<typeof resolveAppSurface>): Href {
  if (surface === 'customer') return BACK_FALLBACK_CUSTOMER;
  if (surface === 'employee') return BACK_FALLBACK_EMPLOYEE;
  return BACK_FALLBACK_ADMIN;
}

function NotificationsScreenTitle({
  titleWeight,
  showBack,
  backFallback,
}: {
  titleWeight: 'medium' | 'semibold';
  showBack: boolean;
  backFallback: Href;
}) {
  const { t, isRTL } = useLocale();
  const { theme } = useTheme();
  const onBack = useSmartBack(backFallback);
  const leadSize = theme.sizes.touch.min;

  return (
    <View style={{ minHeight: leadSize, justifyContent: 'center' }}>
      {showBack ? (
        <View
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            ...notificationLeadEdge(isRTL),
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
  backFallback,
  children,
}: {
  titleWeight: 'medium' | 'semibold';
  showBack: boolean;
  backFallback: Href;
  children: ReactNode;
}) {
  return (
    <AppScreen style={NOTIFICATION_LTR_TREE}>
      <NotificationsScreenTitle
        titleWeight={titleWeight}
        showBack={showBack}
        backFallback={backFallback}
      />
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
  const { t, tPlural, locale, isRTL, formatDate } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const { showOfflineBanner } = useNetwork();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const listBottomClearance = insets.bottom + SURFACE_TAB_BAR_CLEARANCE;
  const allowed = can(user, 'notification.read');
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const surface = user ? resolveAppSurface(user) : 'admin';
  const backFallback = backFallbackForSurface(surface);

  const [segment, setSegment] = useState<NotificationsSegment>('all');
  const animateEnterRef = useRef(true);
  const [animateEnter, setAnimateEnter] = useState(true);

  const query = useNotificationsQuery(allowed);
  const markOne = useMarkNotificationReadMutation();
  const markAll = useMarkAllNotificationsReadMutation();

  const rows = useMemo(
    () =>
      normalizeNotificationList(query.data).map((n) =>
        selectNotificationCard(n, locale, t('mobile.notifications.anOrder')),
      ),
    [locale, query.data, t],
  );

  const unreadTotal = useMemo(() => rows.filter((r) => r.unread).length, [rows]);

  const visibleRows = useMemo(
    () => (segment === 'unread' ? rows.filter((r) => r.unread) : rows),
    [rows, segment],
  );

  const sections = useMemo(
    () =>
      groupNotificationsByDay(visibleRows, (iso) =>
        formatDate(`${iso}T12:00:00.000Z`),
      ),
    [formatDate, visibleRows],
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
      <NotificationsShell titleWeight={titleWeight} showBack={showBack} backFallback={backFallback}>
        <EmptyState title={t('mobile.noModules')} description={t('mobile.noModulesHint')} />
      </NotificationsShell>
    );
  }

  if (query.isLoading && !query.data) {
    return (
      <NotificationsShell titleWeight={titleWeight} showBack={showBack} backFallback={backFallback}>
        <NotificationsListSkeleton />
      </NotificationsShell>
    );
  }

  if (query.isError && !query.data) {
    return (
      <NotificationsShell titleWeight={titleWeight} showBack={showBack} backFallback={backFallback}>
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
      ? tPlural('mobile.notifications.unreadCount', unreadTotal)
      : t('mobile.notifications.subtitle');

  return (
    <NotificationsShell titleWeight={titleWeight} showBack={showBack} backFallback={backFallback}>
      {showOfflineBanner ? <OfflineBanner /> : null}
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          flexGrow: 1,
          paddingBottom: listBottomClearance,
        }}
        ItemSeparatorComponent={() => <View style={{ height: theme.spacing.md }} />}
        refreshControl={
          <RefreshControl
            refreshing={Boolean(query.isRefetching && !query.isFetching)}
            onRefresh={() => void query.refetch()}
          />
        }
        ListHeaderComponent={
          <View style={{ gap: theme.spacing.md, marginBottom: theme.spacing.md }}>
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
                  flexDirection: notificationRowDirection(isRTL),
                  alignItems: 'center',
                  justifyContent: 'flex-start',
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
                  align="start"
                  style={{
                    flex: 1,
                    width: '100%',
                    textAlign: notificationStartAlign(isRTL),
                    letterSpacing: locale === 'ar' ? 0 : 0.45,
                    fontSize: 11,
                    color: colors.brand,
                    textTransform: 'none',
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
        renderSectionHeader={({ section }) => (
          <AppText
            variant="caption"
            weight={titleWeight}
            color="muted"
            align="start"
            style={{
              width: '100%',
              textAlign: notificationStartAlign(isRTL),
              marginTop: theme.spacing.xs,
              marginBottom: theme.spacing.xs,
              letterSpacing: locale === 'ar' ? 0 : 0.6,
              textTransform: 'none',
            }}
          >
            {section.label}
          </AppText>
        )}
        renderItem={({ item, index }) => (
          <ListItemEnter index={index} enabled={animateEnter}>
            <NotificationBoardCard
              item={item}
              onPress={() => {
                if (item.unread) {
                  markOne.mutate(item.id);
                }
                const href = mapNotificationLinkToHref(item.linkUrl, surface);
                if (href) router.push(href);
              }}
            />
          </ListItemEnter>
        )}
      />
    </NotificationsShell>
  );
}
