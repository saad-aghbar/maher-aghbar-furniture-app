import { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { can, canAny } from '@maher/permissions';
import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { AppScreen } from '@/components/layout/AppScreen';
import { FloatingActionDock } from '@/components/layout/FloatingActionDock';
import { stickyCtaBottomInset } from '@/components/layout/stickyCtaInset';
import { DealerEmptyPanel } from '@/features/dealers/components/DealerEmptyPanel';
import { useLocale } from '@/i18n';
import { AnimatedPressable, ListItemEnter, haptics } from '@/motion';
import { useTheme } from '@/theme';
import type { Warehouse } from './api';
import { CreateWarehouseSheet } from './components/CreateWarehouseSheet';
import { InventoryBoardCard } from './components/InventoryBoardCard';
import { InventoryListSkeleton } from './components/InventorySkeleton';
import { SearchBarShell } from '@/components/forms/SearchBarShell';
import { AppTextInput } from '@/components/forms/AppTextInput';
import { resolveAppFontStyle } from '@/theme';
import { useWarehousesQuery } from './query';
import { warehouseDisplayName, warehouseTypeKey } from './warehouseDesk';
import { useTabBarReserve } from '@/adaptive/useSurfaceClearance';

const backFallback = '/(app)/(admin)/(tabs)/inventory' as Href;

export function InventoryWarehousesScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { t, locale, isRTL } = useLocale();
  const { theme, colors } = useTheme();
  const insets = useSafeAreaInsets();
  const tabBarReserve = useTabBarReserve();
  const allowed = canAny(user, ['warehouse.read', 'warehouse.manage', 'inventory.read']);
  const canCreate = can(user, 'warehouse.manage');
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const [q, setQ] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const query = useWarehousesQuery(allowed);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (query.data ?? []).filter((wh) => {
      if (!needle) return true;
      const name = warehouseDisplayName(wh, locale);
      const typeLabel = t(`mobile.inventory.warehouseTypes.${warehouseTypeKey(wh.type)}`);
      return `${wh.code} ${name} ${wh.type ?? ''} ${typeLabel}`.toLowerCase().includes(needle);
    });
  }, [locale, q, query.data, t]);

  const dockPad =
    stickyCtaBottomInset(insets.bottom, theme.spacing.md, tabBarReserve) +
    (canCreate ? 72 : 0);

  if (!allowed) {
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
          title={t('mobile.inventory.errorTitle')}
          description={t('mobile.inventory.errorBody')}
          retryLabel={t('mobile.inventory.retry')}
          onRetry={() => void query.refetch()}
        />
      </AppScreen>
    );
  }

  return (
    <AppScreen backFallback={backFallback}>
      <ScrollView
        contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: dockPad }}
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching && !query.isLoading}
            onRefresh={() => void query.refetch()}
            tintColor={colors.brand}
          />
        }
      >
        <View style={{ gap: theme.spacing.sm }}>
          <AppText variant="largeTitle" weight={titleWeight} align="center">
            {t('mobile.inventory.warehousesSection')}
          </AppText>
          <AppText variant="caption" color="muted" style={{ textAlign: 'center' }}>
            {t('mobile.inventory.warehousesHint')}
          </AppText>
        </View>

        <SearchBarShell>
          <AppTextInput
            value={q}
            onChangeText={setQ}
            placeholder={t('mobile.inventory.searchWarehouses')}
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            clearButtonMode="while-editing"
            style={{
              flex: 1,
              minWidth: 0,
              paddingVertical: theme.spacing.sm,
              fontSize: 16,
              color: colors.textPrimary,
              textAlign: isRTL ? 'right' : 'left',
              ...resolveAppFontStyle(locale, { variant: 'body' }),
            }}
          />
        </SearchBarShell>

        {query.isLoading ? <InventoryListSkeleton /> : null}

        {!query.isLoading && rows.length === 0 ? (
          <DealerEmptyPanel nested icon="business-outline" text={t('mobile.inventory.warehousesEmpty')} />
        ) : null}

        {rows.map((warehouse, index) => (
          <WarehouseListCard
            key={warehouse.id}
            warehouse={warehouse}
            index={index}
            onPress={() => {
              void haptics.selection();
              router.push(`/(app)/(admin)/inventory/warehouses/${warehouse.id}` as Href);
            }}
          />
        ))}
      </ScrollView>

      {canCreate ? (
        <FloatingActionDock floating>
          <PrimaryButton
            label={t('mobile.inventory.newWarehouse')}
            onPress={() => {
              void haptics.selection();
              setCreateOpen(true);
            }}
            style={{ borderRadius: theme.radius.full, minHeight: 44 }}
          />
        </FloatingActionDock>
      ) : null}

      <CreateWarehouseSheet
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(warehouse) => {
          setCreateOpen(false);
          router.push(`/(app)/(admin)/inventory/warehouses/${warehouse.id}` as Href);
        }}
      />
    </AppScreen>
  );
}

function WarehouseListCard({
  warehouse,
  index,
  onPress,
}: {
  warehouse: Warehouse;
  index: number;
  onPress: () => void;
}) {
  const { t, locale, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const name = warehouseDisplayName(warehouse, locale);
  const typeKey = warehouseTypeKey(warehouse.type);
  const typeLabel = t(`mobile.inventory.warehouseTypes.${typeKey}`);
  const binCount = (warehouse.locations ?? []).filter((loc) => loc.isActive !== false).length;

  return (
    <ListItemEnter index={index}>
      <AnimatedPressable
        variant="card"
        accessibilityRole="button"
        accessibilityLabel={name}
        onPress={onPress}
        style={{
          borderRadius: theme.radius.xl,
        }}
      >
        <InventoryBoardCard
          title={warehouse.code}
          trailing={
            warehouse.isDefault ? (
              <StatusBadge
                status="READY"
                label={t('mobile.inventory.warehouseDefault')}
                branded
                dot
              />
            ) : (
              <Ionicons
                name={isRTL ? 'chevron-back' : 'chevron-forward'}
                size={16}
                color={colors.textMuted}
              />
            )
          }
        >
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'flex-start',
              gap: theme.spacing.md,
            }}
          >
            {warehouse.isDefault ? (
              <Ionicons name="star" size={18} color={colors.brand} />
            ) : (
              <Ionicons name="business-outline" size={18} color={colors.brand} />
            )}
            <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
              <AppText
                weight={titleWeight}
                numberOfLines={2}
                style={{ textAlign: isRTL ? 'right' : 'left' }}
              >
                {name}
              </AppText>
              <AppText
                variant="caption"
                color="muted"
                style={{ textAlign: isRTL ? 'right' : 'left' }}
              >
                {[typeLabel, t('mobile.inventory.warehouseBinCount', { count: String(binCount) })]
                  .filter(Boolean)
                  .join(' · ')}
              </AppText>
            </View>
          </View>
        </InventoryBoardCard>
      </AnimatedPressable>
    </ListItemEnter>
  );
}
