import { useMemo, useState, type ReactNode } from 'react';
import { RefreshControl, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { can } from '@maher/permissions';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { BackButton } from '@/components/BackButton';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { useToast } from '@/components/feedback/Toast';
import { DeskSectionBand } from '@/components/desk';
import { AppScreen } from '@/components/layout/AppScreen';
import { FloatingActionDock } from '@/components/layout/FloatingActionDock';
import { ListItemEnter, haptics } from '@/motion';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import {
  OrderBoardCard,
  OrderSectionHeader,
} from '../components/OrderBoardCard';
import { stickyCtaBottomInset } from '../components/journey/stickyCtaInset';
import { FactoryReadinessSummary } from './components/FactoryReadinessSummary';
import { ReleaseReviewSheet } from './components/ReleaseReviewSheet';
import { SetupLineCard } from './components/SetupLineCard';
import { SetupProgressSteps } from './components/SetupProgressSteps';
import { dealerDisplayName } from './labels';
import {
  useOrderProductionSetupActions,
  useOrderProductionSetupQuery,
  useOrderProductionSetupReleasePreviewQuery,
} from './query';

type Props = {
  salesOrderId: string;
};

export function OrderProductionSetupHomeScreen({ salesOrderId }: Props) {
  const { t, locale } = useLocale();
  const { colors, theme } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const [releaseOpen, setReleaseOpen] = useState(false);

  const canView = can(user, 'production.setup.view');
  const canEdit = can(user, 'production.setup.edit');
  const canReleasePerm = can(user, 'production.setup.release');

  const query = useOrderProductionSetupQuery(salesOrderId, canView);
  const previewQuery = useOrderProductionSetupReleasePreviewQuery(
    salesOrderId,
    releaseOpen && canReleasePerm,
  );
  const actions = useOrderProductionSetupActions(salesOrderId);

  const setup = query.data;
  const released = setup?.status === 'RELEASED';
  const stickyPad = stickyCtaBottomInset(insets.bottom, theme.spacing.md) + 88;

  const headerStatusLabel = useMemo(() => {
    if (!setup) return '';
    const key = `mobile.productionSetup.status.${String(setup.status).toUpperCase()}`;
    const label = t(key);
    return label.startsWith('mobile.') ? String(setup.status) : label;
  }, [setup, t]);

  function openLine(lineId: string) {
    router.push(
      `/(app)/(admin)/orders/${salesOrderId}/production-setup/lines/${lineId}` as Href,
    );
  }

  function onMarkReady() {
    actions.markReady.mutate(undefined, {
      onSuccess: () => {
        void haptics.confirmMedium();
        showToast({
          variant: 'success',
          message: t('mobile.productionSetup.markReadySuccess'),
        });
      },
      onError: () =>
        showToast({
          variant: 'error',
          message: t('mobile.productionSetup.actionFailed'),
        }),
    });
  }

  function onRelease() {
    actions.release.mutate(undefined, {
      onSuccess: () => {
        void haptics.confirmMedium();
        setReleaseOpen(false);
        showToast({
          variant: 'success',
          message: t('mobile.productionSetup.releaseSuccess'),
        });
      },
      onError: () =>
        showToast({
          variant: 'error',
          message: t('mobile.productionSetup.actionFailed'),
        }),
    });
  }

  if (!canView) {
    return (
      <AppScreen>
        <DetailNav
          onBack={() => router.back()}
          title={t('mobile.productionSetup.title')}
        />
        <EmptyState
          title={t('mobile.noModules')}
          description={t('mobile.noModulesHint')}
        />
      </AppScreen>
    );
  }

  if (query.isLoading && !setup) {
    return (
      <AppScreen edges={{ top: true, bottom: false }} style={{ paddingHorizontal: 0 }}>
        <DetailNav
          onBack={() => router.back()}
          title={t('mobile.productionSetup.title')}
        />
        <View style={{ padding: theme.spacing.lg }}>
          <AppText variant="caption" color="muted">
            {t('mobile.productionSetup.loading')}
          </AppText>
        </View>
      </AppScreen>
    );
  }

  if (query.isError && !setup) {
    return (
      <AppScreen>
        <DetailNav
          onBack={() => router.back()}
          title={t('mobile.productionSetup.title')}
        />
        <ErrorState
          title={t('mobile.productionSetup.errorTitle')}
          description={t('mobile.productionSetup.errorBody')}
          retryLabel={t('mobile.orderDetail.retry')}
          onRetry={() => void query.refetch()}
        />
      </AppScreen>
    );
  }

  if (!setup) return null;

  const dealer = dealerDisplayName(setup.salesOrder.customer, locale);
  let section = 0;
  const nextIndex = () => section++;

  return (
    <AppScreen edges={{ top: true, bottom: false }} style={{ paddingHorizontal: 0 }}>
      <DetailNav
        onBack={() => router.back()}
        title={t('mobile.productionSetup.title')}
        trailing={
          <StatusBadge status={String(setup.status)} label={headerStatusLabel} />
        }
      />

      <Animated.ScrollView
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching}
            onRefresh={() => void query.refetch()}
            tintColor={colors.brand}
          />
        }
        contentContainerStyle={{
          paddingHorizontal: theme.spacing.lg,
          paddingTop: theme.spacing.md,
          paddingBottom: stickyPad,
          gap: theme.spacing.md,
        }}
      >
        {released ? (
          <ListItemEnter index={nextIndex()}>
            <OrderBoardCard
              accent={colors.success}
              style={{ backgroundColor: colors.successSoft }}
            >
              <OrderSectionHeader
                icon="checkmark-done-outline"
                label={t('mobile.productionSetup.releasedBanner')}
                accent={colors.success}
              />
              <AppText variant="caption" color="secondary">
                {t('mobile.productionSetup.releasedBannerHint')}
              </AppText>
            </OrderBoardCard>
          </ListItemEnter>
        ) : null}

        <DeskSectionBand style={{ gap: theme.spacing.md }}>
          <ListItemEnter index={nextIndex()}>
            <OrderBoardCard accent={colors.brand}>
              <AppText variant="title" weight="semibold">
                {setup.salesOrder.number}
              </AppText>
              <AppText variant="caption" color="secondary">
                {t('mobile.orders.dealer')}: {dealer}
              </AppText>
              {setup.salesOrder.projectName ? (
                <AppText variant="caption" color="muted">
                  {setup.salesOrder.projectName}
                </AppText>
              ) : null}
              <View style={{ marginTop: theme.spacing.sm }}>
                <SetupProgressSteps
                  steps={setup.progress.steps}
                  percent={setup.progress.percent}
                />
              </View>
            </OrderBoardCard>
          </ListItemEnter>

          <ListItemEnter index={nextIndex()}>
            <FactoryReadinessSummary setup={setup} />
          </ListItemEnter>

          <ListItemEnter index={nextIndex()}>
            <View style={{ gap: theme.spacing.sm }}>
              <AppText variant="label" weight="semibold">
                {t('mobile.productionSetup.linesTitle')}
              </AppText>
              {setup.lines.length === 0 ? (
                <EmptyState
                  title={t('mobile.productionSetup.noLines')}
                  description={t('mobile.productionSetup.noLinesHint')}
                />
              ) : (
                setup.lines.map((line, idx) => (
                  <SetupLineCard
                    key={line.id}
                    line={line}
                    index={idx}
                    onPress={() => openLine(line.id)}
                  />
                ))
              )}
            </View>
          </ListItemEnter>
        </DeskSectionBand>
      </Animated.ScrollView>

      {!released && (canReleasePerm || canEdit) ? (
        <FloatingActionDock floating>
          <View style={{ gap: theme.spacing.sm, width: '100%' }}>
            {!released && canEdit && setup.status !== 'READY_FOR_RELEASE' ? (
              <View style={{ gap: 6, width: '100%' }}>
                <SecondaryButton
                  label={t('mobile.productionSetup.markReady')}
                  onPress={onMarkReady}
                  loading={actions.markReady.isPending}
                  disabled={!setup.validation.ok}
                  style={{ alignSelf: 'stretch', width: '100%' }}
                />
                {!setup.validation.ok ? (
                  <AppText variant="caption" color="muted" style={{ textAlign: 'center' }}>
                    {t('mobile.productionSetup.markReadyDisabledReason', {
                      count: setup.validation.issues.length,
                    })}
                  </AppText>
                ) : null}
              </View>
            ) : null}
            {canReleasePerm ? (
              <PrimaryButton
                label={t('mobile.productionSetup.reviewRelease')}
                onPress={() => setReleaseOpen(true)}
                style={{ alignSelf: 'stretch', width: '100%' }}
              />
            ) : null}
          </View>
        </FloatingActionDock>
      ) : null}

      <ReleaseReviewSheet
        open={releaseOpen}
        onClose={() => setReleaseOpen(false)}
        preview={previewQuery.data}
        loadingPreview={previewQuery.isLoading}
        releasing={actions.release.isPending}
        onRelease={onRelease}
      />
    </AppScreen>
  );
}

function DetailNav({
  onBack,
  title,
  trailing,
}: {
  onBack: () => void;
  title: string;
  trailing?: ReactNode;
}) {
  const { isRTL } = useLocale();
  const { theme } = useTheme();
  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: theme.spacing.lg,
        paddingVertical: theme.spacing.sm,
        gap: theme.spacing.sm,
      }}
    >
      <BackButton onPress={onBack} />
      <AppText variant="label" weight="semibold" style={{ flex: 1 }} numberOfLines={1}>
        {title}
      </AppText>
      {trailing ? <View>{trailing}</View> : <View style={{ width: 32 }} />}
    </View>
  );
}
