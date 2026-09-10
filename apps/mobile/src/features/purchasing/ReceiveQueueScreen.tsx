import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { can } from '@maher/permissions';
import type { ReceivablePurchaseOrder } from '@/api/modules/purchasing';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { TextField } from '@/components/forms/TextField';
import { AppScreen } from '@/components/layout/AppScreen';
import { InventoryBoardCard } from '@/features/inventory/components/InventoryBoardCard';
import { DealerEmptyPanel } from '@/features/dealers/components/DealerEmptyPanel';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics, ListItemEnter } from '@/motion';
import { useTheme } from '@/theme';
import { PurchasingSkeleton } from './components/PurchasingSkeleton';
import { useReceivablePurchaseOrdersQuery } from './query';
import { localizedNamed } from './selectPurchase';

function runKey(row: ReceivablePurchaseOrder) {
  return row.runId ?? row.purchaseRunId ?? row.id;
}

export function ReceiveQueueScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { t, locale, isRTL, formatDate } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const canReceive = can(user, 'inventory.receive');
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const backFallback = '/(app)/(admin)/(tabs)/inventory' as Href;
  const [q, setQ] = useState('');
  const query = useReceivablePurchaseOrdersQuery(canReceive, { q: q.trim() || undefined });

  const groups = useMemo(() => {
    const map = new Map<string, ReceivablePurchaseOrder[]>();
    for (const row of query.data ?? []) {
      const key = runKey(row);
      const list = map.get(key) ?? [];
      list.push(row);
      map.set(key, list);
    }
    return [...map.entries()].map(([id, orders]) => ({ id, orders }));
  }, [query.data]);

  if (!canReceive) {
    return (
      <AppScreen backFallback={backFallback}>
        <EmptyState title={t('mobile.noModules')} description={t('mobile.noModulesHint')} />
      </AppScreen>
    );
  }

  if (query.isError && !query.data) {
    return (
      <AppScreen backFallback={backFallback}>
        <ErrorState
          title={t('mobile.purchasing.errorTitle')}
          description={t('mobile.purchasing.errorBody')}
          retryLabel={t('mobile.purchasing.retry')}
          onRetry={() => void query.refetch()}
        />
      </AppScreen>
    );
  }

  return (
    <AppScreen backFallback={backFallback}>
      <FlatList
        data={groups}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ gap: theme.spacing.md, flexGrow: 1 }}
        refreshControl={
          <RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} tintColor={colors.brand} />
        }
        ListHeaderComponent={
          <View style={{ gap: theme.spacing.md }}>
            <AppText variant="largeTitle" weight={titleWeight} align="center">
              {t('mobile.purchasing.receiveQueueTitle')}
            </AppText>
            <View
              style={{
                borderRadius: theme.radius.xl,
                borderWidth: 1,
                borderColor: colors.borderStrong,
                backgroundColor: colors.surface,
                padding: theme.spacing.md,
                ...orderBoardShadow(colorScheme),
              }}
            >
              <TextField
                value={q}
                onChangeText={setQ}
                placeholder={t('mobile.purchasing.searchOrders')}
                autoCorrect={false}
                autoCapitalize="none"
                pill
              />
            </View>
          </View>
        }
        ListEmptyComponent={
          query.isLoading ? (
            <PurchasingSkeleton />
          ) : (
            <DealerEmptyPanel text={t('mobile.purchasing.receivableEmptyBody')} icon="cube-outline" />
          )
        }
        renderItem={({ item, index }) => {
          const runNumber = item.orders[0]?.runNumber;
          const multi = item.orders.length > 1 && Boolean(runNumber);
          return (
            <ListItemEnter index={index}>
              <View style={{ gap: theme.spacing.sm }}>
                {multi ? (
                  <AppText weight={titleWeight} style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {t('mobile.purchasing.runBadge', {
                      number: runNumber ?? '',
                      count: String(item.orders[0]?.runSupplierCount ?? item.orders.length),
                    })}
                  </AppText>
                ) : null}
                {item.orders.map((row) => {
                  const remaining = Number(row.remainingQty ?? 0);
                  const overdue = Boolean(row.isOverdue);
                  return (
                    <AnimatedPressable
                      key={row.id}
                      variant="card"
                      accessibilityRole="button"
                      accessibilityLabel={row.number}
                      onPress={() => {
                        void haptics.selection();
                        router.push(`/(app)/(admin)/inventory/receive/${row.id}` as Href);
                      }}
                    >
                      <InventoryBoardCard
                        accent={overdue ? colors.error : colors.brand}
                        title={localizedNamed(locale, row.supplier)}
                        trailing={<StatusBadge status={row.status} />}
                      >
                        <AppText dir="ltr" weight="medium">
                          {row.number}
                        </AppText>
                        <AppText variant="caption" color="muted" dir="ltr">
                          {`${t('mobile.purchasing.remaining')}: ${remaining}`}
                        </AppText>
                        {row.expectedDeliveryDate ? (
                          <AppText variant="caption" color={overdue ? 'error' : 'muted'} dir="ltr">
                            {formatDate(row.expectedDeliveryDate)}
                          </AppText>
                        ) : null}
                      </InventoryBoardCard>
                    </AnimatedPressable>
                  );
                })}
              </View>
            </ListItemEnter>
          );
        }}
      />
    </AppScreen>
  );
}
