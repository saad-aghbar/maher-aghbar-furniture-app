import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { can } from '@maher/permissions';
import { isApiError } from '@/api/errors';
import {
  getRequest,
  updateRequest,
  type RequestPriority,
} from '@/api/modules/requests';
import { resolveDocumentUrl, uploadFile } from '@/api/modules/uploads';
import type { AvailabilityRequest } from '@/api/modules/scheduling';
import { queryKeys } from '@/api/queryKeys';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { BackButton } from '@/components/BackButton';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { Ionicons } from '@expo/vector-icons';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { LockedTextField } from '@/components/forms/LockedTextField';
import { PhoneField } from '@/components/forms/PhoneField';
import { AppScreen } from '@/components/layout/AppScreen';
import { LocationMapPicker } from '@/components/maps/LocationMapPicker';
import { useLocale } from '@/i18n';
import { AnimatedPressable, FormShake, haptics, ListItemEnter } from '@/motion';
import { DEALER_TAB_BAR_CLEARANCE, SURFACE_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import { useTheme } from '@/theme';
import { useAvailabilityQuery } from '@/features/scheduling/query';
import {
  OrderBoardCard,
  OrderSectionHeader,
} from '@/features/sales-orders/components/OrderBoardCard';
import { ImageCarousel } from '@/features/sales-orders/components/ImageCarousel';
import { resolveOrderMediaUri } from '@/features/sales-orders/components/OrderCardMedia';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { DeliveryAvailabilityCard } from './components/DeliveryAvailabilityCard';
import { NewOrderDeliveryAddressBlock } from './components/NewOrderDeliveryAddressBlock';
import { NewOrderDimensionsEditor } from './components/NewOrderDimensionsEditor';
import { NewOrderPriorityBar } from './components/NewOrderPriorityBar';
import {
  emptyDimensionFields,
  formatDimensionsNotes,
  parseDimNumber,
  toRequestCustomMeasurements,
  type NewOrderDimensionFields,
} from './newOrderMeasurements';
import {
  composeRequestNotes,
  isValidOptionalDate,
  isValidOptionalPhone,
} from './newOrderValidation';
import { selectDeliveryAvailability, toDeliveryYmd } from './selectDeliveryAvailability';
import type { RequestItem } from './types';

function formatRemaining(
  ms: number,
  t: (k: string, p?: Record<string, string | number>) => string,
) {
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

function seedDimensionsFromItem(
  item: RequestItem | undefined,
  seatLabel: string,
): NewOrderDimensionFields {
  const base = emptyDimensionFields();
  if (!item) return base;
  const fmt = (v: number | string | null | undefined) => {
    if (v == null || v === '') return '';
    const n = Number(v);
    return Number.isFinite(n) ? String(n) : String(v);
  };
  base.width = fmt(item.width);
  base.height = fmt(item.height);
  base.depth = fmt(item.depth);
  const custom = item.customMeasurements ?? [];
  const seatKey = seatLabel.trim().toLowerCase();
  const seatRow = custom.find((m) => m.label.trim().toLowerCase() === seatKey);
  if (seatRow) base.seat = seatRow.value ?? '';
  base.custom = custom
    .filter((m) => m.label.trim().toLowerCase() !== seatKey)
    .map((m, i) => ({
      id: `m-${i}-${m.label}`,
      label: m.label,
      value: m.value,
    }));
  return base;
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
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const allowed = can(user, 'request.read');
  const canUpdate = can(user, 'request.update');
  const isAdmin = variant === 'admin';
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const stickyBottom = isAdmin ? SURFACE_TAB_BAR_CLEARANCE : DEALER_TAB_BAR_CLEARANCE;
  const stickyPad = stickyBottom + 120;

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
  const [mapOpen, setMapOpen] = useState(false);
  const [galleryUris, setGalleryUris] = useState<string[]>([]);
  const [deliveryNotes, setDeliveryNotes] = useState('');

  const [externalOrderNumber, setExternalOrderNumber] = useState('');
  const [priority, setPriority] = useState<RequestPriority>('NORMAL');
  const [endCustomerName, setEndCustomerName] = useState('');
  const [endCustomerPhone, setEndCustomerPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryLat, setDeliveryLat] = useState<number | undefined>();
  const [deliveryLng, setDeliveryLng] = useState<number | undefined>();
  const [requiredDeliveryDate, setRequiredDeliveryDate] = useState('');
  const [fabric, setFabric] = useState('');
  const [fabricDescription, setFabricDescription] = useState('');
  const [dimensions, setDimensions] = useState<NewOrderDimensionFields>(emptyDimensionFields);
  const [orderNotes, setOrderNotes] = useState('');
  const [quantity, setQuantity] = useState('1');

  useEffect(() => {
    if (!detail) return;
    setExternalOrderNumber(detail.externalOrderNumber ?? '');
    const p = (detail.priority ?? 'NORMAL').toUpperCase() as RequestPriority;
    setPriority(
      p === 'LOW' || p === 'NORMAL' || p === 'HIGH' || p === 'URGENT' ? p : 'NORMAL',
    );
    setEndCustomerName(detail.endCustomerName ?? '');
    setEndCustomerPhone(detail.endCustomerPhone ?? '');
    setDeliveryAddress(detail.deliveryAddress ?? '');
    setDeliveryLat(detail.deliveryLat ?? undefined);
    setDeliveryLng(detail.deliveryLng ?? undefined);
    setRequiredDeliveryDate(toDeliveryYmd(detail.requiredDeliveryDate) ?? '');
    setOrderNotes(detail.notes ?? '');
    setFabric(item?.fabricType ?? item?.fabric ?? '');
    setFabricDescription(item?.description ?? '');
    setDimensions(seedDimensionsFromItem(item, t('mobile.newOrder.dimSeat')));
    setQuantity(String(item?.quantity ?? '1'));
  }, [detail, item, t]);

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

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

  const remainingMs = useMemo(() => {
    if (!policy?.editWindowEndsAt || !policy.serverNow) return policy?.remainingMs ?? 0;
    const ends = new Date(policy.editWindowEndsAt).getTime();
    const fetchedAt = new Date(policy.serverNow).getTime();
    const skewAdjustedNow = fetchedAt + (Date.now() - fetchedAt);
    void tick;
    return Math.max(0, ends - skewAdjustedNow);
  }, [policy, tick]);

  const orderLocked = Boolean(!isAdmin && policy && !policy.canEdit);
  const fabricLocked = Boolean(!isAdmin && policy?.fabricLocked);
  const fieldsLocked = orderLocked || !canUpdate;
  const fabricReason =
    policy?.lockReasons.find((r) => r.code === 'FABRIC_LOCKED')?.message ??
    t('mobile.requestEdit.fabricLockedHint');
  const orderReason =
    policy?.lockReasons.find((r) => r.code === 'ORDER_LOCKED')?.message ??
    t('mobile.requestEdit.orderLockedHint');

  const productId = item?.productId?.trim() ?? '';
  const availabilityRequest: AvailabilityRequest | null =
    productId && Number(quantity) > 0
      ? {
          items: [{ productId, quantity: Math.max(1, Number(quantity) || 1) }],
          requestedDeliveryDate:
            requiredDeliveryDate.trim() && isValidOptionalDate(requiredDeliveryDate)
              ? requiredDeliveryDate.trim()
              : undefined,
        }
      : null;
  const availabilityQuery = useAvailabilityQuery(availabilityRequest);
  const availabilityDisplay = selectDeliveryAvailability({
    hasItems: Boolean(availabilityRequest),
    isLoading: availabilityQuery.isLoading && !availabilityQuery.data,
    isError: availabilityQuery.isError,
    result: availabilityQuery.data,
    requestedDeliveryDate: requiredDeliveryDate.trim() || undefined,
  });
  const availabilityUpdating =
    availabilityQuery.isFetching && Boolean(availabilityQuery.data);

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

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.requests.all });
    await query.refetch();
  };

  const uploadMutation = useMutation({
    mutationFn: async (args: { uri: string; fileName: string; mimeType: string }) =>
      uploadFile({
        uri: args.uri,
        fileName: args.fileName,
        mimeType: args.mimeType,
        category: 'RFQ_ATTACHMENT',
        requestId,
      }),
    onSuccess: async () => {
      void haptics.confirmMedium();
      await invalidate();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : t('mobile.requestEdit.uploadFailed'));
      void haptics.error();
    },
  });

  const attachPhoto = async () => {
    if (fieldsLocked) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError(t('mobile.requestEdit.photoPermission'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
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

  const attachDocument = async () => {
    if (fieldsLocked) return;
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    uploadMutation.mutate({
      uri: asset.uri,
      fileName: asset.name,
      mimeType: asset.mimeType ?? 'application/octet-stream',
    });
  };

  const save = async () => {
    if (!canUpdate || !detail) return;
    if (orderLocked) {
      setError(orderReason);
      setShake((n) => n + 1);
      void haptics.error();
      return;
    }
    if (endCustomerPhone.trim() && !isValidOptionalPhone(endCustomerPhone)) {
      setError(t('mobile.newOrder.errors.phoneInvalid'));
      setShake((n) => n + 1);
      void haptics.error();
      return;
    }
    if (requiredDeliveryDate.trim() && !isValidOptionalDate(requiredDeliveryDate)) {
      setError(t('mobile.newOrder.errors.dateInvalid'));
      setShake((n) => n + 1);
      void haptics.error();
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const dimensionsNotes = formatDimensionsNotes(dimensions);
      const customMeasurements = toRequestCustomMeasurements(
        dimensions,
        t('mobile.newOrder.dimSeat'),
      );
      const notesBlob =
        composeRequestNotes({
          deliveryNotes,
          dimensionsNotes: '',
          orderNotes,
        })?.trim() || undefined;
      await updateRequest(detail.id, {
        externalOrderNumber: externalOrderNumber.trim() || undefined,
        priority,
        endCustomerName: endCustomerName.trim() || undefined,
        endCustomerPhone: endCustomerPhone.trim() || undefined,
        deliveryAddress: deliveryAddress.trim() || undefined,
        deliveryLat,
        deliveryLng,
        requiredDeliveryDate: requiredDeliveryDate.trim() || undefined,
        notes: notesBlob,
        items: [
          {
            productName: item?.productName || detail.title || detail.number,
            productId: item?.productId || undefined,
            quantity: Number(quantity) || 1,
            fabric: fabricLocked
              ? item?.fabricType ?? item?.fabric ?? undefined
              : fabric.trim() || undefined,
            color: fabricLocked ? item?.fabricColor ?? item?.color ?? undefined : undefined,
            description: fabricLocked
              ? item?.description ?? undefined
              : fabricDescription.trim() || undefined,
            notes: dimensionsNotes || undefined,
            width: parseDimNumber(dimensions.width),
            height: parseDimNumber(dimensions.height),
            depth: parseDimNumber(dimensions.depth),
            customMeasurements: customMeasurements.length ? customMeasurements : undefined,
          },
        ],
      });
      void haptics.confirmMedium();
      Alert.alert(t('mobile.requestEdit.savedTitle'), t('mobile.requestEdit.savedBody'));
      await invalidate();
    } catch (err) {
      if (
        isApiError(err) &&
        (err.code === 'ORDER_LOCKED' || err.code === 'FABRIC_LOCKED' || err.status === 409)
      ) {
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
      <AppScreen>
        <EmptyState title={t('mobile.noModules')} description={t('mobile.noModulesHint')} />
      </AppScreen>
    );
  }

  if (query.isError && !detail) {
    return (
      <AppScreen>
        <ErrorState
          title={t('mobile.requestEdit.errorTitle')}
          description={t('mobile.requestEdit.errorBody')}
          retryLabel={t('mobile.requestEdit.retry')}
          onRetry={() => void query.refetch()}
        />
      </AppScreen>
    );
  }

  if (!detail) {
    return (
      <AppScreen>
        <AppText variant="body" color="secondary">
          {t('mobile.requestEdit.loading')}
        </AppText>
      </AppScreen>
    );
  }

  let section = 0;
  const nextIndex = () => {
    const i = section;
    section += 1;
    return i;
  };

  return (
    <AppScreen edges={{ top: true, bottom: false }} style={{ paddingHorizontal: 0 }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
      >
        <View
          style={{
            paddingHorizontal: theme.spacing.lg,
            paddingBottom: theme.spacing.sm,
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: theme.spacing.md,
          }}
        >
          <BackButton onPress={goBack} />
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="title" weight={titleWeight} numberOfLines={1} dir="ltr">
              {detail.number}
            </AppText>
            {detail.title ? (
              <AppText variant="caption" color="muted" numberOfLines={1}>
                {detail.title}
              </AppText>
            ) : null}
          </View>
          <StatusBadge status={detail.status} />
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ paddingBottom: stickyPad }}
        >
          <ImageCarousel uris={galleryUris} height={240} />

          <FormShake shakeKey={shake} haptic={false}>
            <View
              style={{
                paddingHorizontal: theme.spacing.lg,
                gap: theme.spacing.md,
                marginTop: theme.spacing.md,
              }}
            >
              {!isAdmin ? (
                <ListItemEnter index={nextIndex()}>
                  <OrderBoardCard
                    accent={orderLocked ? colors.error : colors.warning}
                    style={{
                      backgroundColor: orderLocked ? colors.errorSoft : colors.warningSoft,
                    }}
                  >
                    <OrderSectionHeader
                      icon="time-outline"
                      label={t('mobile.requestEdit.editWindow')}
                      accent={orderLocked ? colors.error : colors.warning}
                    />
                    <AppText variant="title" weight={titleWeight}>
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
                  </OrderBoardCard>
                </ListItemEnter>
              ) : null}

              <ListItemEnter index={nextIndex()}>
                <OrderBoardCard accent={colors.brand}>
                  <OrderSectionHeader
                    icon="receipt-outline"
                    label={t('mobile.requestEdit.sectionOrder')}
                  />
                  <LockedTextField
                    label={t('mobile.requestEdit.dealerPo')}
                    value={externalOrderNumber}
                    onChangeText={setExternalOrderNumber}
                    locked={fieldsLocked}
                    lockReason={fieldsLocked ? orderReason : undefined}
                  />
                  <AppText variant="caption" color="muted">
                    {t('mobile.requestEdit.priority')}
                  </AppText>
                  <View pointerEvents={fieldsLocked ? 'none' : 'auto'} style={{ opacity: fieldsLocked ? 0.55 : 1 }}>
                    <NewOrderPriorityBar value={priority} onChange={setPriority} />
                  </View>
                  <LockedTextField
                    label={t('mobile.requestEdit.quantity')}
                    value={quantity}
                    onChangeText={setQuantity}
                    locked={fieldsLocked}
                    lockReason={fieldsLocked ? orderReason : undefined}
                    keyboardType="decimal-pad"
                  />
                </OrderBoardCard>
              </ListItemEnter>

              <ListItemEnter index={nextIndex()}>
                <OrderBoardCard accent={colors.brand}>
                  <OrderSectionHeader
                    icon="person-outline"
                    label={t('mobile.requestEdit.sectionCustomer')}
                  />
                  <LockedTextField
                    label={t('mobile.requestEdit.customerName')}
                    value={endCustomerName}
                    onChangeText={setEndCustomerName}
                    locked={fieldsLocked}
                    lockReason={fieldsLocked ? orderReason : undefined}
                  />
                  {fieldsLocked ? (
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
                </OrderBoardCard>
              </ListItemEnter>

              <ListItemEnter index={nextIndex()}>
                <OrderBoardCard accent={colors.info}>
                  <OrderSectionHeader
                    icon="navigate-outline"
                    label={t('mobile.requestEdit.sectionDelivery')}
                    accent={colors.info}
                  />
                  {fieldsLocked ? (
                    <>
                      <LockedTextField
                        label={t('mobile.requestEdit.address')}
                        value={deliveryAddress}
                        onChangeText={setDeliveryAddress}
                        locked
                        lockReason={orderReason}
                        multiline
                      />
                      {deliveryLat != null ? (
                        <AppText variant="caption" color="muted">
                          {t('mobile.requestEdit.mapPinned')}
                        </AppText>
                      ) : null}
                      <LockedTextField
                        label={t('mobile.requestEdit.deliveryDate')}
                        value={requiredDeliveryDate || '—'}
                        onChangeText={() => undefined}
                        locked
                        lockReason={orderReason}
                      />
                    </>
                  ) : (
                    <>
                      <NewOrderDeliveryAddressBlock
                        savedAddresses={[]}
                        deliveryAddress={deliveryAddress}
                        deliveryNotes={deliveryNotes}
                        deliveryLat={deliveryLat}
                        notesMax={200}
                        onOpenSavedAddresses={() => undefined}
                        onChangeAddress={setDeliveryAddress}
                        onClearCoords={() => {
                          setDeliveryLat(undefined);
                          setDeliveryLng(undefined);
                        }}
                        onOpenMap={() => setMapOpen(true)}
                        onChangeNotes={setDeliveryNotes}
                      />
                      <DeliveryAvailabilityCard
                        display={availabilityDisplay}
                        requestedDeliveryDate={requiredDeliveryDate}
                        onChangeDate={setRequiredDeliveryDate}
                        updating={availabilityUpdating}
                      />
                    </>
                  )}
                </OrderBoardCard>
              </ListItemEnter>

              <ListItemEnter index={nextIndex()}>
                <OrderBoardCard accent={colors.brand}>
                  <OrderSectionHeader
                    icon="color-palette-outline"
                    label={t('mobile.requestEdit.sectionSpecs')}
                  />
                  <LockedTextField
                    label={t('mobile.requestEdit.fabric')}
                    value={fabric}
                    onChangeText={setFabric}
                    locked={fieldsLocked || fabricLocked}
                    lockReason={
                      fieldsLocked ? orderReason : fabricLocked ? fabricReason : undefined
                    }
                  />
                  <LockedTextField
                    label={t('mobile.requestEdit.fabricDescription')}
                    value={fabricDescription}
                    onChangeText={setFabricDescription}
                    locked={fieldsLocked || fabricLocked}
                    lockReason={
                      fieldsLocked ? orderReason : fabricLocked ? fabricReason : undefined
                    }
                    multiline
                  />
                  {fieldsLocked ? (
                    <LockedTextField
                      label={t('mobile.requestEdit.dimensions')}
                      value={formatDimensionsNotes(dimensions) || '—'}
                      onChangeText={() => undefined}
                      locked
                      lockReason={orderReason}
                      multiline
                    />
                  ) : (
                    <NewOrderDimensionsEditor value={dimensions} onChange={setDimensions} />
                  )}
                  <LockedTextField
                    label={t('mobile.requestEdit.notes')}
                    value={orderNotes}
                    onChangeText={setOrderNotes}
                    locked={fieldsLocked}
                    lockReason={fieldsLocked ? orderReason : undefined}
                    multiline
                  />
                </OrderBoardCard>
              </ListItemEnter>

              <ListItemEnter index={nextIndex()}>
                <OrderBoardCard>
                  <OrderSectionHeader
                    icon="attach-outline"
                    label={t('mobile.requestEdit.sectionAttachments')}
                  />
                  {(detail.documents ?? []).length === 0 ? (
                    <AppText variant="caption" color="muted">
                      {t('mobile.requestEdit.attachmentsEmpty')}
                    </AppText>
                  ) : (
                    (detail.documents ?? []).map((doc) => (
                      <Pressable
                        key={doc.id}
                        onPress={() => {
                          void (async () => {
                            try {
                              const url = await resolveDocumentUrl(doc.id);
                              await Linking.openURL(url);
                            } catch {
                              setError(t('mobile.requestEdit.openFailed'));
                            }
                          })();
                        }}
                        style={{
                          paddingVertical: theme.spacing.sm,
                          borderBottomWidth: 1,
                          borderBottomColor: colors.border,
                        }}
                      >
                        <AppText variant="body" color="brand" numberOfLines={1}>
                          {doc.fileName}
                        </AppText>
                      </Pressable>
                    ))
                  )}
                  {!fieldsLocked ? (
                    <View
                      style={{
                        flexDirection: isRTL ? 'row-reverse' : 'row',
                        gap: theme.spacing.sm,
                        marginTop: theme.spacing.sm,
                      }}
                    >
                      {(
                        [
                          {
                            key: 'photo',
                            icon: 'image-outline' as const,
                            label: t('mobile.requestEdit.attachPhoto'),
                            onPress: () => void attachPhoto(),
                          },
                          {
                            key: 'file',
                            icon: 'document-outline' as const,
                            label: t('mobile.requestEdit.attachFile'),
                            onPress: () => void attachDocument(),
                          },
                        ] as const
                      ).map((action) => (
                        <AnimatedPressable
                          key={action.key}
                          variant="button"
                          accessibilityRole="button"
                          accessibilityLabel={action.label}
                          disabled={uploadMutation.isPending}
                          onPress={() => {
                            void haptics.selection();
                            action.onPress();
                          }}
                          style={{
                            flex: 1,
                            minHeight: theme.sizes.touch.min,
                            borderRadius: theme.radius.lg,
                            borderWidth: 1,
                            borderColor: colors.borderStrong,
                            backgroundColor: colors.brandSoft,
                            paddingVertical: theme.spacing.md,
                            paddingHorizontal: theme.spacing.sm,
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            opacity: uploadMutation.isPending ? 0.55 : 1,
                          }}
                        >
                          <View
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 18,
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: colors.surface,
                              borderWidth: 1,
                              borderColor: colors.border,
                            }}
                          >
                            <Ionicons name={action.icon} size={18} color={colors.brand} />
                          </View>
                          <AppText
                            variant="caption"
                            weight="semibold"
                            style={{ color: colors.brand, textAlign: 'center' }}
                            numberOfLines={1}
                          >
                            {action.label}
                          </AppText>
                        </AnimatedPressable>
                      ))}
                    </View>
                  ) : null}
                </OrderBoardCard>
              </ListItemEnter>

              {error ? (
                <AppText variant="caption" color="error">
                  {error}
                </AppText>
              ) : null}
            </View>
          </FormShake>
        </ScrollView>

        <View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: stickyBottom,
            paddingHorizontal: theme.spacing.lg,
            paddingTop: theme.spacing.sm,
            paddingBottom: theme.spacing.md,
          }}
        >
          <View
            style={{
              borderRadius: theme.radius.xl,
              borderWidth: 1,
              borderColor: colors.borderStrong,
              backgroundColor: colors.surface,
              padding: theme.spacing.md,
              ...orderBoardShadow(colorScheme),
            }}
          >
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                gap: theme.spacing.sm,
              }}
            >
              <View style={{ flex: 1 }}>
                <SecondaryButton label={t('mobile.requestEdit.back')} onPress={goBack} />
              </View>
              <View style={{ flex: 1 }}>
                <PrimaryButton
                  label={t('mobile.requestEdit.save')}
                  onPress={() => void save()}
                  loading={busy}
                  disabled={!canUpdate || orderLocked}
                />
              </View>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>

      <LocationMapPicker
        open={mapOpen}
        initial={
          deliveryLat != null && deliveryLng != null
            ? { latitude: deliveryLat, longitude: deliveryLng }
            : null
        }
        onClose={() => setMapOpen(false)}
        onConfirm={(coords) => {
          setDeliveryLat(coords.latitude);
          setDeliveryLng(coords.longitude);
          setDeliveryAddress(
            coords.address?.trim() ||
              `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`,
          );
          setMapOpen(false);
        }}
        onClear={() => {
          setDeliveryLat(undefined);
          setDeliveryLng(undefined);
        }}
      />
    </AppScreen>
  );
}
