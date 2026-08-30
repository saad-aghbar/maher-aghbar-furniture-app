import { useMemo } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import type { Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { can } from '@maher/permissions';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { BackButton } from '@/components/BackButton';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { AppScreen } from '@/components/layout/AppScreen';
import { useNetwork } from '@/components/network/NetworkProvider';
import { useLocale } from '@/i18n';
import { ProgressBar } from '@/motion';
import { SURFACE_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import { useSmartBack } from '@/navigation/useSmartBack';
import { useTheme } from '@/theme';
import { OrderBoardCard } from './components/OrderBoardCard';
import { OrderDetailSkeleton } from './components/OrderDetailSkeleton';
import { useSalesOrderQuery } from './query';
import { selectOrderDetail } from './selectOrderDetail';
import {
  orderProductionSetupPlanCopy,
  selectOrderProductionSetup,
} from './orderProductionSetupCopy';

type Props = {
  orderId: string;
};

function KickerRow({
  icon,
  label,
  tone,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  tone?: 'success' | 'warning';
}) {
  const { isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const ink = tone === 'warning' ? colors.warning : colors.brand;
  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
      }}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.surfaceSecondary,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Ionicons name={icon} size={16} color={ink} />
      </View>
      <AppText
        variant="caption"
        color="muted"
        style={{ flex: 1, fontSize: 11, lineHeight: 14 }}
      >
        {label}
      </AppText>
    </View>
  );
}

function FlowChip({ label, active }: { label: string; active?: boolean }) {
  const { colors, theme } = useTheme();
  return (
    <View
      style={{
        borderRadius: theme.radius.full,
        borderWidth: 1,
        borderColor: active ? colors.brand : colors.borderStrong,
        backgroundColor: active ? colors.brandSoft : colors.surface,
        paddingHorizontal: theme.spacing.sm + 2,
        paddingVertical: theme.spacing.xs,
      }}
    >
      <AppText
        variant="caption"
        weight={active ? 'semibold' : 'medium'}
        style={{ color: active ? colors.brand : colors.textSecondary }}
      >
        {label}
      </AppText>
    </View>
  );
}

function FactRow({
  icon,
  label,
  value,
  ok,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  ok?: boolean;
}) {
  const { isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const ink = ok ? colors.success : colors.warning;
  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'flex-start',
        gap: theme.spacing.sm,
      }}
    >
      <Ionicons name={icon} size={16} color={ink} style={{ marginTop: 2 }} />
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <AppText variant="caption" color="muted">
          {label}
        </AppText>
        <AppText
          variant="body"
          style={{ color: ok ? colors.textPrimary : colors.warning }}
        >
          {value}
        </AppText>
      </View>
    </View>
  );
}

