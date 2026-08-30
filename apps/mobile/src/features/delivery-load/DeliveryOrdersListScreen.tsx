import { FlatList, RefreshControl, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { can } from '@maher/permissions';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { AppScreen } from '@/components/layout/AppScreen';
import { useNetwork } from '@/components/network/NetworkProvider';
import { useLocale } from '@/i18n';
import { SURFACE_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import { useTheme } from '@/theme';
import { DeliveryFloorOrderCard } from './components/DeliveryFloorOrderCard';
import { deliverySectionLabelStyle } from './deliveryFloorStyle';
import { useMyDeliveriesQuery } from './query';

export type DeliveryOrdersListVariant = 'open' | 'completed';

type Props = {
  variant: DeliveryOrdersListVariant;
};

export function DeliveryOrdersListScreen({ variant }: Props) {
  const { user } = useAuth();
  const { t, locale, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const { showOfflineBanner } = useNetwork();
  const allowed = can(user, 'delivery.read');
  const isCompleted = variant === 'completed';
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const listBottomPad = theme.spacing['3xl'] + SURFACE_TAB_BAR_CLEARANCE;

  const query = useMyDeliveriesQuery(
    { scope: isCompleted ? 'completed' : 'open', pageSize: 50 },
    allowed,
  );

  const rows = query.data?.data ?? [];

  if (!allowed) {
    return (
      <AppScreen>
        <EmptyState title={t('mobile.noModules')} description={t('mobile.noModulesHint')} />
      </AppScreen>
    );
  }

  if (query.isLoading && !query.data) {
    return (
      <AppScreen>
        <View style={{ padding: theme.spacing.xl }}>
          <AppText variant="title" weight={titleWeight}>
            {isCompleted
              ? t('mobile.deliveryLoad.completedTitle')
              : t('mobile.deliveryLoad.openTitle')}
          </AppText>
          <AppText variant="body" color="secondary" style={{ marginTop: theme.spacing.sm }}>
            {t('mobile.deliveryLoad.loading')}
          </AppText>
        </View>
      </AppScreen>
    );
  }

  if (query.isError && !query.data) {
    return (
      <AppScreen>
        {showOfflineBanner ? <OfflineBanner /> : null}
        <ErrorState
          title={t('mobile.deliveryLoad.errorTitle')}
          description={t('mobile.deliveryLoad.errorBody')}
          retryLabel={t('mobile.deliveryLoad.retry')}
          onRetry={() => void query.refetch()}
        />
      </AppScreen>
    );
  }

  return (
    <AppScreen edges={{ top: true }} padding="md">
      {showOfflineBanner ? <OfflineBanner /> : null}
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          paddingTop: theme.spacing.sm,
          paddingBottom: listBottomPad,
          flexGrow: 1,
        }}
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching && !query.isLoading}
            onRefresh={() => void query.refetch()}
            tintColor={colors.brand}
          />
        }
        ListHeaderComponent={
          <View style={{ marginBottom: theme.spacing.lg, gap: theme.spacing.xs }}>
            <AppText
              variant="caption"
              weight="semibold"
              style={{
                ...deliverySectionLabelStyle(locale, colors.brand),
                textAlign: isRTL ? 'right' : 'left',
              }}
            >
              {isCompleted
                ? t('mobile.deliveryLoad.completedEyebrow')
                : t('mobile.deliveryLoad.openEyebrow')}
            </AppText>
            <AppText variant="title" weight={titleWeight} align="start">
              {isCompleted
                ? t('mobile.deliveryLoad.completedTitle')
                : t('mobile.deliveryLoad.openTitle')}
            </AppText>
            <AppText variant="body" color="secondary" align="start">
              {isCompleted
                ? t('mobile.deliveryLoad.completedCaption')
                : t('mobile.deliveryLoad.openCaption')}
            </AppText>
          </View>
        }
        ListEmptyComponent={
          <View
            style={{
              marginTop: theme.spacing.xl,
              backgroundColor: colors.surface,
              borderRadius: theme.radius.xl,
              borderWidth: 1,
              borderColor: colors.borderStrong,
              overflow: 'hidden',
              ...theme.elevation.card,
            }}
          >
            <View
              style={{
                height: 3,
                backgroundColor: isCompleted ? colors.success : colors.brand,
                opacity: 0.35,
              }}
            />
            <View
              style={{
                paddingVertical: theme.spacing['2xl'],
                paddingHorizontal: theme.spacing.lg,
                alignItems: 'center',
                gap: theme.spacing.sm,
              }}
            >
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 16,
                  backgroundColor: isCompleted ? colors.successSoft : colors.brandSoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons
                  name={isCompleted ? 'navigate-outline' : 'cube-outline'}
                  size={26}
                  color={isCompleted ? colors.success : colors.brand}
                />
              </View>
              <AppText variant="heading" weight="semibold" style={{ textAlign: 'center' }}>
                {isCompleted
                  ? t('mobile.deliveryLoad.emptyCompletedTitle')
                  : t('mobile.deliveryLoad.emptyOpenTitle')}
              </AppText>
              <AppText
                variant="caption"
                color="secondary"
                style={{ textAlign: 'center', maxWidth: 280 }}
              >
                {isCompleted
                  ? t('mobile.deliveryLoad.emptyCompletedBody')
                  : t('mobile.deliveryLoad.emptyOpenBody')}
              </AppText>
            </View>
          </View>
        }
        renderItem={({ item, index }) => (
          <DeliveryFloorOrderCard item={item} index={index} completed={isCompleted} />
        )}
      />
    </AppScreen>
  );
}
