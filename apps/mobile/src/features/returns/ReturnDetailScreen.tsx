import { useState, type ReactNode } from 'react';
import type { Href } from 'expo-router';
import { ActivityIndicator, Image, ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { can } from '@maher/permissions';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { useToast } from '@/components/feedback/Toast';
import { AppScreen } from '@/components/layout/AppScreen';
import { useNetwork } from '@/components/network/NetworkProvider';
import { ConfirmationSheet } from '@/components/sheets/ConfirmationSheet';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { resolveOrderMediaUri } from '@/features/sales-orders/components/OrderCardMedia';
import { useLocale } from '@/i18n';
import { haptics } from '@/motion';
import { SURFACE_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import { useTheme } from '@/theme';
import { ReturnPhotoGallery } from './components/ReturnPhotoGallery';
import { useResolveReturnMutation, useReturnQuery } from './query';
import {
  returnLifecycleBadgeStatus,
  returnNextActionKey,
  returnPhysicalLabelKey,
  selectReturnCard,
} from './selectReturn';

type Props = {
  returnId: string;
  /** Dealer surface: human lifecycle, need-info note, no admin resolve actions. */
  dealerFacing?: boolean;
  backFallback?: Href;
};

export function ReturnDetailScreen({
  returnId,
  dealerFacing = false,
  backFallback,
}: Props) {
  const { user } = useAuth();
  const { t, locale, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const { showOfflineBanner } = useNetwork();
  const { showToast } = useToast();
  const canRead = can(user, 'sales-order.read');
  const canResolve = !dealerFacing && can(user, 'sales-order.update');
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const resolvedBack =
    backFallback ??
    ((dealerFacing
      ? '/(app)/(customer)/returns'
      : '/(app)/(admin)/returns') as Href);

  const [confirm, setConfirm] = useState<'APPROVED' | 'REJECTED' | null>(null);
  const query = useReturnQuery(returnId, canRead);
  const resolveMutation = useResolveReturnMutation(returnId);

  const label = (key: string, fallback: string) => {
    const v = t(key);
    return v === key ? fallback : v;
  };

  if (!canRead) {
    return (
      <AppScreen backFallback={resolvedBack}>
        <EmptyState title={t('mobile.noModules')} description={t('mobile.noModulesHint')} />
      </AppScreen>
    );
  }

  if (query.isError && !query.data) {
    return (
      <AppScreen backFallback={resolvedBack}>
        {showOfflineBanner ? <OfflineBanner /> : null}
        <ErrorState
          title={t('mobile.returns.errorTitle')}
          description={t('mobile.returns.errorBody')}
          retryLabel={t('mobile.returns.retry')}
          onRetry={() => void query.refetch()}
        />
      </AppScreen>
    );
  }

  const row = query.data;
  if (!row) {
    return (
      <AppScreen backFallback={resolvedBack}>
        {showOfflineBanner ? <OfflineBanner /> : null}
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            gap: theme.spacing.md,
            paddingVertical: theme.spacing['3xl'],
          }}
        >
          <ActivityIndicator color={colors.brand} />
          <AppText variant="caption" color="muted">
            {t('mobile.returns.loading')}
          </AppText>
        </View>
      </AppScreen>
    );
  }

  const card = selectReturnCard(row, locale);
  const lifecycleLabel = (() => {
    const v = t(card.lifecycleLabelKey);
    return v === card.lifecycleLabelKey
      ? card.lifecyclePhase.replace(/_/g, ' ')
      : v;
  })();
  const reasonLabel = (() => {
    const fromCatalog = t(card.reasonLabelKey);
    if (fromCatalog && fromCatalog !== card.reasonLabelKey) return fromCatalog;
    return t(`mobile.returns.reasons.${card.reason}`);
  })();
  const productUri = resolveOrderMediaUri(card.productImageUrl);
  const badgeStatus = returnLifecycleBadgeStatus(card.lifecyclePhase);
  const badgeLabel = lifecycleLabel;
  const nextAction = t(
    returnNextActionKey(card.lifecyclePhase, {
      dealerFacing,
      needsInfo: card.needsInfo,
    }),
  );
  const physicalRaw = t(returnPhysicalLabelKey(card.physicalStatus));
  const physicalLabel =
    physicalRaw === returnPhysicalLabelKey(card.physicalStatus)
      ? card.physicalStatus.replace(/_/g, ' ')
      : physicalRaw;

  return (
    <AppScreen backFallback={resolvedBack}>
      {showOfflineBanner ? <OfflineBanner /> : null}
      <ScrollView
        contentContainerStyle={{
          gap: theme.spacing.md,
          paddingBottom: theme.spacing['3xl'] + SURFACE_TAB_BAR_CLEARANCE,
        }}
      >
        <View
          style={{
            borderRadius: theme.radius.xl,
            borderWidth: 1,
            borderColor: colors.borderStrong,
            backgroundColor: colors.surface,
            overflow: 'hidden',
            ...orderBoardShadow(colorScheme),
          }}
        >
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: theme.spacing.md,
              paddingHorizontal: theme.spacing.lg,
              paddingVertical: theme.spacing.md,
              backgroundColor: colors.surfaceSecondary,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <StatusBadge status={badgeStatus} label={badgeLabel} dot />
            <AppText
              variant="caption"
              color="muted"
              style={{
                textTransform: locale === 'ar' ? 'none' : 'uppercase',
                letterSpacing: 0.6,
                fontSize: 10,
              }}
            >
              {label('navigation.returns', 'Returns')}
            </AppText>
          </View>

          <View
            style={{
              padding: theme.spacing.lg,
              gap: theme.spacing.md,
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
            }}
          >
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.brandSoft,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Ionicons name="return-down-back-outline" size={22} color={colors.brand} />
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
              <AppText
                variant="title"
                weight={titleWeight}
                dir="ltr"
                style={{ textAlign: isRTL ? 'right' : 'left', fontSize: 22 }}
              >
                {card.number}
              </AppText>
              <AppText
                weight={titleWeight}
                numberOfLines={2}
                style={{
                  textAlign: isRTL ? 'right' : 'left',
                  fontSize: 15,
                  color: colors.textPrimary,
                }}
              >
                {card.productDesc}
              </AppText>
              {!dealerFacing ? (
                <AppText
                  variant="caption"
                  color="secondary"
                  numberOfLines={1}
                  style={{ textAlign: isRTL ? 'right' : 'left' }}
                >
                  {card.dealerName}
                </AppText>
              ) : (
                <AppText
                  variant="caption"
                  color="secondary"
                  numberOfLines={1}
                  style={{ textAlign: isRTL ? 'right' : 'left' }}
                >
                  {lifecycleLabel}
                </AppText>
              )}
            </View>
          </View>
        </View>

        {dealerFacing && card.needsInfo && card.needInfoNote ? (
          <View
            style={{
              borderRadius: theme.radius.xl,
              borderWidth: 1,
              borderColor: colors.borderStrong,
              backgroundColor: colors.surfaceSecondary,
              padding: theme.spacing.lg,
              gap: theme.spacing.sm,
              ...orderBoardShadow(colorScheme),
            }}
          >
            <AppText
              variant="caption"
              weight="semibold"
              style={{
                color: colors.brand,
                textTransform: locale === 'ar' ? 'none' : 'uppercase',
                letterSpacing: 0.5,
                fontSize: 11,
                textAlign: isRTL ? 'right' : 'left',
              }}
            >
              {t('mobile.returns.needInfoTitle')}
            </AppText>
            <AppText
              variant="body"
              style={{
                textAlign: isRTL ? 'right' : 'left',
                lineHeight: 22,
                color: colors.textPrimary,
              }}
            >
              {card.needInfoNote}
            </AppText>
          </View>
        ) : null}

        <View
          style={{
            borderRadius: theme.radius.xl,
            borderWidth: 1,
            borderColor: colors.brand,
            backgroundColor: colors.brandSoft,
            padding: theme.spacing.lg,
            gap: theme.spacing.sm,
            ...orderBoardShadow(colorScheme),
          }}
        >
          <AppText
            variant="caption"
            weight="semibold"
            style={{
              color: colors.brand,
              textTransform: locale === 'ar' ? 'none' : 'uppercase',
              letterSpacing: 0.5,
              fontSize: 11,
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {label('mobile.returns.nextAction', 'Next action')}
          </AppText>
          <AppText
            variant="body"
            weight={titleWeight}
            style={{
              textAlign: isRTL ? 'right' : 'left',
              color: colors.textPrimary,
            }}
          >
            {nextAction}
          </AppText>
        </View>

        {productUri ? (
          <View
            style={{
              borderRadius: theme.radius.xl,
              overflow: 'hidden',
              borderWidth: 1,
              borderColor: colors.borderStrong,
              height: 180,
              ...orderBoardShadow(colorScheme),
            }}
          >
            <Image
              source={{ uri: productUri }}
              style={{ width: '100%', height: '100%' }}
              resizeMode="cover"
            />
            <View
              style={{
                position: 'absolute',
                top: theme.spacing.sm,
                ...(isRTL ? { left: theme.spacing.sm } : { right: theme.spacing.sm }),
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: theme.radius.md,
                backgroundColor: 'rgba(28,24,20,0.5)',
              }}
            >
              <AppText
                variant="caption"
                weight="semibold"
                style={{ color: '#fff', fontSize: 10 }}
              >
                {label('catalog.productPhoto', 'Catalog')}
              </AppText>
            </View>
          </View>
        ) : null}

        <FloorBoard>
          <View style={{ paddingHorizontal: theme.spacing.md, paddingTop: theme.spacing.md }}>
            <AppText
              variant="caption"
              weight="semibold"
              style={{
                textTransform: locale === 'ar' ? 'none' : 'uppercase',
                letterSpacing: 0.55,
                fontSize: 11,
                color: colors.brand,
                textAlign: isRTL ? 'right' : 'left',
              }}
            >
              {label('mobile.returns.item', 'Details')}
            </AppText>
          </View>
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              flexWrap: 'wrap',
              gap: theme.spacing.sm,
              padding: theme.spacing.md,
            }}
          >
            <FactChip
              label={label('mobile.returns.reason', 'Reason')}
              value={reasonLabel}
              emphasize
              isRTL={isRTL}
            />
            <FactChip
              label={label('mobile.returns.quantity', 'Qty')}
              value={card.quantityLabel}
              ltr
              isRTL={isRTL}
            />
            <FactChip
              label={label('mobile.returns.physicalState', 'Physical')}
              value={physicalLabel}
              isRTL={isRTL}
            />
            <FactChip
              label={label('mobile.returns.resolutionState', 'Resolution')}
              value={lifecycleLabel}
              isRTL={isRTL}
            />
            {card.salesOrderNumber ? (
              <FactChip
                label={label('mobile.returns.order', 'Order')}
                value={card.salesOrderNumber}
                ltr
                isRTL={isRTL}
              />
            ) : null}
            {card.dealerOrderNumber ? (
              <FactChip
                label={
                  dealerFacing
                    ? t('mobile.dealerAccount.yourOrderNumber')
                    : label('sales.dealerOrderNumber', 'Dealer order #')
                }
                value={card.dealerOrderNumber}
                ltr
                isRTL={isRTL}
              />
            ) : null}
          </View>
          {card.description ? (
            <View
              style={{
                marginHorizontal: theme.spacing.md,
                marginBottom: theme.spacing.md,
                borderRadius: theme.radius.lg,
                backgroundColor: colors.surfaceSecondary,
                borderWidth: 1,
                borderColor: colors.border,
                paddingHorizontal: theme.spacing.md,
                paddingVertical: theme.spacing.sm + 2,
                gap: 4,
              }}
            >
              <AppText
                variant="caption"
                color="muted"
                style={{
                  textTransform: locale === 'ar' ? 'none' : 'uppercase',
                  letterSpacing: 0.45,
                  fontSize: 10,
                  textAlign: isRTL ? 'right' : 'left',
                }}
              >
                {label('mobile.returns.notes', 'Notes')}
              </AppText>
              <AppText
                variant="caption"
                color="secondary"
                style={{
                  textAlign: isRTL ? 'right' : 'left',
                  lineHeight: 18,
                  fontSize: 13,
                }}
              >
                {card.description}
              </AppText>
            </View>
          ) : null}
        </FloorBoard>

        <ReturnPhotoGallery
          title={label('catalog.reasonPhoto', 'Reason')}
          uris={card.reasonPhotoUrls}
          emptyLabel={label('catalog.noReturnPhoto', 'No photo')}
          icon="document-text-outline"
        />

        <ReturnPhotoGallery
          title={label('catalog.issuePhoto', 'Damage')}
          uris={card.issuePhotoUrls}
          emptyLabel={label('catalog.noReturnPhoto', 'No photo')}
          icon="alert-circle-outline"
        />

        {canResolve && card.isPending ? (
          <View style={{ gap: theme.spacing.sm, paddingTop: theme.spacing.xs }}>
            <PrimaryButton
              label={t('mobile.returns.approve')}
              onPress={() => setConfirm('APPROVED')}
              style={{ borderRadius: theme.radius.xl }}
            />
            <SecondaryButton
              label={t('mobile.returns.reject')}
              onPress={() => setConfirm('REJECTED')}
              style={{ borderRadius: theme.radius.xl }}
            />
          </View>
        ) : null}
      </ScrollView>

      {canResolve ? (
        <ConfirmationSheet
          open={Boolean(confirm)}
          onClose={() => setConfirm(null)}
          title={
            confirm === 'APPROVED'
              ? t('mobile.returns.approve')
              : t('mobile.returns.reject')
          }
          message={
            confirm === 'APPROVED'
              ? t('mobile.returns.approveConfirm')
              : t('mobile.returns.rejectConfirm')
          }
          confirmLabel={t('mobile.returns.confirm')}
          cancelLabel={t('mobile.returns.cancel')}
          destructive={confirm === 'REJECTED'}
          onConfirm={() => {
            if (!confirm) return;
            resolveMutation.mutate(confirm, {
              onSuccess: () => {
                void haptics.confirmMedium();
                showToast({
                  variant: 'success',
                  message: t('mobile.returns.resolveSuccess'),
                });
              },
              onError: () => {
                void haptics.error();
                showToast({
                  variant: 'error',
                  message: t('mobile.returns.resolveFailed'),
                });
              },
            });
          }}
        />
      ) : null}
    </AppScreen>
  );
}

function FloorBoard({ children }: { children: ReactNode }) {
  const { colors, theme, colorScheme } = useTheme();
  return (
    <View
      style={{
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: colors.borderStrong,
        backgroundColor: colors.surface,
        overflow: 'hidden',
        ...orderBoardShadow(colorScheme),
      }}
    >
      {children}
    </View>
  );
}

function FactChip({
  label,
  value,
  emphasize,
  ltr,
  isRTL,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
  ltr?: boolean;
  isRTL: boolean;
}) {
  const { colors, theme } = useTheme();
  return (
    <View
      style={{
        minWidth: '46%',
        flexGrow: 1,
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: emphasize ? colors.brand : colors.border,
        backgroundColor: emphasize ? colors.brandSoft : colors.surfaceSecondary,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm + 2,
        gap: 4,
      }}
    >
      <AppText
        variant="caption"
        color="muted"
        style={{
          textTransform: 'uppercase',
          letterSpacing: 0.4,
          fontSize: 10,
          textAlign: isRTL ? 'right' : 'left',
        }}
      >
        {label}
      </AppText>
      <AppText
        weight="semibold"
        dir={ltr ? 'ltr' : undefined}
        numberOfLines={2}
        style={{
          fontSize: 13,
          color: emphasize ? colors.brand : colors.textPrimary,
          textAlign: isRTL ? 'right' : 'left',
        }}
      >
        {value}
      </AppText>
    </View>
  );
}
