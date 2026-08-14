import { useMemo } from 'react';
import { View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { can, canAny } from '@maher/permissions';
import { queryKeys } from '@/api/queryKeys';
import {
  getInventoryOverview,
  listInventoryStockCounts,
  listWarehouseTransfers,
} from '@/api/modules/inventory';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { AnimatedPressable, CountUp, haptics, useReducedMotion } from '@/motion';
import { useTheme } from '@/theme';

const INVENTORY_HREF = '/(app)/(admin)/(tabs)/inventory' as Href;

/**
 * Permission-composed inventory ops on admin Home — not a staff-type dashboard.
 * Floor board: one static panel, not floating metric chips.
 */
export function AdminHomeOpsInventory() {
  const { user } = useAuth();
  const { t, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const router = useRouter();
  const reduce = useReducedMotion();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  const canRead = can(user, 'inventory.read');
  const canReceive = can(user, 'inventory.receive');
  const canTransfer = can(user, 'inventory.transfer');
  const canCount = can(user, 'inventory.count');
  const show = canAny(user, [
    'inventory.read',
    'inventory.receive',
    'inventory.transfer',
    'inventory.count',
  ]);

  const overviewQuery = useQuery({
    queryKey: queryKeys.inventory.overview(),
    queryFn: getInventoryOverview,
    enabled: show && canRead,
    staleTime: 30_000,
  });
  const transfersQuery = useQuery({
    queryKey: [...queryKeys.inventory.transfers(), 'home'],
    queryFn: () => listWarehouseTransfers({ page: 1, pageSize: 20 }),
    enabled: show && (canRead || canTransfer),
    staleTime: 30_000,
  });
  const countsQuery = useQuery({
    queryKey: [...queryKeys.inventory.counts(), 'home'],
    queryFn: () => listInventoryStockCounts({ page: 1, pageSize: 20 }),
    enabled: show && (canRead || canCount),
    staleTime: 30_000,
  });

  const lowStock = overviewQuery.data?.rawMaterials.lowStockCount ?? 0;
  const openTransfers = useMemo(
    () =>
      (transfersQuery.data?.data ?? []).filter(
        (row) => row.status === 'DRAFT' || row.status === 'IN_TRANSIT',
      ).length,
    [transfersQuery.data],
  );
  const openCounts = useMemo(
    () => (countsQuery.data?.data ?? []).filter((row) => row.status === 'DRAFT').length,
    [countsQuery.data],
  );
  const recent = useMemo(() => {
    const transfers = (transfersQuery.data?.data ?? []).map((row) => ({
      id: row.id,
      number: row.number,
      kind: 'transfer' as const,
      at: row.createdAt,
    }));
    const counts = (countsQuery.data?.data ?? []).map((row) => ({
      id: row.id,
      number: row.number,
      kind: 'count' as const,
      at: row.createdAt,
    }));
    return [...transfers, ...counts]
      .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
      .slice(0, 3);
  }, [countsQuery.data, transfersQuery.data]);

  if (!show) return null;

  const attention = lowStock > 0;
  const accent = attention ? colors.warning : colors.brand;
  const hasActions = canReceive || canTransfer || canCount;

  const goInventory = () => {
    void haptics.selection();
    router.push(INVENTORY_HREF);
  };

  const Wrapper = reduce ? View : Animated.View;
  const wrapperProps = reduce
    ? {}
    : { entering: FadeInDown.delay(260).duration(400).damping(22) };

  return (
    <Wrapper
      {...wrapperProps}
      style={{ marginBottom: theme.spacing.xl, gap: theme.spacing.md }}
    >
      <View style={{ gap: 4, alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
        <AppText
          variant="caption"
          weight="semibold"
          style={{
            letterSpacing: locale === 'ar' ? 0 : 1.6,
            textTransform: locale === 'ar' ? 'none' : 'uppercase',
            color: colors.brand,
          }}
        >
          {t('mobile.opsHome.eyebrow')}
        </AppText>
        <AppText variant="title" weight={titleWeight}>
          {t('mobile.opsHome.inventoryTitle')}
        </AppText>
        <AppText variant="caption" color="secondary" style={{ fontSize: 11, lineHeight: 15 }}>
          {t('mobile.opsHome.hint')}
        </AppText>
      </View>

      <View
        style={{
          borderRadius: theme.radius.xl,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          overflow: 'hidden',
          ...theme.elevation.raised,
        }}
      >
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            ...(isRTL ? { right: 0 } : { left: 0 }),
            width: 3,
            backgroundColor: accent,
            opacity: 0.55,
          }}
        />

        <AnimatedPressable
          variant="card"
          accessibilityRole="button"
          accessibilityLabel={t('mobile.opsHome.inventoryTitle')}
          onPress={goInventory}
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: theme.spacing.md,
            padding: theme.spacing.lg,
            ...(isRTL
              ? { paddingRight: theme.spacing.lg + 4 }
              : { paddingLeft: theme.spacing.lg + 4 }),
          }}
        >
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 16,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: attention ? colors.warningSoft : colors.brandSoft,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Ionicons
              name={attention ? 'alert-circle-outline' : 'cube-outline'}
              size={22}
              color={accent}
            />
          </View>
          <View style={{ flex: 1, minWidth: 0, gap: 2, alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
            <AppText
              variant="caption"
              weight="semibold"
              style={{
                letterSpacing: locale === 'ar' ? 0 : 1.2,
                textTransform: locale === 'ar' ? 'none' : 'uppercase',
                color: accent,
                fontSize: 11,
              }}
            >
              {t('mobile.opsHome.attention')}
            </AppText>
            <AppText variant="label" weight={titleWeight} numberOfLines={1}>
              {t('mobile.opsHome.inventoryTitle')}
            </AppText>
          </View>
          <Ionicons
            name={isRTL ? 'chevron-back' : 'chevron-forward'}
            size={18}
            color={colors.textMuted}
          />
        </AnimatedPressable>

        {canRead ? (
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              marginHorizontal: theme.spacing.md,
              marginBottom: hasActions ? theme.spacing.sm : theme.spacing.md,
              borderRadius: theme.radius.lg,
              backgroundColor: colors.surfaceSecondary,
              borderWidth: 1,
              borderColor: colors.border,
              overflow: 'hidden',
            }}
          >
            <MetricCell
              icon="warning-outline"
              label={t('mobile.opsHome.lowStock')}
              value={lowStock}
              tint={colors.warning}
              onPress={goInventory}
            />
            <View style={{ width: 1, backgroundColor: colors.border }} />
            <MetricCell
              icon="swap-horizontal-outline"
              label={t('mobile.opsHome.openTransfers')}
              value={openTransfers}
              tint={colors.brand}
              onPress={goInventory}
            />
            <View style={{ width: 1, backgroundColor: colors.border }} />
            <MetricCell
              icon="clipboard-outline"
              label={t('mobile.opsHome.openCounts')}
              value={openCounts}
              tint={colors.brand}
              onPress={goInventory}
            />
          </View>
        ) : null}

        {canRead ? (
          <View
            style={{
              marginHorizontal: theme.spacing.md,
              marginBottom: hasActions ? theme.spacing.sm : theme.spacing.md,
              gap: 6,
            }}
          >
            <AppText
              variant="caption"
              color="muted"
              style={{
                fontSize: 10,
                letterSpacing: locale === 'ar' ? 0 : 0.4,
                textTransform: locale === 'ar' ? 'none' : 'uppercase',
                textAlign: isRTL ? 'right' : 'left',
              }}
            >
              {t('mobile.opsHome.recentActivity')}
            </AppText>
            {recent.length === 0 ? (
              <AppText variant="caption" color="secondary">
                {t('mobile.opsHome.emptyActivity')}
              </AppText>
            ) : (
              recent.map((row) => (
                <AppText key={row.id} variant="caption" color="secondary" numberOfLines={1}>
                  {row.kind === 'transfer'
                    ? t('mobile.opsHome.transfer')
                    : t('mobile.opsHome.count')}
                  {' · '}
                  {row.number}
                </AppText>
              ))
            )}
          </View>
        ) : null}

        {hasActions ? (
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: theme.spacing.sm,
              paddingHorizontal: theme.spacing.md,
              paddingVertical: theme.spacing.md,
              borderTopWidth: 1,
              borderTopColor: colors.border,
              backgroundColor: colors.surfaceSecondary,
            }}
          >
            {canReceive ? (
              <ActionChip
                icon="download-outline"
                label={t('mobile.opsHome.receive')}
                emphasis
                onPress={goInventory}
              />
            ) : null}
            {canTransfer ? (
              <ActionChip
                icon="swap-horizontal-outline"
                label={t('mobile.opsHome.transfer')}
                onPress={goInventory}
              />
            ) : null}
            {canCount ? (
              <ActionChip
                icon="clipboard-outline"
                label={t('mobile.opsHome.count')}
                onPress={goInventory}
              />
            ) : null}
          </View>
        ) : null}
      </View>
    </Wrapper>
  );
}

