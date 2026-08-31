import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Image, Linking, RefreshControl, ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { can } from '@maher/permissions';
import { localizedName, presentQuotationStatus } from '@maher/i18n';
import { isApiError } from '@/api/errors';
import { toastMessageForError } from '@/api/queryClient';
import { resolveDocumentUrl } from '@/api/modules/uploads';
import {
  getQuotation,
  openQuotationPdf,
  rejectQuotation,
  reviseQuotation,
  sendQuotation,
  updateQuotation,
  type QuotationLine,
} from '@/api/modules/quotations';
import { queryKeys } from '@/api/queryKeys';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { BackButton } from '@/components/BackButton';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import {
  DestructiveButton,
  SecondaryButton,
} from '@/components/buttons/SecondaryButton';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { useToast } from '@/components/feedback/Toast';
import { TextField } from '@/components/forms/TextField';
import { AppScreen } from '@/components/layout/AppScreen';
import { ConfirmationSheet } from '@/components/sheets/ConfirmationSheet';
import { useLocale } from '@/i18n';
import { formatNumber } from '@/i18n/format';
import { DealerBoard } from '@/features/dealers/components/DealerBoard';
import { usePdfDownload } from '@/features/pdf/usePdfDownload';
import { AnimatedPressable, haptics, ListItemEnter } from '@/motion';
import { useTheme } from '@/theme';
import { SURFACE_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import {
  presentableText,
  quotationComplexity,
  quotationDraftTotals,
  quotationLineDims,
  quotationLineNet,
  quotationLineSpecs,
  quotationQtyLabel,
  sellingPriceMissing,
} from '@/features/quotations/presentAdminQuotation';

type Props = {
  quotationId: string;
  /** Render inside RFQ workspace (no shell / header / nested scroll). */
  embedded?: boolean;
  /** Deep-link: if quote belongs to an RFQ, open that workspace instead. */
  preferWorkspace?: boolean;
  onAccepted?: (salesOrder: { id: string; number: string; status: string }) => void;
  onRevised?: (quotationId: string) => void;
  onOpenRequest?: () => void;
  onLoaded?: (info: {
    status: string;
    number: string;
    salesOrder?: { id: string; number: string; status: string } | null;
  }) => void;
};

type ConfirmKind = 'revise' | 'reject' | null;

const REVISE_STATUSES = new Set([
  'APPROVED',
  'SENT',
  'REJECTED',
  'REVISION_REQUESTED',
  'VIEWED',
]);

function boardMoney(
  locale: string,
  value: number | string | null | undefined,
): string {
  if (value == null || value === '') return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  const typed = locale === 'ar' || locale === 'he' || locale === 'en' ? locale : 'en';
  return `${formatNumber(typed, n, { maximumFractionDigits: 2 })} ₪`;
}

function MetaCell({
  label,
  value,
  ltr,
  onPress,
  brand,
  fullWidth,
}: {
  label: string;
  value: string;
  ltr?: boolean;
  onPress?: () => void;
  brand?: boolean;
  fullWidth?: boolean;
}) {
  const { colors, theme } = useTheme();
  const { isRTL, locale } = useLocale();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const cellStyle = {
    flexGrow: 1,
    flexBasis: fullWidth ? ('100%' as const) : ('46%' as const),
    minWidth: fullWidth ? ('100%' as const) : ('46%' as const),
    maxWidth: fullWidth ? ('100%' as const) : ('50%' as const),
    gap: theme.spacing.xs,
    alignItems: (isRTL ? 'flex-end' : 'flex-start') as 'flex-end' | 'flex-start',
  };
  const content = (
    <>
      <AppText
        variant="caption"
        color="muted"
        style={{
          textAlign: isRTL ? 'right' : 'left',
          textTransform: locale === 'ar' ? 'none' : 'uppercase',
          letterSpacing: locale === 'ar' ? 0 : 0.45,
          fontSize: 11,
        }}
      >
        {label}
      </AppText>
      <AppText
        variant="label"
        weight={titleWeight}
        numberOfLines={fullWidth ? 4 : 2}
        dir={ltr ? 'ltr' : undefined}
        style={{
          color: brand ? colors.brand : colors.textPrimary,
          textAlign: isRTL ? 'right' : 'left',
        }}
      >
        {value}
      </AppText>
    </>
  );
  if (!onPress) {
    return <View style={cellStyle}>{content}</View>;
  }
  return (
    <AnimatedPressable
      variant="button"
      accessibilityRole="link"
      onPress={() => {
        void haptics.selection();
        onPress();
      }}
      style={cellStyle}
    >
      {content}
    </AnimatedPressable>
  );
}

function MetaRow({
  children,
  isRTL,
}: {
  children: ReactNode;
  isRTL: boolean;
}) {
  const { theme } = useTheme();
  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        flexWrap: 'wrap',
        alignItems: 'flex-start',
        columnGap: theme.spacing.md,
        rowGap: theme.spacing.md,
      }}
    >
      {children}
    </View>
  );
}

