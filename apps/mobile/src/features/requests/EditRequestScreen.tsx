import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { can } from '@maher/permissions';
import { isApiError } from '@/api/errors';
import { getRequest, updateRequest } from '@/api/modules/requests';
import { queryKeys } from '@/api/queryKeys';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { LockedTextField } from '@/components/forms/LockedTextField';
import { PhoneField } from '@/components/forms/PhoneField';
import { KeyboardAwareScreen } from '@/components/layout/KeyboardAwareScreen';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { useLocale } from '@/i18n';
import { FormShake, haptics } from '@/motion';
import { useTheme } from '@/theme';

function formatRemaining(ms: number, t: (k: string, p?: Record<string, string | number>) => string) {
  if (ms <= 0) return t('mobile.requestEdit.windowClosed');
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (days > 0) {
    return t('mobile.requestEdit.remainingDhms', { days, hours, mins });
  }
  return t('mobile.requestEdit.remainingHms', {
    hours,
    mins,
    secs: secs.toString().padStart(2, '0'),
  });
}

type EditRequestScreenProps = {
  requestId: string;
  /** Admin factory edit — no dealer 3-day window chrome. */
  variant?: 'dealer' | 'admin';
};

export function EditRequestScreen({
  requestId,
  variant = 'dealer',
}: EditRequestScreenProps) {
  const { user } = useAuth();
  const { t, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const allowed = can(user, 'request.read');
  const canUpdate = can(user, 'request.update');
  const isAdmin = variant === 'admin';

  const query = useQuery({
    queryKey: queryKeys.requests.detail(requestId),
    queryFn: () => getRequest(requestId),
    enabled: allowed && Boolean(requestId),
    refetchInterval: 30_000,
  });

  const detail = query.data;
  const policy = detail?.editPolicy;
  const item = detail?.items?.[0];

  const [shake, setShake] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const [externalOrderNumber, setExternalOrderNumber] = useState('');
  const [endCustomerName, setEndCustomerName] = useState('');
  const [endCustomerPhone, setEndCustomerPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [fabric, setFabric] = useState('');
  const [fabricDescription, setFabricDescription] = useState('');
  const [dimensionsNotes, setDimensionsNotes] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [quantity, setQuantity] = useState('1');

  useEffect(() => {
    if (!detail) return;
    setExternalOrderNumber(detail.externalOrderNumber ?? '');
    setEndCustomerName(detail.endCustomerName ?? '');
    setEndCustomerPhone(detail.endCustomerPhone ?? '');
    setDeliveryAddress(detail.deliveryAddress ?? '');
    setOrderNotes(detail.notes ?? '');
    setFabric(item?.fabricType ?? item?.fabric ?? '');
    setFabricDescription(item?.description ?? '');
    setDimensionsNotes(item?.notes ?? '');
    setQuantity(String(item?.quantity ?? '1'));
  }, [detail, item]);

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const remainingMs = useMemo(() => {
    if (!policy?.editWindowEndsAt || !policy.serverNow) return policy?.remainingMs ?? 0;
    // Recompute from server-authoritative end time using local elapsed since last fetch.
    // Still anchors on server `editWindowEndsAt`, not a client-chosen start.
    const ends = new Date(policy.editWindowEndsAt).getTime();
    const fetchedAt = new Date(policy.serverNow).getTime();
    const elapsed = tick * 1000; // approx since mount ticks; refetch refreshes anchor
    const skewAdjustedNow = fetchedAt + (Date.now() - fetchedAt);
    void elapsed;
    return Math.max(0, ends - skewAdjustedNow);
  }, [policy, tick]);

  const orderLocked = Boolean(!isAdmin && policy && !policy.canEdit);
  const fabricLocked = Boolean(!isAdmin && policy?.fabricLocked);
  const fabricReason =
    policy?.lockReasons.find((r) => r.code === 'FABRIC_LOCKED')?.message ??
    t('mobile.requestEdit.fabricLockedHint');
  const orderReason =
    policy?.lockReasons.find((r) => r.code === 'ORDER_LOCKED')?.message ??
    t('mobile.requestEdit.orderLockedHint');

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace(
      isAdmin
        ? ('/(app)/(admin)/(tabs)/orders' as never)
        : ('/(app)/(customer)/(tabs)/orders' as never),
    );
  };

  const save = async () => {
    if (!canUpdate || !detail) return;
    if (orderLocked) {
      setError(orderReason);
      setShake((n) => n + 1);
      void haptics.error();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await updateRequest(detail.id, {
        externalOrderNumber: externalOrderNumber.trim() || undefined,
        endCustomerName: endCustomerName.trim() || undefined,
        endCustomerPhone: endCustomerPhone.trim() || undefined,
        deliveryAddress: deliveryAddress.trim() || undefined,
        notes: orderNotes.trim() || undefined,
        items: [
          {
            productName: item?.productName || detail.title || detail.number,
            productId: item?.productId || undefined,
            quantity: Number(quantity) || 1,
            fabric: fabricLocked ? item?.fabricType ?? item?.fabric ?? undefined : fabric.trim() || undefined,
            color: fabricLocked ? item?.fabricColor ?? item?.color ?? undefined : undefined,
            description: fabricDescription.trim() || undefined,
            notes: dimensionsNotes.trim() || undefined,
          },
        ],
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.requests.all });
      void haptics.confirmMedium();
      Alert.alert(t('mobile.requestEdit.savedTitle'), t('mobile.requestEdit.savedBody'));
      await query.refetch();
    } catch (err) {
      if (isApiError(err) && (err.code === 'ORDER_LOCKED' || err.code === 'FABRIC_LOCKED' || err.status === 409)) {
        setError(err.message);
        await query.refetch();
      } else {
        setError(err instanceof Error ? err.message : t('mobile.requestEdit.saveFailed'));
      }
      setShake((n) => n + 1);
      void haptics.error();
    } finally {
      setBusy(false);
    }
  };

  if (!allowed) {
    return (
      <KeyboardAwareScreen>
        <EmptyState title={t('mobile.noModules')} description={t('mobile.noModulesHint')} />
      </KeyboardAwareScreen>
    );
  }

  if (query.isError && !detail) {
    return (
      <KeyboardAwareScreen>
        <ErrorState
          title={t('mobile.requestEdit.errorTitle')}
          description={t('mobile.requestEdit.errorBody')}
          retryLabel={t('mobile.requestEdit.retry')}
          onRetry={() => void query.refetch()}
        />
      </KeyboardAwareScreen>
    );
  }

  if (!detail) {
    return (
      <KeyboardAwareScreen>
        <AppText variant="body" color="secondary">
          {t('mobile.requestEdit.loading')}
        </AppText>
      </KeyboardAwareScreen>
    );
  }

  return (
    <KeyboardAwareScreen
      header={
        <View style={{ gap: theme.spacing.md }}>
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: theme.spacing.md,
            }}
          >
            <Pressable
              onPress={goBack}
              style={{ minHeight: theme.sizes.touch.min, justifyContent: 'center' }}
            >
              <AppText variant="label" weight="semibold" color="brand">
                {t('mobile.requestEdit.back')}
              </AppText>
            </Pressable>
            <AppText variant="largeTitle" style={{ flex: 1 }} numberOfLines={1}>
              {detail.number}
            </AppText>
            <StatusBadge status={detail.status} />
          </View>

          {!isAdmin ? (
            <View
              style={{
                padding: theme.spacing.md,
                borderRadius: theme.radius.md,
                backgroundColor: orderLocked ? colors.errorSoft : colors.warningSoft,
                borderWidth: 1,
                borderColor: orderLocked ? colors.error : colors.warning,
                gap: theme.spacing.xs,
              }}
            >
              <AppText variant="label" weight="semibold">
                {t('mobile.requestEdit.editWindow')}
              </AppText>
              <AppText variant="body">
                {orderLocked
                  ? t('mobile.requestEdit.windowClosed')
                  : formatRemaining(remainingMs, t)}
              </AppText>
              {policy?.editWindowEndsAt ? (
                <AppText variant="caption" color="muted">
                  {t('mobile.requestEdit.endsAtServer')}
                </AppText>
              ) : null}
              {orderLocked ? (
                <AppText variant="caption" color="error">
                  {orderReason}
                </AppText>
              ) : null}
            </View>
          ) : null}
        </View>
      }
    >
      <FormShake shakeKey={shake} haptic={false}>
        <View style={{ gap: theme.spacing.lg }}>
          <AppText variant="title" weight="semibold">
            {detail.title || t('mobile.requestEdit.title')}
          </AppText>

          <LockedTextField
            label={t('mobile.requestEdit.dealerPo')}
            value={externalOrderNumber}
            onChangeText={setExternalOrderNumber}
            locked={orderLocked}
            lockReason={orderLocked ? orderReason : undefined}
          />
          <LockedTextField
            label={t('mobile.requestEdit.customerName')}
            value={endCustomerName}
            onChangeText={setEndCustomerName}
            locked={orderLocked}
            lockReason={orderLocked ? orderReason : undefined}
          />
          {orderLocked ? (
            <LockedTextField
              label={t('mobile.requestEdit.phone')}
              value={endCustomerPhone}
              onChangeText={setEndCustomerPhone}
              locked
              lockReason={orderReason}
              keyboardType="phone-pad"
            />
          ) : (
            <PhoneField
              label={t('mobile.requestEdit.phone')}
              value={endCustomerPhone}
              onChangeText={setEndCustomerPhone}
            />
          )}
          <LockedTextField
            label={t('mobile.requestEdit.address')}
            value={deliveryAddress}
            onChangeText={setDeliveryAddress}
            locked={orderLocked}
            lockReason={orderLocked ? orderReason : undefined}
            multiline
          />
          <LockedTextField
            label={t('mobile.requestEdit.quantity')}
            value={quantity}
            onChangeText={setQuantity}
            locked={orderLocked}
            lockReason={orderLocked ? orderReason : undefined}
            keyboardType="decimal-pad"
          />
          <LockedTextField
            label={t('mobile.requestEdit.fabric')}
            value={fabric}
            onChangeText={setFabric}
            locked={orderLocked || fabricLocked}
            lockReason={
              orderLocked ? orderReason : fabricLocked ? fabricReason : undefined
            }
          />
          <LockedTextField
            label={t('mobile.requestEdit.fabricDescription')}
            value={fabricDescription}
            onChangeText={setFabricDescription}
            locked={orderLocked || fabricLocked}
            lockReason={
              orderLocked ? orderReason : fabricLocked ? fabricReason : undefined
            }
            multiline
          />
          <LockedTextField
            label={t('mobile.requestEdit.dimensions')}
            value={dimensionsNotes}
            onChangeText={setDimensionsNotes}
            locked={orderLocked}
            lockReason={orderLocked ? orderReason : undefined}
            multiline
          />
          <LockedTextField
            label={t('mobile.requestEdit.notes')}
            value={orderNotes}
            onChangeText={setOrderNotes}
            locked={orderLocked}
            lockReason={orderLocked ? orderReason : undefined}
            multiline
          />

          {error ? (
            <AppText variant="caption" color="error">
              {error}
            </AppText>
          ) : null}

          <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: theme.spacing.sm }}>
            <SecondaryButton
              label={t('mobile.requestEdit.back')}
              onPress={goBack}
              style={{ flex: 1 }}
            />
            <PrimaryButton
              label={t('mobile.requestEdit.save')}
              onPress={() => void save()}
              loading={busy}
              disabled={!canUpdate || orderLocked}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </FormShake>
    </KeyboardAwareScreen>
  );
}