function MetricCell({
  icon,
  label,
  value,
  tint,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: number;
  tint: string;
  onPress: () => void;
}) {
  const { isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const active = value > 0;
  const color = active ? tint : colors.textMuted;

  return (
    <AnimatedPressable
      variant="card"
      accessibilityRole="button"
      accessibilityLabel={`${label} ${value}`}
      onPress={() => {
        void haptics.selection();
        onPress();
      }}
      style={{
        flex: 1,
        paddingVertical: theme.spacing.md,
        paddingHorizontal: theme.spacing.sm,
        gap: 6,
        alignItems: isRTL ? 'flex-end' : 'flex-start',
      }}
    >
      <Ionicons name={icon} size={14} color={color} />
      <AppText
        variant="caption"
        color="muted"
        numberOfLines={2}
        style={{
          textAlign: isRTL ? 'right' : 'left',
          fontSize: 10,
          letterSpacing: locale === 'ar' ? 0 : 0.4,
          textTransform: locale === 'ar' ? 'none' : 'uppercase',
        }}
      >
        {label}
      </AppText>
      <CountUp value={value} variant="heading" color={active ? tint : colors.textPrimary} />
    </AnimatedPressable>
  );
}

function ActionChip({
  icon,
  label,
  onPress,
  emphasis,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  emphasis?: boolean;
}) {
  const { isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();

  return (
    <AnimatedPressable
      variant="button"
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        void haptics.selection();
        onPress();
      }}
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        minHeight: 40,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
        borderRadius: theme.radius.full,
        borderWidth: 1,
        borderColor: emphasis ? colors.brand : colors.borderStrong,
        backgroundColor: emphasis ? colors.brand : colors.surface,
      }}
    >
      <Ionicons name={icon} size={14} color={emphasis ? colors.onBrand : colors.brand} />
      <AppText
        variant="caption"
        weight={locale === 'ar' ? 'medium' : 'semibold'}
        numberOfLines={1}
        style={{ color: emphasis ? colors.onBrand : colors.brand }}
      >
        {label}
      </AppText>
    </AnimatedPressable>
  );
}
