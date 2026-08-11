import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { useRouter } from 'expo-router';
import { statusLabel } from '@maher/i18n';
import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import {
  DealerEmptyState,
  DealerFilterSheet,
  DealerOrderCard,
  DealerSearchBar,
  DealerSkeleton,
  statusToDealerTone,
} from '@/features/dealer-ui';
import { dealerOrderFlowHref } from '@/features/production-flow/flowRoutes';
import { useLocale } from '@/i18n';
import { haptics } from '@/motion';
import { useTheme } from '@/theme';
import { SURFACE_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import type { DealerOrderCardModel } from '../selectOrderCard';
import {
  OrdersFilterChips,
  type StatusChipKey,
} from './OrdersFilterChips';

type Props = {
  items: DealerOrderCardModel[];
  searchInput: string;
  setSearchInput: (v: string) => void;
  statusChip: StatusChipKey;
  onChipChange: (v: StatusChipKey) => void;
  filterOpen: boolean;
  onOpenFilters: () => void;
  onCloseFilters: () => void;
  filterOptions: { id: string; label: string }[];
  selectedFilterId: string | null;
  onSelectFilter: (id: string | null) => void;
  refreshing: boolean;
  onRefresh: () => void;
  onEndReached: () => void;
  isFetchingNextPage: boolean;
  onPressItem: (id: string, kind?: 'order' | 'rfq') => void;
  banner?: React.ReactNode;
};

export function DealerOrdersHome({
  items,
  searchInput,
  setSearchInput,
  statusChip,
  onChipChange,
  filterOpen,
  onOpenFilters,
  onCloseFilters,
  filterOptions,
  selectedFilterId,
  onSelectFilter,
  refreshing,
  onRefresh,
  onEndReached,
  isFetchingNextPage,
  onPressItem,
  banner,
}: Props) {
  const { t, formatCurrency, formatDate, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const router = useRouter();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  return (
    <>
      <View style={{ paddingHorizontal: theme.spacing.lg, gap: theme.spacing.md }}>
        {banner}
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: theme.spacing.md,
          }}
        >
          <View style={{ flex: 1, gap: theme.spacing.xs, minWidth: 0 }}>
            <AppText
              variant="caption"
              weight={locale === 'ar' ? 'regular' : 'medium'}
              style={{
                letterSpacing: locale === 'ar' ? 0 : 1.4,
                textTransform: locale === 'ar' ? 'none' : 'uppercase',
                color: colors.brand,
              }}
            >
              {t('mobile.dealerAccount.ordersEyebrow')}
            </AppText>
            <AppText variant="title" weight={titleWeight}>
              {t('mobile.orders.title')}
            </AppText>
            <AppText variant="caption" color="muted" numberOfLines={2}>
              {t('mobile.dealerAccount.ordersSubtitle')}
            </AppText>
          </View>
          <Pressable
            onPress={() => {
              void haptics.selection();
              onOpenFilters();
            }}
            accessibilityRole="button"
            accessibilityLabel={t('mobile.orders.filter')}
            style={{ paddingVertical: theme.spacing.sm }}
          >
            <AppText variant="caption" weight="medium" color="brand">
              {t('mobile.orders.filter')}
            </AppText>
          </Pressable>
        </View>
        <DealerSearchBar
          value={searchInput}
          onChangeText={setSearchInput}
          placeholder={t('mobile.orders.searchPlaceholder')}
        />
        <OrdersFilterChips value={statusChip} onChange={onChipChange} />
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => (item.kind === 'rfq' ? `rfq-${item.id}` : item.id)}
        contentContainerStyle={{
          paddingHorizontal: theme.spacing.lg,
          paddingTop: theme.spacing.md,
          paddingBottom: theme.spacing['3xl'] + SURFACE_TAB_BAR_CLEARANCE,
          flexGrow: 1,
          gap: theme.spacing.md,
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />
        }
        onEndReached={onEndReached}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={
          <DealerEmptyState
            title={t('mobile.orders.emptyTitle')}
            body={t('mobile.orders.emptyBody')}
          />
        }
        ListFooterComponent={
          isFetchingNextPage ? (
            <View style={{ gap: theme.spacing.sm, paddingVertical: theme.spacing.lg }}>
              <DealerSkeleton height={88} radius={theme.radius.lg} />
              <DealerSkeleton height={88} radius={theme.radius.lg} />
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const pct = Math.round(item.progressPercent || 0);
          return (
            <DealerOrderCard
              title={item.title}
              subtitle={item.number}
              statusLabel={statusLabel(locale, item.status)}
              statusTone={statusToDealerTone(item.status)}
              progressLabel={item.progressLabel ?? undefined}
              progressPercent={pct}
              deliveryLabel={
                item.deliveryDate
                  ? `${t('mobile.orders.expectedDelivery')}: ${formatDate(item.deliveryDate)}`
                  : undefined
              }
              priceLabel={
                item.sellerPrice != null ? formatCurrency(item.sellerPrice) : undefined
              }
              imageUri={item.imageUrl}
              onPress={() => onPressItem(item.id, item.kind)}
              onProgressPress={
                item.kind === 'rfq'
                  ? undefined
                  : () => router.push(dealerOrderFlowHref(item.id))
              }
            />
          );
        }}
      />

      <BottomSheet
        open={filterOpen}
        onClose={onCloseFilters}
        fitContent
        title={t('mobile.orders.filterTitle')}
      >
        <DealerFilterSheet
          title={t('mobile.orders.filterStatus')}
          options={filterOptions}
          selectedId={selectedFilterId}
          onSelect={(id) => {
            onSelectFilter(id);
            if (id) onChipChange(id as StatusChipKey);
          }}
          onClose={onCloseFilters}
          clearLabel={t('mobile.orders.filterDealerClear')}
          applyLabel={t('mobile.dealerUi.apply')}
        />
      </BottomSheet>
    </>
  );
}