export function OrderProductionSetupScreen({ orderId }: Props) {
  const { user } = useAuth();
  const { t, tPlural, locale, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { showOfflineBanner } = useNetwork();
  const allowed = can(user, 'sales-order.read');
  const query = useSalesOrderQuery(orderId, allowed);
  const backFallback = `/(app)/(admin)/orders/${orderId}` as Href;
  const onBack = useSmartBack(backFallback);
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  const vm = useMemo(
    () => (query.data ? selectOrderDetail(query.data, 'admin', locale) : null),
    [query.data, locale],
  );
  const facts = useMemo(
    () => (vm ? selectOrderProductionSetup(vm) : null),
    [vm],
  );

  const lastContentInset = insets.bottom + SURFACE_TAB_BAR_CLEARANCE;

  if (!allowed) {
    return (
      <AppScreen backFallback={'/(app)/(admin)/(tabs)/orders' as Href}>
        <EmptyState title={t('mobile.noModules')} description={t('mobile.noModulesHint')} />
      </AppScreen>
    );
  }

  if (query.isLoading && !query.data) {
    return (
      <AppScreen edges={{ top: true, bottom: false }} backFallback={backFallback}>
        <OrderDetailSkeleton />
      </AppScreen>
    );
  }

  if ((query.isError && !query.data) || !vm || !facts) {
    return (
      <AppScreen backFallback={backFallback}>
        {showOfflineBanner ? <OfflineBanner /> : null}
        <ErrorState
          title={t('mobile.orderDetail.errorTitle')}
          description={t('mobile.orderDetail.errorBody')}
          retryLabel={t('mobile.orderDetail.retry')}
          onRetry={() => void query.refetch()}
        />
      </AppScreen>
    );
  }

  const plan = orderProductionSetupPlanCopy(facts.released, t);
  const setupChips = [
    t('mobile.orderProductionSetup.chipSetup'),
    t('mobile.orderProductionSetup.chipLines'),
    t('mobile.orderProductionSetup.chipReady'),
    t('mobile.orderProductionSetup.chipReleased'),
  ];
  const flowChips = [
    t('mobile.orderProductionSetup.flowAccepted'),
    t('mobile.orderProductionSetup.flowConfigure'),
    t('mobile.orderProductionSetup.flowFactoryReady'),
    t('mobile.orderProductionSetup.flowRelease'),
  ];
  const activeSetup = facts.released ? 3 : facts.lineCount > 0 ? 1 : 0;
  const activeFlow = facts.released ? 3 : facts.lineCount > 0 ? 1 : 0;

  return (
    <AppScreen edges={{ top: true, bottom: false }}>
      {showOfflineBanner ? <OfflineBanner /> : null}
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
          minHeight: theme.sizes.touch.min,
        }}
      >
        <BackButton label={t('mobile.orderDetail.back')} onPress={onBack} />
        <AppText
          variant="title"
          weight={titleWeight}
          numberOfLines={1}
          align="center"
          style={{ flex: 1 }}
        >
          {t('mobile.orderProductionSetup.title')}
        </AppText>
        {facts.released ? (
          <View
            style={{
              borderRadius: theme.radius.full,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surfaceSecondary,
              paddingHorizontal: theme.spacing.sm + 2,
              paddingVertical: theme.spacing.xs,
            }}
          >
            <AppText variant="caption" weight="medium" color="secondary">
              {t('mobile.orderProductionSetup.phaseReleased')}
            </AppText>
          </View>
        ) : (
          <StatusBadge status={vm.status} />
        )}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          gap: theme.spacing.md,
          paddingBottom: lastContentInset,
          flexGrow: 1,
        }}
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching}
            onRefresh={() => void query.refetch()}
            tintColor={colors.brand}
          />
        }
      >
        <OrderBoardCard
          style={{ backgroundColor: colors.successSoft, borderColor: colors.border }}
        >
          <KickerRow icon="checkmark-circle" label={plan.kicker} tone="success" />
          <AppText variant="body" color="secondary">
            {plan.body}
          </AppText>
        </OrderBoardCard>

        <OrderBoardCard>
          <AppText variant="title" weight={titleWeight} dir="ltr">
            {vm.number}
          </AppText>
          {vm.dealerName ? (
            <AppText variant="caption" color="muted">
              {t('mobile.orderProductionSetup.dealer', { name: vm.dealerName })}
            </AppText>
          ) : null}
          {vm.title ? (
            <AppText variant="caption" color="secondary">
              {vm.title}
            </AppText>
          ) : null}
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: theme.spacing.sm,
            }}
          >
            <AppText variant="caption" color="muted">
              {t('mobile.orderProductionSetup.setupProgress')}
            </AppText>
            <AppText variant="caption" weight="semibold" style={{ color: colors.brand }} dir="ltr">
              {`${facts.setupProgressPercent}%`}
            </AppText>
          </View>
          <ProgressBar progress={facts.setupProgressPercent / 100} height={4} />
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              flexWrap: 'wrap',
              gap: theme.spacing.xs,
            }}
          >
            {setupChips.map((label, i) => (
              <FlowChip key={label} label={label} active={i === activeSetup} />
            ))}
          </View>
        </OrderBoardCard>

        <OrderBoardCard>
          <KickerRow icon="construct-outline" label={t('mobile.orderProductionSetup.factoryReadiness')} />
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              flexWrap: 'wrap',
              gap: theme.spacing.xs,
            }}
          >
            {flowChips.map((label, i) => (
              <FlowChip key={label} label={label} active={i === activeFlow} />
            ))}
          </View>
          <FactRow
            icon="checkmark-circle-outline"
            label={t('mobile.orderProductionSetup.linesReady')}
            value={`${facts.linesReadyCount}/${facts.lineCount}`}
            ok={facts.lineCount > 0 && facts.linesReadyCount >= facts.lineCount}
          />
          <FactRow
            icon="cube-outline"
            label={t('mobile.orderProductionSetup.materialPlan')}
            value={
              facts.materialsNeedReview
                ? t('mobile.orderProductionSetup.materialsNeedReview')
                : t('mobile.orderProductionSetup.materialsOk')
            }
            ok={!facts.materialsNeedReview}
          />
          <FactRow
            icon="cash-outline"
            label={t('mobile.orderProductionSetup.estimatedMaterials')}
            value={
              facts.estimateIncomplete
                ? t('mobile.orderProductionSetup.estimateIncomplete')
                : t('mobile.orderProductionSetup.estimateOk')
            }
            ok={!facts.estimateIncomplete}
          />
        </OrderBoardCard>

        {facts.remainingIssueCount > 0 ? (
          <OrderBoardCard>
            <KickerRow
              icon="alert-circle"
              label={tPlural(
                'mobile.orderProductionSetup.issuesRemaining',
                facts.remainingIssueCount,
              )}
              tone="warning"
            />
          </OrderBoardCard>
        ) : null}
      </ScrollView>
    </AppScreen>
  );
}
