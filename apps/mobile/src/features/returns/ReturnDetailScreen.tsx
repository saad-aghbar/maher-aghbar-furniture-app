import { useState, type ReactNode } from 'react';
import type { Href } from 'expo-router';
import { Image, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { ActionSheet } from '@/components/sheets/ActionSheet';
import { ConfirmationSheet } from '@/components/sheets/ConfirmationSheet';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { resolveOrderMediaUri } from '@/features/sales-orders/components/OrderCardMedia';
import { useLocale } from '@/i18n';
import { haptics } from '@/motion';
import { SURFACE_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import { useTheme } from '@/theme';
import { ReturnPhotoGallery } from './components/ReturnPhotoGallery';
import { useResolveReturnMutation, useReturnQuery, useSetReturnFateMutation } from './query';
import {
  RETURN_FATE_OPTIONS,
  returnFateLabelKey,
  selectReturnCard,
} from './selectReturn';

type Props = { returnId: string };

export function ReturnDetailScreen({ returnId }: Props) {
  const { user } = useAuth();
  const { t, locale, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const insets = useSafeAreaInsets();
  const { showOfflineBanner } = useNetwork();
  const { showToast } = useToast();
  const canRead = can(user, 'sales-order.read');
  const canResolve = can(user, 'sales-order.update');
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const backFallback = '/(app)/(admin)/returns' as Href;

  const [confirm, setConfirm] = useState<'APPROVED' | 'REJECTED' | null>(null);
  const [dispositionOpen, setDispositionOpen] = useState(false);
  const query = useReturnQuery(returnId, canRead);
  const resolveMutation = useResolveReturnMutation(returnId);
  const fateMutation = useSetReturnFateMutation(returnId);

  const label = (key: string, fallback: string) => {
    const v = t(key);
    return v === key ? fallback : v;
  };

  if (!canRead) {
    return (
      <AppScreen backFallback={backFallback}>
        <EmptyState title={t('mobile.noModules')} description={t('mobile.noModulesHint')} />
      </AppScreen>
    );
  }

  if (query.isError && !query.data) {
    return (
      <AppScreen backFallback={backFallback}>
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
      <AppScreen backFallback={backFallback}>
        <AppText>{t('mobile.returns.loading')}</AppText>
      </AppScreen>
    );
  }

  const card = selectReturnCard(row, locale);
  const reasonLabel = (() => {
    const fromCatalog = t(card.reasonLabelKey);
    if (fromCatalog && fromCatalog !== card.reasonLabelKey) return fromCatalog;
    return t(`mobile.returns.reasons.${card.reason}`);
  })();
  const productUri = resolveOrderMediaUri(card.productImageUrl);

  return (
    <AppScreen backFallback={backFallback}>
      {showOfflineBanner ? <OfflineBanner /> : null}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          gap: theme.spacing.md,
          paddingBottom:
            insets.bottom + SURFACE_TAB_BAR_CLEARANCE + theme.spacing['3xl'],
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
            <StatusBadge
              status={card.approvalStatus}
              label={
                card.beingResolved
                  ? label('mobile.returns.beingResolved', 'Being resolved')
                  : undefined
              }
              dot
            />
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
              <AppText
                variant="caption"
                color="secondary"
                numberOfLines={1}
                style={{ textAlign: isRTL ? 'right' : 'left' }}
              >
                {card.dealerName}
              </AppText>
            </View>
          </View>
        </View>

        {canResolve && card.beingResolved ? (
          <FloorBoard>
            <View
              style={{
                paddingHorizontal: theme.spacing.md,
                paddingTop: theme.spacing.md,
                paddingBottom: theme.spacing.sm,
              }}
            >
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
                {label('mobile.returns.nextAction', 'Next action')}
              </AppText>
            </View>
            <View
              style={{
                paddingHorizontal: theme.spacing.md,
                paddingBottom: theme.spacing.md,
              }}
            >
              <PrimaryButton
                label={label(
                  'mobile.returns.receiveDisposition',
                  'Receive / set disposition',
                )}
                onPress={() => setDispositionOpen(true)}
                loading={fateMutation.isPending}
                style={{
                  borderRadius: theme.radius.xl,
                  alignSelf: 'stretch',
                  width: '100%',
                }}
              />
            </View>
          </FloorBoard>
        ) : null}

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
                label={label('sales.dealerOrderNumber', 'Dealer order #')}
                value={card.dealerOrderNumber}
                ltr
                isRTL={isRTL}
              />
            ) : null}
          </View>
        </FloorBoard>

        {card.reasonPhotoUrls.length ? (
          <ReturnPhotoGallery
            title={label('catalog.reasonPhoto', 'Reason')}
            uris={card.reasonPhotoUrls}
            emptyLabel={label('catalog.noReturnPhoto', 'No photo')}
            icon="document-text-outline"
          />
        ) : null}

        {card.issuePhotoUrls.length ? (
          <ReturnPhotoGallery
            title={label('catalog.issuePhoto', 'Damage')}
            uris={card.issuePhotoUrls}
            emptyLabel={label('catalog.noReturnPhoto', 'No photo')}
            icon="alert-circle-outline"
          />
        ) : null}

        {card.description ? (
          <FloorBoard>
            <View
              style={{
                paddingHorizontal: theme.spacing.md,
                paddingTop: theme.spacing.md,
                paddingBottom: theme.spacing.md,
                gap: 4,
              }}
            >
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
                {label('mobile.returns.notes', 'Notes')}
              </AppText>
              <AppText
                weight="semibold"
                style={{
                  textAlign: isRTL ? 'right' : 'left',
                  fontSize: 15,
                  color: colors.textPrimary,
                }}
              >
                {card.description}
              </AppText>
            </View>
          </FloorBoard>
        ) : null}

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
              showToast({ variant: 'success', message: t('mobile.returns.resolveSuccess') });
            },
            onError: () => {
              void haptics.error();
              showToast({ variant: 'error', message: t('mobile.returns.resolveFailed') });
            },
          });
        }}
      />

      <ActionSheet
        open={dispositionOpen}
        onClose={() => setDispositionOpen(false)}
        title={label('mobile.returns.dispositionTitle', 'Set disposition')}
        cancelLabel={t('mobile.returns.cancel')}
        actions={RETURN_FATE_OPTIONS.map((fate) => {
          const key = returnFateLabelKey(fate);
          const translated = t(key);
          return {
            label: translated === key ? fate.replace(/_/g, ' ') : translated,
            onPress: () => {
              fateMutation.mutate(fate, {
                onSuccess: () => {
                  void haptics.confirmMedium();
                  showToast({
                    variant: 'success',
                    message: t('inventory.fateApplied'),
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
            },
          };
        })}
      />
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
