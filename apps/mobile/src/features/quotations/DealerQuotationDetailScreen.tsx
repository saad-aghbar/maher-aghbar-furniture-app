import { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter, type Href } from 'expo-router';
import { can } from '@maher/permissions';
import { presentQuotationStatus } from '@maher/i18n';
import type { Locale } from '@maher/types';
import { isApiError } from '@/api/errors';
import {
  acceptQuotation,
  getQuotation,
  openQuotationPdf,
  rejectQuotation,
  requestQuotationRevision,
} from '@/api/modules/quotations';
import { queryKeys } from '@/api/queryKeys';
import { invalidateFactoryJourney } from '@/api/invalidateFactoryJourney';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { DestructiveButton, PrimaryButton, SecondaryButton } from '@/components/buttons/PrimaryButton';
import { DealerEmptyState } from '@/features/dealer-ui';
import { ErrorState } from '@/components/feedback/ErrorState';
import { useToast } from '@/components/feedback/Toast';
import { AppScreen } from '@/components/layout/AppScreen';
import { ScreenBackLead } from '@/components/layout/ScreenBackLead';
import { usePdfDownload } from '@/features/pdf/usePdfDownload';
import { DealerBoard } from '@/features/dealers/components/DealerBoard';
import { useLocale } from '@/i18n';
import { formatNumber } from '@/i18n/format';
import { haptics, ListItemEnter } from '@/motion';
import { SURFACE_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import { useTheme } from '@/theme';
import { QuotationDecisionSheet, type QuotationDecisionKind } from './components/QuotationDecisionSheet';
import { QuotationLineBoard } from './components/QuotationLineBoard';
import { QuotationValidityStub } from './components/QuotationValidityStub';
import { dealerCanDecideQuotation, dealerQuoteRailTone } from './dealerQuotationUi';

type Props = {
  quotationId: string;
  backFallback: Href;
  embedded?: boolean;
};

function money(locale: Locale, value: number): string {
  return `${formatNumber(locale, value, { maximumFractionDigits: 2 })} ₪`;
}

function DetailTitle({
  title,
  titleWeight,
  backFallback,
  embedded = false,
}: {
  title: string;
  titleWeight: 'medium' | 'semibold';
  backFallback: Href;
  embedded?: boolean;
}) {
  const { isRTL } = useLocale();
  const { theme } = useTheme();
  const leadSize = theme.sizes.touch.min;

  return (
    <View style={{ minHeight: leadSize, justifyContent: 'center' }}>
      {embedded ? null : (
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
      )}
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

export function DealerQuotationDetailScreen({ quotationId, backFallback, embedded = false }: Props) {
  const { user } = useAuth();
  const { t, locale, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const { showToast } = useToast();
  const { pickPdfOptions, pdfDownloadSheet } = usePdfDownload();
  const [confirm, setConfirm] = useState<QuotationDecisionKind | null>(null);
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
  const tone = detail
    ? dealerQuoteRailTone(detail.status, detail.commerciallyExpired)
    : 'brand';
  const accent =
    tone === 'warning'
      ? colors.warning
      : tone === 'success'
        ? colors.success
        : tone === 'error'
          ? colors.error
          : colors.brand;

  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey: queryKeys.quotations.all });
    await invalidateFactoryJourney(qc);
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

  const totalLabel = money(locale, Number(detail?.total ?? 0));
  const pill = {
    borderRadius: theme.radius.full,
    minHeight: theme.sizes.touch.min,
    paddingVertical: 0,
    alignSelf: 'stretch' as const,
    width: '100%' as const,
  };

  if (!allowed) {
    return (
      <AppScreen>
        <DetailTitle
          title={t('mobile.dealerQuotations.title')}
          titleWeight={titleWeight}
          backFallback={backFallback}
          embedded={embedded}
        />
        <DealerEmptyState
          title={t('mobile.noModules')}
          body={t('mobile.noModulesHint')}
        />
      </AppScreen>
    );
  }

  if (query.isError && !detail) {
    return (
      <AppScreen>
        <DetailTitle
          title={t('mobile.dealerQuotations.title')}
          titleWeight={titleWeight}
          backFallback={backFallback}
          embedded={embedded}
        />
        <ErrorState
          title={t('mobile.adminQuotation.errorTitle')}
          description={t('mobile.adminQuotation.errorBody')}
          retryLabel={t('mobile.adminQuotation.retry')}
          onRetry={() => void query.refetch()}
        />
      </AppScreen>
    );
  }

  const lines = detail?.lines ?? [];

  return (
    <AppScreen edges={{ top: true, bottom: false }}>
      <DetailTitle
        title={detail?.number ?? t('mobile.dealerQuotations.title')}
        titleWeight={titleWeight}
        backFallback={backFallback}
        embedded={embedded}
      />

      <ScrollView
        contentContainerStyle={{
          paddingBottom: theme.spacing['3xl'] + SURFACE_TAB_BAR_CLEARANCE,
          gap: theme.spacing.md,
          paddingTop: theme.spacing.sm,
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
                accentColor={accent}
                trailing={<StatusBadge status={detail.status} label={statusLabel} dot />}
              >
                <View
                  style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    alignItems: 'stretch',
                    gap: theme.spacing.md,
                  }}
                >
                  <View style={{ flex: 1, minWidth: 0, gap: 6, justifyContent: 'center' }}>
                    <AppText
                      variant="caption"
                      color="muted"
                      style={{
                        textTransform: locale === 'ar' ? 'none' : 'uppercase',
                        letterSpacing: locale === 'ar' ? 0 : 0.55,
                        fontSize: 10,
                        textAlign: isRTL ? 'right' : 'left',
                      }}
                    >
                      {t('mobile.dealerQuotations.folioEyebrow')}
                    </AppText>
                    <AppText
                      weight={titleWeight}
                      dir="ltr"
                      numberOfLines={1}
                      style={{
                        fontSize: 22,
                        lineHeight: locale === 'ar' ? 32 : 28,
                        textAlign: isRTL ? 'right' : 'left',
                      }}
                    >
                      {detail.number}
                    </AppText>
                    {(detail.version ?? 1) > 1 ? (
                      <AppText
                        variant="caption"
                        style={{ color: colors.warning, textAlign: isRTL ? 'right' : 'left' }}
                      >
                        {t('mobile.dealerQuotations.revisedBanner')}
                      </AppText>
                    ) : null}
                  </View>
                  <QuotationValidityStub
                    expirationDate={detail.expirationDate}
                    commerciallyExpired={detail.commerciallyExpired}
                  />
                </View>

                {totals ? (
                  <View
                    style={{
                      borderRadius: theme.radius.lg,
                      backgroundColor: colors.surfaceSecondary,
                      borderWidth: 1,
                      borderColor: colors.border,
                      overflow: 'hidden',
                    }}
                  >
                    <View
                      style={{
                        paddingHorizontal: theme.spacing.md,
                        paddingVertical: theme.spacing.md,
                        gap: 4,
                      }}
                    >
                      <AppText
                        variant="caption"
                        color="muted"
                        style={{
                          textTransform: locale === 'ar' ? 'none' : 'uppercase',
                          letterSpacing: locale === 'ar' ? 0 : 0.55,
                          fontSize: 10,
                          textAlign: isRTL ? 'right' : 'left',
                        }}
                      >
                        {t('mobile.dealerQuotations.offer')}
                      </AppText>
                      <AppText
                        weight={titleWeight}
                        dir="ltr"
                        style={{
                          fontSize: 24,
                          lineHeight: locale === 'ar' ? 36 : 30,
                          textAlign: isRTL ? 'right' : 'left',
                          fontVariant: ['tabular-nums'],
                        }}
                      >
                        {money(locale, totals.total)}
                      </AppText>
                    </View>
                    <MoneyRow
                      isRTL={isRTL}
                      locale={locale}
                      label={t('mobile.adminQuotation.subtotal')}
                      value={money(locale, totals.subtotal)}
                    />
                    {totals.discount > 0 ? (
                      <MoneyRow
                        isRTL={isRTL}
                        locale={locale}
                        label={t('quotations.discount')}
                        value={money(locale, totals.discount)}
                      />
                    ) : null}
                    {totals.tax > 0 ? (
                      <MoneyRow
                        isRTL={isRTL}
                        locale={locale}
                        label={t('mobile.adminQuotation.tax')}
                        value={money(locale, totals.tax)}
                      />
                    ) : null}
                  </View>
                ) : null}

                {detail.paymentTerms || detail.deliveryTerms || detail.customerNotes ? (
                  <View
                    style={{
                      borderRadius: theme.radius.lg,
                      backgroundColor: colors.surfaceSecondary,
                      borderWidth: 1,
                      borderColor: colors.border,
                      padding: theme.spacing.md,
                      gap: theme.spacing.sm,
                    }}
                  >
                    {detail.paymentTerms ? (
                      <TermBlock
                        label={t('mobile.adminQuotation.paymentTerms')}
                        value={detail.paymentTerms}
                        isRTL={isRTL}
                      />
                    ) : null}
                    {detail.deliveryTerms ? (
                      <TermBlock
                        label={t('mobile.adminQuotation.deliveryTerms')}
                        value={detail.deliveryTerms}
                        isRTL={isRTL}
                      />
                    ) : null}
                    {detail.customerNotes ? (
                      <TermBlock
                        label={t('quotations.notes')}
                        value={detail.customerNotes}
                        isRTL={isRTL}
                      />
                    ) : null}
                  </View>
                ) : null}

                {detail.rejectionReason ? (
                  <AppText
                    variant="caption"
                    style={{ color: colors.error, textAlign: isRTL ? 'right' : 'left' }}
                  >
                    {t('mobile.adminQuotation.rejectionReason')}: {detail.rejectionReason}
                  </AppText>
                ) : null}

                <SecondaryButton
                  label={t('mobile.adminQuotation.pdf')}
                  disabled={pdfBusy}
                  onPress={() => void openPdf()}
                  style={pill}
                />
                {so ? (
                  <PrimaryButton
                    label={`${t('mobile.adminQuotation.openSalesOrder')} · ${so.number}`}
                    onPress={() => {
                      void haptics.selection();
                      router.push(`/(app)/(customer)/orders/${so.id}` as Href);
                    }}
                    style={pill}
                  />
                ) : null}
              </DealerBoard>
            </ListItemEnter>

            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                gap: theme.spacing.sm,
              }}
            >
              <AppText variant="label" weight={titleWeight}>
                {t('mobile.adminQuotation.lines')}
              </AppText>
              <AppText variant="caption" color="muted">
                {String(lines.length)}
              </AppText>
            </View>

            {lines.length === 0 ? (
              <DealerEmptyState title={t('mobile.adminQuotation.noLines')} />
            ) : (
              lines.map((line, i) => (
                <ListItemEnter key={line.id} index={i + 1}>
                  <QuotationLineBoard line={line} />
                </ListItemEnter>
              ))
            )}

            {detail.status === 'ACCEPTED' ? (
              <ListItemEnter index={lines.length + 2}>
                <DealerBoard
                  title={t('mobile.dealerQuotations.accepted')}
                  titleWeight={titleWeight}
                  accentColor={colors.success}
                >
                  <AppText
                    variant="body"
                    color="secondary"
                    style={{ textAlign: isRTL ? 'right' : 'left' }}
                  >
                    {t('mobile.dealerQuotations.accepted')}
                  </AppText>
                </DealerBoard>
              </ListItemEnter>
            ) : null}
            {detail.status === 'REJECTED' ? (
              <ListItemEnter index={lines.length + 2}>
                <DealerBoard
                  title={t('mobile.dealerQuotations.rejected')}
                  titleWeight={titleWeight}
                  accentColor={colors.error}
                >
                  <AppText
                    variant="body"
                    color="secondary"
                    style={{ textAlign: isRTL ? 'right' : 'left' }}
                  >
                    {t('mobile.dealerQuotations.rejected')}
                  </AppText>
                </DealerBoard>
              </ListItemEnter>
            ) : null}
            {detail.status === 'REVISION_REQUESTED' ? (
              <ListItemEnter index={lines.length + 2}>
                <DealerBoard
                  title={t('mobile.dealerQuotations.awaitingRevision')}
                  titleWeight={titleWeight}
                  accentColor={colors.warning}
                >
                  <AppText
                    variant="body"
                    color="secondary"
                    style={{ textAlign: isRTL ? 'right' : 'left' }}
                  >
                    {t('mobile.dealerQuotations.awaitingRevision')}
                  </AppText>
                </DealerBoard>
              </ListItemEnter>
            ) : null}

            {canDecide ? (
              <ListItemEnter index={lines.length + 3}>
                <DealerBoard
                  title={t('mobile.dealerQuotations.needsReply')}
                  titleWeight={titleWeight}
                  accentColor={colors.warning}
                >
                  {canAccept ? (
                    <PrimaryButton
                      label={t('mobile.dealerQuotations.acceptCta')}
                      disabled={busy}
                      onPress={() => setConfirm('accept')}
                      style={pill}
                    />
                  ) : null}
                  {canReject ? (
                    <DestructiveButton
                      label={t('mobile.dealerQuotations.rejectCta')}
                      disabled={busy}
                      onPress={() => setConfirm('reject')}
                      style={pill}
                    />
                  ) : null}
                  {canAccept ? (
                    <SecondaryButton
                      label={t('mobile.dealerQuotations.revisionCta')}
                      disabled={busy}
                      onPress={() => setConfirm('revision')}
                      style={pill}
                    />
                  ) : null}
                </DealerBoard>
              </ListItemEnter>
            ) : null}
          </>
        ) : null}
      </ScrollView>

      <QuotationDecisionSheet
        open={confirm != null}
        kind={confirm}
        onClose={() => setConfirm(null)}
        number={detail?.number ?? ''}
        totalLabel={totalLabel}
        expirationDate={detail?.expirationDate}
        commerciallyExpired={detail?.commerciallyExpired}
        busy={busy}
        onConfirm={(reason) => {
          const kind = confirm;
          setConfirm(null);
          if (kind === 'accept') acceptMutation.mutate();
          else if (kind === 'reject') rejectMutation.mutate(reason);
          else if (kind === 'revision') revisionMutation.mutate(reason);
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
  locale,
}: {
  label: string;
  value: string;
  isRTL: boolean;
  locale: Locale;
}) {
  const { colors, theme } = useTheme();
  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.spacing.md,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm + 2,
        borderTopWidth: 1,
        borderTopColor: colors.border,
      }}
    >
      <AppText
        variant="caption"
        color="muted"
        style={{
          textTransform: locale === 'ar' ? 'none' : 'uppercase',
          letterSpacing: locale === 'ar' ? 0 : 0.45,
          fontSize: 10,
          textAlign: isRTL ? 'right' : 'left',
        }}
      >
        {label}
      </AppText>
      <AppText
        variant="caption"
        weight="semibold"
        dir="ltr"
        style={{ fontVariant: ['tabular-nums'] }}
      >
        {value}
      </AppText>
    </View>
  );
}

function TermBlock({
  label,
  value,
  isRTL,
}: {
  label: string;
  value: string;
  isRTL: boolean;
}) {
  return (
    <View style={{ gap: 2 }}>
      <AppText
        variant="caption"
        color="muted"
        style={{ textAlign: isRTL ? 'right' : 'left' }}
      >
        {label}
      </AppText>
      <AppText variant="body" style={{ textAlign: isRTL ? 'right' : 'left' }}>
        {value}
      </AppText>
    </View>
  );
}
