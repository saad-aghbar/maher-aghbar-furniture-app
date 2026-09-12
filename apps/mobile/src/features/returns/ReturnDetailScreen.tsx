import { useState, type ReactNode } from 'react';
import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Image, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { can, canAny } from '@maher/permissions';
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
import { ScreenBackLead } from '@/components/layout/ScreenBackLead';
import { useNetwork } from '@/components/network/NetworkProvider';
import { AppTextInput } from '@/components/forms/AppTextInput';
import { ConfirmationSheet } from '@/components/sheets/ConfirmationSheet';
import { ReturnPieceDecisionSheet } from './components/ReturnPieceDecisionSheet';
import { ReturnLinkageCard } from './components/ReturnLinkageCard';
import { ReturnPiecesBoard } from './components/ReturnPiecesBoard';
import { ReturnReceiveSheet } from './components/ReturnReceiveSheet';
import { ReturnResponsibilityBoard } from './components/ReturnResponsibilityBoard';
import { ReturnPieceSheet } from './components/ReturnPieceSheet';
import { DealerBoard } from '@/features/dealers/components/DealerBoard';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { resolveOrderMediaUri } from '@/features/sales-orders/components/OrderCardMedia';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { SURFACE_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import { useTheme } from '@/theme';
import { ReturnJourneyRail } from './components/ReturnJourneyRail';
import { ReturnPhotoGallery } from './components/ReturnPhotoGallery';
import { returnCtaStyle } from './components/returnFloorCta';
import {
  useCancelReturnMutation,
  useCancelReturnPieceMutation,
  useChargeReturnMutation,
  useDecidePiecesMutation,
  useMarkReturnReadyMutation,
  useMarkReturnSentMutation,
  useNeedInfoReturnMutation,
  useReceiveReturnMutation,
  useResolveReturnMutation,
  useReturnQuery,
  useRespondReturnChargeMutation,
  useScheduleReshipMutation,
  useSendReturnChargeMutation,
  useSetResponsibilityMutation,
} from './query';
import type { ReturnPiece } from './api';
import { canDecidePiece } from './returnPiece';
import { useWorkflowsQuery } from '@/features/workflow/query';
import { isReturnWorkflowScope } from '@maher/types';
import {
  returnLifecycleBadgeStatus,
  returnNextActionKey,
  returnPhysicalLabelKey,
  selectReturnCard,
} from './selectReturn';
import type { ReturnResolution } from './api';

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
  const router = useRouter();
  const { t, locale, isRTL, formatCurrency } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const pill = returnCtaStyle(theme);
  const insets = useSafeAreaInsets();
  const { showOfflineBanner } = useNetwork();
  const { showToast } = useToast();
  const canRead = canAny(user, ['return.read', 'sales-order.read']);
  const canApprove = !dealerFacing && canAny(user, ['return.approve', 'sales-order.update']);
  const canReceive = !dealerFacing && canAny(user, ['return.receive', 'sales-order.update']);
  const canInspect = !dealerFacing && canAny(user, ['return.inspect', 'sales-order.update']);
  const canWork = !dealerFacing && canAny(user, ['return.work', 'sales-order.update']);
  const canSend = dealerFacing && canAny(user, ['return.create', 'sales-order.read']);
  const canResolve = canApprove;
  const canReadCost = !dealerFacing && can(user, 'inventory.cost.read');
  const canCharge = !dealerFacing && canAny(user, ['return.inspect', 'invoice.create', 'sales-order.update']);
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const resolvedBack =
    backFallback ??
    ((dealerFacing
      ? '/(app)/(customer)/returns'
      : '/(app)/(admin)/returns') as Href);

  const [confirm, setConfirm] = useState<
    | 'APPROVED'
    | 'REJECTED'
    | 'NEED_INFO'
    | 'RECEIVE'
    | 'SENT'
    | 'RESHIP'
    | 'CHARGE'
    | 'READY'
    | 'CANCEL'
    | null
  >(null);
  const [decisionOpen, setDecisionOpen] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [selectedPiece, setSelectedPiece] = useState<ReturnPiece | null>(null);
  const [reshipAddress, setReshipAddress] = useState('');
  const [reshipNotes, setReshipNotes] = useState('');
  const [chargeDraft, setChargeDraft] = useState('');
  const [resolution, setResolution] = useState<Exclude<ReturnResolution, 'REJECTED'>>('REPAIR');
  const query = useReturnQuery(returnId, canRead);
  const resolveMutation = useResolveReturnMutation(returnId);
  const needInfoMutation = useNeedInfoReturnMutation(returnId);
  const receiveMutation = useReceiveReturnMutation(returnId);
  const sentMutation = useMarkReturnSentMutation(returnId);
  const decidePiecesMutation = useDecidePiecesMutation(returnId);
  const workflowsQuery = useWorkflowsQuery(decisionOpen && !dealerFacing);
  const reshipMutation = useScheduleReshipMutation(returnId);
  const chargeMutation = useChargeReturnMutation(returnId);
  const responsibilityMutation = useSetResponsibilityMutation(returnId);
  const sendChargeMutation = useSendReturnChargeMutation(returnId);
  const respondChargeMutation = useRespondReturnChargeMutation(returnId);
  const readyMutation = useMarkReturnReadyMutation(returnId);
  const cancelMutation = useCancelReturnMutation(returnId);
  const cancelPieceMutation = useCancelReturnPieceMutation(returnId);

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
  const receivedForDecision =
    card.physicalStatus === 'RETURNED' ||
    row.lifecycleState === 'RECEIVED' ||
    row.lifecycleState === 'INSPECTING';
  const pieces = row.pieces ?? [];
  const canOpenDecision =
    (canInspect || canWork) &&
    receivedForDecision &&
    pieces.some((piece) => canDecidePiece(piece));

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
    <AppScreen edges={{ top: true, bottom: false }}>
      {showOfflineBanner ? <OfflineBanner /> : null}
      <DetailTitle
        title={card.number}
        titleWeight={titleWeight}
        backFallback={resolvedBack}
      />
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
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              ...(isRTL ? { right: 0 } : { left: 0 }),
              width: 3,
              backgroundColor: colors.brand,
              opacity: 0.55,
            }}
          />
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: theme.spacing.md,
              paddingHorizontal: theme.spacing.lg,
              paddingVertical: theme.spacing.md,
              ...(isRTL
                ? { paddingRight: theme.spacing.lg + 4 }
                : { paddingLeft: theme.spacing.lg + 4 }),
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
              ...(isRTL
                ? { paddingRight: theme.spacing.lg + 4 }
                : { paddingLeft: theme.spacing.lg + 4 }),
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

        <ReturnJourneyRail
          phase={card.lifecyclePhase}
          physicalStatus={card.physicalStatus}
          approvalStatus={card.approvalStatus}
          inventoryFate={card.inventoryFate}
          lifecycleState={row.lifecycleState}
        />

        {dealerFacing && card.needsInfo && card.needInfoNote ? (
          <DealerBoard
            title={t('mobile.returns.needInfoTitle')}
            titleWeight={titleWeight}
            accentColor={colors.warning}
          >
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
          </DealerBoard>
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
            {row.responsibility && row.responsibility !== 'UNDETERMINED' ? (
              <FactChip
                label={t('mobile.returns.responsibility')}
                value={t(`mobile.returns.responsibilityOption.${row.responsibility}`)}
                isRTL={isRTL}
              />
            ) : null}
            {row.chargeAmount != null && Number(row.chargeAmount) > 0 ? (
              <FactChip
                label={t('mobile.returns.chargeTitle')}
                value={formatCurrency(Number(row.chargeAmount))}
                ltr
                isRTL={isRTL}
              />
            ) : null}
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
        </FloorBoard>

        <ReturnPiecesBoard
          pieces={pieces}
          dealerFacing={dealerFacing}
          onPiecePress={setSelectedPiece}
        />

        <ReturnResponsibilityBoard
          row={row}
          dealerFacing={dealerFacing}
          canEdit={canInspect}
          canCharge={canCharge}
          saving={responsibilityMutation.isPending}
          sending={sendChargeMutation.isPending}
          responding={respondChargeMutation.isPending}
          charging={chargeMutation.isPending}
          onSave={(body) => {
            responsibilityMutation.mutate(body, {
              onSuccess: () => {
                void haptics.confirmMedium();
                showToast({ variant: 'success', message: t('mobile.returns.responsibilitySaved') });
              },
              onError: () => {
                void haptics.error();
                showToast({ variant: 'error', message: t('mobile.returns.responsibilityFailed') });
              },
            });
          }}
          onSend={() => {
            sendChargeMutation.mutate(undefined, {
              onSuccess: () => {
                void haptics.confirmMedium();
                showToast({ variant: 'success', message: t('mobile.returns.chargeSent') });
              },
              onError: () => {
                void haptics.error();
                showToast({ variant: 'error', message: t('mobile.returns.chargeSendFailed') });
              },
            });
          }}
          onRespond={(body) => {
            respondChargeMutation.mutate(body, {
              onSuccess: () => {
                void haptics.confirmMedium();
                showToast({
                  variant: 'success',
                  message: body.accept
                    ? t('mobile.returns.chargeAccepted')
                    : t('mobile.returns.chargeRejected'),
                });
              },
              onError: () => {
                void haptics.error();
                showToast({ variant: 'error', message: t('mobile.returns.chargeRespondFailed') });
              },
            });
          }}
          onCharge={() => {
            if (!(Number(row.chargeAmount) > 0)) {
              showToast({ variant: 'error', message: t('mobile.returns.chargeNeedAmount') });
              return;
            }
            setChargeDraft(String(row.chargeAmount));
            setConfirm('CHARGE');
          }}
        />

        {!dealerFacing && pieces.some((piece) => (piece.recoveryLines ?? []).length > 0) ? (
          <DealerBoard title={t('mobile.returns.recoveryTitle')} titleWeight={titleWeight}>
            <View style={{ gap: theme.spacing.sm }}>
              {pieces.flatMap((piece) =>
                (piece.recoveryLines ?? []).map((line) => (
                  <View
                    key={line.id}
                    style={{
                      borderRadius: theme.radius.lg,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.surfaceSecondary,
                      padding: theme.spacing.md,
                    }}
                  >
                    <AppText weight={titleWeight} dir="ltr">
                      {piece.code} · {line.label}
                    </AppText>
                    <AppText variant="caption" color="muted" dir="ltr">
                      {String(line.quantity)} {line.unit} · {line.outcome}
                    </AppText>
                  </View>
                )),
              )}
            </View>
          </DealerBoard>
        ) : null}

        <ReturnLinkageCard row={row} dealerFacing={dealerFacing} />

        {canReadCost && row.reworkCost ? (
          <DealerBoard title={t('mobile.returns.reworkCostTitle')} titleWeight={titleWeight}>
            <AppText variant="caption" color="muted">
              {t('mobile.returns.reworkCostHint')}
            </AppText>
            <View
              style={{
                borderRadius: theme.radius.lg,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surfaceSecondary,
                padding: theme.spacing.md,
                gap: theme.spacing.sm,
              }}
            >
              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  justifyContent: 'space-between',
                  gap: theme.spacing.md,
                }}
              >
                <AppText variant="caption" color="muted">
                  {t('mobile.orderDetail.mfgCostEstimated')}
                </AppText>
                <AppText variant="body" weight={titleWeight}>
                  {row.reworkCost.estimatedTotal != null
                    ? formatCurrency(Number(row.reworkCost.estimatedTotal))
                    : '—'}
                </AppText>
              </View>
              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  justifyContent: 'space-between',
                  gap: theme.spacing.md,
                }}
              >
                <AppText variant="caption" color="muted">
                  {t('mobile.orderDetail.mfgCostActual')}
                </AppText>
                <AppText variant="body" weight={titleWeight}>
                  {row.reworkCost.actualTotal != null
                    ? formatCurrency(Number(row.reworkCost.actualTotal))
                    : '—'}
                </AppText>
              </View>
            </View>
          </DealerBoard>
        ) : null}

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
            <FloorBoard>
              <View style={{ padding: theme.spacing.md, gap: theme.spacing.sm }}>
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
                  {t('mobile.returns.approveResolutionHint')}
                </AppText>
                <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: theme.spacing.sm }}>
                  {([
                    ['REPAIR', 'mobile.returns.resolutionRepair'],
                    ['REPLACEMENT', 'mobile.returns.resolutionReplacement'],
                  ] as const).map(([value, key]) => {
                    const selected = resolution === value;
                    return (
                      <AnimatedPressable
                        key={value}
                        variant="button"
                        onPress={() => {
                          void haptics.selection();
                          setResolution(value);
                        }}
                        style={{
                          flex: 1,
                          minHeight: 44,
                          borderRadius: theme.radius.lg,
                          borderWidth: 1,
                          borderColor: selected ? colors.brand : colors.border,
                          backgroundColor: selected ? colors.brandSoft : colors.surfaceSecondary,
                          paddingHorizontal: theme.spacing.sm,
                          paddingVertical: theme.spacing.sm,
                          justifyContent: 'center',
                          overflow: 'hidden',
                        }}
                      >
                        {selected ? (
                          <View
                            pointerEvents="none"
                            style={{
                              position: 'absolute',
                              top: 0,
                              bottom: 0,
                              width: 3,
                              backgroundColor: colors.brand,
                              ...(isRTL ? { right: 0 } : { left: 0 }),
                            }}
                          />
                        ) : null}
                        <AppText
                          weight={titleWeight}
                          style={{
                            fontSize: 13,
                            color: selected ? colors.brand : colors.textPrimary,
                            textAlign: isRTL ? 'right' : 'left',
                          }}
                        >
                          {t(key)}
                        </AppText>
                      </AnimatedPressable>
                    );
                  })}
                </View>
              </View>
            </FloorBoard>
            <PrimaryButton
              label={t('mobile.returns.approve')}
              onPress={() => setConfirm('APPROVED')}
              style={pill}
            />
            <SecondaryButton
              label={t('mobile.returns.reject')}
              onPress={() => setConfirm('REJECTED')}
              style={pill}
            />
            <SecondaryButton
              label={t('mobile.returns.needInfo')}
              onPress={() => setConfirm('NEED_INFO')}
              style={pill}
            />
          </View>
        ) : null}

        {canSend &&
        card.approvalStatus === 'APPROVED' &&
        (card.physicalStatus === 'WAITING_RETURN' || row.lifecycleState === 'APPROVED') ? (
          <View style={{ gap: theme.spacing.sm, paddingTop: theme.spacing.xs }}>
            <PrimaryButton
              label={t('mobile.returns.confirmSent')}
              onPress={() => setConfirm('SENT')}
              style={pill}
            />
          </View>
        ) : null}

        {canReceive &&
        (card.physicalStatus === 'WAITING_RETURN' ||
          row.lifecycleState === 'APPROVED' ||
          row.lifecycleState === 'IN_TRANSIT' ||
          pieces.some((piece) => piece.state === 'AWAITING_RECEIPT')) ? (
          <View style={{ gap: theme.spacing.sm, paddingTop: theme.spacing.xs }}>
            <PrimaryButton
              label={t('mobile.returns.receive')}
              onPress={() => setReceiveOpen(true)}
              style={pill}
            />
          </View>
        ) : null}

        {canOpenDecision ? (
          <View style={{ gap: theme.spacing.sm, paddingTop: theme.spacing.xs }}>
            <PrimaryButton
              label={t('mobile.returns.decisionTitle')}
              onPress={() => setDecisionOpen(true)}
              style={pill}
            />
          </View>
        ) : null}

        {(canInspect || canWork) &&
        pieces.some((piece) => piece.state === 'DECIDED' || piece.state === 'IN_PROGRESS') ? (
          <View style={{ gap: theme.spacing.sm, paddingTop: theme.spacing.xs }}>
            <SecondaryButton
              label={t('mobile.returns.readyToReturn')}
              onPress={() => setConfirm('READY')}
              style={pill}
            />
          </View>
        ) : null}

        {canWork &&
        (row.lifecycleState === 'READY_TO_RETURN' ||
          row.lifecycleState === 'REWORKING' ||
          row.lifecycleState === 'REPLACING' ||
          pieces.some((piece) => piece.state === 'READY_TO_RETURN')) ? (
          <View style={{ gap: theme.spacing.sm, paddingTop: theme.spacing.xs }}>
            <AppTextInput
              value={reshipAddress}
              onChangeText={setReshipAddress}
              placeholder={t('mobile.returns.reshipAddress')}
              style={{
                minHeight: 44,
                borderRadius: theme.radius.lg,
                borderWidth: 1,
                borderColor: colors.border,
                paddingHorizontal: theme.spacing.md,
                color: colors.textPrimary,
              }}
            />
            <AppTextInput
              value={reshipNotes}
              onChangeText={setReshipNotes}
              placeholder={t('mobile.returns.reshipNotes')}
              style={{
                minHeight: 44,
                borderRadius: theme.radius.lg,
                borderWidth: 1,
                borderColor: colors.border,
                paddingHorizontal: theme.spacing.md,
                color: colors.textPrimary,
              }}
            />
            <SecondaryButton
              label={t('mobile.returns.scheduleReship')}
              onPress={() => setConfirm('RESHIP')}
              style={pill}
            />
          </View>
        ) : null}

        {(canInspect || canWork) && row.lifecycleState !== 'COMPLETED' && row.lifecycleState !== 'REJECTED' ? (
          <View style={{ gap: theme.spacing.sm, paddingTop: theme.spacing.xs }}>
            <SecondaryButton
              label={t('mobile.returns.cancelReturn')}
              onPress={() => setConfirm('CANCEL')}
              style={pill}
            />
          </View>
        ) : null}
      </ScrollView>

      {canRead ? (
        <>
          <ConfirmationSheet
            open={confirm === 'APPROVED' || confirm === 'REJECTED'}
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
              if (confirm !== 'APPROVED' && confirm !== 'REJECTED') return;
              resolveMutation.mutate(
                {
                  status: confirm,
                  resolution: confirm === 'APPROVED' ? resolution : undefined,
                },
                {
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
                },
              );
            }}
          />
          <ConfirmationSheet
            open={confirm === 'NEED_INFO'}
            onClose={() => setConfirm(null)}
            title={t('mobile.returns.needInfo')}
            message={t('mobile.returns.needInfoConfirm')}
            confirmLabel={t('mobile.returns.needInfo')}
            cancelLabel={t('mobile.returns.cancel')}
            reasonLabel={t('mobile.returns.needInfo')}
            reasonPlaceholder={t('mobile.returns.needInfoPlaceholder')}
            reasonRequired
            onConfirm={(note) => {
              const trimmed = note?.trim() ?? '';
              if (!trimmed) return;
              needInfoMutation.mutate(trimmed, {
                onSuccess: () => {
                  void haptics.confirmMedium();
                  showToast({
                    variant: 'success',
                    message: t('mobile.returns.needInfoSuccess'),
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
          <ConfirmationSheet
            open={confirm === 'SENT'}
            onClose={() => setConfirm(null)}
            title={t('mobile.returns.confirmSent')}
            message={t('mobile.returns.confirmSentHint')}
            confirmLabel={t('mobile.returns.confirm')}
            cancelLabel={t('mobile.returns.cancel')}
            onConfirm={() => {
              sentMutation.mutate(undefined, {
                onSuccess: () => {
                  void haptics.confirmMedium();
                  showToast({ variant: 'success', message: t('mobile.returns.confirmSentSuccess') });
                },
                onError: () => {
                  void haptics.error();
                  showToast({ variant: 'error', message: t('mobile.returns.resolveFailed') });
                },
              });
            }}
          />
          <ReturnReceiveSheet
            open={receiveOpen}
            loading={receiveMutation.isPending}
            pieces={pieces}
            onClose={() => setReceiveOpen(false)}
            onConfirm={(body) => {
              receiveMutation.mutate(body, {
                onSuccess: () => {
                  void haptics.confirmMedium();
                  setReceiveOpen(false);
                  showToast({
                    variant: 'success',
                    message: t('mobile.returns.receiveSuccess'),
                  });
                },
                onError: () => {
                  void haptics.error();
                  showToast({
                    variant: 'error',
                    message: t('mobile.returns.receiveFailed'),
                  });
                },
              });
            }}
          />
          <ConfirmationSheet
            open={confirm === 'RESHIP'}
            onClose={() => setConfirm(null)}
            title={t('mobile.returns.scheduleReship')}
            message={t('mobile.returns.scheduleReship')}
            confirmLabel={t('mobile.returns.confirm')}
            cancelLabel={t('mobile.returns.cancel')}
            onConfirm={() => {
              reshipMutation.mutate(
                {
                  address: reshipAddress.trim() || undefined,
                  notes: reshipNotes.trim() || undefined,
                },
                {
                onSuccess: (result) => {
                  void haptics.confirmMedium();
                  showToast({
                    variant: 'success',
                    message: result.created
                      ? t('mobile.returns.reshipSuccess')
                      : t('mobile.returns.reshipSuccess'),
                  });
                },
                onError: () => {
                  void haptics.error();
                  showToast({ variant: 'error', message: t('mobile.returns.reshipFailed') });
                },
              });
            }}
          />
          <ConfirmationSheet
            open={confirm === 'CHARGE'}
            onClose={() => setConfirm(null)}
            title={t('mobile.returns.chargeTitle')}
            message={t('mobile.returns.chargeConfirmAmount', {
              amount: formatCurrency(Number(chargeDraft || row.chargeAmount || 0)),
            })}
            confirmLabel={t('mobile.returns.chargeFromCost')}
            cancelLabel={t('mobile.returns.cancel')}
            onConfirm={() => {
              const amount = Number(chargeDraft || row.chargeAmount || 0);
              if (!(amount > 0)) return;
              chargeMutation.mutate(
                { amount },
                {
                  onSuccess: () => {
                    void haptics.confirmMedium();
                    showToast({
                      variant: 'success',
                      message: t('mobile.returns.chargeSuccess'),
                    });
                  },
                  onError: () => {
                    void haptics.error();
                    showToast({
                      variant: 'error',
                      message: t('mobile.returns.chargeFailed'),
                    });
                  },
                },
              );
            }}
          />
          <ReturnPieceDecisionSheet
            open={decisionOpen}
            loading={decidePiecesMutation.isPending}
            returnNumber={row.number}
            pieces={pieces}
            workflows={(workflowsQuery.data ?? []).filter((workflow) =>
              isReturnWorkflowScope(workflow.scope),
            )}
            onClose={() => setDecisionOpen(false)}
            onConfirm={(items) => {
              decidePiecesMutation.mutate(items, {
                onSuccess: () => {
                  void haptics.confirmMedium();
                  setDecisionOpen(false);
                  showToast({
                    variant: 'success',
                    message: t('mobile.returns.pieceConfirmSuccess'),
                  });
                },
                onError: () => {
                  void haptics.error();
                  showToast({ variant: 'error', message: t('mobile.returns.pieceConfirmFailed') });
                },
              });
            }}
          />
          <ConfirmationSheet
            open={confirm === 'READY'}
            onClose={() => setConfirm(null)}
            title={t('mobile.returns.readyToReturn')}
            message={t('mobile.returns.readyToReturn')}
            confirmLabel={t('mobile.returns.confirm')}
            cancelLabel={t('mobile.returns.cancel')}
            onConfirm={() => {
              readyMutation.mutate(undefined, {
                onSuccess: () => {
                  void haptics.confirmMedium();
                  showToast({
                    variant: 'success',
                    message: t('mobile.returns.readyToReturnSuccess'),
                  });
                },
                onError: () => {
                  void haptics.error();
                  showToast({
                    variant: 'error',
                    message: t('mobile.returns.readyToReturnFailed'),
                  });
                },
              });
            }}
          />
          <ConfirmationSheet
            open={confirm === 'CANCEL'}
            onClose={() => setConfirm(null)}
            title={t('mobile.returns.cancelReturn')}
            message={t('mobile.returns.cancelReturnConfirm')}
            confirmLabel={t('mobile.returns.cancelReturn')}
            cancelLabel={t('mobile.returns.cancel')}
            destructive
            onConfirm={() => {
              cancelMutation.mutate(undefined, {
                onSuccess: () => {
                  void haptics.confirmMedium();
                  showToast({ variant: 'success', message: t('mobile.returns.cancelSuccess') });
                },
                onError: () => {
                  void haptics.error();
                  showToast({ variant: 'error', message: t('mobile.returns.cancelFailed') });
                },
              });
            }}
          />
          <ReturnPieceSheet
            piece={selectedPiece}
            dealerFacing={dealerFacing}
            canCancel={!dealerFacing && (canInspect || canWork)}
            cancelling={cancelPieceMutation.isPending}
            onClose={() => setSelectedPiece(null)}
            onCancel={() => {
              if (!selectedPiece) return;
              cancelPieceMutation.mutate(selectedPiece.id, {
                onSuccess: () => {
                  void haptics.confirmMedium();
                  setSelectedPiece(null);
                  showToast({ variant: 'success', message: t('mobile.returns.cancelSuccess') });
                },
                onError: () => {
                  void haptics.error();
                  showToast({ variant: 'error', message: t('mobile.returns.cancelFailed') });
                },
              });
            }}
          />
        </>
      ) : null}
    </AppScreen>
  );
}

function DetailTitle({
  title,
  titleWeight,
  backFallback,
}: {
  title: string;
  titleWeight: 'medium' | 'semibold';
  backFallback: Href;
}) {
  const { isRTL } = useLocale();
  const { theme } = useTheme();
  const leadSize = theme.sizes.touch.min;

  return (
    <View style={{ minHeight: leadSize, justifyContent: 'center' }}>
      <View
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          ...(isRTL ? { right: 0 } : { left: 0 }),
          zIndex: 1,
          justifyContent: 'center',
        }}
      >
        <ScreenBackLead fallback={backFallback} />
      </View>
      <AppText
        variant="largeTitle"
        weight={titleWeight}
        align="center"
        numberOfLines={1}
        dir="ltr"
        style={{ paddingHorizontal: leadSize + theme.spacing.sm }}
      >
        {title}
      </AppText>
    </View>
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
