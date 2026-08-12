import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { can } from '@maher/permissions';
import { localizedName } from '@maher/i18n';
import { isApiError } from '@/api/errors';
import {
  acceptQuotation,
  approveQuotation,
  getQuotation,
  openQuotationPdf,
  rejectQuotation,
  reviseQuotation,
  sendQuotation,
  submitQuotationForApproval,
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
import { usePdfDownload } from '@/features/pdf/usePdfDownload';
import { haptics, ListItemEnter } from '@/motion';
import { useTheme } from '@/theme';
import {
  OrderBoardCard,
  OrderSectionHeader,
} from '@/features/sales-orders/components/OrderBoardCard';

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

type ConfirmKind = 'revise' | 'reject' | 'accept' | null;

const REVISE_STATUSES = new Set([
  'APPROVED',
  'SENT',
  'REJECTED',
  'REVISION_REQUESTED',
  'VIEWED',
]);

function money(value: number | string | null | undefined): string {
  if (value == null || value === '') return '—';
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(2) : String(value);
}

function lineDims(line: {
  width?: number | string | null;
  height?: number | string | null;
  depth?: number | string | null;
}): string {
  const parts = [line.width, line.height, line.depth].filter((v) => v != null && v !== '');
  return parts.length ? parts.map(String).join('×') : '—';
}

function lineSpecs(line: {
  material?: string | null;
  fabric?: string | null;
  color?: string | null;
}): string {
  const parts = [line.material, line.fabric, line.color].filter(Boolean);
  return parts.length ? parts.join(' / ') : '—';
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
  const cellStyle = {
    flexGrow: 1,
    flexBasis: fullWidth ? ('100%' as const) : ('46%' as const),
    minWidth: fullWidth ? ('100%' as const) : ('46%' as const),
    maxWidth: fullWidth ? ('100%' as const) : ('50%' as const),
    gap: theme.spacing.xs,
  };
  const content = (
    <>
      <AppText variant="caption" color="muted">
        {label}
      </AppText>
      <AppText
        variant="label"
        weight="semibold"
        numberOfLines={fullWidth ? 4 : 2}
        dir={ltr ? 'ltr' : undefined}
        style={brand ? { color: colors.brand } : undefined}
      >
        {value}
      </AppText>
    </>
  );
  if (!onPress) {
    return <View style={cellStyle}>{content}</View>;
  }
  return (
    <Pressable accessibilityRole="link" onPress={onPress} style={cellStyle}>
      {content}
    </Pressable>
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
  const { t, isRTL, locale, formatCurrency } = useLocale();
  const { colors, theme } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { pickPdfOptions, pdfDownloadSheet } = usePdfDownload();
  const [confirm, setConfirm] = useState<ConfirmKind>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [paymentTerms, setPaymentTerms] = useState('');
  const [deliveryTerms, setDeliveryTerms] = useState('');
  const [draftLines, setDraftLines] = useState<
    Array<{ id: string; unitPrice: string; line: QuotationLine }>
  >([]);
  const [workspaceRedirected, setWorkspaceRedirected] = useState(false);

  const allowed = can(user, 'quotation.read') || can(user, 'request.read');
  const canUpdate = can(user, 'quotation.update');
  const canApprove = can(user, 'quotation.approve');
  const canSend = can(user, 'quotation.send');
  const canAccept = can(user, 'quotation.accept');
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
      message: isApiError(err) ? err.message : fallback,
    });
  };

  const saveMutation = useMutation({
    mutationFn: () =>
      updateQuotation(quotationId, {
        paymentTerms: paymentTerms.trim() || undefined,
        deliveryTerms: deliveryTerms.trim() || undefined,
        lines: draftLines.map(({ unitPrice, line }) => ({
          description: line.description,
          quantity: Number(line.quantity) || 0,
          unitPrice: Number(unitPrice) || 0,
          unit: line.unit ?? undefined,
          productId: line.productId ?? undefined,
          material: line.material ?? undefined,
          fabric: line.fabric ?? undefined,
          color: line.color ?? undefined,
          notes: line.notes ?? undefined,
          taxRate: line.taxRate != null ? Number(line.taxRate) : 0.16,
          width: line.width != null ? Number(line.width) : undefined,
          height: line.height != null ? Number(line.height) : undefined,
          depth: line.depth != null ? Number(line.depth) : undefined,
        })),
      }),
    onSuccess: () => {
      void haptics.confirmMedium();
      showToast({ variant: 'success', message: t('mobile.adminQuotation.saved') });
      invalidate();
    },
    onError: (err) => actionError(err, t('mobile.adminQuotation.saveFailed')),
  });

  const submitMutation = useMutation({
    mutationFn: () => submitQuotationForApproval(quotationId),
    onSuccess: () => {
      void haptics.confirmMedium();
      showToast({ variant: 'success', message: t('mobile.adminQuotation.submitted') });
      invalidate();
    },
    onError: (err) => actionError(err, t('mobile.adminQuotation.actionFailed')),
  });

  const approveMutation = useMutation({
    mutationFn: () => approveQuotation(quotationId),
    onSuccess: () => {
      void haptics.confirmMedium();
      showToast({ variant: 'success', message: t('mobile.adminQuotation.approved') });
      invalidate();
    },
    onError: (err) => actionError(err, t('mobile.adminQuotation.actionFailed')),
  });

  const sendMutation = useMutation({
    mutationFn: () => sendQuotation(quotationId),
    onSuccess: () => {
      void haptics.confirmMedium();
      showToast({ variant: 'success', message: t('mobile.adminQuotation.sent') });
      invalidate();
    },
    onError: (err) => actionError(err, t('mobile.adminQuotation.actionFailed')),
  });

  const acceptMutation = useMutation({
    mutationFn: () => acceptQuotation(quotationId),
    onSuccess: (accepted) => {
      void haptics.confirmMedium();
      showToast({ variant: 'success', message: t('mobile.adminQuotation.accepted') });
      setConfirm(null);
      invalidate();
      const so = accepted.salesOrders?.[0];
      if (so && onAccepted) {
        onAccepted(so);
        return;
      }
      if (so) {
        router.replace(`/(app)/(admin)/orders/${so.id}` as never);
      }
    },
    onError: (err) => {
      setConfirm(null);
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
    submitMutation.isPending ||
    approveMutation.isPending ||
    sendMutation.isPending ||
    acceptMutation.isPending ||
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
  const taxValue = Number(detail.taxAmount ?? detail.taxTotal ?? 0);
  const showRevise = canUpdate && REVISE_STATUSES.has(status);
  const showSubmit = canUpdate && status === 'DRAFT';
  const showApprove = canApprove && status === 'INTERNAL_REVIEW';
  const showSend = canSend && status === 'APPROVED';
  const showAcceptBtn = canAccept && status === 'SENT';
  const showRejectBtn =
    canReject && ['INTERNAL_REVIEW', 'SENT', 'APPROVED'].includes(status);
  const linkedSalesOrder = detail.salesOrders?.[0];

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
              {t('mobile.adminQuotation.pendingApproval')}: {detail.pendingApproverRole}
            </AppText>
          </View>
        ) : null}

        <ListItemEnter index={nextIndex()}>
          <OrderBoardCard accent={colors.brand}>
            <OrderSectionHeader
              icon="receipt-outline"
              label={
                embedded
                  ? `${t('mobile.adminQuotation.detail')} · ${detail.number}`
                  : t('mobile.adminQuotation.detail')
              }
              accent={colors.brand}
              trailing={embedded ? <StatusBadge status={detail.status} dot /> : undefined}
            />

            <View style={{ gap: theme.spacing.lg }}>
              <MetaRow isRTL={isRTL}>
                <MetaCell
                  label={t('mobile.adminQuotation.customer')}
                  value={dealerName}
                  brand
                />
                <MetaCell
                  label={t('mobile.adminQuotation.total')}
                  value={formatCurrency(Number(detail.total ?? 0))}
                  ltr
                />
              </MetaRow>

              {isDraft && canUpdate ? null : (
                <View style={{ gap: theme.spacing.md }}>
                  <MetaCell
                    label={t('mobile.adminQuotation.paymentTerms')}
                    value={detail.paymentTerms?.trim() || '—'}
                    fullWidth
                  />
                  <MetaCell
                    label={t('mobile.adminQuotation.deliveryTerms')}
                    value={detail.deliveryTerms?.trim() || '—'}
                    fullWidth
                  />
                </View>
              )}

              {detail.request && !embedded ? (
                <MetaRow isRTL={isRTL}>
                  <MetaCell
                    label={t('mobile.adminQuotation.rfq')}
                    value={detail.request.number}
                    brand
                    ltr
                    onPress={() => {
                      void haptics.selection();
                      if (onOpenRequest) {
                        onOpenRequest();
                        return;
                      }
                      router.push(`/(app)/(admin)/requests/${detail.request!.id}` as never);
                    }}
                  />
                  {detail.request.externalOrderNumber ? (
                    <MetaCell
                      label={t('mobile.adminQuotation.dealerOrder')}
                      value={detail.request.externalOrderNumber}
                      ltr
                    />
                  ) : null}
                </MetaRow>
              ) : detail.request?.externalOrderNumber ? (
                <MetaRow isRTL={isRTL}>
                  <MetaCell
                    label={t('mobile.adminQuotation.dealerOrder')}
                    value={detail.request.externalOrderNumber}
                    ltr
                  />
                </MetaRow>
              ) : null}
              {linkedSalesOrder && !embedded ? (
                <MetaRow isRTL={isRTL}>
                  <MetaCell
                    label={t('mobile.adminQuotation.openSalesOrder')}
                    value={linkedSalesOrder.number}
                    brand
                    ltr
                    onPress={() => {
                      void haptics.selection();
                      router.push(`/(app)/(admin)/orders/${linkedSalesOrder.id}` as never);
                    }}
                  />
                </MetaRow>
              ) : null}
            </View>

            {isDraft && canUpdate ? (
              <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
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
              </View>
            ) : null}

            {(detail.approvalChain?.length ?? 0) > 0 ? (
              <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.md }}>
                <AppText variant="caption" color="muted">
                  {t('mobile.adminQuotation.approvalChain')}
                </AppText>
                <View
                  style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    flexWrap: 'wrap',
                    gap: theme.spacing.sm,
                  }}
                >
                  {detail.approvalChain!.map((role) => {
                    const done = detail.completedApprovalSteps?.includes(role);
                    return (
                      <View
                        key={role}
                        style={{
                          flexDirection: isRTL ? 'row-reverse' : 'row',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <AppText
                          variant="label"
                          weight="medium"
                          style={{ color: done ? colors.success : colors.textSecondary }}
                        >
                          {done ? '✓' : '○'}
                        </AppText>
                        <AppText variant="label" weight="medium" numberOfLines={1}>
                          {role}
                        </AppText>
                      </View>
                    );
                  })}
                </View>
              </View>
            ) : null}

            {(detail.subtotal != null || taxValue > 0) && (
              <View
                style={{
                  marginTop: theme.spacing.md,
                  paddingTop: theme.spacing.md,
                  borderTopWidth: 1,
                  borderTopColor: colors.border,
                  gap: theme.spacing.sm,
                }}
              >
                {detail.subtotal != null ? (
                  <View
                    style={{
                      flexDirection: isRTL ? 'row-reverse' : 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <AppText variant="caption" color="muted">
                      {t('mobile.adminQuotation.subtotal')}
                    </AppText>
                    <AppText variant="caption" weight="medium" dir="ltr">
                      {formatCurrency(Number(detail.subtotal))}
                    </AppText>
                  </View>
                ) : null}
                {taxValue > 0 ? (
                  <View
                    style={{
                      flexDirection: isRTL ? 'row-reverse' : 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <AppText variant="caption" color="muted">
                      {t('mobile.adminQuotation.tax')}
                    </AppText>
                    <AppText variant="caption" weight="medium" dir="ltr">
                      {formatCurrency(taxValue)}
                    </AppText>
                  </View>
                ) : null}
              </View>
            )}

            <View
              style={{
                marginTop: theme.spacing.md,
                paddingTop: theme.spacing.md,
                borderTopWidth: 1,
                borderTopColor: colors.border,
                gap: theme.spacing.md,
              }}
            >
              <SecondaryButton
                label={t('mobile.adminQuotation.pdf')}
                disabled={pdfBusy}
                onPress={() => void openPdf()}
                style={{ alignSelf: 'stretch', width: '100%' }}
              />
              {showRevise ? (
                <SecondaryButton
                  label={t('mobile.adminQuotation.revise')}
                  onPress={() => setConfirm('revise')}
                  disabled={workflowBusy}
                  style={{ alignSelf: 'stretch', width: '100%' }}
                />
              ) : null}

              {isDraft && canUpdate ? (
                <SecondaryButton
                  label={t('mobile.adminQuotation.save')}
                  onPress={() => saveMutation.mutate()}
                  loading={saveMutation.isPending}
                  disabled={workflowBusy}
                  style={{ alignSelf: 'stretch', width: '100%' }}
                />
              ) : null}

              {showSubmit ? (
                <PrimaryButton
                  label={t('mobile.adminQuotation.submitForApproval')}
                  onPress={() => submitMutation.mutate()}
                  loading={submitMutation.isPending}
                  disabled={workflowBusy}
                  style={{ alignSelf: 'stretch', width: '100%' }}
                />
              ) : null}
              {showApprove ? (
                <PrimaryButton
                  label={
                    detail.pendingApproverRole
                      ? t('mobile.adminQuotation.approveAs', {
                          role: detail.pendingApproverRole,
                        })
                      : t('mobile.adminQuotation.approve')
                  }
                  onPress={() => approveMutation.mutate()}
                  loading={approveMutation.isPending}
                  disabled={workflowBusy}
                  style={{ alignSelf: 'stretch', width: '100%' }}
                />
              ) : null}
              {showSend ? (
                <PrimaryButton
                  label={t('mobile.adminQuotation.send')}
                  onPress={() => sendMutation.mutate()}
                  loading={sendMutation.isPending}
                  disabled={workflowBusy}
                  style={{ alignSelf: 'stretch', width: '100%' }}
                />
              ) : null}
              {showAcceptBtn ? (
                <PrimaryButton
                  label={t('mobile.adminQuotation.accept')}
                  onPress={() => setConfirm('accept')}
                  disabled={workflowBusy}
                  style={{ alignSelf: 'stretch', width: '100%' }}
                />
              ) : null}
              {showRejectBtn ? (
                <DestructiveButton
                  label={t('mobile.adminQuotation.reject')}
                  disabled={workflowBusy}
                  onPress={() => setConfirm('reject')}
                  style={{ alignSelf: 'stretch', width: '100%' }}
                />
              ) : null}
            </View>
          </OrderBoardCard>
        </ListItemEnter>

        <ListItemEnter index={nextIndex()}>
          <OrderBoardCard>
            <OrderSectionHeader
              icon="list-outline"
              label={t('mobile.adminQuotation.lines')}
            />
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
                        justifyContent: 'space-between',
                        gap: theme.spacing.sm,
                        alignItems: 'flex-start',
                      }}
                    >
                      <AppText
                        variant="label"
                        weight="semibold"
                        style={{ flex: 1 }}
                        numberOfLines={4}
                      >
                        {line.description || t('mobile.adminQuotation.line', { n: index + 1 })}
                      </AppText>
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
                          ×{money(line.quantity)}
                        </AppText>
                      </View>
                    </View>

                    <View
                      style={{
                        flexDirection: isRTL ? 'row-reverse' : 'row',
                        flexWrap: 'wrap',
                        gap: theme.spacing.md,
                      }}
                    >
                      <View style={{ minWidth: '40%', gap: 2 }}>
                        <AppText
                          variant="caption"
                          color="muted"
                          style={{ textTransform: 'uppercase', fontSize: 10, letterSpacing: 0.5 }}
                        >
                          {t('mobile.adminQuotation.dimensions')}
                        </AppText>
                        <AppText variant="caption" color="secondary" dir="ltr">
                          {lineDims(line)}
                        </AppText>
                      </View>
                      <View style={{ minWidth: '40%', gap: 2 }}>
                        <AppText
                          variant="caption"
                          color="muted"
                          style={{ textTransform: 'uppercase', fontSize: 10, letterSpacing: 0.5 }}
                        >
                          {t('mobile.adminQuotation.specs')}
                        </AppText>
                        <AppText variant="caption" color="secondary">
                          {lineSpecs(line)}
                        </AppText>
                      </View>
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
                        </View>
                      ) : (
                        <>
                          <View style={{ minWidth: '40%', gap: 2 }}>
                            <AppText
                              variant="caption"
                              color="muted"
                              style={{
                                textTransform: 'uppercase',
                                fontSize: 10,
                                letterSpacing: 0.5,
                              }}
                            >
                              {t('mobile.adminQuotation.price')}
                            </AppText>
                            <AppText variant="caption" weight="medium" dir="ltr">
                              {money(line.unitPrice)}
                            </AppText>
                          </View>
                          <View style={{ minWidth: '40%', gap: 2 }}>
                            <AppText
                              variant="caption"
                              color="muted"
                              style={{
                                textTransform: 'uppercase',
                                fontSize: 10,
                                letterSpacing: 0.5,
                              }}
                            >
                              {t('mobile.adminQuotation.lineTotal')}
                            </AppText>
                            <AppText variant="caption" weight="semibold" dir="ltr">
                              {money(
                                line.lineTotal ??
                                  Number(line.unitPrice) * Number(line.quantity),
                              )}
                            </AppText>
                          </View>
                        </>
                      )}
                    </View>
                  </View>
                  );
                })}
              </View>
            )}
          </OrderBoardCard>
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
      <ConfirmationSheet
        open={confirm === 'accept'}
        onClose={() => setConfirm(null)}
        title={t('mobile.adminQuotation.accept')}
        message={t('mobile.adminQuotation.acceptConfirm')}
        confirmLabel={t('mobile.adminQuotation.accept')}
        cancelLabel={t('mobile.adminQuotation.cancel')}
        onConfirm={() => acceptMutation.mutate()}
      />
    </>
  );

  if (embedded) {
    return (
      <View style={{ gap: theme.spacing.md }}>
        {body}
        {sheets}
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
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <AppText variant="title" weight={titleWeight} numberOfLines={1} dir="ltr">
            {detail.number}
          </AppText>
          <AppText variant="caption" color="muted" numberOfLines={1}>
            {dealerName}
          </AppText>
        </View>
        <StatusBadge status={detail.status} dot />
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
          paddingBottom: theme.spacing['3xl'] + insets.bottom + 72,
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
