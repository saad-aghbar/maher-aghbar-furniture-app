import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { can } from '@maher/permissions';
import { isApiError } from '@/api/errors';
import { toastMessageForError } from '@/api/queryClient';
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
import { useLocale } from '@/i18n';
import { haptics } from '@/motion';
import { SURFACE_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import { useTheme } from '@/theme';
import { PurchasingFloorBoard } from './components/PurchasingFloorBoard';
import { usePurchaseRequestActionMutation, usePurchaseRequestQuery } from './query';
import { localizedNamed, resolvePurchaseRequestSupplier } from './selectPurchase';

type Props = { requestId: string };

export function PurchaseRequestDetailScreen({ requestId }: Props) {
  const { user } = useAuth();
  const { t, locale, isRTL } = useLocale();
  const { theme } = useTheme();
  const { showOfflineBanner } = useNetwork();
  const { showToast } = useToast();
  const router = useRouter();
  const canRead = can(user, 'purchase-request.read');
  const canApprove = can(user, 'purchase-order.approve');
  const canConvert = can(user, 'purchase-order.create');
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const backFallback = '/(app)/(admin)/purchasing' as Href;

  const [confirm, setConfirm] = useState<'approve' | 'convert' | null>(null);
  const query = usePurchaseRequestQuery(requestId, canRead);
  const actions = usePurchaseRequestActionMutation(requestId);

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
          title={t('mobile.purchasing.errorTitle')}
          description={t('mobile.purchasing.errorBody')}
          retryLabel={t('mobile.purchasing.retry')}
          onRetry={() => void query.refetch()}
        />
      </AppScreen>
    );
  }

  const pr = query.data;
  if (!pr) {
    return (
      <AppScreen backFallback={backFallback}>
        <AppText>{t('mobile.purchasing.loading')}</AppText>
      </AppScreen>
    );
  }

  return (
    <AppScreen backFallback={backFallback}>
      {showOfflineBanner ? <OfflineBanner /> : null}
      <ScrollView
        contentContainerStyle={{
          gap: theme.spacing.md,
          paddingBottom: theme.spacing['3xl'] + SURFACE_TAB_BAR_CLEARANCE,
        }}
      >
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            justifyContent: 'space-between',
            gap: theme.spacing.sm,
          }}
        >
          <AppText
            variant="title"
            weight={titleWeight}
            dir="ltr"
            style={{ flex: 1, textAlign: isRTL ? 'right' : 'left' }}
          >
            {pr.number}
          </AppText>
          <StatusBadge status={pr.status} />
        </View>

        <PurchasingFloorBoard>
          <Meta label={t('catalog.reason')} value={pr.reason?.trim() || '—'} />
          <Meta
            label={t('catalog.supplier')}
            value={resolvePurchaseRequestSupplier(pr, locale)}
          />
          <Meta
            label={t('catalog.warehouses')}
            value={pr.warehouse ? localizedNamed(locale, pr.warehouse) : '—'}
          />
          {pr.purchaseOrder?.number ? (
            <Meta
              label={t('catalog.poShort')}
              value={pr.purchaseOrder.number}
            />
          ) : null}
        </PurchasingFloorBoard>

        <PurchasingFloorBoard title={t('catalog.materialsList')}>
          {(pr.lines ?? []).map((line, idx) => (
            <View key={line.id ?? String(idx)} style={{ gap: 2 }}>
              <AppText weight="semibold" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                {line.description}
              </AppText>
              <AppText variant="caption" color="secondary" dir="ltr">
                {`${String(line.quantity)} ${line.unit || 'pcs'}`}
              </AppText>
            </View>
          ))}
        </PurchasingFloorBoard>

        {(pr.offers ?? []).length > 0 ? (
          <PurchasingFloorBoard title={t('catalog.offersShort')}>
            {(pr.offers ?? []).map((o) => (
              <View key={o.id} style={{ gap: 2 }}>
                <AppText weight="semibold" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                  {localizedNamed(locale, o.supplier)}
                  {o.isSelected ? ' ✓' : ''}
                </AppText>
                <AppText variant="caption" color="secondary" dir="ltr">
                  {String(o.unitPrice)}
                </AppText>
              </View>
            ))}
          </PurchasingFloorBoard>
        ) : null}

        {canApprove && pr.status === 'SUBMITTED' ? (
          <PrimaryButton
            label={t('mobile.purchasing.approve')}
            onPress={() => setConfirm('approve')}
            style={{ borderRadius: theme.radius.xl }}
          />
        ) : null}
        {canConvert && pr.status === 'APPROVED' && !pr.purchaseOrderId ? (
          <SecondaryButton
            label={t('mobile.purchasing.convertToPo')}
            onPress={() => setConfirm('convert')}
            style={{ borderRadius: theme.radius.xl }}
          />
        ) : null}
      </ScrollView>

      <ConfirmationSheet
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        title={
          confirm === 'convert'
            ? t('mobile.purchasing.convertToPo')
            : t('mobile.purchasing.approve')
        }
        message={
          confirm === 'convert'
            ? t('mobile.purchasing.convertConfirm')
            : t('mobile.purchasing.approveRequestConfirm')
        }
        confirmLabel={t('mobile.purchasing.confirm')}
        cancelLabel={t('mobile.purchasing.cancel')}
        onConfirm={() => {
          if (confirm === 'approve') {
            actions.approve.mutate(undefined, {
              onSuccess: () => {
                void haptics.confirmMedium();
                showToast({
                  variant: 'success',
                  message: t('mobile.purchasing.updateSuccess'),
                });
              },
              onError: (err) =>
                showToast({
                  variant: 'error',
                  message: isApiError(err)
                    ? toastMessageForError(err)
                    : t('mobile.purchasing.updateFailed'),
                }),
            });
          } else if (confirm === 'convert') {
            actions.convert.mutate(undefined, {
              onSuccess: (po) => {
                void haptics.confirmMedium();
                showToast({
                  variant: 'success',
                  message: t('catalog.purchaseOrderCreated'),
                });
                router.push(`/(app)/(admin)/purchasing/${po.id}` as Href);
              },
              onError: (err) =>
                showToast({
                  variant: 'error',
                  message: isApiError(err)
                    ? toastMessageForError(err)
                    : t('mobile.purchasing.updateFailed'),
                }),
            });
          }
        }}
      />
    </AppScreen>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  const { isRTL } = useLocale();
  return (
    <View style={{ gap: 2 }}>
      <AppText
        variant="caption"
        color="muted"
        style={{ textAlign: isRTL ? 'right' : 'left', fontSize: 11 }}
      >
        {label}
      </AppText>
      <AppText weight="medium" style={{ textAlign: isRTL ? 'right' : 'left' }}>
        {value}
      </AppText>
    </View>
  );
}
