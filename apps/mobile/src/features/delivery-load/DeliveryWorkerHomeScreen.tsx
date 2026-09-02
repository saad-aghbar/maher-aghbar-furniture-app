import { Image, RefreshControl, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated from 'react-native-reanimated';
import { can } from '@maher/permissions';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { ScrollableScreen } from '@/components/layout/ScrollableScreen';
import { useNetwork } from '@/components/network/NetworkProvider';
import { resolveOrderMediaUri } from '@/features/sales-orders/components/OrderCardMedia';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { WorkerHomeHeader } from '@/features/worker-home/components/WorkerHomeHeader';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics, softFadeDown, useReducedMotion } from '@/motion';
import { useTheme } from '@/theme';
import type { DeliveryListItem } from '@/api/modules/deliveries';
import {
  DeliveryFloorOrderCard,
  deliveryDealerLabel,
  deliveryProductLabel,
} from './components/DeliveryFloorOrderCard';
import {
  DELIVERY_FLOOR_CHARCOAL,
  DELIVERY_FLOOR_CREAM,
  deliverySectionLabelStyle,
} from './deliveryFloorStyle';
import { useMyDeliveriesQuery } from './query';

const HERO_HEIGHT = 360;

function DeliveryCurrentHero({ item }: { item: DeliveryListItem }) {
  const { t, locale, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const router = useRouter();
  const reduce = useReducedMotion();
  const loaded = item.loadProgress?.loaded ?? 0;
  const total = item.loadProgress?.total ?? 0;
  const ratio = total > 0 ? Math.min(1, loaded / total) : 0;
  const href = `/(app)/(employee)/deliveries/${item.id}` as Href;
  const mediaUri = resolveOrderMediaUri(item.imageUrl);
  const productTitle = deliveryProductLabel(item, locale);
  const dealer = deliveryDealerLabel(item, locale);

  const open = () => {
    void haptics.selection();
    router.push(href);
  };

  return (
    <Animated.View
      entering={reduce ? undefined : softFadeDown(40)}
      style={{ marginBottom: theme.spacing.lg, gap: theme.spacing.sm }}
    >
      <AppText
        variant="caption"
        weight="semibold"
        style={{
          ...deliverySectionLabelStyle(locale, colors.textMuted),
          textAlign: isRTL ? 'right' : 'left',
        }}
      >
        {t('mobile.deliveryLoad.homeCurrent')}
      </AppText>

      <AnimatedPressable
        variant="card"
        onPress={open}
        style={{
          borderRadius: theme.radius.xl,
          overflow: 'hidden',
          backgroundColor: DELIVERY_FLOOR_CHARCOAL,
          borderWidth: 1,
          borderColor: colors.borderStrong,
          ...orderBoardShadow(colorScheme),
        }}
      >
        <View style={{ height: HERO_HEIGHT, width: '100%', justifyContent: 'flex-end' }}>
          {mediaUri ? (
            <Image
              source={{ uri: mediaUri }}
              style={{ position: 'absolute', width: '100%', height: '100%' }}
              resizeMode="cover"
              accessibilityIgnoresInvertColors
            />
          ) : (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: 0,
                bottom: 0,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: 0.28,
              }}
            >
              <Ionicons name="cube-outline" size={132} color={DELIVERY_FLOOR_CREAM} />
            </View>
          )}
          <View
            pointerEvents="none"
            style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
          >
            <View style={{ flex: 1, backgroundColor: 'rgba(20,18,16,0.12)' }} />
            <View style={{ height: '22%', backgroundColor: 'rgba(20,18,16,0.42)' }} />
            <View style={{ height: '38%', backgroundColor: 'rgba(20,18,16,0.94)' }} />
          </View>

          <View
            style={{
              padding: theme.spacing.lg,
              gap: theme.spacing.md,
              alignItems: isRTL ? 'flex-end' : 'flex-start',
            }}
          >
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                gap: 6,
                backgroundColor: 'rgba(20,18,16,0.72)',
                borderWidth: 1,
                borderColor: 'rgba(247,244,239,0.16)',
                paddingHorizontal: theme.spacing.sm + 2,
                paddingVertical: 6,
                borderRadius: theme.radius.full,
              }}
            >
              <Ionicons name="cube-outline" size={13} color={colors.brand} />
              <AppText
                variant="caption"
                weight="semibold"
                style={{ color: DELIVERY_FLOOR_CREAM, fontSize: 11 }}
              >
                {t('mobile.deliveryLoad.statusReady')}
              </AppText>
            </View>

            <View style={{ gap: theme.spacing.xs, width: '100%' }}>
              <AppText
                variant="title"
                weight="semibold"
                numberOfLines={2}
                align="start"
                style={{ color: DELIVERY_FLOOR_CREAM, fontSize: 24, lineHeight: 30 }}
              >
                {productTitle}
              </AppText>
              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  flexWrap: 'wrap',
                  gap: theme.spacing.sm,
                  alignItems: 'center',
                }}
              >
                <AppText
                  variant="bodySecondary"
                  align="start"
                  style={{ color: 'rgba(247,244,239,0.88)' }}
                >
                  {item.salesOrder?.number
                    ? t('mobile.deliveryLoad.orderLabel', {
                        number: item.salesOrder.number,
                      })
                    : item.number}
                </AppText>
                <AppText
                  variant="bodySecondary"
                  weight="semibold"
                  align="start"
                  style={{ color: colors.brand }}
                >
                  {dealer}
                </AppText>
              </View>
            </View>

            {total > 0 ? (
              <View
                style={{
                  width: '100%',
                  gap: 8,
                  backgroundColor: 'rgba(247,244,239,0.10)',
                  borderWidth: 1,
                  borderColor: 'rgba(247,244,239,0.14)',
                  borderRadius: theme.radius.lg,
                  paddingHorizontal: theme.spacing.md,
                  paddingVertical: theme.spacing.sm + 2,
                }}
              >
                <View
                  style={{
                    height: 7,
                    borderRadius: 4,
                    backgroundColor: 'rgba(247,244,239,0.16)',
                    overflow: 'hidden',
                  }}
                >
                  <View
                    style={{
                      width: `${Math.round(ratio * 100)}%`,
                      height: '100%',
                      backgroundColor: colors.brand,
                      borderRadius: 4,
                    }}
                  />
                </View>
                <AppText
                  variant="caption"
                  weight="semibold"
                  style={{ color: 'rgba(247,244,239,0.88)' }}
                >
                  {t('mobile.deliveryLoad.packagesProgress', { loaded, total })}
                </AppText>
              </View>
            ) : null}

            <PrimaryButton
              label={t('mobile.deliveryLoad.openLoadSheet')}
              onPress={open}
              style={{ alignSelf: 'stretch' }}
            />
          </View>
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
}

