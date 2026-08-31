import { useEffect, useMemo, useState } from 'react';
import { Linking, ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { can } from '@maher/permissions';
import { localizedName } from '@maher/i18n';
import { manufacturingComplexityDisplayKey } from '@maher/types';
import { isApiError } from '@/api/errors';
import { toastMessageForError } from '@/api/queryClient';
import { createQuotation } from '@/api/modules/quotations';
import { seedOrdersDeskChip } from '@/features/sales-orders/ordersDeskContext';
import { quotationLinesFromRequestItems } from './quotationLinesFromRequest';
import {
  closeRequest,
  confirmRequestDelivery,
  changeRequestDelivery,
  getRequest,
  markRequestNeedsInformation,
  markRequestReadyForQuotation,
  markRequestUnderReview,
  submitRequest,
  updateRequest,
} from '@/api/modules/requests';
import { resolveDocumentUrl, uploadFile, uploadFromUrl } from '@/api/modules/uploads';
import { queryKeys } from '@/api/queryKeys';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { BackButton } from '@/components/BackButton';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import {
  DestructiveButton,
  SecondaryButton,
  TertiaryButton,
} from '@/components/buttons/SecondaryButton';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { useToast, toastCopy } from '@/components/feedback/Toast';
import { TextField } from '@/components/forms/TextField';
import { AppScreen } from '@/components/layout/AppScreen';
import { SURFACE_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import { ActionSheet, type ActionSheetItem } from '@/components/sheets/ActionSheet';
import { ConfirmationSheet } from '@/components/sheets/ConfirmationSheet';
import { useLocale } from '@/i18n';
import { DealerBoard } from '@/features/dealers/components/DealerBoard';
import { resolveOrderMediaUri } from '@/features/sales-orders/components/OrderCardMedia';
import { AdminQuotationPanel } from '@/features/quotations/AdminQuotationDetailScreen';
import { RequestIdentityBoard } from '@/features/requests/components/RequestIdentityBoard';
import {
  RfqStageRail,
  isRfqWaitingForReview,
  rfqIncompleteGaps,
  rfqStageFromData,
  type RfqWorkspaceStage,
} from '@/features/requests/components/RfqStageRail';
import { AnimatedPressable, haptics, ListItemEnter } from '@/motion';
import { useTheme } from '@/theme';
import type { RequestItem } from './types';
import { localDealerMinimumRequestYmd, toDeliveryYmd } from './selectDeliveryAvailability';

type Props = {
  requestId: string;
  initialStage?: RfqWorkspaceStage;
  initialQuoteId?: string;
};

type WorkflowConfirm = 'needsInfo' | 'close' | null;

type LinkedSalesOrder = { id: string; number: string; status: string };

function priorityLabel(
  priority: string | null | undefined,
  t: (k: string) => string,
): string {
  if (!priority) return '—';
  const key = `mobile.production.priority.${priority.toUpperCase()}`;
  const label = t(key);
  return label === key ? priority : label;
}

function itemSpecs(item: {
  material?: string | null;
  fabric?: string | null;
  fabricType?: string | null;
  color?: string | null;
  fabricColor?: string | null;
}): string {
  const parts = [
    item.material,
    item.fabricType ?? item.fabric,
    item.fabricColor ?? item.color,
  ].filter(Boolean);
  return parts.length ? parts.join(' / ') : '—';
}

function complexityLabel(
  code: string | null | undefined,
  t: (k: string) => string,
): string | null {
  if (!code) return null;
  const key = manufacturingComplexityDisplayKey(code);
  return t(`mobile.orders.lineKind.${key}`);
}

function collectIncompleteWarnings(
  detail: {
    items?: RequestItem[] | null;
    documents?: { id: string }[] | null;
    deliveryAddress?: string | null;
    endCustomerName?: string | null;
  },
  t: (k: string) => string,
): string[] {
  const warnings: string[] = [];
  const items = detail.items ?? [];
  if (items.length === 0) {
    warnings.push(t('mobile.adminRequest.incompleteNoItems'));
  }
  if ((detail.documents?.length ?? 0) === 0) {
    warnings.push(t('mobile.adminRequest.incompleteNoAttachments'));
  }
  if (
    items.some((i) => {
      const c = (i.manufacturingComplexity ?? '').toUpperCase();
      return c === 'CUSTOM' || c === 'MODIFIED' || !i.productId;
    })
  ) {
    warnings.push(t('mobile.adminRequest.incompleteCustomLines'));
  }
  if (!detail.deliveryAddress?.trim()) {
    warnings.push(t('mobile.adminRequest.incompleteDelivery'));
  }
  if (!detail.endCustomerName?.trim()) {
    warnings.push(t('mobile.adminRequest.incompleteCustomer'));
  }
  return warnings;
}

function MetaCell({
  label,
  value,
  ltr,
}: {
  label: string;
  value: string;
  ltr?: boolean;
}) {
  const { theme } = useTheme();
  const { isRTL, locale } = useLocale();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  return (
    <View style={{ flex: 1, minWidth: '42%', gap: theme.spacing.xs }}>
      <AppText
        variant="caption"
        color="muted"
        style={{ textAlign: isRTL ? 'right' : 'left' }}
      >
        {label}
      </AppText>
      <AppText
        variant="label"
        weight={titleWeight}
        numberOfLines={2}
        dir={ltr ? 'ltr' : undefined}
        style={{ textAlign: isRTL ? 'right' : 'left' }}
      >
        {value}
      </AppText>
    </View>
  );
}

/**
 * Unapproved-order workspace: Request → Quotation → Order on one screen.
 */
export function AdminRequestDetailScreen({
  requestId,
  initialStage,
  initialQuoteId,
}: Props) {
  const { user } = useAuth();
  const { t, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const allowed = can(user, 'request.read');
  const canUpdate = can(user, 'request.update');
  const canCreateQuote = can(user, 'quotation.create');
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const floorBtn = {
    alignSelf: 'stretch' as const,
    width: '100%' as const,
    borderRadius: theme.radius.full,
    minHeight: theme.sizes.touch.min,
  };

  const [pickedStage, setPickedStage] = useState<RfqWorkspaceStage | undefined>(
    initialStage,
  );
  const [activeQuotationId, setActiveQuotationId] = useState<string | null>(
    initialQuoteId ?? null,
  );
  const [linkedSalesOrder, setLinkedSalesOrder] = useState<LinkedSalesOrder | null>(null);
  const [externalOrderNumber, setExternalOrderNumber] = useState('');
  const [projectName, setProjectName] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [attachUrl, setAttachUrl] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<WorkflowConfirm>(null);
  const [uploadSheetOpen, setUploadSheetOpen] = useState(false);
  const [galleryUris, setGalleryUris] = useState<string[]>([]);
  const [draftLines, setDraftLines] = useState<
    Array<{ key: string; productName: string; quantity: string; notes: string }>
  >([]);
  const [deliveryChangeDate, setDeliveryChangeDate] = useState('');
  const [deliveryChangeReason, setDeliveryChangeReason] = useState('');

  useEffect(() => {
    if (initialStage) setPickedStage(initialStage);
    if (initialQuoteId) setActiveQuotationId(initialQuoteId);
  }, [initialStage, initialQuoteId]);

  const query = useQuery({
    queryKey: queryKeys.requests.detail(requestId),
    queryFn: () => getRequest(requestId),
    enabled: allowed && Boolean(requestId),
  });

  const detail = query.data;
  const dealerMinRequestYmd = localDealerMinimumRequestYmd();
  const requestedDeliveryYmd = toDeliveryYmd(detail?.requiredDeliveryDate);
  const confirmWouldOverrideLead =
    Boolean(requestedDeliveryYmd && requestedDeliveryYmd < dealerMinRequestYmd);
  const changeWouldOverrideLead = Boolean(
    toDeliveryYmd(deliveryChangeDate) &&
      (toDeliveryYmd(deliveryChangeDate) as string) < dealerMinRequestYmd,
  );

  useEffect(() => {
    if (!detail) return;
    setExternalOrderNumber(detail.externalOrderNumber ?? '');
    setProjectName(detail.projectName ?? '');
    setInternalNotes(detail.internalNotes ?? '');
    setDeliveryChangeDate(
      (detail.offeredDeliveryDate ?? detail.requiredDeliveryDate ?? '').toString().slice(0, 10),
    );
    setDraftLines(
      (detail.items ?? []).map((item, index) => ({
        key: item.id ?? `line-${index}`,
        productName: item.productName ?? '',
        quantity: String(item.quantity ?? ''),
        notes: item.notes ?? item.description ?? '',
      })),
    );
    if (!activeQuotationId && (detail.quotations?.length ?? 0) > 0) {
      setActiveQuotationId(detail.quotations![0]!.id);
    }
  }, [detail, activeQuotationId]);

  useEffect(() => {
    let cancelled = false;
    async function loadGallery() {
      if (!detail) {
        setGalleryUris([]);
        return;
      }
      const uris: string[] = [];
      const hero = resolveOrderMediaUri(detail.imageUrl);
      if (hero) uris.push(hero);
      for (const doc of detail.documents ?? []) {
        const mime = (doc.mimeType ?? '').toLowerCase();
        const name = (doc.fileName ?? '').toLowerCase();
        const isImage =
          mime.startsWith('image/') ||
          /\.(jpe?g|png|gif|webp|heic|heif|bmp)$/.test(name);
        if (!isImage) continue;
        // Avoid duplicating the signed hero if it already came from this attachment
        try {
          const url = await resolveDocumentUrl(doc.id);
          if (!uris.includes(url)) uris.push(url);
        } catch {
          // skip failed signed URLs
        }
      }
      if (!cancelled) setGalleryUris(uris);
    }
    void loadGallery();
    return () => {
      cancelled = true;
    };
  }, [detail]);

  const dealerName = useMemo(() => {
    if (!detail?.customer) return detail?.contactName?.trim() || '—';
    return localizedName(locale, detail.customer, detail.customer.code || '—');
  }, [detail, locale]);

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.requests.detail(requestId) });
    await queryClient.invalidateQueries({ queryKey: queryKeys.requests.all });
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      const isDraft = detail?.status === 'DRAFT';
      const items = isDraft
        ? draftLines
            .filter((line) => line.productName.trim())
            .map((line) => ({
              productName: line.productName.trim(),
              quantity: Number(line.quantity) || 0,
              notes: line.notes.trim() || undefined,
            }))
        : undefined;
      return updateRequest(requestId, {
        externalOrderNumber: externalOrderNumber.trim() || undefined,
        projectName: projectName.trim() || undefined,
        internalNotes: internalNotes.trim() || undefined,
        ...(items ? { items } : {}),
      });
    },
    onSuccess: async () => {
      setError(null);
      setMessage(t('mobile.adminRequest.saved'));
      void haptics.confirmMedium();
      await invalidate();
    },
    onError: (err) => {
      setMessage(null);
      setError(isApiError(err) ? err.message : t('mobile.adminRequest.saveFailed'));
      void haptics.error();
    },
  });

  const workflowMutation = useMutation({
    mutationFn: async (args: {
      kind: 'submit' | 'underReview' | 'ready' | 'needsInfo' | 'close';
      notes?: string;
    }) => {
      switch (args.kind) {
        case 'submit':
          return submitRequest(requestId);
        case 'underReview':
          return markRequestUnderReview(requestId);
        case 'ready':
          return markRequestReadyForQuotation(requestId);
        case 'needsInfo': {
          const reason = args.notes?.trim();
          if (!reason) {
            throw new Error(t('mobile.adminRequest.reasonRequired'));
          }
          return markRequestNeedsInformation(requestId, reason);
        }
        case 'close':
          return closeRequest(requestId);
      }
    },
    onSuccess: async () => {
      setConfirm(null);
      setError(null);
      setMessage(t('mobile.adminRequest.statusUpdated'));
      void haptics.confirmMedium();
      await invalidate();
    },
    onError: (err) => {
      setMessage(null);
      setError(isApiError(err) ? err.message : t('mobile.adminRequest.actionFailed'));
      void haptics.error();
    },
  });

  const deliveryMutation = useMutation({
    mutationFn: async (args: { kind: 'confirm' | 'change'; date: string; reason?: string }) => {
      if (args.kind === 'confirm') {
        return confirmRequestDelivery(requestId, args.date);
      }
      const reason = args.reason?.trim();
      if (!reason) {
        throw new Error(t('mobile.adminRequest.dateReasonRequired'));
      }
      return changeRequestDelivery(requestId, args.date, reason);
    },
    onSuccess: async () => {
      setError(null);
      setDeliveryChangeReason('');
      setMessage(t('mobile.adminRequest.statusUpdated'));
      void haptics.confirmMedium();
      await invalidate();
    },
    onError: (err) => {
      setMessage(null);
      setError(isApiError(err) ? toastMessageForError(err) : t('mobile.adminRequest.actionFailed'));
      void haptics.error();
    },
  });

  const quoteMutation = useMutation({
    mutationFn: async () => {
      if (!detail?.customer?.id || !(detail.items?.length ?? 0)) {
        throw new Error(t('mobile.adminRequest.customerItemsRequired'));
      }
      return createQuotation({
        customerId: detail.customer.id,
        requestId: detail.id,
        deliveryTerms: undefined,
        offeredDeliveryDate: detail.offeredDeliveryDate ?? undefined,
        customerNotes: detail.notes ?? undefined,
        lines: quotationLinesFromRequestItems(detail.items ?? []),
      });
    },
    onSuccess: async (quote) => {
      setError(null);
      setMessage(t('mobile.adminRequest.quotationCreated', { number: quote.number }));
      void haptics.confirmMedium();
      await invalidate();
      await queryClient.invalidateQueries({ queryKey: queryKeys.quotations.all });
      setActiveQuotationId(quote.id);
      setPickedStage('quotation');
    },
    onError: (err) => {
      setMessage(null);
      const msg = isApiError(err)
        ? err.message
        : err instanceof Error
          ? err.message
          : t('mobile.adminRequest.actionFailed');
      setError(msg);
      void haptics.error();
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (args: { uri?: string; fileName?: string; mimeType?: string; url?: string }) => {
      if (args.url) {
        return uploadFromUrl({
          url: args.url,
          category: 'RFQ_ATTACHMENT',
          requestId,
        });
      }
      if (!args.uri || !args.fileName || !args.mimeType) {
        throw new Error(t('mobile.adminRequest.uploadRequired'));
      }
      return uploadFile({
        uri: args.uri,
        fileName: args.fileName,
        mimeType: args.mimeType,
        category: 'RFQ_ATTACHMENT',
        requestId,
      });
    },
    onSuccess: async () => {
      setAttachUrl('');
      setError(null);
      setMessage(t('mobile.adminRequest.documentUploaded'));
      void haptics.confirmMedium();
      await invalidate();
    },
    onError: (err) => {
      setMessage(null);
      setError(err instanceof Error ? err.message : t('mobile.adminRequest.uploadFailed'));
      void haptics.error();
    },
  });

  const pickPhotoUpload = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      showToast({
        variant: 'warning',
        message: toastCopy(
          t('mobile.newOrder.permissionTitle'),
          t('mobile.newOrder.permissionBody'),
        ),
      });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    uploadMutation.mutate({
      uri: asset.uri,
      fileName: asset.fileName ?? `photo-${Date.now()}.jpg`,
      mimeType: asset.mimeType ?? 'image/jpeg',
    });
  };

  const pickFileUpload = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: [
        'application/pdf',
        'image/*',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    uploadMutation.mutate({
      uri: asset.uri,
      fileName: asset.name,
      mimeType: asset.mimeType ?? 'application/octet-stream',
    });
  };

  const uploadActions: ActionSheetItem[] = [
    {
      label: t('mobile.adminRequest.photo'),
      icon: 'images-outline',
      deferUntilClosed: true,
      onPress: () => void pickPhotoUpload(),
    },
    {
      label: t('mobile.adminRequest.file'),
      icon: 'document-outline',
      deferUntilClosed: true,
      onPress: () => void pickFileUpload(),
    },
  ];

  const openDocument = async (id: string) => {
    try {
      const url = await resolveDocumentUrl(id);
      await Linking.openURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('mobile.adminRequest.openFailed'));
    }
  };

  const goBack = () => {
    router.replace('/(app)/(admin)/(tabs)/orders' as never);
  };

  if (!allowed) {
    return (
      <AppScreen>
        <EmptyState title={t('mobile.noModules')} description={t('mobile.noModulesHint')} />
      </AppScreen>
    );
  }

  if (query.isError && !detail) {
    return (
      <AppScreen>
        <ErrorState
          title={t('mobile.adminRequest.errorTitle')}
          description={t('mobile.adminRequest.errorBody')}
          retryLabel={t('mobile.adminRequest.retry')}
          onRetry={() => void query.refetch()}
        />
      </AppScreen>
    );
  }

  if (!detail) {
    return (
      <AppScreen>
        <AppText variant="body" color="secondary">
          {t('mobile.adminRequest.loading')}
        </AppText>
      </AppScreen>
    );
  }

  const status = detail.status;
  const canUnderReview = ['SUBMITTED', 'NEEDS_INFORMATION'].includes(status);
  const canReady = ['UNDER_REVIEW', 'NEEDS_INFORMATION', 'SUBMITTED'].includes(status);
  const canNeedsInfo = ['SUBMITTED', 'UNDER_REVIEW', 'READY_FOR_QUOTATION'].includes(
    status,
  );
  const canClose = !['CLOSED', 'CANCELLED', 'QUOTED'].includes(status);
  const canQuote = [
    'READY_FOR_QUOTATION',
    'UNDER_REVIEW',
    'SUBMITTED',
    'NEEDS_INFORMATION',
  ].includes(status);
  const canSubmit = status === 'DRAFT' || status === 'NEEDS_INFORMATION';
  const isDraft = status === 'DRAFT';
  const isNeedsInfo = status === 'NEEDS_INFORMATION';
  const workflowBusy = workflowMutation.isPending || quoteMutation.isPending;
  const hasQuote = Boolean(activeQuotationId) || (detail.quotations?.length ?? 0) > 0;
  const hasOrder = Boolean(linkedSalesOrder);
  const quoteId = activeQuotationId ?? detail.quotations?.[0]?.id ?? null;
  const canOpenQuotation = Boolean(quoteId) || status === 'QUOTED';
  const incompleteWarnings = collectIncompleteWarnings(detail, t);
  const stage =
    pickedStage ??
    rfqStageFromData({ hasQuote, hasOrder, status: detail.status });
  const statusPhrase = isRfqWaitingForReview(status)
    ? t('mobile.adminRequest.waitingForReview')
    : t(`statuses.${status}`);
  const incompleteGaps = rfqIncompleteGaps(detail);
  const needsInfoAsk = status === 'NEEDS_INFORMATION' ? detail.internalNotes?.trim() : '';

  const stageBadgeStatus =
    stage === 'order' && linkedSalesOrder
      ? linkedSalesOrder.status
      : detail.status;
  const identityAccent =
    status === 'NEEDS_INFORMATION' ? colors.warning : colors.brand;
  const phaseLabel =
    status === 'NEEDS_INFORMATION'
      ? t('mobile.orders.presentation.needsInformation')
      : status === 'SUBMITTED' || status === 'UNDER_REVIEW'
        ? t('mobile.orders.presentation.waitingForReview')
        : status === 'READY_FOR_QUOTATION' || status === 'QUOTED'
          ? t('mobile.orders.presentation.quotation')
          : linkedSalesOrder
            ? t('mobile.orders.orderAcceptedSetup')
            : t(
                `mobile.orders.presentation.${status === 'DRAFT' ? 'draft' : 'waitingForReview'}`,
              );
  const phaseHint = linkedSalesOrder
    ? t('mobile.adminRequest.acceptedToPreparing', {
        number: linkedSalesOrder.number,
      })
    : null;

  let enter = 0;
  const nextIndex = () => enter++;

  return (
    <AppScreen
      edges={{ top: false, bottom: false }}
      padding="sm"
      style={{
        paddingHorizontal: 0,
        paddingBottom: 0,
        paddingTop: insets.top,
        backgroundColor: colors.background,
        gap: 0,
      }}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: theme.spacing.lg,
          paddingTop: theme.spacing.sm,
          paddingBottom:
            theme.spacing['3xl'] +
            SURFACE_TAB_BAR_CLEARANCE +
            theme.spacing.xl +
            Math.max(insets.bottom, theme.spacing.sm),
          gap: theme.spacing.md,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            minHeight: theme.sizes.touch.min,
          }}
        >
          <BackButton onPress={goBack} label={t('mobile.adminRequest.backToOrders')} />
        </View>

        <ListItemEnter index={nextIndex()}>
          <RequestIdentityBoard
            number={detail.number}
            dealerName={dealerName}
            status={stageBadgeStatus}
            statusLabel={
              stageBadgeStatus === status && isRfqWaitingForReview(status)
                ? statusPhrase
                : t(`statuses.${stageBadgeStatus}`)
            }
            phaseLabel={phaseLabel}
            phaseHint={phaseHint}
            imageUrl={galleryUris[0] ?? null}
            accent={identityAccent}
          />
        </ListItemEnter>

        <ListItemEnter index={nextIndex()}>
          <RfqStageRail
            stage={stage}
            hasQuote={hasQuote}
            hasOrder={hasOrder}
            onChange={(next) => {
              setPickedStage(next);
              setMessage(null);
              setError(null);
            }}
          />
        </ListItemEnter>

        {needsInfoAsk ? (
          <ListItemEnter index={nextIndex()}>
            <DealerBoard
              title={t('mobile.adminRequest.needsInfo')}
              titleWeight={titleWeight}
              accentColor={colors.warning}
            >
              <AppText variant="label" weight="medium">
                {needsInfoAsk}
              </AppText>
            </DealerBoard>
          </ListItemEnter>
        ) : null}
        {message ? (
          <View
            style={{
              paddingHorizontal: theme.spacing.md,
              paddingVertical: theme.spacing.sm,
              borderRadius: theme.radius.lg,
              backgroundColor: colors.successSoft,
              borderWidth: 1,
              borderColor: colors.success,
            }}
          >
            <AppText variant="caption" style={{ color: colors.success }}>
              {message}
            </AppText>
          </View>
        ) : null}
        {error ? (
          <View
            style={{
              paddingHorizontal: theme.spacing.md,
              paddingVertical: theme.spacing.sm,
              borderRadius: theme.radius.lg,
              backgroundColor: colors.errorSoft,
              borderWidth: 1,
              borderColor: colors.error,
            }}
          >
            <AppText variant="caption" color="error">
              {error}
            </AppText>
          </View>
        ) : null}

        {stage === 'quotation' ? (
          quoteId ? (
            <AdminQuotationPanel
              quotationId={quoteId}
              embedded
              onOpenRequest={() => setPickedStage('request')}
              onRevised={(id) => {
                setActiveQuotationId(id);
                void invalidate();
              }}
              onAccepted={(so) => {
                setLinkedSalesOrder(so);
                setPickedStage('order');
                void invalidate();
              }}
              onLoaded={(info) => {
                if (info.salesOrder) setLinkedSalesOrder(info.salesOrder);
              }}
            />
          ) : (
            <DealerBoard
              title={t('mobile.adminRequest.stages.quotation')}
              titleWeight={titleWeight}
            >
              <AppText variant="label" weight={titleWeight}>
                {t('mobile.adminRequest.noQuotationYet')}
              </AppText>
              <AppText variant="caption" color="secondary">
                {t('mobile.adminRequest.noQuotationHint')}
              </AppText>
              {detail.customer?.id && canQuote && canCreateQuote ? (
                <PrimaryButton
                  label={t('mobile.adminRequest.createQuotation')}
                  onPress={() => quoteMutation.mutate()}
                  loading={quoteMutation.isPending}
                  disabled={!canCreateQuote}
                  style={floorBtn}
                />
              ) : (
                <SecondaryButton
                  label={t('mobile.adminRequest.stages.request')}
                  onPress={() => setPickedStage('request')}
                  style={floorBtn}
                />
              )}
            </DealerBoard>
          )
        ) : null}

        {stage === 'order' ? (
          <DealerBoard
            title={t('mobile.adminRequest.stages.order')}
            titleWeight={titleWeight}
            accentColor={linkedSalesOrder ? colors.success : colors.brand}
          >
            {linkedSalesOrder ? (
              <View style={{ gap: theme.spacing.md }}>
                <View
                  style={{
                    borderRadius: theme.radius.lg,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.surfaceSecondary,
                    padding: theme.spacing.md,
                    gap: theme.spacing.xs,
                  }}
                >
                  <AppText variant="caption" color="muted">
                    {t('mobile.adminRequest.openSalesOrder')}
                  </AppText>
                  <AppText variant="title" weight={titleWeight} dir="ltr">
                    {linkedSalesOrder.number}
                  </AppText>
                  <StatusBadge status={linkedSalesOrder.status} dot />
                </View>
                <PrimaryButton
                  label={t('mobile.adminRequest.openSalesOrder')}
                  onPress={() => {
                    void haptics.selection();
                    seedOrdersDeskChip('preparing');
                    router.push(
                      `/(app)/(admin)/orders/${linkedSalesOrder.id}?from=rfq` as never,
                    );
                  }}
                  style={floorBtn}
                />
              </View>
            ) : (
              <View style={{ gap: theme.spacing.sm }}>
                <AppText variant="label" weight={titleWeight}>
                  {t('mobile.adminRequest.orderStageEmpty')}
                </AppText>
                <AppText variant="caption" color="secondary">
                  {t('mobile.adminRequest.orderStageHint')}
                </AppText>
                <SecondaryButton
                  label={t('mobile.adminRequest.stages.quotation')}
                  onPress={() => setPickedStage('quotation')}
                  style={floorBtn}
                />
              </View>
            )}
          </DealerBoard>
        ) : null}

        {stage === 'request' ? (
          <>
        {isNeedsInfo && detail.informationRequestReason?.trim() ? (
          <ListItemEnter index={nextIndex()}>
            <DealerBoard
              title={t('mobile.adminRequest.needsInfo')}
              titleWeight={titleWeight}
              accentColor={colors.warning}
            >
              <AppText variant="body" style={{ lineHeight: 22 }}>
                {detail.informationRequestReason.trim()}
              </AppText>
            </DealerBoard>
          </ListItemEnter>
        ) : null}

        {incompleteWarnings.length > 0 ? (
          <ListItemEnter index={nextIndex()}>
            <DealerBoard
              title={t('mobile.adminRequest.incompleteWarning')}
              titleWeight={titleWeight}
              accentColor={colors.warning}
            >
              <View style={{ gap: theme.spacing.xs }}>
                {incompleteWarnings.map((w) => (
                  <AppText key={w} variant="caption" color="secondary">
                    • {w}
                  </AppText>
                ))}
              </View>
            </DealerBoard>
          </ListItemEnter>
        ) : null}

        <ListItemEnter index={nextIndex()}>
          <DealerBoard
            title={t('mobile.adminRequest.details')}
            titleWeight={titleWeight}
          >
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                flexWrap: 'wrap',
                gap: theme.spacing.md,
              }}
            >
              <MetaCell
                label={t('mobile.adminRequest.priority')}
                value={priorityLabel(detail.priority, t)}
              />
            </View>

            <TextField
              label={t('mobile.adminRequest.dealerOrder')}
              value={externalOrderNumber}
              onChangeText={setExternalOrderNumber}
              editable={canUpdate}
              autoCapitalize="characters"
            />
            <TextField
              label={t('mobile.adminRequest.project')}
              value={projectName}
              onChangeText={setProjectName}
              editable={canUpdate}
            />
            <TextField
              label={t('mobile.adminRequest.internalNotes')}
              value={internalNotes}
              onChangeText={setInternalNotes}
              editable={canUpdate}
              multiline
              copyable
            />

            <SecondaryButton
              label={t('mobile.adminRequest.save')}
              onPress={() => saveMutation.mutate()}
              loading={saveMutation.isPending}
              disabled={!canUpdate}
              style={floorBtn}
            />
          </DealerBoard>
        </ListItemEnter>

        <ListItemEnter index={nextIndex()}>
          <DealerBoard
            title={t('mobile.adminRequest.lineItems')}
            titleWeight={titleWeight}
          >
            {isDraft ? (
              <View style={{ gap: theme.spacing.sm }}>
                {draftLines.length === 0 ? (
                  <AppText variant="caption" color="muted">
                    {t('mobile.adminRequest.noLineItems')}
                  </AppText>
                ) : null}
                {draftLines.map((line, index) => (
                  <View
                    key={line.key}
                    style={{
                      padding: theme.spacing.md,
                      borderRadius: theme.radius.lg,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.surfaceSecondary,
                      gap: theme.spacing.sm,
                    }}
                  >
                    <TextField
                      label={t('mobile.adminRequest.product')}
                      value={line.productName}
                      onChangeText={(text) =>
                        setDraftLines((prev) =>
                          prev.map((row, i) =>
                            i === index ? { ...row, productName: text } : row,
                          ),
                        )
                      }
                      editable={canUpdate}
                    />
                    <TextField
                      label={t('mobile.adminRequest.qty')}
                      value={line.quantity}
                      onChangeText={(text) =>
                        setDraftLines((prev) =>
                          prev.map((row, i) =>
                            i === index ? { ...row, quantity: text } : row,
                          ),
                        )
                      }
                      keyboardType="decimal-pad"
                      editable={canUpdate}
                    />
                    <TextField
                      label={t('mobile.adminRequest.itemNotes')}
                      value={line.notes}
                      onChangeText={(text) =>
                        setDraftLines((prev) =>
                          prev.map((row, i) =>
                            i === index ? { ...row, notes: text } : row,
                          ),
                        )
                      }
                      multiline
                      editable={canUpdate}
                    />
                    {canUpdate && draftLines.length > 1 ? (
                      <TertiaryButton
                        label={t('mobile.adminRequest.removeLine')}
                        onPress={() =>
                          setDraftLines((prev) => prev.filter((_, i) => i !== index))
                        }
                        style={floorBtn}
                      />
                    ) : null}
                  </View>
                ))}
                {canUpdate ? (
                  <SecondaryButton
                    label={t('mobile.adminRequest.addLine')}
                    onPress={() =>
                      setDraftLines((prev) => [
                        ...prev,
                        {
                          key: `new-${Date.now()}`,
                          productName: '',
                          quantity: '1',
                          notes: '',
                        },
                      ])
                    }
                    style={floorBtn}
                  />
                ) : null}
              </View>
            ) : (detail.items ?? []).length === 0 ? (
              <AppText variant="caption" color="muted">
                {t('mobile.adminRequest.noLineItems')}
              </AppText>
            ) : (
              <View style={{ gap: theme.spacing.sm }}>
                {(detail.items ?? []).map((item, index) => {
                  const complexity = complexityLabel(item.manufacturingComplexity, t);
                  return (
                  <View
                    key={item.id ?? `${item.productName}-${index}`}
                    style={{
                      padding: theme.spacing.md,
                      borderRadius: theme.radius.lg,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.surfaceSecondary,
                      gap: theme.spacing.sm,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: isRTL ? 'row-reverse' : 'row',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        gap: theme.spacing.sm,
                      }}
                    >
                      <AppText
                        variant="label"
                        weight={titleWeight}
                        style={{ flex: 1, textAlign: isRTL ? 'right' : 'left' }}
                        numberOfLines={4}
                      >
                        {item.productName}
                      </AppText>
                      <View
                        style={{
                          flexDirection: isRTL ? 'row-reverse' : 'row',
                          flexWrap: 'wrap',
                          gap: theme.spacing.xs,
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          maxWidth: '48%',
                        }}
                      >
                        {complexity ? (
                          <View
                            style={{
                              paddingHorizontal: theme.spacing.sm,
                              paddingVertical: 4,
                              borderRadius: theme.radius.md,
                              backgroundColor: colors.warningSoft,
                              borderWidth: 1,
                              borderColor: colors.warning,
                            }}
                          >
                            <AppText
                              variant="caption"
                              weight="semibold"
                              style={{ color: colors.warning }}
                            >
                              {complexity}
                            </AppText>
                          </View>
                        ) : null}
                        <View
                          style={{
                            paddingHorizontal: theme.spacing.sm,
                            paddingVertical: 4,
                            borderRadius: theme.radius.md,
                            backgroundColor: colors.brandSoft,
                            borderWidth: 1,
                            borderColor: colors.brand,
                          }}
                        >
                          <AppText
                            variant="caption"
                            weight="semibold"
                            style={{ color: colors.brand }}
                            dir="ltr"
                          >
                            ×{String(item.quantity)}
                          </AppText>
                        </View>
                      </View>
                    </View>
                    {(item.notes || item.description) ? (
                      <View style={{ gap: 2 }}>
                        <AppText
                          variant="caption"
                          color="muted"
                          style={{
                            textTransform: locale === 'ar' ? 'none' : 'uppercase',
                            letterSpacing: locale === 'ar' ? 0 : 0.5,
                            fontSize: 10,
                          }}
                        >
                          {t('mobile.adminRequest.itemNotes')}
                        </AppText>
                        <AppText variant="caption" color="secondary">
                          {item.notes || item.description}
                        </AppText>
                      </View>
                    ) : null}
                    {itemSpecs(item) !== '—' ? (
                      <View style={{ gap: 2 }}>
                        <AppText
                          variant="caption"
                          color="muted"
                          style={{
                            textTransform: locale === 'ar' ? 'none' : 'uppercase',
                            letterSpacing: locale === 'ar' ? 0 : 0.5,
                            fontSize: 10,
                          }}
                        >
                          {t('mobile.adminRequest.specs')}
                        </AppText>
                        <AppText variant="caption" color="secondary">
                          {itemSpecs(item)}
                        </AppText>
                      </View>
                    ) : null}
                  </View>
                  );
                })}
              </View>
            )}
          </DealerBoard>
        </ListItemEnter>

        <ListItemEnter index={nextIndex()}>
          <DealerBoard
            title={t('mobile.adminRequest.attachments')}
            titleWeight={titleWeight}
          >
            <TextField
              label={t('mobile.adminRequest.attachUrl')}
              value={attachUrl}
              onChangeText={setAttachUrl}
              placeholder="https://…"
              autoCapitalize="none"
              autoCorrect={false}
              editable={canUpdate && !uploadMutation.isPending}
            />
            <View style={{ width: '100%', gap: theme.spacing.sm }}>
              <SecondaryButton
                label={t('mobile.adminRequest.attachFromUrl')}
                onPress={() => {
                  const url = attachUrl.trim();
                  if (!url) return;
                  uploadMutation.mutate({ url });
                }}
                loading={uploadMutation.isPending}
                disabled={!canUpdate || !attachUrl.trim()}
                style={floorBtn}
              />
              <PrimaryButton
                label={t('mobile.adminRequest.upload')}
                onPress={() => setUploadSheetOpen(true)}
                loading={uploadMutation.isPending}
                disabled={!canUpdate}
                style={floorBtn}
              />
            </View>
            <AppText variant="caption" color="muted">
              {t('mobile.adminRequest.attachHint')}
            </AppText>
            {(detail.documents?.length ?? 0) === 0 ? (
              <AppText variant="caption" color="muted">
                {t('mobile.adminRequest.noAttachments')}
              </AppText>
            ) : (
              <View style={{ gap: theme.spacing.xs }}>
                {detail.documents!.map((doc) => (
                  <AnimatedPressable
                    key={doc.id}
                    variant="button"
                    accessibilityRole="button"
                    accessibilityLabel={doc.fileName}
                    onPress={() => {
                      void haptics.selection();
                      void openDocument(doc.id);
                    }}
                    style={{
                      paddingVertical: theme.spacing.md,
                      paddingHorizontal: theme.spacing.md,
                      borderRadius: theme.radius.lg,
                      borderWidth: 1,
                      borderColor: colors.borderStrong,
                      backgroundColor: colors.surfaceSecondary,
                      flexDirection: isRTL ? 'row-reverse' : 'row',
                      alignItems: 'center',
                      gap: theme.spacing.sm,
                    }}
                  >
                    <AppText
                      variant="label"
                      weight="medium"
                      color="brand"
                      numberOfLines={1}
                      style={{ flex: 1, textAlign: isRTL ? 'right' : 'left' }}
                    >
                      {doc.fileName}
                    </AppText>
                    <Ionicons
                      name={isRTL ? 'chevron-back' : 'chevron-forward'}
                      size={16}
                      color={colors.textMuted}
                    />
                  </AnimatedPressable>
                ))}
              </View>
            )}
          </DealerBoard>
        </ListItemEnter>

        <ListItemEnter index={nextIndex()}>
          <DealerBoard
            title={t('mobile.adminRequest.factoryReview')}
            titleWeight={titleWeight}
          >
            <View
              style={{
                borderRadius: theme.radius.lg,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surfaceSecondary,
                padding: theme.spacing.md,
                gap: theme.spacing.xs,
              }}
            >
              <AppText
                variant="caption"
                color="muted"
                style={{ textAlign: isRTL ? 'right' : 'left' }}
              >
                {t('mobile.adminRequest.phaseEyebrow')}
              </AppText>
              <AppText
                variant="label"
                weight={titleWeight}
                style={{ textAlign: isRTL ? 'right' : 'left' }}
              >
                {statusPhrase}
              </AppText>
              <AppText
                variant="caption"
                color="secondary"
                style={{ textAlign: isRTL ? 'right' : 'left' }}
              >
                {status === 'NEEDS_INFORMATION'
                  ? t('mobile.adminRequest.nextAskDealer')
                  : linkedSalesOrder ||
                      (detail.quotations ?? []).some((q) => q.status === 'ACCEPTED')
                    ? t('mobile.adminRequest.nextPrepareProduction')
                    : (detail.quotations ?? []).some((q) =>
                          ['SENT', 'VIEWED'].includes(q.status),
                        )
                      ? t('mobile.adminRequest.nextWaitingDealer')
                      : t('mobile.adminRequest.nextPrepareQuote')}
              </AppText>
            </View>

            {canUpdate ? (
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
                <AppText
                  variant="caption"
                  color="muted"
                  style={{ textAlign: isRTL ? 'right' : 'left' }}
                >
                  {t('mobile.adminRequest.requestedDelivery')}
                </AppText>
                <AppText
                  variant="label"
                  weight={titleWeight}
                  style={{ textAlign: isRTL ? 'right' : 'left' }}
                >
                  {detail.requiredDeliveryDate
                    ? String(detail.requiredDeliveryDate).slice(0, 10)
                    : '—'}
                </AppText>
                <AppText
                  variant="caption"
                  color="muted"
                  style={{ textAlign: isRTL ? 'right' : 'left' }}
                >
                  {t('mobile.adminRequest.offeredDelivery')}
                </AppText>
                <AppText
                  variant="label"
                  weight={titleWeight}
                  style={{ textAlign: isRTL ? 'right' : 'left' }}
                >
                  {detail.offeredDeliveryDate
                    ? String(detail.offeredDeliveryDate).slice(0, 10)
                    : '—'}
                </AppText>
                {confirmWouldOverrideLead || changeWouldOverrideLead ? (
                  <AppText
                    variant="caption"
                    style={{ color: colors.warning, textAlign: isRTL ? 'right' : 'left' }}
                  >
                    {t('mobile.adminRequest.leadTimeOverrideWarning')}
                  </AppText>
                ) : null}
                {detail.requiredDeliveryDate && !confirmWouldOverrideLead ? (
                  <SecondaryButton
                    label={t('mobile.adminRequest.confirmDate')}
                    onPress={() =>
                      deliveryMutation.mutate({
                        kind: 'confirm',
                        date: String(detail.requiredDeliveryDate).slice(0, 10),
                      })
                    }
                    loading={deliveryMutation.isPending}
                    disabled={!canUpdate}
                    style={floorBtn}
                  />
                ) : null}
                <TextField
                  label={t('mobile.adminRequest.changeDate')}
                  value={deliveryChangeDate}
                  onChangeText={setDeliveryChangeDate}
                  placeholder="YYYY-MM-DD"
                />
                <TextField
                  label={t('mobile.adminRequest.changeDateReason')}
                  value={deliveryChangeReason}
                  onChangeText={setDeliveryChangeReason}
                />
                <TertiaryButton
                  label={t('mobile.adminRequest.changeDate')}
                  disabled={!canUpdate || !deliveryChangeDate.trim() || !deliveryChangeReason.trim()}
                  onPress={() =>
                    deliveryMutation.mutate({
                      kind: 'change',
                      date: deliveryChangeDate.trim(),
                      reason: deliveryChangeReason,
                    })
                  }
                  style={floorBtn}
                />
              </View>
            ) : null}

            {canSubmit ? (
              <SecondaryButton
                label={t('mobile.adminRequest.submit')}
                onPress={() => workflowMutation.mutate({ kind: 'submit' })}
                loading={workflowBusy}
                disabled={!canUpdate}
                style={floorBtn}
              />
            ) : null}
            {canUnderReview ? (
              <SecondaryButton
                label={t('mobile.adminRequest.underReview')}
                onPress={() => workflowMutation.mutate({ kind: 'underReview' })}
                loading={workflowBusy}
                disabled={!canUpdate}
                style={floorBtn}
              />
            ) : null}
            {canReady ? (
              <SecondaryButton
                label={t('mobile.adminRequest.readyForQuote')}
                onPress={() => workflowMutation.mutate({ kind: 'ready' })}
                loading={workflowBusy}
                disabled={!canUpdate}
                style={floorBtn}
              />
            ) : null}
            {canNeedsInfo ? (
              <TertiaryButton
                label={t('mobile.adminRequest.needsInfo')}
                disabled={!canUpdate || workflowBusy}
                onPress={() => setConfirm('needsInfo')}
                style={floorBtn}
              />
            ) : null}
            {canOpenQuotation ? (
              <SecondaryButton
                label={t('mobile.adminRequest.openQuotation')}
                onPress={() => {
                  void haptics.selection();
                  setPickedStage('quotation');
                }}
                style={floorBtn}
              />
            ) : null}
            {detail.customer?.id && canQuote && canCreateQuote ? (
              <PrimaryButton
                label={t('mobile.adminRequest.createQuotation')}
                onPress={() => quoteMutation.mutate()}
                loading={quoteMutation.isPending}
                disabled={!canCreateQuote}
                style={floorBtn}
              />
            ) : null}
            {canClose ? (
              <DestructiveButton
                label={t('mobile.adminRequest.closeRfq')}
                disabled={!canUpdate || workflowBusy}
                onPress={() => setConfirm('close')}
                style={floorBtn}
              />
            ) : null}
          </DealerBoard>
        </ListItemEnter>

        <ListItemEnter index={nextIndex()}>
          <DealerBoard
            title={t('mobile.adminRequest.quotations')}
            titleWeight={titleWeight}
          >
            {(detail.quotations?.length ?? 0) === 0 ? (
              <AppText variant="caption" color="muted">
                {t('mobile.adminRequest.noQuotations')}
              </AppText>
            ) : (
              <View style={{ gap: theme.spacing.sm }}>
                {detail.quotations!.map((q) => (
                  <AnimatedPressable
                    key={q.id}
                    variant="button"
                    accessibilityRole="button"
                    accessibilityLabel={q.number}
                    onPress={() => {
                      void haptics.selection();
                      setActiveQuotationId(q.id);
                      setPickedStage('quotation');
                    }}
                    style={{
                      flexDirection: isRTL ? 'row-reverse' : 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: theme.spacing.md,
                      paddingVertical: theme.spacing.md,
                      paddingHorizontal: theme.spacing.md,
                      borderRadius: theme.radius.lg,
                      borderWidth: 1,
                      borderColor: colors.borderStrong,
                      backgroundColor: colors.surfaceSecondary,
                    }}
                  >
                    <AppText
                      variant="label"
                      weight={titleWeight}
                      dir="ltr"
                      style={{ flex: 1 }}
                    >
                      {q.number}
                    </AppText>
                    <StatusBadge status={q.status} dot />
                    <Ionicons
                      name={isRTL ? 'chevron-back' : 'chevron-forward'}
                      size={16}
                      color={colors.textMuted}
                    />
                  </AnimatedPressable>
                ))}
              </View>
            )}
          </DealerBoard>
        </ListItemEnter>
          </>
        ) : null}

        {incompleteGaps.length > 0 ? (
          <ListItemEnter index={nextIndex()}>
            <DealerBoard
              title={t('mobile.adminRequest.gaps.title')}
              titleWeight={titleWeight}
              accentColor={colors.warning}
            >
              <View style={{ gap: theme.spacing.xs }}>
                {incompleteGaps.map((gap) => (
                  <AppText key={gap} variant="label" color="secondary">
                    {`• ${t(`mobile.adminRequest.gaps.${gap}`)}`}
                  </AppText>
                ))}
              </View>
            </DealerBoard>
          </ListItemEnter>
        ) : null}
      </ScrollView>

      <ActionSheet
        open={uploadSheetOpen}
        onClose={() => setUploadSheetOpen(false)}
        title={t('mobile.adminRequest.upload')}
        actions={uploadActions}
        cancelLabel={t('mobile.adminRequest.cancel')}
      />
      <ConfirmationSheet
        open={confirm === 'needsInfo'}
        onClose={() => setConfirm(null)}
        title={t('mobile.adminRequest.needsInfo')}
        message={t('mobile.adminRequest.needsInfoConfirm')}
        confirmLabel={t('mobile.adminRequest.needsInfo')}
        cancelLabel={t('mobile.adminRequest.cancel')}
        reasonLabel={t('mobile.adminRequest.notes')}
        reasonPlaceholder={t('mobile.adminRequest.notesPlaceholder')}
        reasonRequired
        reasonRequiredMessage={t('mobile.adminRequest.reasonRequired')}
        onConfirm={(notes) =>
          workflowMutation.mutate({ kind: 'needsInfo', notes })
        }
      />
      <ConfirmationSheet
        open={confirm === 'close'}
        onClose={() => setConfirm(null)}
        title={t('mobile.adminRequest.closeRfq')}
        message={t('mobile.adminRequest.closeConfirm')}
        confirmLabel={t('mobile.adminRequest.closeRfq')}
        cancelLabel={t('mobile.adminRequest.cancel')}
        destructive
        onConfirm={() => workflowMutation.mutate({ kind: 'close' })}
      />
    </AppScreen>
  );
}
