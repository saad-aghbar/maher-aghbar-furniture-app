import { useEffect, useMemo, useState } from 'react';
import {
  Image,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { can } from '@maher/permissions';
import { getApiBaseUrl } from '@/api/config';
import { listCustomers } from '@/api/modules/customers';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { DestructiveButton } from '@/components/buttons/DestructiveButton';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { useToast } from '@/components/feedback/Toast';
import { TextField } from '@/components/forms/TextField';
import { AppScreen } from '@/components/layout/AppScreen';
import { useNetwork } from '@/components/network/NetworkProvider';
import { ConfirmationSheet } from '@/components/sheets/ConfirmationSheet';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { SurfaceCard } from '@/components/surfaces/SurfaceCard';
import { useLocale } from '@/i18n';
import { SuccessBurst, haptics } from '@/motion';
import { useTheme } from '@/theme';
import { SURFACE_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import { AiProcessingAnimation } from './components/AiProcessingAnimation';
import {
  useAiJobQuery,
  useApproveAiJobMutation,
  useCorrectAiJobMutation,
  useManualAiJobMutation,
  useRejectAiJobMutation,
} from './query';
import {
  confidenceLabel,
  isProcessingPhase,
  selectAiJobReview,
} from './selectAiReview';

type AiReviewScreenProps = {
  jobId: string;
};

function absoluteUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const base = getApiBaseUrl();
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

export function AiReviewScreen({ jobId }: AiReviewScreenProps) {
  const { user } = useAuth();
  const { t, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const { showOfflineBanner } = useNetwork();
  const { showToast } = useToast();
  const router = useRouter();

  const allowed = can(user, 'ai-intake.read');
  const canManage = can(user, 'ai-intake.manage');

  const query = useAiJobQuery(jobId, allowed);
  const approveMutation = useApproveAiJobMutation(jobId);
  const rejectMutation = useRejectAiJobMutation(jobId);
  const correctMutation = useCorrectAiJobMutation(jobId);
  const manualMutation = useManualAiJobMutation(jobId);

  const review = selectAiJobReview(query.data);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [customerId, setCustomerId] = useState('');
  const [customerSheetOpen, setCustomerSheetOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [approvedBurst, setApprovedBurst] = useState(false);

  const customersQuery = useQuery({
    queryKey: ['customers-ai-pick'],
    queryFn: () => listCustomers({ page: 1, pageSize: 100 }),
    enabled: canManage && Boolean(review && !isProcessingPhase(review.phase)),
  });

  useEffect(() => {
    const fields = query.data?.review?.fields ?? [];
    if (!fields.length) return;
    const next: Record<string, string> = {};
    for (const f of fields) next[f.fieldName] = f.value;
    setOverrides(next);
  }, [jobId, query.data?.review]);

  function fieldLabel(fieldName: string): string {
    const key = `mobile.aiIntake.fields.${fieldName}`;
    const translated = t(key);
    return translated === key ? fieldName : translated;
  }
  const customers = customersQuery.data?.data ?? [];
  const selectedCustomer = customers.find((c) => c.id === customerId);
  const originalUrl = absoluteUrl(review?.originalDownloadPath);
  const isImage = Boolean(
    query.data?.storageKey?.match(/\.(png|jpe?g|webp|gif)$/i) ||
      originalUrl?.match(/\.(png|jpe?g|webp|gif)(\?|$)/i),
  );

  const busy =
    approveMutation.isPending ||
    rejectMutation.isPending ||
    correctMutation.isPending ||
    manualMutation.isPending;

  const confKey = confidenceLabel(review?.confidence ?? null);

  async function onSaveCorrections() {
    try {
      await correctMutation.mutateAsync(overrides);
      void haptics.confirmLight();
      showToast({ variant: 'success', message: t('mobile.aiIntake.saved') });
    } catch {
      void haptics.error();
      showToast({ variant: 'error', message: t('mobile.aiIntake.actionFailed') });
    }
  }

  async function onApprove() {
    if (!customerId) {
      showToast({ variant: 'error', message: t('mobile.aiIntake.selectDealer') });
      return;
    }
    try {
      const result = await approveMutation.mutateAsync({
        customerId,
        fieldOverrides: overrides,
      });
      // Contract: draft only
      if (result.created.invoice || result.created.inventoryMovement) {
        showToast({ variant: 'error', message: t('mobile.aiIntake.actionFailed') });
        return;
      }
      void haptics.completeStrong();
      setApprovedBurst(true);
      showToast({
        variant: 'success',
        message: t('mobile.aiIntake.approvedDraft', {
          number: result.request.number,
        }),
      });
    } catch {
      void haptics.error();
      showToast({ variant: 'error', message: t('mobile.aiIntake.actionFailed') });
    }
  }

  async function onReject() {
    try {
      await rejectMutation.mutateAsync(undefined);
      void haptics.confirmMedium();
      setRejectOpen(false);
      showToast({ variant: 'success', message: t('mobile.aiIntake.rejected') });
      router.back();
    } catch {
      void haptics.error();
      showToast({ variant: 'error', message: t('mobile.aiIntake.actionFailed') });
    }
  }

  async function onManual() {
    try {
      await manualMutation.mutateAsync(t('mobile.aiIntake.manualDefaultNote'));
      void haptics.confirmMedium();
      setManualOpen(false);
      showToast({ variant: 'success', message: t('mobile.aiIntake.manualRequested') });
      router.back();
    } catch {
      void haptics.error();
      showToast({ variant: 'error', message: t('mobile.aiIntake.actionFailed') });
    }
  }

  const summaryRows = useMemo(() => {
    if (!review) return [];
    return [
      { label: t('mobile.aiIntake.fields.orderNumber'), value: review.orderNumber },
      { label: t('mobile.aiIntake.fields.model'), value: review.extractedModel },
      { label: t('mobile.aiIntake.fields.dealer'), value: review.dealer },
      { label: t('mobile.aiIntake.fields.customer'), value: review.customer },
      { label: t('mobile.aiIntake.fields.fabric'), value: review.fabric },
    ];
  }, [review, t]);

  if (!allowed) {
    return (
      <AppScreen backFallback={'/(app)/(admin)/ai-intake' as Href}>
        <EmptyState title={t('mobile.noModules')} description={t('mobile.noModulesHint')} />
      </AppScreen>
    );
  }

  if (query.isLoading && !query.data) {
    return (
      <AppScreen backFallback={'/(app)/(admin)/ai-intake' as Href}>
        <AiProcessingAnimation phase="extracting" />
      </AppScreen>
    );
  }

  if (query.isError && !query.data) {
    return (
      <AppScreen backFallback={'/(app)/(admin)/ai-intake' as Href}>
        {showOfflineBanner ? <OfflineBanner /> : null}
        <ErrorState
          title={t('mobile.aiIntake.errorTitle')}
          description={t('mobile.aiIntake.errorBody')}
          retryLabel={t('mobile.aiIntake.retry')}
          onRetry={() => void query.refetch()}
        />
      </AppScreen>
    );
  }

  if (!review) {
    return (
      <AppScreen backFallback={'/(app)/(admin)/ai-intake' as Href}>
        <EmptyState title={t('mobile.aiIntake.emptyTitle')} />
      </AppScreen>
    );
  }

  if (isProcessingPhase(review.phase)) {
    return (
      <AppScreen backFallback={'/(app)/(admin)/ai-intake' as Href}>
        {showOfflineBanner ? <OfflineBanner /> : null}
        <AiProcessingAnimation phase={review.phase} />
        <AppText variant="caption" color="muted" align="center">
          {t('mobile.aiIntake.leaveHint')}
        </AppText>
        <SecondaryButton
          label={t('mobile.aiIntake.backToList')}
          onPress={() => router.replace('/(app)/(admin)/ai-intake' as Href)}
          style={{ marginTop: theme.spacing.lg }}
        />
      </AppScreen>
    );
  }

  return (
    <AppScreen edges={{ top: true, bottom: true }}>
      {showOfflineBanner ? <OfflineBanner /> : null}
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching}
            onRefresh={() => void query.refetch()}
            tintColor={colors.brand}
          />
        }
        contentContainerStyle={{ gap: theme.spacing.lg, paddingBottom: theme.spacing['3xl'] + SURFACE_TAB_BAR_CLEARANCE }}
      >
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: theme.spacing.sm,
          }}
        >
          <AppText variant="title" weight="semibold" style={{ flex: 1 }}>
            {t('mobile.aiIntake.reviewTitle')}
          </AppText>
          <StatusBadge
            status={query.data?.status ?? 'NEEDS_REVIEW'}
            label={t(`mobile.aiIntake.phases.${review.phase}`)}
          />
        </View>

        {approvedBurst ? (
          <SuccessBurst triggerKey="ai-approved">
            <SurfaceCard style={{ alignItems: 'center', gap: theme.spacing.sm }}>
              <AppText variant="heading" weight="semibold" style={{ color: colors.success }}>
                {t('mobile.aiIntake.approvedTitle')}
              </AppText>
              <AppText variant="bodySecondary" color="secondary" align="center">
                {t('mobile.aiIntake.approvedBody')}
              </AppText>
            </SurfaceCard>
          </SuccessBurst>
        ) : null}

        <SurfaceCard style={{ gap: theme.spacing.sm }}>
          <AppText variant="label" weight="semibold">
            {t('mobile.aiIntake.original')}
          </AppText>
          {isImage && originalUrl ? (
            <Image
              source={{ uri: originalUrl }}
              style={{ width: '100%', height: 220, borderRadius: theme.radius.md }}
              accessibilityIgnoresInvertColors
            />
          ) : originalUrl ? (
            <SecondaryButton
              label={t('mobile.aiIntake.openOriginal')}
              onPress={() => void Linking.openURL(originalUrl)}
            />
          ) : (
            <AppText color="muted">{t('mobile.aiIntake.noOriginal')}</AppText>
          )}
        </SurfaceCard>

        <SurfaceCard style={{ gap: theme.spacing.sm }}>
          {summaryRows.map((row) => (
            <View
              key={row.label}
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                justifyContent: 'space-between',
                gap: theme.spacing.md,
              }}
            >
              <AppText variant="caption" color="muted">
                {row.label}
              </AppText>
              <AppText variant="label" weight="medium" style={{ flex: 1 }} align="end">
                {row.value || '—'}
              </AppText>
            </View>
          ))}
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              justifyContent: 'space-between',
            }}
          >
            <AppText variant="caption" color="muted">
              {t('mobile.aiIntake.confidence')}
            </AppText>
            <AppText variant="label" weight="medium">
              {confKey ? t(`mobile.aiIntake.confidenceLevel.${confKey}`) : '—'}
            </AppText>
          </View>
          {review.missingFields.length > 0 ? (
            <AppText variant="caption" style={{ color: colors.warning }}>
              {t('mobile.aiIntake.missingFields', {
                fields: review.missingFields.join(', '),
              })}
            </AppText>
          ) : null}
          {review.notes ? (
            <View style={{ gap: theme.spacing.xs }}>
              <AppText variant="caption" color="muted">
                {t('mobile.aiIntake.fields.notes')}
              </AppText>
              <AppText variant="bodySecondary">{review.notes}</AppText>
            </View>
          ) : null}
        </SurfaceCard>

        {canManage && review.canCorrect ? (
          <View style={{ gap: theme.spacing.md }}>
            <AppText variant="label" weight="semibold">
              {t('mobile.aiIntake.correctFields')}
            </AppText>
            {review.fields
              .filter((f) => f.correctable)
              .map((field) => (
                <TextField
                  key={field.fieldName}
                  label={fieldLabel(field.fieldName)}
                  value={overrides[field.fieldName] ?? ''}
                  onChangeText={(text) =>
                    setOverrides((prev) => ({ ...prev, [field.fieldName]: text }))
                  }
                />
              ))}
            <SecondaryButton
              label={t('mobile.aiIntake.saveCorrections')}
              onPress={() => void onSaveCorrections()}
              loading={correctMutation.isPending}
              disabled={busy}
            />
          </View>
        ) : null}

        {canManage && (review.canApprove || review.canReject || review.canRequestManual) ? (
          <View style={{ gap: theme.spacing.sm }}>
            <SecondaryButton
              label={
                selectedCustomer
                  ? t('mobile.aiIntake.dealerSelected', {
                      name: selectedCustomer.name,
                    })
                  : t('mobile.aiIntake.selectDealer')
              }
              onPress={() => setCustomerSheetOpen(true)}
              disabled={busy}
            />
            {review.canApprove ? (
              <PrimaryButton
                label={t('mobile.aiIntake.approveDraft')}
                onPress={() => setApproveOpen(true)}
                disabled={busy || !customerId}
                style={{ minHeight: theme.sizes.touch.min }}
              />
            ) : null}
            {review.canRequestManual ? (
              <SecondaryButton
                label={t('mobile.aiIntake.requestManual')}
                onPress={() => setManualOpen(true)}
                disabled={busy}
              />
            ) : null}
            {review.canReject ? (
              <DestructiveButton
                label={t('mobile.aiIntake.rejectDraft')}
                onPress={() => setRejectOpen(true)}
                disabled={busy}
              />
            ) : null}
            <AppText variant="caption" color="muted" align="center">
              {t('mobile.aiIntake.safetyNote')}
            </AppText>
          </View>
        ) : null}

        {review.phase === 'failed' ? (
          <ErrorState
            title={t('mobile.aiIntake.failedTitle')}
            description={query.data?.errorMessage ?? t('mobile.aiIntake.failedBody')}
            retryLabel={t('mobile.aiIntake.backToList')}
            onRetry={() => router.replace('/(app)/(admin)/ai-intake' as Href)}
          />
        ) : null}
      </ScrollView>

      <BottomSheet
        open={customerSheetOpen}
        onClose={() => setCustomerSheetOpen(false)}
        title={t('mobile.aiIntake.selectDealer')}
        sheetHeight={420}
      >
        <ScrollView style={{ maxHeight: 320 }}>
          {customers.map((c) => (
            <Pressable
              key={c.id}
              onPress={() => {
                void haptics.selection();
                setCustomerId(c.id);
                setCustomerSheetOpen(false);
              }}
              style={{
                minHeight: theme.sizes.touch.min,
                paddingVertical: theme.spacing.md,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              }}
            >
              <AppText variant="label" weight={c.id === customerId ? 'semibold' : 'medium'}>
                {c.name}
              </AppText>
              {c.code ? (
                <AppText variant="caption" color="muted">
                  {c.code}
                </AppText>
              ) : null}
            </Pressable>
          ))}
        </ScrollView>
      </BottomSheet>

      <ConfirmationSheet
        open={approveOpen}
        onClose={() => setApproveOpen(false)}
        title={t('mobile.aiIntake.approveDraft')}
        message={t('mobile.aiIntake.approveConfirm')}
        confirmLabel={t('mobile.aiIntake.approveDraft')}
        cancelLabel={t('mobile.aiIntake.cancel')}
        onConfirm={() => void onApprove()}
      />
      <ConfirmationSheet
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title={t('mobile.aiIntake.rejectDraft')}
        message={t('mobile.aiIntake.rejectConfirm')}
        confirmLabel={t('mobile.aiIntake.rejectDraft')}
        cancelLabel={t('mobile.aiIntake.cancel')}
        destructive
        onConfirm={() => void onReject()}
      />
      <ConfirmationSheet
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        title={t('mobile.aiIntake.requestManual')}
        message={t('mobile.aiIntake.manualConfirm')}
        confirmLabel={t('mobile.aiIntake.requestManual')}
        cancelLabel={t('mobile.aiIntake.cancel')}
        onConfirm={() => void onManual()}
      />
    </AppScreen>
  );
}