function DeliveryCurrentIdle() {
  const { t, locale, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const reduce = useReducedMotion();

  return (
    <Animated.View
      entering={reduce ? undefined : softFadeDown(40)}
      style={{ marginBottom: theme.spacing.lg, gap: theme.spacing.sm }}
    >
      <AppText
        variant="caption"
        weight="semibold"
        style={{
          ...deliverySectionLabelStyle(locale, colors.textMuted),
          textAlign: isRTL ? 'right' : 'left',
        }}
      >
        {t('mobile.deliveryLoad.homeCurrent')}
      </AppText>
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: theme.radius.xl,
          borderWidth: 1,
          borderColor: colors.borderStrong,
          overflow: 'hidden',
          ...theme.elevation.card,
        }}
      >
        <View style={{ height: 3, backgroundColor: colors.brand, opacity: 0.35 }} />
        <View
          style={{
            paddingVertical: theme.spacing['2xl'],
            paddingHorizontal: theme.spacing.lg,
            alignItems: 'center',
            gap: theme.spacing.sm,
          }}
        >
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 18,
              backgroundColor: colors.brandSoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="cube-outline" size={28} color={colors.brand} />
          </View>
          <AppText variant="heading" weight="semibold">
            {t('mobile.deliveryLoad.homeIdleTitle')}
          </AppText>
          <AppText variant="caption" color="secondary" style={{ textAlign: 'center' }}>
            {t('mobile.deliveryLoad.homeIdleBody')}
          </AppText>
        </View>
      </View>
    </Animated.View>
  );
}

