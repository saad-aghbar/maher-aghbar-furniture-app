import { useMemo, type ReactNode } from 'react';
import { SectionList, RefreshControl, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { EmptyState } from '@/components/feedback/EmptyState';
import { useLocale } from '@/i18n';
import { useReducedMotion } from '@/motion';
import { useTheme } from '@/theme';
import { SURFACE_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import { groupOrdersByDay, type LedgerBucketKey } from '../groupOrdersByDay';
import type { AdminOrderCardModel, DealerOrderCardModel, OrdersListVariant } from '../selectOrderCard';
import type { StatusChipKey } from './OrdersFilterChips';
import { OrdersCompositionChrome } from './OrdersCompositionChrome';
import { OrdersListSkeleton } from './OrdersListSkeleton';
import { OrdersQuietRow } from './OrdersQuietRow';
import { orderBoardShadow } from './orderFloorStyle';

type StreamItem = {
  id: string;
  number: string;
  status: string;
  title: string;
  imageUrl: string | null;
  deliveryDate: string | null;
  kind?: 'order' | 'rfq';
};

type Props = {
  variant: OrdersListVariant;
  adminItems: AdminOrderCardModel[];
  dealerItems: DealerOrderCardModel[];
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
  /** Unused on ledger — kept so parent can share props with pipeline/workbench. */
  stageFocus?: unknown;
  onStageFocusChange?: unknown;
  statusChip?: StatusChipKey;
  onStatusChipChange?: (v: StatusChipKey) => void;
};

function ledgerMeta(
  bucket: LedgerBucketKey,
  colors: ReturnType<typeof useTheme>['colors'],
): { accent: string; soft: string; icon: keyof typeof Ionicons.glyphMap } {
  switch (bucket) {
    case 'today':
      return { accent: colors.brand, soft: colors.brandSoft, icon: 'sunny-outline' };
    case 'past':
      return { accent: colors.warning, soft: colors.warningSoft, icon: 'time-outline' };
    case 'tomorrow':
      return { accent: colors.info, soft: colors.infoSoft, icon: 'calendar-outline' };
    case 'later':
      return { accent: colors.success, soft: colors.successSoft, icon: 'arrow-forward-outline' };
    default:
      return { accent: colors.textSecondary, soft: colors.surfaceSecondary, icon: 'help-circle-outline' };
  }
}

export function OrdersLedgerHome({
  variant,
  adminItems,
  dealerItems,
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
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const reduce = useReducedMotion();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  const stream: StreamItem[] = useMemo(() => {
    if (variant === 'dealer') {
      return dealerItems.map((o) => ({
        id: o.id,
        number: o.number,
        status: o.status,
        title: o.title,
        imageUrl: o.imageUrl,
        deliveryDate: o.deliveryDate,
        kind: o.kind,
      }));
    }
    return adminItems.map((o) => ({
      id: o.id,
      number: o.number,
      status: o.status,
      title: o.title,
      imageUrl: o.imageUrl,
      deliveryDate: o.deliveryDate,
      kind: o.kind ?? 'order',
    }));
  }, [adminItems, dealerItems, variant]);

  const sections = useMemo(() => {
    const groups = groupOrdersByDay(stream);
    return groups.map((g) => ({
      key: g.key,
      title: t(`mobile.orders.ledger.${g.key}`),
      data: g.items,
    }));
  }, [stream, t]);

  const header = (
    <View style={{ gap: theme.spacing.md, paddingBottom: theme.spacing.md }}>
      {banner}
      <OrdersCompositionChrome
        title={t('mobile.orders.title')}
        searchInput={searchInput}
        setSearchInput={setSearchInput}
        onOpenFilters={onOpenFilters}
        filterActiveCount={filterActiveCount}
      >
        <View
          style={{
            borderRadius: theme.radius.xl,
            borderWidth: 1,
            borderColor: colors.borderStrong,
            backgroundColor: colors.surface,
            overflow: 'hidden',
            padding: theme.spacing.md,
            gap: theme.spacing.xs,
            ...orderBoardShadow(colorScheme),
          }}
        >
          <View
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              ...(isRTL ? { right: 0 } : { left: 0 }),
              width: 3,
              backgroundColor: colors.brand,
              opacity: 0.5,
            }}
          />
          <AppText
            variant="caption"
            weight={titleWeight}
            style={{
              letterSpacing: locale === 'ar' ? 0 : 1.2,
              textTransform: locale === 'ar' ? 'none' : 'uppercase',
              color: colors.brand,
              fontSize: 11,
              lineHeight: 14,
              ...(isRTL ? { paddingRight: 4 } : { paddingLeft: 4 }),
            }}
          >
            {t('mobile.orders.ledgerEyebrow')}
          </AppText>
          <AppText
            variant="caption"
            color="secondary"
            style={isRTL ? { paddingRight: 4 } : { paddingLeft: 4 }}
          >
            {t('mobile.orders.ledgerHint')}
          </AppText>
        </View>
      </OrdersCompositionChrome>
    </View>
  );

  return (
    <SectionList
      sections={sections}
      keyExtractor={(item) => (item.kind === 'rfq' ? `rfq-${item.id}` : item.id)}
      stickySectionHeadersEnabled
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
        <EmptyState
          title={t('mobile.orders.emptyTitle')}
          description={t('mobile.orders.emptyBody')}
        />
      }
      ListFooterComponent={
        isFetchingNextPage ? (
          <View style={{ paddingVertical: theme.spacing.lg }}>
            <OrdersListSkeleton />
          </View>
        ) : null
      }
      renderSectionHeader={({ section }) => (
        <LedgerDayHeader
          title={section.title}
          bucket={section.key as LedgerBucketKey}
          count={section.data.length}
          reduce={reduce}
        />
      )}
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

function LedgerDayHeader({
  title,
  bucket,
  count,
  reduce,
}: {
  title: string;
  bucket: LedgerBucketKey;
  count: number;
  reduce: boolean;
}) {
  const { isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const { accent, soft, icon } = ledgerMeta(bucket, colors);
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  const body = (
    <View
      style={{
        marginTop: theme.spacing.sm,
        marginBottom: theme.spacing.sm,
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
          position: 'absolute',
          top: 0,
          bottom: 0,
          ...(isRTL ? { right: 0 } : { left: 0 }),
          width: 3,
          backgroundColor: accent,
          opacity: 0.75,
        }}
      />
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.sm,
          minHeight: theme.sizes.touch.min,
          paddingVertical: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
          ...(isRTL
            ? { paddingRight: theme.spacing.md + 4 }
            : { paddingLeft: theme.spacing.md + 4 }),
          backgroundColor: soft,
        }}
      >
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: theme.spacing.sm,
            flex: 1,
          }}
        >
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.surface,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: colors.border,
            }}
          >
            <Ionicons name={icon} size={16} color={accent} />
          </View>
          <AppText variant="label" weight={titleWeight} style={{ color: accent, flexShrink: 1 }}>
            {title}
          </AppText>
        </View>
        <View
          style={{
            minWidth: 28,
            height: 28,
            paddingHorizontal: 8,
            borderRadius: 14,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: accent,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <AppText
            variant="caption"
            weight="semibold"
            dir="ltr"
            style={{ color: accent, fontVariant: ['tabular-nums'] }}
          >
            {String(count)}
          </AppText>
        </View>
      </View>
    </View>
  );

  if (reduce) return body;
  return (
    <Animated.View entering={FadeInDown.duration(220)}>
      {body}
    </Animated.View>
  );
}
