import { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { can } from '@maher/permissions';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { AppScreen } from '@/components/layout/AppScreen';
import { FloatingActionDock } from '@/components/layout/FloatingActionDock';
import { stickyCtaBottomInset } from '@/components/layout/stickyCtaInset';
import { DealerEmptyPanel } from '@/features/dealers/components/DealerEmptyPanel';
import { useLocale } from '@/i18n';
import { SURFACE_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import { useTheme } from '@/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { InventoryCategoryGroup } from './api';
import { InventoryCategoryRail } from './components/InventoryCategoryRail';
import { InventoryLowStockPickRow } from './components/InventoryLowStockPickRow';
import { InventoryListSkeleton } from './components/InventorySkeleton';
import {
  filterLowStockByGroup,
  lowStockBuilderHref,
  sortLowStockByShortfall,
  toggleLowStockPick,
} from './lowStockPick';
import { useInventoryGroupsQuery, useLowStockQuery } from './query';
import { isValidCategoryGroup, selectInventoryItemCard } from './selectInventory';

export function InventoryLowStockScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ group?: string | string[] }>();
  const groupParam = Array.isArray(params.group) ? params.group[0] ?? '' : params.group ?? '';
  const { t, locale } = useLocale();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const allowed = can(user, 'inventory.read');
  const canCreatePo = can(user, 'purchase-order.create');
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const backFallback = '/(app)/(admin)/(tabs)/inventory' as Href;

  const [categoryGroup, setCategoryGroup] = useState<InventoryCategoryGroup>(
    isValidCategoryGroup(groupParam) ? groupParam : 'fabric',
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isValidCategoryGroup(groupParam)) setCategoryGroup(groupParam);
  }, [groupParam]);

  const groupsQuery = useInventoryGroupsQuery(allowed);
  const lowStockQuery = useLowStockQuery(allowed);

  const items = useMemo(
    () => (lowStockQuery.data ?? []).map((item) => selectInventoryItemCard(item, locale)),
    [lowStockQuery.data, locale],
  );
  const visible = useMemo(
    () => sortLowStockByShortfall(filterLowStockByGroup(items, categoryGroup)),
    [items, categoryGroup],
  );

  const groups = groupsQuery.data ?? [];
  const dockPad =
    stickyCtaBottomInset(insets.bottom, theme.spacing.md, SURFACE_TAB_BAR_CLEARANCE) +
    (canCreatePo ? 72 : 0);
  const selectedCount = selected.size;

  const openBuilder = () => {
    if (!canCreatePo || selectedCount === 0) return;
    router.push(lowStockBuilderHref([...selected]) as Href);
  };

  if (!allowed) {
    return (
      <AppScreen backFallback={backFallback}>
        <EmptyState title={t('mobile.noModules')} description={t('mobile.noModulesHint')} />
      </AppScreen>
    );
  }

  if (lowStockQuery.isError && !lowStockQuery.data) {
    return (
      <AppScreen backFallback={backFallback}>
        <ErrorState
          title={t('mobile.inventory.errorTitle')}
          description={t('mobile.inventory.errorBody')}
          retryLabel={t('mobile.inventory.retry')}
          onRetry={() => void lowStockQuery.refetch()}
        />
      </AppScreen>
    );
  }

  return (
    <AppScreen backFallback={backFallback}>
      <ScrollView contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: dockPad }}>
        <View style={{ gap: theme.spacing.sm }}>
          <AppText variant="largeTitle" weight={titleWeight} align="center">
            {t('mobile.inventory.lowStockPageTitle')}
          </AppText>
          <AppText variant="caption" color="muted" style={{ textAlign: 'center' }}>
            {t('mobile.inventory.lowStockPageHint')}
          </AppText>
        </View>

        <InventoryCategoryRail
          groups={groups}
          active={categoryGroup}
          onChange={setCategoryGroup}
        />

        {lowStockQuery.isLoading ? <InventoryListSkeleton /> : null}

        {!lowStockQuery.isLoading && visible.length === 0 ? (
          <DealerEmptyPanel
            icon="flash-outline"
            text={t('mobile.inventory.lowStockEmptyBody')}
          />
        ) : null}

        {visible.map((item, index) => (
          <InventoryLowStockPickRow
            key={item.id}
            item={item}
            index={index}
            selected={selected.has(item.id)}
            onToggle={() => setSelected((prev) => toggleLowStockPick(prev, item.id))}
            onDetails={() =>
              router.push(`/(app)/(admin)/inventory/items/${item.id}` as Href)
            }
          />
        ))}
      </ScrollView>

      {canCreatePo ? (
        <FloatingActionDock floating>
          <PrimaryButton
            label={t('mobile.inventory.createPurchaseOrderCount', {
              count: String(selectedCount),
            })}
            disabled={selectedCount === 0}
            onPress={openBuilder}
            style={{ borderRadius: theme.radius.full, minHeight: 44 }}
          />
        </FloatingActionDock>
      ) : null}
    </AppScreen>
  );
}
