import { useEffect, useMemo, type ReactNode } from 'react';
import { FlatList, Image, RefreshControl, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Easing,
  FadeInDown,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { EmptyState } from '@/components/feedback/EmptyState';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics, useReducedMotion } from '@/motion';
import { useTheme } from '@/theme';
import { SURFACE_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import { pickHotOrder, type HotOrderCandidate } from '../pickHotOrder';
import {
  countOrderStages,
  filterByStageFocus,
  toggleStageFocus,
  type OrdersStageFocus,
  type OrdersStageKey,
} from '../stageCounts';
import type { AdminOrderCardModel, DealerOrderCardModel, OrdersListVariant } from '../selectOrderCard';
import { OrdersCompositionChrome } from './OrdersCompositionChrome';
import { OrdersListSkeleton } from './OrdersListSkeleton';
import { resolveOrderMediaUri } from './OrderCardMedia';
import { OrdersQuietRow } from './OrdersQuietRow';

type Props = {
  variant: OrdersListVariant;
  adminItems: AdminOrderCardModel[];
  dealerItems: DealerOrderCardModel[];
  stageFocus: OrdersStageFocus;
  onStageFocusChange: (next: OrdersStageFocus) => void;
  searchInput: string;
  setSearchInput: (v: string) => void;
  onOpenFilters: () => void;
  filterActiveCount?: number;
  refreshing: boolean;
  onRefresh: () => void;
  onEndReached: () => void;
  isFetchingNextPage: boolean;
  onPressItem: (id: string, kind?: 'order' | 'rfq') => void;
  banner?: ReactNode;
};

const LANE_KEYS: OrdersStageKey[] = ['pending', 'production', 'ready'];

export function OrdersWorkbenchHome({
  variant,
  adminItems,
  dealerItems,
  stageFocus,
  onStageFocusChange,
  searchInput,
  setSearchInput,
  onOpenFilters,
  filterActiveCount = 0,
  refreshing,
  onRefresh,
  onEndReached,
  isFetchingNextPage,
  onPressItem,
  banner,
}: Props) {
  const { t, formatCurrency, formatDate, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const reduce = useReducedMotion();

  const allCandidates: HotOrderCandidate[] = useMemo(() => {
    if (variant === 'dealer') {
      return dealerItems.map((o) => ({
        id: o.id,
        number: o.number,
        status: o.status,
        title: o.title,
        imageUrl: o.imageUrl,
        progressPercent: o.progressPercent,
        deliveryDate: o.deliveryDate,
        sellerPrice: o.sellerPrice,
        kind: o.kind,
      }));
    }
    return adminItems.map((o) => ({
      id: o.id,
      number: o.number,
      status: o.status,
      title: o.title,
      imageUrl: o.imageUrl,
      progressPercent: o.progressPercent,
      deliveryDate: o.deliveryDate,
      priority: o.priority,
      dealerName: o.dealerName,
      sellerPrice: o.sellerPrice,
      kind: o.kind ?? 'order',
    }));
  }, [adminItems, dealerItems, variant]);

  // Lane counts follow the filtered list; cards stay mounted so the board doesn’t jump.
  const counts = useMemo(
    () =>
      countOrderStages(
        allCandidates.map((o) => ({ status: o.status, deliveryDate: o.deliveryDate })),
      ),
    [allCandidates],
  );

  const focused = useMemo(
    () => filterByStageFocus(allCandidates, stageFocus),
    [allCandidates, stageFocus],
  );

  const hot = useMemo(() => pickHotOrder(focused), [focused]);
  const browse = useMemo(
    () =>
      focused.filter(
        (c) => !hot || c.id !== hot.id || (c.kind ?? 'order') !== (hot.kind ?? 'order'),
      ),
    [focused, hot],
  );

  const header = (
    <View style={{ gap: theme.spacing.lg }}>
      {banner}
      <OrdersCompositionChrome
        title={t('mobile.orders.title')}
        searchInput={searchInput}
        setSearchInput={setSearchInput}
        onOpenFilters={onOpenFilters}
        filterActiveCount={filterActiveCount}
      />
      <WorkbenchHotPanel
        hot={hot}
        variant={variant}
        reduce={reduce}
        onPress={() => {
          if (!hot) return;
          onPressItem(hot.id, hot.kind);
        }}
        formatCurrency={formatCurrency}
        formatDate={formatDate}
      />
      <View style={{ gap: theme.spacing.sm }}>
        <AppText
          variant="caption"
          weight="semibold"
          style={{ color: colors.brand }}
        >
          {t('mobile.orders.workbenchLanesEyebrow')}
        </AppText>
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            justifyContent: 'space-between',
            gap: theme.spacing.xs,
          }}
        >
          {LANE_KEYS.map((key) => {
            const { tint, soft } = laneTint(colors, key);
            const active = stageFocus === key;
            return (
              <AnimatedPressable
                key={key}
                variant="button"
                onPress={() => {
                  void haptics.selection();
                  onStageFocusChange(toggleStageFocus(stageFocus, key));
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={{
                  flex: 1,
                  paddingHorizontal: theme.spacing.xs,
                  paddingVertical: theme.spacing.sm,
                  borderRadius: theme.radius.md,
                  borderWidth: 1,
                  borderColor: active ? tint : colors.border,
                  backgroundColor: active ? soft : colors.surface,
                  alignItems: 'center',
                  gap: 2,
                }}
              >
                <AppText
                  variant="label"
                  weight="semibold"
                  dir="ltr"
                  style={{ color: tint, fontVariant: ['tabular-nums'] }}
                >
                  {String(counts[key])}
                </AppText>
                <AppText
                  variant="caption"
                  color="secondary"
                  numberOfLines={2}
                  align="center"
                  maxFontSizeMultiplier={1.1}
                  style={{
                    fontSize: isRTL ? 10 : 11,
                    lineHeight: isRTL ? 13 : 14,
                    textAlign: 'center',
                  }}
                >
                  {t(`mobile.orders.stages.${key}`)}
                </AppText>
              </AnimatedPressable>
            );
          })}
        </View>
      </View>
      <AppText variant="title" weight="semibold">
        {t('mobile.orders.workbenchBrowseTitle')}
      </AppText>
    </View>
  );

  return (
    <FlatList
      data={browse}
      keyExtractor={(item) => (item.kind === 'rfq' ? `rfq-${item.id}` : item.id)}
      ListHeaderComponent={header}
      contentContainerStyle={{
        paddingHorizontal: theme.spacing.lg,
        paddingBottom: theme.spacing['3xl'] + SURFACE_TAB_BAR_CLEARANCE,
        flexGrow: 1,
      }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />
      }
      onEndReached={onEndReached}
      onEndReachedThreshold={0.4}
      ListEmptyComponent={
        !hot ? (
          <EmptyState
            title={t('mobile.orders.emptyTitle')}
            description={t('mobile.orders.emptyBody')}
          />
        ) : null
      }
      ListFooterComponent={
        isFetchingNextPage ? (
          <View style={{ paddingVertical: theme.spacing.lg }}>
            <OrdersListSkeleton />
          </View>
        ) : null
      }
      renderItem={({ item, index }) => (
        <OrdersQuietRow
          order={item}
          index={index}
          onPress={() => onPressItem(item.id, item.kind)}
        />
      )}
    />
  );
}

function laneTint(
  colors: ReturnType<typeof useTheme>['colors'],
  key: OrdersStageKey,
) {
  switch (key) {
    case 'pending':
      return { tint: colors.brand, soft: colors.brandSoft };
    case 'production':
      return { tint: colors.success, soft: colors.successSoft };
    case 'ready':
      return { tint: colors.warning, soft: colors.warningSoft };
  }
}

function WorkbenchHotPanel({
  hot,
  variant,
  reduce,
  onPress,
  formatCurrency,
  formatDate,
}: {
  hot: HotOrderCandidate | null;
  variant: OrdersListVariant;
  reduce: boolean;
  onPress: () => void;
  formatCurrency: (n: number) => string;
  formatDate: (iso: string) => string;
}) {
  const { t, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const stamp = useSharedValue(reduce ? 1 : 0);
  const rise = useSharedValue(reduce ? 1 : 0);
  const sheen = useSharedValue(0);

  useEffect(() => {
    if (reduce || !hot) {
      stamp.value = 1;
      rise.value = 1;
      return;
    }
    rise.value = 0;
    stamp.value = 0;
    sheen.value = 0;
    rise.value = withDelay(60, withSpring(1, { damping: 26, stiffness: 120 }));
    stamp.value = withDelay(160, withSpring(1, { damping: 24, stiffness: 130 }));
    sheen.value = withDelay(
      380,
      withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) }),
    );
  }, [hot?.id, reduce, rise, sheen, stamp]);

  const stampStyle = useAnimatedStyle(() => ({
    opacity: stamp.value,
    transform: [
      { scale: interpolate(stamp.value, [0, 1], [0.88, 1]) },
      { rotate: `${interpolate(stamp.value, [0, 1], [isRTL ? 4 : -4, 0])}deg` },
    ],
  }));
  const riseStyle = useAnimatedStyle(() => ({
    opacity: rise.value,
    transform: [{ translateY: interpolate(rise.value, [0, 1], [14, 0]) }],
  }));
  const sheenStyle = useAnimatedStyle(() => ({
    opacity: interpolate(sheen.value, [0, 0.35, 0.7, 1], [0, 0.22, 0.12, 0]),
    transform: [
      {
        translateX: interpolate(sheen.value, [0, 1], isRTL ? [140, -200] : [-140, 200]),
      },
    ],
  }));

  if (!hot) return null;

  const ink = colorScheme === 'dark' ? colors.surface : '#2A2425';
  const inkText = colorScheme === 'dark' ? colors.textPrimary : '#F5F1EA';
  const inkMuted = colorScheme === 'dark' ? colors.textMuted : '#CACBCC';

  const Shell = reduce ? View : Animated.View;
  const shellProps = reduce
    ? {}
    : { entering: FadeInDown.delay(40).duration(420).damping(22) };

  return (
    <Shell {...shellProps} style={{ gap: theme.spacing.sm }}>
      <AppText
        variant="caption"
        weight="semibold"
        style={{
          color: colors.brand,
          ...(isRTL ? null : { letterSpacing: 1.4, textTransform: 'uppercase' as const }),
        }}
      >
        {t('mobile.orders.workbenchHotEyebrow')}
      </AppText>
      <AnimatedPressable
        variant="card"
        onPress={() => {
          void haptics.selection();
          onPress();
        }}
        style={{
          borderRadius: theme.radius.xl,
          backgroundColor: ink,
          overflow: 'hidden',
          padding: theme.spacing.lg,
          gap: theme.spacing.md,
          ...theme.elevation.raised,
        }}
      >
        {!reduce ? (
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: 'absolute',
                top: 0,
                bottom: 0,
                width: 56,
                backgroundColor: inkText,
              },
              sheenStyle,
            ]}
          />
        ) : null}
        <Animated.View
          style={[
            {
              flexDirection: isRTL ? 'row-reverse' : 'row',
              gap: theme.spacing.md,
              alignItems: 'center',
            },
            riseStyle,
          ]}
        >
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: theme.radius.md,
              backgroundColor: 'rgba(245,241,234,0.12)',
              overflow: 'hidden',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {resolveOrderMediaUri(hot.imageUrl) ? (
              <Image
                source={{ uri: resolveOrderMediaUri(hot.imageUrl)! }}
                style={{ width: '100%', height: '100%' }}
                accessibilityIgnoresInvertColors
              />
            ) : (
              <AppText style={{ color: inkMuted }}>···</AppText>
            )}
          </View>
          <View style={{ flex: 1, gap: 6, alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
            <StatusBadge status={hot.status} />
            <Animated.View style={stampStyle}>
              <AppText
                variant="title"
                weight="semibold"
                dir="ltr"
                style={{ color: inkText }}
                numberOfLines={1}
              >
                {hot.number}
              </AppText>
            </Animated.View>
            <AppText style={{ color: inkText }} numberOfLines={2}>
              {hot.title}
            </AppText>
            {variant === 'admin' && hot.dealerName ? (
              <AppText
                style={[{ color: inkMuted }, isRTL ? { fontSize: 11, lineHeight: 15 } : null]}
                numberOfLines={1}
              >
                {hot.dealerName}
              </AppText>
            ) : null}
            {variant === 'dealer' && hot.sellerPrice != null ? (
              <AppText style={{ color: inkMuted }} dir="ltr">
                {formatCurrency(hot.sellerPrice)}
              </AppText>
            ) : null}
            {hot.deliveryDate ? (
              <AppText style={[{ color: inkMuted }, isRTL ? { fontSize: 10 } : null]}>
                {formatDate(hot.deliveryDate)}
              </AppText>
            ) : null}
          </View>
          <Ionicons name={isRTL ? 'arrow-back' : 'arrow-forward'} size={22} color={inkText} />
        </Animated.View>
      </AnimatedPressable>
    </Shell>
  );
}
