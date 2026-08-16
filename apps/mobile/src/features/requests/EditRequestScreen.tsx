import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { can } from '@maher/permissions';
import { isApiError } from '@/api/errors';
import {
  createCustomerAddress,
  listCustomerAddresses,
  type CustomerAddress,
} from '@/api/modules/customers';
import {
  getRequest,
  submitRequest,
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
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { useToast, toastCopy } from '@/components/feedback/Toast';
import { LockedTextField } from '@/components/forms/LockedTextField';
import { PhoneField } from '@/components/forms/PhoneField';
import { AppScreen } from '@/components/layout/AppScreen';
import { LocationMapPicker } from '@/components/maps/LocationMapPicker';
import { useLocale } from '@/i18n';
import { FormShake, haptics, ListItemEnter } from '@/motion';
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
import { DeliveryFavoriteSummary } from './components/DeliveryFavoriteSummary';
import { NewOrderDeliveryAddressBlock } from './components/NewOrderDeliveryAddressBlock';
import { NewOrderDimensionsEditor } from './components/NewOrderDimensionsEditor';
import { NewOrderPriorityBar } from './components/NewOrderPriorityBar';
import { SavedAddressPickerSheet } from './components/SavedAddressPickerSheet';
import { SaveAddressSheet } from './components/SaveAddressSheet';
import { UploadsStep } from './components/UploadsStep';
import {
  emptyDimensionFields,
  formatDimensionsNotes,
  parseDimNumber,
  toRequestCustomMeasurements,
  type NewOrderDimensionFields,
} from './newOrderMeasurements';
import {
  composeRequestNotes,
  formatAddressLine,
  guessCityFromAddress,
  isAddressAlreadySaved,
  isValidOptionalDate,
  isValidOptionalPhone,
} from './newOrderValidation';
import {
  isPdfMime,
  type AttachmentCategory,
  type AttachmentKind,
  type PendingAttachment,
} from './pendingAttachment';
import { selectDeliveryAvailability, toDeliveryYmd } from './selectDeliveryAvailability';
import type { RequestDocument, RequestItem } from './types';

function categoryFromDoc(doc: RequestDocument): AttachmentCategory {
  const cat = (doc.category ?? '').toUpperCase();
  if (cat === 'HANDWRITTEN_ORDER') return 'HANDWRITTEN_ORDER';
  if (cat === 'ORDER_DOCUMENT') return 'ORDER_DOCUMENT';
  if (cat === 'ORDER_IMAGE') return 'ORDER_IMAGE';
  const mime = (doc.mimeType ?? '').toLowerCase();
  if (isPdfMime(mime) || mime.includes('pdf') || /\.pdf$/i.test(doc.fileName ?? '')) {
    return 'ORDER_DOCUMENT';
  }
  return 'ORDER_IMAGE';
}

function kindFromCategory(category: AttachmentCategory): AttachmentKind {
  if (category === 'HANDWRITTEN_ORDER') return 'handwritten';
  if (category === 'ORDER_DOCUMENT') return 'pdf';
  return 'gallery';
}
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
  const { showToast } = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();
  const allowed = can(user, 'request.read');
  const canUpdate = can(user, 'request.update');
  const canUpload = can(user, 'document.manage');
  const isAdmin = variant === 'admin';
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const stickyBottom = isAdmin ? SURFACE_TAB_BAR_CLEARANCE : DEALER_TAB_BAR_CLEARANCE;

  const query = useQuery({
    queryKey: queryKeys.requests.detail(requestId),
    queryFn: () => getRequest(requestId),
    enabled: allowed && Boolean(requestId),
    refetchInterval: 30_000,
  });

  const detail = query.data;
  const policy = detail?.editPolicy;
  const item = detail?.items?.[0];
  const isDraft = detail?.status === 'DRAFT';
  const addressCustomerId = user?.customerId ?? detail?.customer?.id ?? null;
  const canReadAddresses = Boolean(addressCustomerId && can(user, 'customer.read'));
  const canSaveAddresses = Boolean(addressCustomerId && can(user, 'address.manage'));
  const stickyPad = stickyBottom + (isDraft && canUpdate ? 180 : 120);

  const [shake, setShake] = useState(0);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [mapOpen, setMapOpen] = useState(false);
  const [addressSheetOpen, setAddressSheetOpen] = useState(false);
  const [saveAddressSheetOpen, setSaveAddressSheetOpen] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [saveAddressError, setSaveAddressError] = useState<string | null>(null);
  const [savedAddresses, setSavedAddresses] = useState<CustomerAddress[]>([]);
  const [galleryUris, setGalleryUris] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const attachmentsRef = useRef(attachments);
  attachmentsRef.current = attachments;
  const uploadAbort = useRef<AbortController | null>(null);
  const uploadInFlight = useRef(false);
  const uploadQueueTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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
    if (!canReadAddresses || !addressCustomerId) {
      setSavedAddresses([]);
      return;
    }
    let cancelled = false;
    void listCustomerAddresses(addressCustomerId)
      .then((rows) => {
        if (!cancelled) setSavedAddresses(rows);
      })
      .catch(() => {
        if (!cancelled) setSavedAddresses([]);
      });
    return () => {
      cancelled = true;
    };
  }, [canReadAddresses, addressCustomerId]);

  const openSaveAddressSheet = () => {
    if (!canSaveAddresses) return;
    if (!deliveryAddress.trim()) {
      setError(t('mobile.newOrder.saveAddressNeedAddress'));
      setShake((n) => n + 1);
      return;
    }
    setSaveAddressError(null);
    setSaveAddressSheetOpen(true);
  };

  const saveCurrentAddress = async (input: {
    label: string;
    isDefaultDelivery: boolean;
  }) => {
    if (!addressCustomerId || !canSaveAddresses) return;
    const address = deliveryAddress.trim();
    if (!address) {
      setSaveAddressError(t('mobile.newOrder.saveAddressNeedAddress'));
      return;
    }
    setSavingAddress(true);
    setSaveAddressError(null);
    try {
      const created = await createCustomerAddress(addressCustomerId, {
        label: input.label,
        city: guessCityFromAddress(address),
        street: address,
        country: 'JO',
        latitude: deliveryLat,
        longitude: deliveryLng,
        isDefaultDelivery: input.isDefaultDelivery || savedAddresses.length === 0,
      });
      setSavedAddresses((prev) => {
        const cleared = input.isDefaultDelivery
          ? prev.map((a) => ({ ...a, isDefaultDelivery: false }))
          : prev;
        return [created, ...cleared.filter((a) => a.id !== created.id)];
      });
      void haptics.confirmMedium();
      setSaveAddressSheetOpen(false);
    } catch {
      setSaveAddressError(t('mobile.newOrder.saveAddressFailed'));
      void haptics.error();
    } finally {
      setSavingAddress(false);
    }
  };

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function hydrateAttachments() {
      if (!detail) {
        setAttachments([]);
        setGalleryUris([]);
        return;
      }
      const uris: string[] = [];
      const hero = resolveOrderMediaUri(detail.imageUrl);
      if (hero) uris.push(hero);

      const localPending = attachmentsRef.current.filter(
        (a) =>
          !a.documentId &&
          (a.status === 'ready' ||
            a.status === 'uploading' ||
            a.status === 'error' ||
            a.status === 'cancelled'),
      );

      const mapped: PendingAttachment[] = [];
      for (const doc of detail.documents ?? []) {
        const mime = (doc.mimeType ?? 'application/octet-stream').toLowerCase();
        const name = (doc.fileName ?? '').toLowerCase();
        const isImage =
          mime.startsWith('image/') ||
          /\.(jpe?g|png|gif|webp|heic|heif|bmp)$/.test(name);
        let uri = '';
        try {
          uri = await resolveDocumentUrl(doc.id);
          if (isImage && uri && !uris.includes(uri)) uris.push(uri);
        } catch {
          // skip failed signed URLs
        }
        const category = categoryFromDoc(doc);
        mapped.push({
          id: doc.id,
          uri: uri || 'file://placeholder',
          fileName: doc.fileName,
          mimeType: doc.mimeType ?? 'application/octet-stream',
          category,
          kind: kindFromCategory(category),
          status: 'uploaded',
          progress: 1,
          documentId: doc.id,
        });
      }

      if (!cancelled) {
        setGalleryUris(uris);
        setAttachments([...mapped, ...localPending]);
      }
    }
    void hydrateAttachments();
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

  const patchAttachment = (id: string, patch: Partial<PendingAttachment>) => {
    setAttachments((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  };

  const uploadOne = async (file: PendingAttachment, signal: AbortSignal) => {
    patchAttachment(file.id, { status: 'uploading', progress: 0.05, errorMessage: undefined });
    try {
      const uploaded = await uploadFile(
        {
          uri: file.uri,
          fileName: file.fileName,
          mimeType: file.mimeType,
          category: file.category,
          requestId,
        },
        {
          signal,
          onProgress: (ratio) => patchAttachment(file.id, { progress: ratio }),
        },
      );
      patchAttachment(file.id, {
        status: 'uploaded',
        progress: 1,
        storageKey: uploaded.document.storageKey,
        documentId: uploaded.document.id,
      });
      return true;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        patchAttachment(file.id, { status: 'cancelled', progress: 0 });
        return false;
      }
      patchAttachment(file.id, {
        status: 'error',
        progress: 0,
        errorMessage: err instanceof Error ? err.message : t('mobile.requestEdit.uploadFailed'),
      });
      setError(err instanceof Error ? err.message : t('mobile.requestEdit.uploadFailed'));
      return false;
    }
  };

  const uploadAll = async () => {
    if (!canUpload) return true;
    const pending = attachmentsRef.current.filter(
      (a) => a.status === 'ready' || a.status === 'error' || a.status === 'cancelled',
    );
    if (!pending.length) return true;
    if (uploadInFlight.current) {
      uploadAbort.current?.abort();
    }
    const controller = new AbortController();
    uploadAbort.current = controller;
    uploadInFlight.current = true;
    setUploading(true);
    try {
      for (const file of pending) {
        if (controller.signal.aborted) break;
        await uploadOne(file, controller.signal);
      }
      const failed = attachmentsRef.current.some((a) => a.status === 'error');
      if (!failed) {
        setError(null);
        await invalidate();
      }
      return !failed;
    } finally {
      uploadInFlight.current = false;
      setUploading(false);
    }
  };

  const cancelUploads = () => {
    uploadAbort.current?.abort();
    uploadInFlight.current = false;
    setUploading(false);
    setAttachments((prev) =>
      prev.map((a) =>
        a.status === 'uploading' ? { ...a, status: 'cancelled', progress: 0 } : a,
      ),
    );
  };

  const retryOne = (id: string) => {
    const file = attachmentsRef.current.find((a) => a.id === id);
    if (!file) return;
    patchAttachment(id, { status: 'ready', progress: 0, errorMessage: undefined });
    void (async () => {
      uploadAbort.current?.abort();
      const controller = new AbortController();
      uploadAbort.current = controller;
      setUploading(true);
      await uploadOne({ ...file, status: 'ready', progress: 0 }, controller.signal);
      setUploading(false);
      if (attachmentsRef.current.every((a) => a.status === 'uploaded' || a.id !== id)) {
        await invalidate();
      }
    })();
  };

  const overallProgress =
    attachments.length === 0
      ? 0
      : attachments.reduce((sum, a) => sum + (a.status === 'uploaded' ? 1 : a.progress), 0) /
        attachments.length;

  const persistFields = async () => {
    if (!canUpdate || !detail) return;
    if (orderLocked) {
      setError(orderReason);
      setShake((n) => n + 1);
      void haptics.error();
      throw new Error(orderReason);
    }
    if (endCustomerPhone.trim() && !isValidOptionalPhone(endCustomerPhone)) {
      setError(t('mobile.newOrder.errors.phoneInvalid'));
      setShake((n) => n + 1);
      void haptics.error();
      throw new Error(t('mobile.newOrder.errors.phoneInvalid'));
    }
    if (requiredDeliveryDate.trim() && !isValidOptionalDate(requiredDeliveryDate)) {
      setError(t('mobile.newOrder.errors.dateInvalid'));
      setShake((n) => n + 1);
      void haptics.error();
      throw new Error(t('mobile.newOrder.errors.dateInvalid'));
    }

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
  };

  const save = async () => {
    if (!canUpdate || !detail) return;
    setBusy(true);
    setError(null);
    try {
      await persistFields();
      await uploadAll();
      void haptics.confirmMedium();
      showToast({
        variant: 'success',
        message: toastCopy(
          t('mobile.requestEdit.savedTitle'),
          t('mobile.requestEdit.savedBody'),
        ),
      });
      await invalidate();
    } catch (err) {
      if (
        isApiError(err) &&
        (err.code === 'ORDER_LOCKED' || err.code === 'FABRIC_LOCKED' || err.status === 409)
      ) {
        setError(err.message);
        await query.refetch();
      } else if (!(err instanceof Error && err.message === orderReason)) {
        setError(err instanceof Error ? err.message : t('mobile.requestEdit.saveFailed'));
      }
      setShake((n) => n + 1);
      void haptics.error();
    } finally {
      setBusy(false);
    }
  };

  const submitDraft = async () => {
    if (!canUpdate || !detail || !isDraft || busy || uploading) return;
    setBusy(true);
    setError(null);
    try {
      await persistFields();
      const uploadsOk = await uploadAll();
      if (!uploadsOk) {
        setError(t('mobile.requestEdit.submitFailed'));
        setShake((n) => n + 1);
        void haptics.error();
        return;
      }
      const submitted = await submitRequest(detail.id);
      void haptics.confirmMedium();
      showToast({
        variant: 'success',
        message: toastCopy(
          t('mobile.requestEdit.submittedTitle'),
          t('mobile.requestEdit.submittedBody', { number: submitted.number }),
        ),
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.requests.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.salesOrders.all }),
      ]);
      router.replace('/(app)/(customer)/(tabs)/orders' as never);
    } catch (err) {
      if (
        isApiError(err) &&
        (err.code === 'ORDER_LOCKED' || err.code === 'FABRIC_LOCKED' || err.status === 409)
      ) {
        setError(err.message);
        await query.refetch();
      } else {
        setError(err instanceof Error ? err.message : t('mobile.requestEdit.submitFailed'));
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
      <View style={{ flex: 1 }}>
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
          automaticallyAdjustKeyboardInsets
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
                      <DeliveryFavoriteSummary
                        deliveryAddress={deliveryAddress}
                        savedAddresses={savedAddresses}
                        footer={
                          deliveryLat != null
                            ? t('mobile.requestEdit.mapPinned')
                            : null
                        }
                      />
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
                        savedAddresses={savedAddresses}
                        deliveryAddress={deliveryAddress}
                        deliveryNotes={deliveryNotes}
                        deliveryLat={deliveryLat}
                        notesMax={200}
                        canSaveAddress={canSaveAddresses}
                        onOpenSavedAddresses={() => setAddressSheetOpen(true)}
                        onSaveAddress={openSaveAddressSheet}
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
                  {!fieldsLocked ? (
                    <UploadsStep
                      attachments={attachments}
                      onChange={(next) => {
                        attachmentsRef.current = next;
                        setAttachments(next);
                      }}
                      canUpload={canUpload}
                      error={error}
                      overallProgress={overallProgress}
                      uploading={uploading}
                      onUploadAll={() => void uploadAll()}
                      onAttachmentsQueued={() => {
                        if (uploadQueueTimer.current) clearTimeout(uploadQueueTimer.current);
                        uploadQueueTimer.current = setTimeout(() => {
                          uploadQueueTimer.current = null;
                          void uploadAll();
                        }, 250);
                      }}
                      onCancelUploads={cancelUploads}
                      onRetry={retryOne}
                      showTitle={false}
                    />
                  ) : (detail.documents ?? []).length === 0 ? (
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
                  loading={busy && !uploading}
                  disabled={!canUpdate || orderLocked || uploading}
                />
              </View>
            </View>
            {isDraft && canUpdate && !orderLocked ? (
              <View style={{ marginTop: theme.spacing.sm }}>
                <PrimaryButton
                  label={t('mobile.requestEdit.submit')}
                  onPress={() => void submitDraft()}
                  loading={busy}
                  disabled={busy || uploading}
                />
              </View>
            ) : null}
          </View>
        </View>
      </View>

      <SavedAddressPickerSheet
        open={addressSheetOpen}
        onClose={() => setAddressSheetOpen(false)}
        addresses={savedAddresses}
        selectedLine={deliveryAddress}
        canSaveCurrent={
          canSaveAddresses &&
          deliveryAddress.trim().length > 0 &&
          !isAddressAlreadySaved(deliveryAddress, savedAddresses)
        }
        onSaveCurrent={openSaveAddressSheet}
        onSelect={(addr) => {
          setDeliveryAddress(formatAddressLine(addr));
          setDeliveryLat(addr.latitude ?? undefined);
          setDeliveryLng(addr.longitude ?? undefined);
        }}
      />

      <SaveAddressSheet
        open={saveAddressSheetOpen}
        onClose={() => {
          if (savingAddress) return;
          setSaveAddressSheetOpen(false);
          setSaveAddressError(null);
        }}
        addressLine={deliveryAddress}
        pinned={deliveryLat != null}
        defaultAsFirst={savedAddresses.length === 0}
        saving={savingAddress}
        error={saveAddressError}
        onSave={(input) => {
          void saveCurrentAddress(input);
        }}
      />

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