export function DeliveryWorkerHomeScreen() {
  const { user } = useAuth();
  const { t, locale, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const { showOfflineBanner } = useNetwork();
  const router = useRouter();
  const canNotify = can(user, 'notification.read');
  const allowed = can(user, 'delivery.read');
  const displayName = user?.name ?? t('mobile.workerHome.fallbackName');
  const reduce = useReducedMotion();

  const openQuery = useMyDeliveriesQuery({ scope: 'open', pageSize: 8 }, allowed);
  const doneQuery = useMyDeliveriesQuery({ scope: 'completed', pageSize: 5 }, allowed);

  if (!allowed) {
    return (
      <ScrollableScreen>
        <WorkerHomeHeader
          userName={displayName}
          unreadNotifications={0}
          canOpenNotifications={canNotify}
        />
        <EmptyState title={t('mobile.noModules')} description={t('mobile.noModulesHint')} />
      </ScrollableScreen>
    );
  }

  if (openQuery.isLoading && !openQuery.data) {
    return (
      <ScrollableScreen>
        <WorkerHomeHeader
          userName={displayName}
          unreadNotifications={0}
          canOpenNotifications={canNotify}
        />
        <AppText variant="body" color="secondary" style={{ padding: theme.spacing.xl }}>
          {t('mobile.deliveryLoad.loading')}
        </AppText>
      </ScrollableScreen>
    );
  }

  if (openQuery.isError && !openQuery.data) {
    return (
      <ScrollableScreen>
        {showOfflineBanner ? <OfflineBanner /> : null}
        <WorkerHomeHeader
          userName={displayName}
          unreadNotifications={0}
          canOpenNotifications={canNotify}
        />
        <ErrorState
          title={t('mobile.deliveryLoad.errorTitle')}
          description={t('mobile.deliveryLoad.errorBody')}
          retryLabel={t('mobile.deliveryLoad.retry')}
          onRetry={() => void openQuery.refetch()}
        />
      </ScrollableScreen>
    );
  }

  const open = openQuery.data?.data ?? [];
  const hero = open[0] ?? null;
  const upcoming = open.slice(1);
  const shippedCount = (doneQuery.data?.data ?? []).length;
  const truckLoaded = open.reduce((sum, d) => sum + (d.loadProgress?.loaded ?? 0), 0);
  const truckTotal = open.reduce((sum, d) => sum + (d.loadProgress?.total ?? 0), 0);

  return (
    <ScrollableScreen
      padding="md"
      scrollProps={{
        refreshControl: (
          <RefreshControl
            refreshing={openQuery.isRefetching && !openQuery.isLoading}
            onRefresh={() => {
              void openQuery.refetch();
              void doneQuery.refetch();
            }}
            tintColor={colors.brand}
          />
        ),
      }}
    >
      {showOfflineBanner ? <OfflineBanner /> : null}
      <WorkerHomeHeader
        userName={displayName}
        unreadNotifications={0}
        canOpenNotifications={canNotify}
        />

      <View style={{ gap: theme.spacing.xl }}>
        {open.length > 1 && truckTotal > 0 ? (
          <View
            style={{
              borderRadius: theme.radius.lg,
              borderWidth: 1,
              borderColor: colors.borderStrong,
              backgroundColor: colors.surfaceSecondary,
              paddingHorizontal: theme.spacing.md,
              paddingVertical: theme.spacing.sm + 2,
              gap: 2,
              alignItems: isRTL ? 'flex-end' : 'flex-start',
            }}
          >
            <AppText
              variant="caption"
              weight="semibold"
              style={deliverySectionLabelStyle(locale, colors.brand)}
            >
              {t('mobile.deliveryLoad.truckRunEyebrow')}
            </AppText>
            <AppText variant="body" weight="semibold" align="start">
              {t('mobile.deliveryLoad.truckRunProgress', {
                loaded: truckLoaded,
                total: truckTotal,
              })}
            </AppText>
            <AppText variant="caption" color="muted" align="start">
              {t('mobile.deliveryLoad.truckRunHint')}
            </AppText>
          </View>
        ) : null}

        {hero ? <DeliveryCurrentHero item={hero} /> : <DeliveryCurrentIdle />}

        {upcoming.length > 0 ? (
          <Animated.View
            entering={reduce ? undefined : softFadeDown(80)}
            style={{ gap: theme.spacing.md }}
          >
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'flex-end',
                justifyContent: 'space-between',
                gap: theme.spacing.md,
              }}
            >
              <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
                <AppText
                  variant="caption"
                  weight="semibold"
                  style={deliverySectionLabelStyle(locale, colors.brand)}
                >
                  {t('mobile.deliveryLoad.homeUpcomingEyebrow')}
                </AppText>
                <View
                  style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    alignItems: 'center',
                    gap: theme.spacing.sm,
                    flexWrap: 'wrap',
                  }}
                >
                  <AppText variant="title" weight="semibold" align="start">
                    {t('mobile.deliveryLoad.homeUpcoming')}
                  </AppText>
                  <View
                    style={{
                      minWidth: 28,
                      height: 28,
                      borderRadius: 14,
                      paddingHorizontal: 8,
                      backgroundColor: colors.brandSoft,
                      borderWidth: 1,
                      borderColor: colors.brand,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <AppText
                      variant="caption"
                      weight="semibold"
                      style={{ color: colors.brand, fontVariant: ['tabular-nums'] }}
                    >
                      {String(upcoming.length)}
                    </AppText>
                  </View>
                </View>
              </View>
              <AnimatedPressable
                variant="button"
                onPress={() => {
                  void haptics.selection();
                  router.push('/(app)/(employee)/(tabs)/tasks' as Href);
                }}
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <AppText variant="caption" weight="semibold" color="brand">
                  {t('mobile.deliveryLoad.viewAll')}
                </AppText>
                <Ionicons
                  name={isRTL ? 'chevron-back' : 'chevron-forward'}
                  size={14}
                  color={colors.brand}
                />
              </AnimatedPressable>
            </View>

            <View style={{ gap: 0 }}>
              {upcoming.map((item, index) => (
                <DeliveryFloorOrderCard
                  key={item.id}
                  item={item}
                  index={index}
                  animateEnter={false}
                />
              ))}
            </View>
          </Animated.View>
        ) : null}

        <Animated.View entering={reduce ? undefined : softFadeDown(100)}>
          <AnimatedPressable
            variant="card"
            onPress={() => {
              void haptics.selection();
              router.push('/(app)/(employee)/(tabs)/completed' as Href);
            }}
            style={{
              borderRadius: theme.radius.xl,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.borderStrong,
              overflow: 'hidden',
              ...orderBoardShadow(colorScheme),
            }}
          >
            <View style={{ height: 3, backgroundColor: colors.success, opacity: 0.45 }} />
            <View
              style={{
                padding: theme.spacing.lg,
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                gap: theme.spacing.md,
              }}
            >
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 16,
                  backgroundColor: colors.successSoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="navigate-outline" size={24} color={colors.success} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <AppText
                  variant="caption"
                  weight="semibold"
                  style={deliverySectionLabelStyle(locale, colors.success)}
                >
                  {t('mobile.deliveryLoad.homeShippedHint')}
                </AppText>
                <AppText variant="title" weight="semibold" align="start">
                  {t('mobile.deliveryLoad.homeShippedCount', { count: shippedCount })}
                </AppText>
              </View>
              <Ionicons
                name={isRTL ? 'chevron-back' : 'chevron-forward'}
                size={18}
                color={colors.textMuted}
              />
            </View>
          </AnimatedPressable>
        </Animated.View>
      </View>
    </ScrollableScreen>
  );
}
