import { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import type { Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { AppScreen } from '@/components/layout/AppScreen';
import { useNetwork } from '@/components/network/NetworkProvider';
import { useLocale } from '@/i18n';
import { ProgressBar } from '@/motion';
import { useTheme } from '@/theme';
import { useSalesOrderQuery } from '@/features/sales-orders/query';
import { useProductionOrderQuery } from '@/features/production/query';
import { AdminStageDrillSheet } from './components/AdminStageDrillSheet';
import { DealerStageSheet } from './components/DealerStageSheet';
import { ProductionFlowMap } from './components/ProductionFlowMap';
import {
  selectProductionFlow,
  type ProductionFlowRole,
  type ProductionFlowStage,
} from './selectProductionFlow';

type Props = {
  role: ProductionFlowRole;
  source: 'sales-order' | 'production-order';
  id: string;
  backFallback: Href;
};

export function ProductionFlowScreen({ role, source, id, backFallback }: Props) {
  const { t, locale, formatDate, isRTL } = useLocale();
  const { theme, colors } = useTheme();
  const { showOfflineBanner } = useNetwork();
  const [selected, setSelected] = useState<ProductionFlowStage | null>(null);

  const salesQuery = useSalesOrderQuery(id, source === 'sales-order');
  const productionQuery = useProductionOrderQuery(id, source === 'production-order');
  const query = source === 'sales-order' ? salesQuery : productionQuery;

  const flow = useMemo(() => {
    if (!query.data) return null;
    if (source === 'sales-order') {
      return selectProductionFlow(
        { kind: 'sales-order', order: query.data as never },
        role,
        locale,
      );
    }
    return selectProductionFlow(
      { kind: 'production-order', order: query.data as never },
      role,
      locale,
    );
  }, [locale, query.data, role, source]);

  if (query.isLoading && !query.data) {
    return (
      <AppScreen backFallback={backFallback}>
        <AppText variant="title" weight="semibold">
          {t('mobile.productionFlow.title')}
        </AppText>
        <AppText variant="body" color="secondary">
          {t('mobile.productionFlow.loading')}
        </AppText>
      </AppScreen>
    );
  }

  if ((query.isError && !query.data) || !flow) {
    return (
      <AppScreen backFallback={backFallback}>
        {showOfflineBanner ? <OfflineBanner /> : null}
        <ErrorState
          title={t('mobile.productionFlow.errorTitle')}
          description={t('mobile.productionFlow.errorBody')}
          retryLabel={t('mobile.productionFlow.retry')}
          onRetry={() => void query.refetch()}
        />
      </AppScreen>
    );
  }

  const pct = Math.max(0, Math.min(100, Math.round(flow.progressPercent || 0)));
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const late =
    Boolean(flow.estimatedDelivery) &&
    new Date(flow.estimatedDelivery!).getTime() < Date.now() &&
    flow.status !== 'COMPLETED' &&
    flow.status !== 'CANCELLED';
  const accent = late
    ? colors.error
    : pct >= 100 || flow.status === 'COMPLETED'
      ? colors.success
      : colors.brand;
  const boardShadow = theme.elevation.card;

  return (
    <AppScreen backFallback={backFallback}>
      {showOfflineBanner ? <OfflineBanner /> : null}
      <ScrollView
        contentContainerStyle={{
          gap: theme.spacing.lg,
          paddingBottom: theme.spacing['6xl'] + 48,
        }}
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching}
            onRefresh={() => void query.refetch()}
          />
        }
      >
        <View
          style={{
            borderRadius: theme.radius.xl,
            borderWidth: 1,
            borderColor: late ? colors.error : colors.borderStrong,
            backgroundColor: colors.surface,
            overflow: 'hidden',
            ...boardShadow,
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
              opacity: late ? 1 : 0.55,
            }}
          />
          <View
            style={{
              gap: theme.spacing.sm,
              paddingVertical: theme.spacing.md,
              paddingHorizontal: theme.spacing.md,
              ...(isRTL
                ? { paddingRight: theme.spacing.md + 4 }
                : { paddingLeft: theme.spacing.md + 4 }),
            }}
          >
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                gap: theme.spacing.sm,
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: late ? colors.errorSoft : colors.brandSoft,
                  borderWidth: 1,
                  borderColor: late ? colors.error : colors.border,
                }}
              >
                <Ionicons name="git-network-outline" size={18} color={accent} />
              </View>
              <AppText
                variant="caption"
                weight={locale === 'ar' ? 'regular' : 'medium'}
                style={{
                  flex: 1,
                  letterSpacing: locale === 'ar' ? 0 : 1.4,
                  textTransform: locale === 'ar' ? 'none' : 'uppercase',
                  color: colors.brand,
                }}
              >
                {t('mobile.productionFlow.title')}
              </AppText>
              <StatusBadge status={flow.status} dot />
            </View>

            <AppText variant="title" weight={titleWeight} numberOfLines={2}>
              {flow.title?.trim() || flow.number}
            </AppText>

            <AppText
              variant="caption"
              color="secondary"
              dir="ltr"
              style={{ letterSpacing: 0.2 }}
            >
              {flow.number}
            </AppText>

            {flow.estimatedDelivery ? (
              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  gap: theme.spacing.xs,
                  paddingTop: theme.spacing.xs,
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderTopColor: colors.border,
                }}
              >
                <Ionicons
                  name="calendar-outline"
                  size={14}
                  color={late ? colors.error : colors.textMuted}
                />
                <AppText
                  variant="caption"
                  color={late ? undefined : 'muted'}
                  style={late ? { color: colors.error } : undefined}
                >
                  {t('mobile.productionFlow.estimatedDelivery')}:{' '}
                  {formatDate(flow.estimatedDelivery)}
                </AppText>
              </View>
            ) : null}
          </View>
        </View>

        {flow.stages.length === 0 ? (
          <EmptyState
            title={t('mobile.productionFlow.emptyTitle')}
            description={t('mobile.productionFlow.emptyBody')}
          />
        ) : (
          <View
            style={{
              borderRadius: theme.radius.xl,
              borderWidth: 1,
              borderColor: colors.borderStrong,
              backgroundColor: colors.surface,
              overflow: 'hidden',
              ...boardShadow,
            }}
          >
            <ProductionFlowMap
              stages={flow.stages}
              onStagePress={(stage) => setSelected(stage)}
            />
          </View>
        )}

        <View
          style={{
            borderRadius: theme.radius.xl,
            borderWidth: 1,
            borderColor: late ? colors.error : colors.borderStrong,
            backgroundColor: colors.surface,
            overflow: 'hidden',
            marginBottom: theme.spacing['3xl'],
            ...boardShadow,
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
              opacity: late ? 1 : 0.55,
            }}
          />

          <View
            style={{
              gap: theme.spacing.md,
              paddingVertical: theme.spacing.md,
              paddingHorizontal: theme.spacing.md,
              ...(isRTL
                ? { paddingRight: theme.spacing.md + 4 }
                : { paddingLeft: theme.spacing.md + 4 }),
            }}
          >
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                gap: theme.spacing.sm,
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: late ? colors.errorSoft : colors.brandSoft,
                  borderWidth: 1,
                  borderColor: late ? colors.error : colors.border,
                }}
              >
                <Ionicons
                  name="analytics-outline"
                  size={18}
                  color={accent}
                />
              </View>
              <AppText variant="label" weight={titleWeight} style={{ flex: 1 }}>
                {t('mobile.productionFlow.overallProgress')}
              </AppText>
              {late ? (
                <StatusBadge
                  status="OVERDUE"
                  label={t('mobile.productionFlow.overdue')}
                  dot
                />
              ) : null}
            </View>

            <View style={{ gap: theme.spacing.xs }}>
              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <AppText variant="caption" color="secondary">
                  {t('mobile.production.progress')}
                </AppText>
                <AppText
                  variant="caption"
                  weight="semibold"
                  style={{ color: accent }}
                  dir="ltr"
                >
                  {`${pct}%`}
                </AppText>
              </View>
              <ProgressBar
                progress={pct / 100}
                height={6}
                fillStyle={{ backgroundColor: accent }}
                trackStyle={{ backgroundColor: colors.surfaceSecondary }}
              />
            </View>

            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                gap: theme.spacing.sm,
                paddingTop: theme.spacing.xs,
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: colors.border,
              }}
            >
              <Ionicons
                name="calendar-outline"
                size={16}
                color={late ? colors.error : colors.textMuted}
              />
              <AppText
                variant="caption"
                color={late ? undefined : 'muted'}
                style={late ? { color: colors.error, flex: 1 } : { flex: 1 }}
              >
                {t('mobile.productionFlow.estimatedDelivery')}:{' '}
                {flow.estimatedDelivery
                  ? formatDate(flow.estimatedDelivery)
                  : t('mobile.productionFlow.deliveryTbd')}
              </AppText>
            </View>
          </View>
        </View>
      </ScrollView>

      {role === 'admin' ? (
        <AdminStageDrillSheet
          open={Boolean(selected)}
          onClose={() => setSelected(null)}
          stage={selected}
          flow={flow}
        />
      ) : (
        <DealerStageSheet
          open={Boolean(selected)}
          onClose={() => setSelected(null)}
          stage={selected}
          flow={flow}
        />
      )}
    </AppScreen>
  );
}