/**
 * Admin quotation detail — matches web: fields, PDF, revise, workflow.
 * Can embed in the unapproved-order workspace without nesting another screen.
 */
export function AdminQuotationDetailScreen({
  quotationId,
  embedded = false,
  preferWorkspace = false,
  onAccepted,
  onRevised,
  onOpenRequest,
  onLoaded,
}: Props) {
  const { user } = useAuth();
  const { t, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const floorBtn = {
    alignSelf: 'stretch' as const,
    width: '100%' as const,
    borderRadius: theme.radius.full,
    minHeight: theme.sizes.touch.min,
  };
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { pickPdfOptions, pdfDownloadSheet } = usePdfDownload();
  const [confirm, setConfirm] = useState<ConfirmKind>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [paymentTerms, setPaymentTerms] = useState('');
  const [deliveryTerms, setDeliveryTerms] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
  const [expirationDate, setExpirationDate] = useState('');
  const [offeredDeliveryDate, setOfferedDeliveryDate] = useState('');
  const [sendBlockers, setSendBlockers] = useState<string[]>([]);
  const [draftLines, setDraftLines] = useState<
    Array<{ id: string; unitPrice: string; line: QuotationLine }>
  >([]);
  const [workspaceRedirected, setWorkspaceRedirected] = useState(false);

  const allowed = can(user, 'quotation.read') || can(user, 'request.read');
  const canUpdate = can(user, 'quotation.update');
  const canSend = can(user, 'quotation.send');
  const canReject = can(user, 'quotation.reject');
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  const query = useQuery({
    queryKey: queryKeys.quotations.detail(quotationId),
    queryFn: () => getQuotation(quotationId),
    enabled: allowed && Boolean(quotationId),
  });

  const detail = query.data;

  useEffect(() => {
    if (!detail) return;
    setPaymentTerms(detail.paymentTerms ?? '');
    setDeliveryTerms(detail.deliveryTerms ?? '');
    setCustomerNotes(detail.customerNotes ?? '');
    setExpirationDate(detail.expirationDate ? String(detail.expirationDate).slice(0, 10) : '');
    setOfferedDeliveryDate(detail.offeredDeliveryDate ? String(detail.offeredDeliveryDate).slice(0, 10) : '');
    setDraftLines(
      (detail.lines ?? []).map((line) => ({
        id: line.id,
        unitPrice: String(line.unitPrice ?? '0'),
        line,
      })),
    );
  }, [detail]);

  useEffect(() => {
    if (!detail) return;
    onLoaded?.({
      status: detail.status,
      number: detail.number,
      salesOrder: detail.salesOrders?.[0] ?? null,
    });
    // Intentionally omit onLoaded — parent passes inline callbacks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail?.id, detail?.status, detail?.salesOrders?.[0]?.id]);

  useEffect(() => {
    if (!preferWorkspace || embedded || workspaceRedirected || !detail?.request?.id) return;
    setWorkspaceRedirected(true);
    router.replace(
      `/(app)/(admin)/requests/${detail.request.id}?stage=quotation&quoteId=${encodeURIComponent(quotationId)}` as never,
    );
  }, [preferWorkspace, embedded, workspaceRedirected, detail, quotationId, router]);

  const dealerName = useMemo(() => {
    if (!detail?.customer) return '—';
    return localizedName(locale, detail.customer, detail.customer.code || '—');
  }, [detail, locale]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.quotations.detail(quotationId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.quotations.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.requests.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.salesOrders.lists() });
  };

  const actionError = (err: unknown, fallback: string) => {
    void haptics.error();
    showToast({
      variant: 'error',
      message: toastMessageForError(err) || fallback,
    });
  };

  const saveMutation = useMutation({
    mutationFn: () =>
      updateQuotation(quotationId, {
        paymentTerms: paymentTerms.trim() || undefined,
        deliveryTerms: deliveryTerms.trim() || undefined,
        customerNotes: customerNotes.trim() || undefined,
        expirationDate: expirationDate.trim() || undefined,
        offeredDeliveryDate: offeredDeliveryDate.trim() || undefined,
        lines: draftLines.map(({ unitPrice, line }) => ({
          description: line.description,
          quantity: Number(line.quantity) || 0,
          unitPrice: Number(unitPrice) || 0,
          unit: line.unit ?? undefined,
          productId: line.productId ?? undefined,
          material: line.material ?? undefined,
          fabric: line.fabric ?? undefined,
          color: line.color ?? undefined,
          taxRate: line.taxRate != null ? Number(line.taxRate) : 0.16,
          width: line.width != null ? Number(line.width) : undefined,
          height: line.height != null ? Number(line.height) : undefined,
          depth: line.depth != null ? Number(line.depth) : undefined,
          manufacturingComplexity: quotationComplexity(line.manufacturingComplexity),
        })),
      }),
    onSuccess: () => {
      void haptics.confirmMedium();
      showToast({ variant: 'success', message: t('mobile.adminQuotation.saved') });
      invalidate();
    },
    onError: (err) => actionError(err, t('mobile.adminQuotation.saveFailed')),
  });

  const sendMutation = useMutation({
    mutationFn: () => sendQuotation(quotationId),
    onSuccess: () => {
      setSendBlockers([]);
      void haptics.confirmMedium();
      showToast({ variant: 'success', message: t('mobile.adminQuotation.sent') });
      invalidate();
    },
    onError: (err) => {
      const extras =
        isApiError(err) && err.fieldErrors
          ? Object.values(err.fieldErrors).flat().filter(Boolean)
          : [];
      setSendBlockers(extras);
      actionError(err, t('mobile.adminQuotation.actionFailed'));
    },
  });

  const rejectMutation = useMutation({
    mutationFn: () => rejectQuotation(quotationId),
    onSuccess: () => {
      void haptics.confirmMedium();
      showToast({ variant: 'success', message: t('mobile.adminQuotation.rejected') });
      setConfirm(null);
      invalidate();
    },
    onError: (err) => {
      setConfirm(null);
      actionError(err, t('mobile.adminQuotation.actionFailed'));
    },
  });

  const reviseMutation = useMutation({
    mutationFn: () => reviseQuotation(quotationId),
    onSuccess: (revised) => {
      void haptics.confirmMedium();
      showToast({ variant: 'success', message: t('mobile.adminQuotation.revisionCreated') });
      setConfirm(null);
      invalidate();
      if (onRevised) {
        onRevised(revised.id);
        return;
      }
      router.replace(`/(app)/(admin)/quotations/${revised.id}` as never);
    },
    onError: (err) => {
      setConfirm(null);
      actionError(err, t('mobile.adminQuotation.actionFailed'));
    },
  });

  const workflowBusy =
    saveMutation.isPending ||
    sendMutation.isPending ||
    rejectMutation.isPending ||
    reviseMutation.isPending;

  const openPdf = async () => {
    if (pdfBusy) return;
    const opts = await pickPdfOptions();
    if (!opts) return;
    setPdfBusy(true);
    try {
      await openQuotationPdf(quotationId, opts);
      void haptics.selection();
    } catch {
      void haptics.error();
      showToast({ variant: 'error', message: t('mobile.adminQuotation.pdfFailed') });
    } finally {
      setPdfBusy(false);
    }
  };

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(app)/(admin)/(tabs)/orders' as never);
  };

  if (!allowed) {
    if (embedded) {
      return (
        <EmptyState title={t('mobile.noModules')} description={t('mobile.noModulesHint')} />
      );
    }
    return (
      <AppScreen>
        <EmptyState title={t('mobile.noModules')} description={t('mobile.noModulesHint')} />
      </AppScreen>
    );
  }

  if (preferWorkspace && !embedded && detail?.request?.id) {
    return (
      <AppScreen>
        <AppText variant="body" color="secondary">
          {t('mobile.adminQuotation.loading')}
        </AppText>
      </AppScreen>
    );
  }

  if (query.isError && !detail) {
    if (embedded) {
      return (
        <ErrorState
          title={t('mobile.adminQuotation.errorTitle')}
          description={t('mobile.adminQuotation.errorBody')}
          retryLabel={t('mobile.adminQuotation.retry')}
          onRetry={() => void query.refetch()}
        />
      );
    }
    return (
      <AppScreen>
        <ErrorState
          title={t('mobile.adminQuotation.errorTitle')}
          description={t('mobile.adminQuotation.errorBody')}
          retryLabel={t('mobile.adminQuotation.retry')}
          onRetry={() => void query.refetch()}
        />
      </AppScreen>
    );
  }

  if (!detail) {
    if (embedded) {
      return (
        <AppText variant="body" color="secondary">
          {t('mobile.adminQuotation.loading')}
        </AppText>
      );
    }
    return (
      <AppScreen>
        <AppText variant="body" color="secondary">
          {t('mobile.adminQuotation.loading')}
        </AppText>
      </AppScreen>
    );
  }

  const status = detail.status;
  const isDraft = status === 'DRAFT';
  const commerciallyExpired = Boolean(detail.commerciallyExpired);
  const statusLabel = presentQuotationStatus(locale, status, commerciallyExpired);
  const quoteAccent =
    status === 'ACCEPTED'
      ? colors.success
      : status === 'REJECTED' || commerciallyExpired
        ? colors.error
        : status === 'REVISION_REQUESTED'
          ? colors.warning
          : colors.brand;
  const savedTax = Number(detail.taxAmount ?? detail.taxTotal ?? 0);
  const liveDraft =
    isDraft && canUpdate
      ? quotationDraftTotals(
          draftLines.map(({ unitPrice, line }) => ({
            unitPrice,
            quantity: line.quantity,
            taxRate: line.taxRate,
          })),
        )
      : null;
  const displayTotal = liveDraft?.total ?? Number(detail.total);
  const displaySubtotal = liveDraft?.subtotal ?? (detail.subtotal != null ? Number(detail.subtotal) : null);
  const displayTax = liveDraft?.tax ?? savedTax;
  const showRevise = canUpdate && REVISE_STATUSES.has(status);
  const showSend =
    canSend && ['DRAFT', 'INTERNAL_REVIEW', 'APPROVED'].includes(status);
  const showRejectBtn =
    canReject && ['INTERNAL_REVIEW', 'APPROVED', 'SENT', 'VIEWED'].includes(status);
  const requestDocs = detail.request?.documents ?? [];
  const linkedSalesOrder = detail.salesOrders?.[0];
  const paymentTermsShown = isDraft && canUpdate ? null : presentableText(detail.paymentTerms);
  const deliveryTermsShown = isDraft && canUpdate ? null : presentableText(detail.deliveryTerms);

  let enter = 0;
  const nextIndex = () => enter++;

  const body = (
    <>
        {detail.pendingApproverRole ? (
          <View
            style={{
              paddingHorizontal: theme.spacing.md,
              paddingVertical: theme.spacing.sm,
              borderRadius: theme.radius.lg,
              borderWidth: 1,
              borderColor: colors.borderStrong,
              backgroundColor: colors.surfaceSecondary,
            }}
          >
            <AppText variant="caption" color="secondary">
              {t('mobile.adminQuotation.pendingApproval')}
            </AppText>
          </View>
        ) : null}

        <ListItemEnter index={nextIndex()}>
          <DealerBoard
            title={t('mobile.adminQuotation.detail')}
            titleWeight={titleWeight}
            accentColor={quoteAccent}
            trailing={
              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  gap: theme.spacing.sm,
                  maxWidth: '58%',
                }}
              >
                <AppText
                  variant="caption"
                  color="brand"
                  weight={titleWeight}
                  dir="ltr"
                  numberOfLines={1}
                >
                  {detail.number}
                </AppText>
                <StatusBadge status={detail.status} label={statusLabel} dot />
              </View>
            }
          >
            <View style={{ gap: theme.spacing.md }}>
              {dealerName !== '—' ? (
                <AppText
                  variant="label"
                  weight={titleWeight}
                  numberOfLines={2}
                  style={{ textAlign: isRTL ? 'right' : 'left' }}
                >
                  {dealerName}
                </AppText>
              ) : null}
              <MetaRow isRTL={isRTL}>
                {detail.customer?.code ? (
                  <MetaCell label={t('mobile.adminQuotation.dealerCode')} value={detail.customer.code} ltr />
                ) : null}
                {detail.request ? (
                  <MetaCell
                    label={t('mobile.adminQuotation.rfq')}
                    value={detail.request.number}
                    brand={!embedded}
                    ltr
                    onPress={
                      embedded
                        ? undefined
                        : () => {
                            if (onOpenRequest) {
                              onOpenRequest();
                              return;
                            }
                            router.push(`/(app)/(admin)/requests/${detail.request!.id}` as never);
                          }
                    }
                  />
                ) : null}
                {detail.request?.externalOrderNumber ? (
                  <MetaCell
                    label={t('mobile.adminQuotation.dealerOrder')}
                    value={detail.request.externalOrderNumber}
                    ltr
                  />
                ) : null}
                {detail.createdAt ? (
                  <MetaCell
                    label={t('mobile.adminQuotation.createdAt')}
                    value={String(detail.createdAt).slice(0, 10)}
                    ltr
                  />
                ) : null}
                {detail.expirationDate || commerciallyExpired ? (
                  <MetaCell
                    label={t('mobile.adminQuotation.validUntil')}
                    value={
                      commerciallyExpired
                        ? statusLabel
                        : String(detail.expirationDate).slice(0, 10)
                    }
                    ltr
                  />
                ) : null}
                <MetaCell
                  label={t('mobile.adminQuotation.currency')}
                  value={detail.currency || 'ILS'}
                  ltr
                />
                {linkedSalesOrder && !embedded ? (
                  <MetaCell
                    label={t('mobile.adminQuotation.openSalesOrder')}
                    value={linkedSalesOrder.number}
                    brand
                    ltr
                    onPress={() => {
                      router.push(`/(app)/(admin)/orders/${linkedSalesOrder.id}` as never);
                    }}
                  />
                ) : null}
              </MetaRow>
              {(detail.version ?? 1) > 1 ? (
                <AppText variant="caption" color="secondary">
                  {t('mobile.adminQuotation.revised')} · v{detail.version}
                </AppText>
              ) : null}
              {detail.rejectionReason ? (
                <AppText variant="caption" color="secondary">
                  {t('mobile.adminQuotation.rejectionReason')}: {detail.rejectionReason}
                </AppText>
              ) : null}
            </View>
          </DealerBoard>
        </ListItemEnter>

        <ListItemEnter index={nextIndex()}>
          <DealerBoard
            title={t('mobile.adminQuotation.lines')}
            titleWeight={titleWeight}
          >
            {(detail.lines ?? []).length === 0 ? (
              <AppText variant="caption" color="muted">
                {t('mobile.adminQuotation.noLines')}
              </AppText>
            ) : (
              <View style={{ gap: theme.spacing.sm }}>
                {(isDraft && canUpdate ? draftLines : (detail.lines ?? []).map((line) => ({
                  id: line.id,
                  unitPrice: String(line.unitPrice ?? '0'),
                  line,
                }))).map((row, index) => {
                  const line = row.line;
                  const dims = quotationLineDims(line);
                  const specs = quotationLineSpecs(line);
                  const qtyLabel = quotationQtyLabel(line.quantity);
                  const pricedUnit = isDraft && canUpdate ? row.unitPrice : line.unitPrice;
                  const missingPrice = sellingPriceMissing(pricedUnit);
                  const lineNet = missingPrice ? null : quotationLineNet(pricedUnit, line.quantity);
                  const complexity = quotationComplexity(line.manufacturingComplexity);
                  const photo = line.product?.imageUrl;
                  const sku = line.product?.sku;
                  return (
                  <View
                    key={row.id}
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
                        gap: theme.spacing.sm,
                        alignItems: 'flex-start',
                      }}
                    >
                      {photo ? (
                        <Image
                          source={{ uri: photo }}
                          style={{ width: 56, height: 56, borderRadius: theme.radius.md }}
                        />
                      ) : (
                        <View
                          style={{
                            width: 56,
                            height: 56,
                            borderRadius: theme.radius.md,
                            backgroundColor: colors.brandSoft,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Ionicons name="image-outline" size={20} color={colors.brand} />
                        </View>
                      )}
                      <View style={{ flex: 1, gap: 4 }}>
                    <View
                      style={{
                        flexDirection: isRTL ? 'row-reverse' : 'row',
                        justifyContent: 'space-between',
                        gap: theme.spacing.sm,
                        alignItems: 'flex-start',
                      }}
                    >
                      <AppText
                        variant="label"
                        weight={titleWeight}
                        style={{ flex: 1, textAlign: isRTL ? 'right' : 'left' }}
                        numberOfLines={4}
                      >
                        {line.description || t('mobile.adminQuotation.line', { n: index + 1 })}
                      </AppText>
                      {qtyLabel ? (
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
                            ×{qtyLabel}
                          </AppText>
                        </View>
                      ) : null}
                    </View>
                    <StatusBadge
                      status={complexity}
                      label={t(`mobile.adminQuotation.complexity.${complexity}`)}
                    />
                    {sku ? (
                      <AppText variant="caption" color="muted" dir="ltr">
                        {t('mobile.adminQuotation.sku')} {sku}
                      </AppText>
                    ) : null}
                      </View>
                    </View>

                    <View
                      style={{
                        flexDirection: isRTL ? 'row-reverse' : 'row',
                        flexWrap: 'wrap',
                        gap: theme.spacing.md,
                      }}
                    >
                      {dims ? (
                        <View style={{ minWidth: '40%', gap: 2 }}>
                          <AppText
                            variant="caption"
                            color="muted"
                            style={{
                              textTransform: locale === 'ar' ? 'none' : 'uppercase',
                              letterSpacing: locale === 'ar' ? 0 : 0.45,
                              fontSize: 10,
                            }}
                          >
                            {t('mobile.adminQuotation.dimensions')}
                          </AppText>
                          <AppText variant="caption" color="secondary" dir="ltr">
                            {dims}
                          </AppText>
                        </View>
                      ) : null}
                      {specs ? (
                        <View style={{ minWidth: '40%', gap: 2 }}>
                          <AppText
                            variant="caption"
                            color="muted"
                            style={{
                              textTransform: locale === 'ar' ? 'none' : 'uppercase',
                              letterSpacing: locale === 'ar' ? 0 : 0.45,
                              fontSize: 10,
                            }}
                          >
                            {t('mobile.adminQuotation.specs')}
                          </AppText>
                          <AppText variant="caption" color="secondary">
                            {specs}
                          </AppText>
                        </View>
                      ) : null}
                      {isDraft && canUpdate ? (
                        <View style={{ width: '100%' }}>
                          <TextField
                            label={t('mobile.adminQuotation.price')}
                            value={row.unitPrice}
                            onChangeText={(text) =>
                              setDraftLines((prev) =>
                                prev.map((entry) =>
                                  entry.id === row.id
                                    ? { ...entry, unitPrice: text }
                                    : entry,
                                ),
                              )
                            }
                            keyboardType="decimal-pad"
                          />
                          {line.referenceUnitPrice != null ? (
                            <AppText variant="caption" color="muted" dir="ltr">
                              {t('mobile.adminQuotation.referencePrice')}{' '}
                              {boardMoney(locale, line.referenceUnitPrice)}
                            </AppText>
                          ) : null}
                        </View>
                      ) : (
                        <View style={{ minWidth: '40%', gap: 2 }}>
                          <AppText
                            variant="caption"
                            color="muted"
                            style={{
                              textTransform: locale === 'ar' ? 'none' : 'uppercase',
                              letterSpacing: locale === 'ar' ? 0 : 0.45,
                              fontSize: 10,
                            }}
                          >
                            {t('mobile.adminQuotation.price')}
                          </AppText>
                          <AppText variant="caption" weight="medium" dir="ltr">
                            {missingPrice
                              ? t('mobile.adminQuotation.priceRequired')
                              : boardMoney(locale, line.unitPrice)}
                          </AppText>
                          {missingPrice && line.referenceUnitPrice != null ? (
                            <AppText variant="caption" color="muted" dir="ltr">
                              {t('mobile.adminQuotation.referencePrice')}{' '}
                              {boardMoney(locale, line.referenceUnitPrice)}
                            </AppText>
                          ) : null}
                        </View>
                      )}
                      <View
                        style={{
                          minWidth: isDraft && canUpdate ? '100%' : '40%',
                          gap: 2,
                        }}
                      >
                        <AppText
                          variant="caption"
                          color="muted"
                          style={{
                            textTransform: locale === 'ar' ? 'none' : 'uppercase',
                            letterSpacing: locale === 'ar' ? 0 : 0.45,
                            fontSize: 10,
                          }}
                        >
                          {t('mobile.adminQuotation.lineTotal')}
                        </AppText>
                        <AppText variant="caption" weight={titleWeight} dir="ltr">
                          {missingPrice
                            ? t('mobile.adminQuotation.priceRequired')
                            : boardMoney(locale, lineNet)}
                        </AppText>
                      </View>
                    </View>
                  </View>
                  );
                })}
              </View>
            )}
          </DealerBoard>
        </ListItemEnter>

        <ListItemEnter index={nextIndex()}>
          <DealerBoard title={t('mobile.adminQuotation.commercial')} titleWeight={titleWeight}>
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
                }}
              >
                <AppText variant="caption" color="muted">
                  {t('mobile.adminQuotation.total')}
                </AppText>
                <AppText variant="title" weight={titleWeight} dir="ltr">
                  {boardMoney(locale, displayTotal)}
                </AppText>
              </View>
              {displaySubtotal != null ? (
                <View
                  style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    justifyContent: 'space-between',
                  }}
                >
                  <AppText variant="caption" color="muted">
                    {t('mobile.adminQuotation.subtotal')}
                  </AppText>
                  <AppText variant="label" weight={titleWeight} dir="ltr">
                    {boardMoney(locale, displaySubtotal)}
                  </AppText>
                </View>
              ) : null}
              {displayTax > 0 ? (
                <View
                  style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    justifyContent: 'space-between',
                  }}
                >
                  <AppText variant="caption" color="muted">
                    {t('mobile.adminQuotation.tax')}
                  </AppText>
                  <AppText variant="label" weight={titleWeight} dir="ltr">
                    {boardMoney(locale, displayTax)}
                  </AppText>
                </View>
              ) : null}
            </View>
            {isDraft && canUpdate ? (
              <View style={{ gap: theme.spacing.sm }}>
                <TextField
                  label={t('mobile.adminQuotation.validUntil')}
                  value={expirationDate}
                  onChangeText={setExpirationDate}
                  placeholder="YYYY-MM-DD"
                />
                <TextField
                  label={t('mobile.adminQuotation.factoryDelivery')}
                  value={offeredDeliveryDate}
                  onChangeText={setOfferedDeliveryDate}
                  placeholder="YYYY-MM-DD"
                />
                <TextField
                  label={t('mobile.adminQuotation.paymentTerms')}
                  value={paymentTerms}
                  onChangeText={setPaymentTerms}
                />
                <TextField
                  label={t('mobile.adminQuotation.deliveryTerms')}
                  value={deliveryTerms}
                  onChangeText={setDeliveryTerms}
                  multiline
                />
                <TextField
                  label={t('mobile.adminQuotation.notes')}
                  value={customerNotes}
                  onChangeText={setCustomerNotes}
                  multiline
                />
              </View>
            ) : (
              <View style={{ gap: theme.spacing.sm }}>
                {offeredDeliveryDate ? (
                  <MetaCell
                    label={t('mobile.adminQuotation.factoryDelivery')}
                    value={offeredDeliveryDate}
                    fullWidth
                  />
                ) : null}
                {paymentTermsShown ? (
                  <MetaCell
                    label={t('mobile.adminQuotation.paymentTerms')}
                    value={paymentTermsShown}
                    fullWidth
                  />
                ) : null}
                {deliveryTermsShown ? (
                  <MetaCell
                    label={t('mobile.adminQuotation.deliveryTerms')}
                    value={deliveryTermsShown}
                    fullWidth
                  />
                ) : null}
                {presentableText(detail.customerNotes) ? (
                  <MetaCell
                    label={t('mobile.adminQuotation.notes')}
                    value={presentableText(detail.customerNotes)!}
                    fullWidth
                  />
                ) : null}
              </View>
            )}
          </DealerBoard>
        </ListItemEnter>

        <ListItemEnter index={nextIndex()}>
          <DealerBoard title={t('mobile.adminQuotation.attachments')} titleWeight={titleWeight}>
            {requestDocs.length === 0 ? (
              <AppText variant="caption" color="muted">
                {t('mobile.adminQuotation.noAttachments')}
              </AppText>
            ) : (
              <View style={{ gap: theme.spacing.sm }}>
                {requestDocs.map((doc) => (
                  <AnimatedPressable
                    key={doc.id}
                    variant="button"
                    onPress={() => {
                      void (async () => {
                        try {
                          const url = await resolveDocumentUrl(doc.id);
                          await Linking.openURL(url);
                        } catch {
                          showToast({
                            variant: 'error',
                            message: t('mobile.adminQuotation.actionFailed'),
                          });
                        }
                      })();
                    }}
                    style={{
                      flexDirection: isRTL ? 'row-reverse' : 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: theme.spacing.md,
                      borderRadius: theme.radius.lg,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.surfaceSecondary,
                    }}
                  >
                    <AppText variant="label" style={{ flex: 1 }}>
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
          <DealerBoard title={t('mobile.adminQuotation.send')} titleWeight={titleWeight}>
            {sendBlockers.length > 0 ? (
              <View
                style={{
                  borderRadius: theme.radius.lg,
                  borderWidth: 1,
                  borderColor: colors.warning,
                  backgroundColor: colors.warningSoft,
                  padding: theme.spacing.md,
                  gap: theme.spacing.xs,
                }}
              >
                <AppText variant="caption" weight={titleWeight}>
                  {t('mobile.adminQuotation.cannotSendTitle')}
                </AppText>
                {sendBlockers.map((reason) => (
                  <AppText key={reason} variant="caption" color="secondary">
                    {reason}
                  </AppText>
                ))}
              </View>
            ) : null}
            {showSend ? (
              <PrimaryButton
                label={t('mobile.adminQuotation.send')}
                onPress={() => sendMutation.mutate()}
                loading={sendMutation.isPending}
                disabled={workflowBusy}
                style={floorBtn}
              />
            ) : null}
            {isDraft && canUpdate ? (
              <SecondaryButton
                label={t('mobile.adminQuotation.save')}
                onPress={() => saveMutation.mutate()}
                loading={saveMutation.isPending}
                disabled={workflowBusy}
                style={floorBtn}
              />
            ) : null}
            <PrimaryButton
              label={t('mobile.adminQuotation.pdf')}
              disabled={pdfBusy}
              loading={pdfBusy}
              onPress={() => void openPdf()}
              leading={<Ionicons name="document-text-outline" size={16} color={colors.onBrand} />}
              style={floorBtn}
            />
            {showRevise ? (
              <SecondaryButton
                label={t('mobile.adminQuotation.revise')}
                onPress={() => setConfirm('revise')}
                disabled={workflowBusy}
                style={floorBtn}
              />
            ) : null}
            {showRejectBtn ? (
              <DestructiveButton
                label={t('mobile.adminQuotation.reject')}
                disabled={workflowBusy}
                onPress={() => setConfirm('reject')}
                style={floorBtn}
              />
            ) : null}
          </DealerBoard>
        </ListItemEnter>
    </>
  );

  const sheets = (
    <>
      <ConfirmationSheet
        open={confirm === 'revise'}
        onClose={() => setConfirm(null)}
        title={t('mobile.adminQuotation.revise')}
        message={t('mobile.adminQuotation.reviseConfirm')}
        confirmLabel={t('mobile.adminQuotation.revise')}
        cancelLabel={t('mobile.adminQuotation.cancel')}
        onConfirm={() => reviseMutation.mutate()}
      />
      <ConfirmationSheet
        open={confirm === 'reject'}
        onClose={() => setConfirm(null)}
        title={t('mobile.adminQuotation.reject')}
        message={t('mobile.adminQuotation.rejectConfirm')}
        confirmLabel={t('mobile.adminQuotation.reject')}
        cancelLabel={t('mobile.adminQuotation.cancel')}
        destructive
        onConfirm={() => rejectMutation.mutate()}
      />
    </>
  );

  if (embedded) {
    return (
      <View style={{ gap: theme.spacing.md }}>
        {body}
        {sheets}
        {pdfDownloadSheet}
      </View>
    );
  }

  return (
    <AppScreen
      edges={{ top: false, bottom: false }}
      padding="sm"
      style={{ paddingHorizontal: 0, paddingBottom: 0, paddingTop: insets.top }}
    >
      <View
        style={{
          paddingHorizontal: theme.spacing.lg,
          marginBottom: theme.spacing.sm,
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
          minHeight: theme.sizes.touch.min,
        }}
      >
        <BackButton onPress={goBack} label={t('mobile.adminQuotation.back')} />
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching}
            onRefresh={() => void query.refetch()}
            tintColor={colors.brand}
          />
        }
        contentContainerStyle={{
          paddingHorizontal: theme.spacing.lg,
          paddingBottom: insets.bottom + SURFACE_TAB_BAR_CLEARANCE,
          gap: theme.spacing.md,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {body}
      </ScrollView>

      {sheets}
      {pdfDownloadSheet}
    </AppScreen>
  );
}

/** Alias for workspace embedding. */
export const AdminQuotationPanel = AdminQuotationDetailScreen;
