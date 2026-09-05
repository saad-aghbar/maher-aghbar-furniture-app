import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { can } from '@maher/permissions';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { useToast } from '@/components/feedback/Toast';
import { TextField } from '@/components/forms/TextField';
import { AppScreen } from '@/components/layout/AppScreen';
import { useNetwork } from '@/components/network/NetworkProvider';
import { ConfirmationSheet } from '@/components/sheets/ConfirmationSheet';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { useLocale } from '@/i18n';
import { haptics, ListItemEnter } from '@/motion';
import { SURFACE_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import { useTheme } from '@/theme';
import { PurchasingFloorBoard } from './components/PurchasingFloorBoard';
import { PurchasingSupplierSheet } from './components/PurchasingSupplierSheet';
import { resolveFabricStageLabel, resolveFabricStatusLabel } from '@/features/fabric/fabricCopy';
import { fabricStatusKind, formatFabricQty, selectFabricTrackerRow } from '@/features/fabric/selectFabricTracker';
import { ProductThumb } from '@/components/desk/ProductThumb';
import { useFabricProcurementActions, useFabricProcurementQuery, useSuppliersQuery } from './query';
import { isApiError } from '@/api/errors';
import { toastMessageForError } from '@/api/queryClient';

type Props = { procurementId: string };

export function FabricProcurementDetailScreen({ procurementId }: Props) {
  const { user } = useAuth();
  const { t, locale, formatDate, isRTL } = useLocale();
  const { theme, colors } = useTheme();
  const { showOfflineBanner } = useNetwork();
  const { showToast } = useToast();
  const router = useRouter();
  const canRead = can(user, 'fabric.procurement.read');
  const canManage = can(user, 'fabric.procurement.manage');
  const canOverride = can(user, 'production.fabric.override');
  const canReadSupplier = can(user, 'supplier.read');
  const canOpenOrder = can(user, 'sales-order.read');
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const backFallback = '/(app)/(admin)/purchasing?tab=fabric' as Href;

  const query = useFabricProcurementQuery(procurementId, canRead);
  const actions = useFabricProcurementActions(procurementId);
  const suppliersQuery = useSuppliersQuery(canReadSupplier);
  const row = useMemo(
    () => (query.data ? selectFabricTrackerRow(query.data) : null),
    [query.data],
  );

  const [whatsappBody, setWhatsappBody] = useState<string | null>(null);
  const [waitOpen, setWaitOpen] = useState(false);
  const [waitNote, setWaitNote] = useState('');
  const [redirectOpen, setRedirectOpen] = useState(false);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [sendConfirm, setSendConfirm] = useState(false);

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

  if (!row) {
    return (
      <AppScreen backFallback={backFallback}>
        <EmptyState title={t('mobile.purchasing.loading')} />
      </AppScreen>
    );
  }

  const statusLabel = resolveFabricStatusLabel(t, row, 'desk');
  const stageLabel = resolveFabricStageLabel(t, row.stageCode);
  const kind = fabricStatusKind(row);
  const sourcingOpen =
    kind === 'NEEDS_ORDERING' ||
    kind === 'WAITING' ||
    kind === 'UNAVAILABLE' ||
    kind === 'READY_FOR_PICKUP';
  const showReceive = Boolean(query.data?.purchaseOrderId);
  const showOverride = canOverride && kind !== 'READY' && kind !== 'ISSUED' && !row.overridden;
  const showManage = canManage && (sourcingOpen || showReceive || showOverride);
  const supplierOptions = (suppliersQuery.data?.data ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    code: s.code,
  }));

  return (
    <AppScreen backFallback={backFallback}>
      {showOfflineBanner ? <OfflineBanner /> : null}
      <ScrollView
        contentContainerStyle={{
          gap: theme.spacing.md,
          paddingBottom: theme.spacing['3xl'] + SURFACE_TAB_BAR_CLEARANCE,
        }}
      >
        <ListItemEnter index={0}>
          <PurchasingFloorBoard title={row.label}>
            <AppText weight={titleWeight}>{statusLabel}</AppText>
            {row.role ? <AppText variant="caption" color="muted">{row.role}</AppText> : null}
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                gap: theme.spacing.md,
                alignItems: 'center',
              }}
            >
              <ProductThumb uri={row.productImageUrl ?? row.imageUrl} size={56} radius={theme.radius.lg} />
              <View style={{ flex: 1, gap: 2 }}>
                {row.orderNumber ? (
                  <AppText variant="caption" weight={titleWeight} dir="ltr">
                    {row.orderNumber}
                  </AppText>
                ) : null}
                {row.productName ? (
                  <AppText variant="caption" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {row.productName}
                  </AppText>
                ) : null}
                {row.dealerName ? (
                  <AppText variant="caption" color="muted">
                    {row.dealerName}
                  </AppText>
                ) : null}
              </View>
            </View>
            <AppText variant="caption" dir="ltr">
              {t('mobile.purchasing.fabricQtyArrived')}: {formatFabricQty(row)}
            </AppText>
            {row.supplierName ? (
              <AppText variant="caption">{row.supplierName}</AppText>
            ) : null}
            {row.locationLabel ? (
              <AppText variant="caption">
                {t('mobile.purchasing.fabricLocation')}: {row.locationLabel}
              </AppText>
            ) : null}
            {stageLabel ? (
              <AppText variant="caption" color="muted">
                {t('mobile.inventory.fabricRequiredFor')}: {stageLabel}
              </AppText>
            ) : null}
            {row.overridden ? (
              <AppText variant="caption" style={{ color: colors.warning }}>
                {t('mobile.purchasing.fabricOverriddenNote')}
              </AppText>
            ) : null}
          </PurchasingFloorBoard>
        </ListItemEnter>

        {showManage ? (
          <ListItemEnter index={1}>
            <View style={{ gap: theme.spacing.sm }}>
              {sourcingOpen ? (
                <>
                  <PrimaryButton
                    label={t('mobile.purchasing.fabricDraftWhatsApp')}
                    onPress={() => {
                      const supplierId = query.data?.supplier?.id ?? supplierOptions[0]?.id;
                      if (!supplierId) {
                        showToast({ variant: 'error', message: t('mobile.purchasing.fabricNoSupplier') });
                        return;
                      }
                      actions.draftWhatsApp.mutate(
                        { ids: [procurementId], supplierId },
                        {
                          onSuccess: (draft) => {
                            setWhatsappBody(draft.body);
                            void haptics.confirmLight();
                          },
                          onError: (err) => {
                            showToast({
                              variant: 'error',
                              message: isApiError(err) ? toastMessageForError(err) : t('mobile.purchasing.createFailed'),
                            });
                          },
                        },
                      );
                    }}
                    loading={actions.draftWhatsApp.isPending}
                  />
                  <SecondaryButton
                    label={t('mobile.purchasing.fabricWait')}
                    onPress={() => setWaitOpen(true)}
                  />
                  <SecondaryButton
                    label={t('mobile.purchasing.fabricRedirect')}
                    onPress={() => setRedirectOpen(true)}
                  />
                </>
              ) : null}
              {showReceive ? (
                <SecondaryButton
                  label={t('mobile.purchasing.receive')}
                  onPress={() =>
                    router.push(
                      `/(app)/(admin)/purchasing/${query.data!.purchaseOrderId}` as Href,
                    )
                  }
                />
              ) : null}
              {showOverride ? (
                <SecondaryButton
                  label={t('mobile.purchasing.fabricOverride')}
                  onPress={() => setOverrideOpen(true)}
                />
              ) : null}
            </View>
          </ListItemEnter>
        ) : null}

        {(canOpenOrder && row.salesOrderId) || row.qrCodes[0] ? (
        <ListItemEnter index={showManage ? 2 : 1}>
          <View style={{ gap: theme.spacing.sm }}>
            {canOpenOrder && row.salesOrderId ? (
              <SecondaryButton
                label={t('mobile.inventory.fabricOpenOrder')}
                onPress={() =>
                  router.push(`/(app)/(admin)/orders/${row.salesOrderId}` as Href)
                }
              />
            ) : null}
            {row.qrCodes[0] ? (
              <SecondaryButton
                label={t('mobile.inventory.fabricScanOpenBundle')}
                onPress={() =>
                  router.push(
                    `/(app)/(admin)/inventory/fabric-bundle/${encodeURIComponent(row.qrCodes[0]!)}` as Href,
                  )
                }
              />
            ) : null}
          </View>
        </ListItemEnter>
        ) : null}

        {whatsappBody ? (
          <ListItemEnter index={2}>
            <PurchasingFloorBoard title={t('mobile.purchasing.fabricWhatsAppBody')}>
              <TextField
                value={whatsappBody}
                onChangeText={setWhatsappBody}
                multiline
              />
              <PrimaryButton
                label={t('mobile.purchasing.fabricSendWhatsApp')}
                onPress={() => setSendConfirm(true)}
                loading={actions.sendWhatsApp.isPending}
              />
            </PurchasingFloorBoard>
          </ListItemEnter>
        ) : null}

        {(query.data?.events?.length ?? 0) > 0 ? (
          <ListItemEnter index={3}>
            <PurchasingFloorBoard title={t('mobile.purchasing.fabricHistory')}>
              {(query.data?.events ?? []).map((ev) => (
                <View key={ev.id} style={{ gap: 2 }}>
                  <AppText variant="caption" weight="semibold">
                    {ev.kind}
                  </AppText>
                  {ev.note ? (
                    <AppText variant="caption" color="muted">
                      {ev.note}
                    </AppText>
                  ) : null}
                  <AppText variant="caption" color="muted">
                    {formatDate(ev.createdAt)}
                  </AppText>
                </View>
              ))}
            </PurchasingFloorBoard>
          </ListItemEnter>
        ) : null}
      </ScrollView>

      <ConfirmationSheet
        open={sendConfirm}
        onClose={() => setSendConfirm(false)}
        title={t('mobile.purchasing.fabricSendWhatsApp')}
        message={t('mobile.purchasing.fabricSendConfirm')}
        confirmLabel={t('mobile.purchasing.fabricSendWhatsApp')}
        onConfirm={() => {
          const supplierId = query.data?.supplier?.id ?? supplierOptions[0]?.id;
          if (!supplierId || !whatsappBody) return;
          actions.sendWhatsApp.mutate(
            { ids: [procurementId], supplierId, body: whatsappBody },
            {
              onSuccess: () => {
                setSendConfirm(false);
                void haptics.confirmLight();
                showToast({ variant: 'success', message: t('mobile.purchasing.fabricSendWhatsApp') });
              },
            },
          );
        }}
      />

      <BottomSheet
        open={waitOpen}
        onClose={() => setWaitOpen(false)}
        title={t('mobile.purchasing.fabricWait')}
        fitContent
      >
        <View style={{ gap: theme.spacing.md, padding: theme.spacing.lg }}>
          <AppText weight={titleWeight}>{t('mobile.purchasing.fabricWait')}</AppText>
          <TextField
            label={t('mobile.purchasing.fabricWaitNote')}
            value={waitNote}
            onChangeText={setWaitNote}
          />
          <PrimaryButton
            label={t('mobile.purchasing.fabricWait')}
            onPress={() => {
              actions.wait.mutate(
                { note: waitNote || undefined },
                {
                  onSuccess: () => {
                    setWaitOpen(false);
                    setWaitNote('');
                    void haptics.confirmLight();
                  },
                },
              );
            }}
            loading={actions.wait.isPending}
          />
        </View>
      </BottomSheet>

      <PurchasingSupplierSheet
        open={redirectOpen}
        onClose={() => setRedirectOpen(false)}
        suppliers={supplierOptions}
        selectedId={query.data?.supplier?.id ?? null}
        onConfirm={(s) => {
          if (!s) return;
          actions.redirect.mutate(
            { supplierId: s.id },
            {
              onSuccess: () => {
                setRedirectOpen(false);
                void haptics.confirmLight();
              },
            },
          );
        }}
      />

      <BottomSheet
        open={overrideOpen}
        onClose={() => setOverrideOpen(false)}
        title={t('mobile.purchasing.fabricOverride')}
        fitContent
      >
        <View style={{ gap: theme.spacing.md, padding: theme.spacing.lg }}>
          <AppText weight={titleWeight}>{t('mobile.purchasing.fabricOverride')}</AppText>
          <TextField
            label={t('mobile.purchasing.fabricOverrideReason')}
            value={overrideReason}
            onChangeText={setOverrideReason}
          />
          <PrimaryButton
            label={t('mobile.purchasing.fabricOverride')}
            onPress={() => {
              if (overrideReason.trim().length < 3) return;
              actions.override.mutate(overrideReason.trim(), {
                onSuccess: () => {
                  setOverrideOpen(false);
                  setOverrideReason('');
                  void haptics.confirmLight();
                },
              });
            }}
            loading={actions.override.isPending}
          />
        </View>
      </BottomSheet>
    </AppScreen>
  );
}
