import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter, type Href } from 'expo-router';
import { can } from '@maher/permissions';
import { queryKeys } from '@/api/queryKeys';
import { listFabricProcurements } from '@/api/modules/purchasing';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { FabricDeskSummary } from '@/features/fabric/FabricDeskSummary';
import { OrderFabricGroupCard } from '@/features/fabric/OrderFabricGroupCard';
import {
  fabricDeskBucketCounts,
  fabricRowDestination,
  fabricRowFromHolding,
  filterRowsByDeskBucket,
  groupFabricRowsBySalesOrder,
  mergeFabricDeskRows,
  selectFabricTrackerRows,
  type FabricDeskBucket,
} from '@/features/fabric/selectFabricTracker';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics, ListItemEnter } from '@/motion';
import { useTheme } from '@/theme';
import { InventoryListSkeleton } from './InventorySkeleton';

type Props = {
  q?: string;
  enabled?: boolean;
};

/**
 * Inventory fabric desk — order first, fabrics under the order.
 * General reusable FAB stock stays in the labelled section that follows.
 */
export function FabricDeskSection({ q, enabled = true }: Props) {
  const { user } = useAuth();
  const { t, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const router = useRouter();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const canProcurement = can(user, 'fabric.procurement.read');
  const canReadOrder = can(user, 'sales-order.read');
  const [bucket, setBucket] = useState<FabricDeskBucket | null>(null);

  const holdingQuery = useQuery({
    queryKey: queryKeys.inventory.fabricHolding(q),
    queryFn: () => listFabricHolding(q),
    enabled,
  });

  const queueQuery = useQuery({
    queryKey: queryKeys.purchasing.fabricList({ q: q || undefined, desk: true }),
    queryFn: () => listFabricProcurements({ q: q || undefined }),
    enabled: enabled && canProcurement,
  });

  const queueRows = useMemo(
    () => (queueQuery.data ? selectFabricTrackerRows(queueQuery.data) : []),
    [queueQuery.data],
  );
  const holdingRows = useMemo(
    () => (holdingQuery.data?.holding ?? []).map(fabricRowFromHolding),
    [holdingQuery.data],
  );
  const merged = useMemo(
    () => mergeFabricDeskRows(canProcurement ? queueRows : [], holdingRows),
    [canProcurement, queueRows, holdingRows],
  );
  const counts = useMemo(() => fabricDeskBucketCounts(merged), [merged]);
  const visible = useMemo(() => filterRowsByDeskBucket(merged, bucket), [merged, bucket]);
  const groups = useMemo(() => groupFabricRowsBySalesOrder(visible), [visible]);

  if (!enabled) return null;

  const loading = holdingQuery.isLoading || (canProcurement && queueQuery.isLoading);
  const failed = holdingQuery.isError && (!canProcurement || queueQuery.isError);
  const nothing = merged.length === 0;

  function openFabric(row: (typeof merged)[number]) {
    const dest = fabricRowDestination(row);
    if (dest.kind === 'bundle') {
      router.push(
        `/(app)/(admin)/inventory/fabric-bundle/${encodeURIComponent(dest.code)}` as Href,
      );
      return;
    }
    if (canProcurement) {
      router.push(`/(app)/(admin)/purchasing/fabric/${dest.id}` as Href);
    }
  }

  function openOrder(salesOrderId: string | null) {
    if (!salesOrderId || !canReadOrder) return;
    router.push(`/(app)/(admin)/orders/${salesOrderId}` as Href);
  }

  return (
    <View style={{ gap: theme.spacing.md }}>
      {loading && nothing ? <InventoryListSkeleton /> : null}

      {failed ? (
        <View style={{ gap: theme.spacing.sm }}>
          <AppText variant="caption" style={{ color: colors.error }}>
            {t('mobile.purchasing.fabricLoadFailed')}
          </AppText>
          <AnimatedPressable
            variant="button"
            accessibilityRole="button"
            accessibilityLabel={t('mobile.purchasing.fabricRetry')}
            onPress={() => {
              void haptics.selection();
              void holdingQuery.refetch();
              void queueQuery.refetch();
            }}
          >
            <AppText variant="caption" weight={titleWeight} style={{ color: colors.brand }}>
              {t('mobile.purchasing.fabricRetry')}
            </AppText>
          </AnimatedPressable>
        </View>
      ) : null}

      {!failed && !loading && !nothing ? (
        <FabricDeskSummary counts={counts} active={bucket} onSelect={setBucket} />
      ) : null}

      {!failed && !loading ? (
        <View style={{ gap: theme.spacing.sm }}>
          <View style={{ gap: 2 }}>
            <AppText
              variant="body"
              weight={titleWeight}
              style={{ textAlign: isRTL ? 'right' : 'left', color: colors.brand }}
            >
              {t('mobile.inventory.fabricDeskTitle')}
            </AppText>
            <AppText
              variant="caption"
              color="muted"
              style={{ textAlign: isRTL ? 'right' : 'left' }}
            >
              {t('mobile.inventory.fabricDeskHint')}
            </AppText>
          </View>

          {groups.length === 0 ? (
            <AppText variant="caption" color="muted">
              {nothing
                ? t('mobile.inventory.fabricDeskEmpty')
                : t('mobile.inventory.fabricLaneEmpty')}
            </AppText>
          ) : (
            groups.map((group, index) => (
              <ListItemEnter key={group.id} index={index}>
                <OrderFabricGroupCard
                  group={group}
                  onPressOrder={
                    group.salesOrderId && canReadOrder
                      ? () => openOrder(group.salesOrderId)
                      : undefined
                  }
                  onPressFabric={openFabric}
                  surface="desk"
                />
              </ListItemEnter>
            ))
          )}
        </View>
      ) : null}

      <GeneralStockLabel />
    </View>
  );
}

function GeneralStockLabel() {
  const { t, isRTL, locale } = useLocale();
  const { theme } = useTheme();
  return (
    <View style={{ gap: 2, marginTop: theme.spacing.xs }}>
      <AppText
        weight={locale === 'ar' ? 'medium' : 'semibold'}
        style={{ textAlign: isRTL ? 'right' : 'left' }}
      >
        {t('mobile.inventory.generalFabricStock')}
      </AppText>
      <AppText variant="caption" color="muted" style={{ textAlign: isRTL ? 'right' : 'left' }}>
        {t('mobile.inventory.generalFabricStockHint')}
      </AppText>
    </View>
  );
}
