import { useMemo, useState } from 'react';
import { Image, RefreshControl, ScrollView, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter, type Href } from 'expo-router';
import { can } from '@maher/permissions';
import { presentQuotationStatus } from '@maher/i18n';
import { isApiError } from '@/api/errors';
import {
  acceptQuotation,
  getQuotation,
  openQuotationPdf,
  rejectQuotation,
  requestQuotationRevision,
  type QuotationLine,
} from '@/api/modules/quotations';
import { queryKeys } from '@/api/queryKeys';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { DestructiveButton, PrimaryButton, SecondaryButton } from '@/components/buttons/PrimaryButton';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { useToast } from '@/components/feedback/Toast';
import { AppScreen } from '@/components/layout/AppScreen';
import { ScreenBackLead } from '@/components/layout/ScreenBackLead';
import { ConfirmationSheet } from '@/components/sheets/ConfirmationSheet';
import { usePdfDownload } from '@/features/pdf/usePdfDownload';
import { DealerBoard } from '@/features/dealers/components/DealerBoard';
import { useLocale } from '@/i18n';
import { formatNumber } from '@/i18n/format';
import { haptics, ListItemEnter } from '@/motion';
import { SURFACE_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import { useTheme } from '@/theme';
import { quotationComplexity, quotationLineNet } from './presentAdminQuotation';
import { dealerCanDecideQuotation } from './dealerQuotationUi';

type Props = {
  quotationId: string;
  backFallback: Href;
};

type ConfirmKind = 'accept' | 'reject' | 'revision' | null;

function lineSpecs(line: QuotationLine): string {
  const parts = [line.material, line.fabric, line.color].filter(Boolean);
  return parts.length ? parts.join(' / ') : '';
}

function lineDims(line: QuotationLine): string {
  const parts = [line.width, line.height, line.depth].filter((v) => v != null && v !== '');
  return parts.length ? parts.map(String).join('×') : '';
}

export function DealerQuotationDetailScreen({ quotationId, backFallback }: Props) {
  const { user } = useAuth();
  const { t, locale, formatCurrency, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const { showToast } = useToast();
  const { pickPdfOptions, pdfDownloadSheet } = usePdfDownload();
  const [confirm, setConfirm] = useState<ConfirmKind>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const allowed = can(user, 'quotation.read');
  const canAccept = can(user, 'quotation.accept');
  const canReject = can(user, 'quotation.reject');
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  const query = useQuery({
    queryKey: queryKeys.quotations.detail(quotationId),
    queryFn: () => getQuotation(quotationId),
    enabled: allowed && Boolean(quotationId),
  });
  const detail = query.data;
  const canDecide = Boolean(
    detail && dealerCanDecideQuotation(detail.status, detail.commerciallyExpired),
  );
  const statusLabel = detail
    ? presentQuotationStatus(locale, detail.status, detail.commerciallyExpired)
    : '';
  const taxValue = Number(detail?.taxAmount ?? detail?.taxTotal ?? 0);
  const so = detail?.salesOrders?.[0];

  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey: queryKeys.quotations.all });
    await qc.invalidateQueries({ queryKey: queryKeys.salesOrders.lists() });
  };

  const fail = (err: unknown) => {
    showToast({
      variant: 'error',
      message: isApiError(err) ? err.message : t('mobile.adminQuotation.actionFailed'),
    });
  };

  const acceptMutation = useMutation({
    mutationFn: () => acceptQuotation(quotationId),
    onSuccess: async () => {
      void haptics.confirmLight();
      await invalidate();
      showToast({ variant: 'success', message: t('mobile.dealerQuotations.accepted') });
    },
    onError: fail,
  });
  const rejectMutation = useMutation({
    mutationFn: (comment?: string) => rejectQuotation(quotationId, comment),
    onSuccess: async () => {
      void haptics.confirmLight();
      await invalidate();
      showToast({ variant: 'success', message: t('mobile.dealerQuotations.rejected') });
    },
    onError: fail,
  });
  const revisionMutation = useMutation({
    mutationFn: (comment?: string) => requestQuotationRevision(quotationId, comment),
    onSuccess: async () => {
      void haptics.confirmLight();
      await invalidate();
      showToast({ variant: 'success', message: t('mobile.dealerQuotations.awaitingRevision') });
    },
    onError: fail,
  });

  const busy =
    acceptMutation.isPending || rejectMutation.isPending || revisionMutation.isPending;

  const openPdf = async () => {
    const opts = await pickPdfOptions();
    if (!opts) return;
    setPdfBusy(true);
    try {
      await openQuotationPdf(quotationId, opts);
    } catch {
      showToast({ variant: 'error', message: t('mobile.adminQuotation.pdfFailed') });
    } finally {
      setPdfBusy(false);
    }
  };

  const totals = useMemo(() => {
    if (!detail) return null;
    return {
      subtotal: Number(detail.subtotal ?? 0),
      discount: Number(detail.discountTotal ?? 0),
      tax: taxValue,
      total: Number(detail.total ?? 0),
    };
  }, [detail, taxValue]);

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
          title={t('mobile.adminQuotation.errorTitle')}
          description={t('mobile.adminQuotation.errorBody')}
          retryLabel={t('mobile.adminQuotation.retry')}
          onRetry={() => void query.refetch()}
        />
      </AppScreen>
    );
  }

  return (
    <AppScreen edges={{ top: true, bottom: false }}>
      <View style={{ paddingHorizontal: theme.spacing.lg, flex: 1 }}>
        <View style={{ minHeight: theme.sizes.touch.min, justifyContent: 'center' }}>
          <View style={{ position: 'absolute', top: 0, bottom: 0, zIndex: 1, justifyContent: 'center' }}>
            <ScreenBackLead fallback={backFallback} />
          </View>
          <AppText variant="largeTitle" weight={titleWeight} style={{ textAlign: 'center' }} numberOfLines={1}>
            {detail?.number ?? t('mobile.dealerQuotations.title')}
          </AppText>
        </View>

        <ScrollView
          contentContainerStyle={{
            paddingBottom: theme.spacing['3xl'] + SURFACE_TAB_BAR_CLEARANCE,
            gap: theme.spacing.md,
            paddingTop: theme.spacing.md,
          }}
          refreshControl={
            <RefreshControl
              refreshing={query.isRefetching}
              onRefresh={() => void query.refetch()}
              tintColor={colors.brand}
            />
          }
        >
          {detail ? (
            <>
              <ListItemEnter index={0}>
                <DealerBoard
                  title={t('mobile.adminQuotation.detail')}
                  titleWeight={titleWeight}
                  trailing={<StatusBadge status={detail.status} label={statusLabel} dot />}
                >
                  <View style={{ gap: theme.spacing.md }}>
                    {detail.expirationDate ? (
                      <AppText variant="caption" color="muted">
                        {t('quotations.validUntil')}: {String(detail.expirationDate).slice(0, 10)}
                      </AppText>
                    ) : null}
                    {detail.paymentTerms ? (
                      <View style={{ gap: 2 }}>
                        <AppText variant="caption" color="muted">
                          {t('mobile.adminQuotation.paymentTerms')}
                        </AppText>
                        <AppText variant="body">{detail.paymentTerms}</AppText>
                      </View>
                    ) : null}
                    {detail.deliveryTerms ? (
                      <View style={{ gap: 2 }}>
                        <AppText variant="caption" color="muted">
                          {t('mobile.adminQuotation.deliveryTerms')}
                        </AppText>
                        <AppText variant="body">{detail.deliveryTerms}</AppText>
                      </View>
                    ) : null}
                    {detail.customerNotes ? (
                      <View style={{ gap: 2 }}>
                        <AppText variant="caption" color="muted">
                          {t('quotations.notes')}
                        </AppText>
                        <AppText variant="body">{detail.customerNotes}</AppText>
                      </View>
                    ) : null}
                    {totals ? (
                      <View style={{ gap: theme.spacing.xs, paddingTop: theme.spacing.sm }}>
                        <MoneyRow
                          isRTL={isRTL}
                          label={t('mobile.adminQuotation.subtotal')}
                          value={formatCurrency(totals.subtotal)}
                        />
                        {totals.discount > 0 ? (
                          <MoneyRow
                            isRTL={isRTL}
                            label={t('quotations.discount')}
                            value={formatCurrency(totals.discount)}
                          />
                        ) : null}
                        {totals.tax > 0 ? (
                          <MoneyRow
                            isRTL={isRTL}
                            label={t('mobile.adminQuotation.tax')}
                            value={formatCurrency(totals.tax)}
                          />
                        ) : null}
                        <MoneyRow
                          isRTL={isRTL}
                          label={t('mobile.adminQuotation.total')}
                          value={formatCurrency(totals.total)}
                          strong
                        />
                      </View>
                    ) : null}
                    <SecondaryButton
                      label={t('mobile.adminQuotation.pdf')}
                      disabled={pdfBusy}
                      onPress={() => void openPdf()}
                      style={{ alignSelf: 'stretch', width: '100%' }}
                    />
                    {so ? (
                      <PrimaryButton
                        label={`${t('mobile.adminQuotation.openSalesOrder')} · ${so.number}`}
                        onPress={() => {
                          void haptics.selection();
                          router.push(`/(app)/(customer)/orders/${so.id}` as Href);
                        }}
                        style={{ alignSelf: 'stretch', width: '100%' }}
                      />
                    ) : null}
                    {(detail.version ?? 1) > 1 ? (
                      <AppText variant="caption" color="secondary">
                        {t('mobile.dealerQuotations.revisedBanner')}
                      </AppText>
                    ) : null}
                    {detail.commerciallyExpired ? (
                      <AppText variant="caption" color="secondary">
                        {t('mobile.dealerQuotations.expired')}
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

              <ListItemEnter index={1}>
                <DealerBoard title={t('mobile.adminQuotation.lines')} titleWeight={titleWeight}>
                  <View style={{ gap: theme.spacing.md }}>
                    {(detail.lines ?? []).map((line, i) => {
                      const complexity = quotationComplexity(line.manufacturingComplexity);
                      const net = quotationLineNet(line.unitPrice, line.quantity);
                      const photo = line.product?.imageUrl;
                      const sku = line.product?.sku;
                      return (
                      <View
                        key={line.id}
                        style={{
                          gap: theme.spacing.xs,
                          paddingTop: i === 0 ? 0 : theme.spacing.sm,
                          borderTopWidth: i === 0 ? 0 : 1,
                          borderTopColor: colors.border,
                        }}
                      >
                        <View
                          style={{
                            flexDirection: isRTL ? 'row-reverse' : 'row',
                            gap: theme.spacing.sm,
                          }}
                        >
                          {photo ? (
                            <Image
                              source={{ uri: photo }}
                              style={{ width: 56, height: 56, borderRadius: theme.radius.md }}
                            />
                          ) : null}
                          <View style={{ flex: 1, gap: 4 }}>
                        <AppText variant="body" weight={titleWeight}>
                          {line.description}
                        </AppText>
                        <StatusBadge
                          status={complexity}
                          label={t(`mobile.adminQuotation.complexity.${complexity}`)}
                        />
                        {sku ? (
                          <AppText variant="caption" color="muted" dir="ltr">
                            {t('mobile.adminQuotation.sku')} {sku}
                          </AppText>
                        ) : null}
                        {lineSpecs(line) ? (
                          <AppText variant="caption" color="muted">
                            {lineSpecs(line)}
                          </AppText>
                        ) : null}
                        {lineDims(line) ? (
                          <AppText variant="caption" color="muted" dir="ltr">
                            {lineDims(line)}
                          </AppText>
                        ) : null}
                          </View>
                        </View>
                        <View
                          style={{
                            flexDirection: isRTL ? 'row-reverse' : 'row',
                            justifyContent: 'space-between',
                          }}
                        >
                          <AppText variant="caption" color="muted" dir="ltr">
                            {t('mobile.adminQuotation.qty')} {String(line.quantity)} ·{' '}
                            {`${formatNumber(locale, Number(line.unitPrice), { maximumFractionDigits: 2 })} ₪`}
                          </AppText>
                          <AppText variant="body" weight="medium" dir="ltr">
                            {net == null
                              ? '—'
                              : `${formatNumber(locale, net, { maximumFractionDigits: 2 })} ₪`}
                          </AppText>
                        </View>
                      </View>
                      );
                    })}
                  </View>
                </DealerBoard>
              </ListItemEnter>

              {detail.status === 'ACCEPTED' ? (
                <AppText variant="body" color="secondary">
                  {t('mobile.dealerQuotations.accepted')}
                </AppText>
              ) : null}
              {detail.status === 'REJECTED' ? (
                <AppText variant="body" color="secondary">
                  {t('mobile.dealerQuotations.rejected')}
                </AppText>
              ) : null}
              {detail.status === 'REVISION_REQUESTED' ? (
                <AppText variant="body" color="secondary">
                  {t('mobile.dealerQuotations.awaitingRevision')}
                </AppText>
              ) : null}

              {canDecide ? (
                <View style={{ gap: theme.spacing.sm, paddingTop: theme.spacing.sm }}>
                  {canAccept ? (
                    <PrimaryButton
                      label={t('mobile.dealerQuotations.acceptCta')}
                      disabled={busy}
                      onPress={() => setConfirm('accept')}
                      style={{ alignSelf: 'stretch', width: '100%' }}
                    />
                  ) : null}
                  {canReject ? (
                    <DestructiveButton
                      label={t('mobile.dealerQuotations.rejectCta')}
                      disabled={busy}
                      onPress={() => setConfirm('reject')}
                      style={{ alignSelf: 'stretch', width: '100%' }}
                    />
                  ) : null}
                  {canAccept ? (
                    <SecondaryButton
                      label={t('mobile.dealerQuotations.revisionCta')}
                      disabled={busy}
                      onPress={() => setConfirm('revision')}
                      style={{ alignSelf: 'stretch', width: '100%' }}
                    />
                  ) : null}
                </View>
              ) : null}
            </>
          ) : null}
        </ScrollView>
      </View>

      <ConfirmationSheet
        open={confirm === 'accept'}
        onClose={() => setConfirm(null)}
        title={t('mobile.dealerQuotations.acceptTitle')}
        message={t('mobile.dealerQuotations.acceptBody', {
          number: detail?.number ?? '',
          total: formatCurrency(Number(detail?.total ?? 0)),
        })}
        confirmLabel={t('mobile.dealerQuotations.acceptCta')}
        cancelLabel={t('mobile.adminQuotation.cancel')}
        onConfirm={() => {
          setConfirm(null);
          acceptMutation.mutate();
        }}
      />
      <ConfirmationSheet
        open={confirm === 'reject'}
        onClose={() => setConfirm(null)}
        title={t('mobile.dealerQuotations.rejectTitle')}
        message={t('mobile.dealerQuotations.rejectBody')}
        confirmLabel={t('mobile.dealerQuotations.rejectCta')}
        cancelLabel={t('mobile.adminQuotation.cancel')}
        destructive
        reasonLabel={t('mobile.dealerQuotations.rejectReasonOptional')}
        onConfirm={(reason) => {
          setConfirm(null);
          rejectMutation.mutate(reason);
        }}
      />
      <ConfirmationSheet
        open={confirm === 'revision'}
        onClose={() => setConfirm(null)}
        title={t('mobile.dealerQuotations.revisionTitle')}
        message={t('mobile.dealerQuotations.revisionBody')}
        confirmLabel={t('mobile.dealerQuotations.revisionCta')}
        cancelLabel={t('mobile.adminQuotation.cancel')}
        reasonLabel={t('quotations.revisionComment')}
        onConfirm={(reason) => {
          setConfirm(null);
          revisionMutation.mutate(reason);
        }}
      />
      {pdfDownloadSheet}
    </AppScreen>
  );
}

function MoneyRow({
  label,
  value,
  isRTL,
  strong,
}: {
  label: string;
  value: string;
  isRTL: boolean;
  strong?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <AppText variant={strong ? 'body' : 'caption'} color={strong ? 'primary' : 'muted'} weight={strong ? 'semibold' : 'regular'}>
        {label}
      </AppText>
      <AppText variant={strong ? 'body' : 'caption'} weight="medium" dir="ltr">
        {value}
      </AppText>
    </View>
  );
}
