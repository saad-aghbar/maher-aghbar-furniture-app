import { useEffect, useRef, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { can } from '@maher/permissions';
import { extractPreview, linkAiJobToRequest } from '@/api/modules/ai-intake';
import {
  createCustomerAddress,
  listCustomerAddresses,
  type CustomerAddress,
} from '@/api/modules/customers';
import {
  createRequest,
  getRequest,
  submitRequest,
  updateRequest,
  type CreateRequestInput,
  type RequestPriority,
} from '@/api/modules/requests';
import { uploadFile } from '@/api/modules/uploads';
import { queryKeys } from '@/api/queryKeys';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { EmptyState } from '@/components/feedback/EmptyState';
import { TextField } from '@/components/forms/TextField';
import { PhoneField } from '@/components/forms/PhoneField';
import { KeyboardAwareScreen } from '@/components/layout/KeyboardAwareScreen';
import { ConfirmationSheet } from '@/components/sheets/ConfirmationSheet';
import { useLocale } from '@/i18n';
import { FadeIn, FormShake, SlideIn, haptics } from '@/motion';
import { dealerTokens, useTheme } from '@/theme';
import { useBrowseProductQuery, useFavoriteProductsQuery, usePreviouslyOrderedQuery } from '@/features/catalog/query';
import { useAvailabilityQuery } from '@/features/scheduling/query';
import type { AvailabilityRequest } from '@/api/modules/scheduling';
import { catalogPickForOrderHref } from '@/features/catalog/catalogPickForOrder';
import {
  isCatalogOrderDeepLink,
  parseDeepLinkProductId,
  parseDeepLinkQty,
} from '@/features/catalog/newOrderDeepLink';
import { useDealerFavorites } from '@/features/catalog/useDealerFavorites';
import {
  DealerGlassCard,
  DealerSectionHeader,
} from '@/features/dealer-ui';
import { DeliveryAvailabilityCard } from './components/DeliveryAvailabilityCard';
import { selectDeliveryAvailability } from './selectDeliveryAvailability';
import {
  type DealerAiIntakeState,
  previewNeedsInfo,
} from './aiIntakeHumanState';
import { LocationMapPicker } from './components/LocationMapPicker';
import { NewOrderDeliveryAddressBlock } from './components/NewOrderDeliveryAddressBlock';
import { NewOrderDimensionsEditor } from './components/NewOrderDimensionsEditor';
import { NewOrderFloatingDock } from './components/NewOrderFloatingDock';
import { NewOrderQtyStepper } from './components/NewOrderQtyStepper';
import { NewOrderPriorityBar } from './components/NewOrderPriorityBar';
import { NewOrderStageRail } from './components/NewOrderStageRail';
import { ProductQuickPickSheet } from './components/ProductQuickPickSheet';
import { ReviewStep } from './components/ReviewStep';
import { SavedAddressPickerSheet } from './components/SavedAddressPickerSheet';
import { SaveAddressSheet } from './components/SaveAddressSheet';
import { UploadsStep } from './components/UploadsStep';
import {
  clearLocalDraft,
  loadLocalDraft,
  saveLocalDraft,
  type NewOrderLocalDraft,
} from './newOrderDraft';
import { newOrderDockMode, newOrderDockScrollPad } from './newOrderDockMode';
import {
  emptyDimensionFields,
  formatDimensionsNotes,
  parseDimNumber,
  seedDimensionsFromProduct,
  toRequestCustomMeasurements,
  type NewOrderDimensionFields,
} from './newOrderMeasurements';
import {
  clampOrderQuantity,
  isCustomCatalogProduct,
} from './newOrderProductKind';
import { resolveExternalOrderNumber } from './resolveExternalOrderNumber';
import { clampWizardStep, type NewOrderStep } from './newOrderSteps';
import type { PendingAttachment } from './pendingAttachment';
import {
  clampNotes,
  composeRequestNotes,
  formatAddressLine,
  guessCityFromAddress,
  isAddressAlreadySaved,
  isValidDeliveryAddress,
  isValidOptionalDate,
  isValidOptionalPhone,
  isValidQuantity,
  resolveModelName,
} from './newOrderValidation';

const NOTES_MAX = 200;
const FABRIC_DESC_MAX = 300;

export function NewOrderScreen() {
  const { user } = useAuth();
  const { t, locale, isRTL, formatCurrency } = useLocale();
  const { colors, theme } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{
    productId?: string;
    qty?: string;
    fromCatalog?: string;
  }>();
  const fromCatalog = isCatalogOrderDeepLink(params);
  const catalogProductId = parseDeepLinkProductId(params.productId);
  const catalogQty = parseDeepLinkQty(params.qty);
  const catalogDeepLinkKey = fromCatalog ? `${catalogProductId}:${catalogQty}` : '';
  const allowed = can(user, 'request.create');
  const canUpload = can(user, 'document.manage');
  const canAi = can(user, 'request.create') || can(user, 'ai-intake.manage');
  const canReadAddresses = Boolean(user?.customerId && can(user, 'customer.read'));
  const canSaveAddresses = Boolean(user?.customerId && can(user, 'address.manage'));

  const [step, setStep] = useState<NewOrderStep>(1);
  const [shake, setShake] = useState(0);
  const [hydrated, setHydrated] = useState(false);

  const [productId, setProductId] = useState(catalogProductId);
  const [customProductName, setCustomProductName] = useState('');
  const [quantity, setQuantity] = useState(fromCatalog ? catalogQty : '1');
  const [externalOrderNumber, setExternalOrderNumber] = useState('');
  const [priority, setPriority] = useState<RequestPriority>('NORMAL');

  const [fabric, setFabric] = useState('');
  const [fabricDescription, setFabricDescription] = useState('');
  const [dimensions, setDimensions] = useState<NewOrderDimensionFields>(emptyDimensionFields);
  const [orderNotes, setOrderNotes] = useState('');

  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [endCustomerName, setEndCustomerName] = useState('');
  const [endCustomerPhone, setEndCustomerPhone] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [deliveryLat, setDeliveryLat] = useState<number | undefined>();
  const [deliveryLng, setDeliveryLng] = useState<number | undefined>();
  const [requiredDeliveryDate, setRequiredDeliveryDate] = useState('');
  const [savedAddresses, setSavedAddresses] = useState<CustomerAddress[]>([]);
  const [mapOpen, setMapOpen] = useState(false);

  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [aiJobId, setAiJobId] = useState<string | null>(null);
  const [aiState, setAiState] = useState<DealerAiIntakeState>('idle');

  const [pickSheet, setPickSheet] = useState<'favorites' | 'ordered' | null>(null);
  const [addressSheetOpen, setAddressSheetOpen] = useState(false);
  const [saveAddressSheetOpen, setSaveAddressSheetOpen] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [saveAddressError, setSaveAddressError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftSaved, setDraftSaved] = useState<{ id: string; number: string } | null>(null);
  const [submittedNumber, setSubmittedNumber] = useState<string | null>(null);
  const [draftSavedNumber, setDraftSavedNumber] = useState<string | null>(null);
  const [successKey, setSuccessKey] = useState(0);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false);

  const productQuery = useBrowseProductQuery(productId || undefined, Boolean(productId));
  const favorites = useDealerFavorites(user?.id);
  const orderedQuery = usePreviouslyOrderedQuery(Boolean(user?.customerId));
  const favoriteProductsQuery = useFavoriteProductsQuery(
    favorites.favoriteIds,
    Boolean(user?.id) && favorites.ready,
  );
  const skipLocalSave = useRef(true);
  const submitLock = useRef(false);
  const uploadAbort = useRef<AbortController | null>(null);
  const uploadQueueTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const uploadInFlight = useRef(false);
  const attachmentsRef = useRef(attachments);
  attachmentsRef.current = attachments;
  const resolvedNameRef = useRef('');
  const appliedCatalogKey = useRef('');

  const dimensionsNotes = formatDimensionsNotes(dimensions);
  const appliedDimsProduct = useRef<string>('');

  useEffect(() => {
    const onShow = () => setKeyboardOpen(true);
    const onHide = () => setKeyboardOpen(false);
    const willShow = Keyboard.addListener('keyboardWillShow', onShow);
    const didShow = Keyboard.addListener('keyboardDidShow', onShow);
    const willHide = Keyboard.addListener('keyboardWillHide', onHide);
    const didHide = Keyboard.addListener('keyboardDidHide', onHide);
    return () => {
      willShow.remove();
      didShow.remove();
      willHide.remove();
      didHide.remove();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const local = await loadLocalDraft();
      if (cancelled) return;

      const restoreServerDraft = async (id: string, number: string) => {
        try {
          await getRequest(id);
          if (!cancelled) setDraftSaved({ id, number });
        } catch {
          // Draft RFQ was wiped (e.g. db:seed:demo) — keep form fields, drop stale id.
          if (!cancelled) setDraftSaved(null);
        }
      };

      // Catalog deep-link product/qty is applied in a separate effect so it
      // also runs when New Order was already mounted (tabs keep screens alive).
      if (local && !fromCatalog) {
        setStep(clampWizardStep(local.step));
        setProductId(local.productId || '');
        setCustomProductName(local.customProductName);
        setQuantity(local.quantity || '1');
        setExternalOrderNumber(local.externalOrderNumber);
        setPriority(local.priority);
        setFabric(local.fabric);
        setFabricDescription(local.fabricDescription);
        setDimensions({
          width: local.dimWidth || '',
          height: local.dimHeight || '',
          depth: local.dimDepth || '',
          seat: local.dimSeat || '',
          custom: local.customMeasurements ?? [],
        });
        setOrderNotes(local.orderNotes);
        setDeliveryAddress(local.deliveryAddress);
        setEndCustomerName(local.endCustomerName);
        setEndCustomerPhone(local.endCustomerPhone);
        setDeliveryNotes(local.deliveryNotes);
        setDeliveryLat(local.deliveryLat);
        setDeliveryLng(local.deliveryLng);
        setRequiredDeliveryDate(local.requiredDeliveryDate || '');
        if (local.serverDraftId && local.serverDraftNumber) {
          await restoreServerDraft(local.serverDraftId, local.serverDraftNumber);
        }
      } else if (local && fromCatalog) {
        // Keep non-product draft fields so returning dealers don't retype delivery/etc.
        setExternalOrderNumber(local.externalOrderNumber);
        setPriority(local.priority);
        setFabric(local.fabric);
        setFabricDescription(local.fabricDescription);
        setDimensions({
          width: local.dimWidth || '',
          height: local.dimHeight || '',
          depth: local.dimDepth || '',
          seat: local.dimSeat || '',
          custom: local.customMeasurements ?? [],
        });
        setOrderNotes(local.orderNotes);
        setDeliveryAddress(local.deliveryAddress);
        setEndCustomerName(local.endCustomerName);
        setEndCustomerPhone(local.endCustomerPhone);
        setDeliveryNotes(local.deliveryNotes);
        setDeliveryLat(local.deliveryLat);
        setDeliveryLng(local.deliveryLng);
        setRequiredDeliveryDate(local.requiredDeliveryDate || '');
        if (local.serverDraftId && local.serverDraftNumber) {
          await restoreServerDraft(local.serverDraftId, local.serverDraftNumber);
        }
      }

      setHydrated(true);
      skipLocalSave.current = false;
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Catalog PDP → New Order: apply product + qty whenever deep-link params arrive
  // (including when this tab screen was already mounted).
  useEffect(() => {
    if (!hydrated || !fromCatalog || !catalogProductId) return;
    if (appliedCatalogKey.current === catalogDeepLinkKey) return;
    appliedCatalogKey.current = catalogDeepLinkKey;
    setProductId(catalogProductId);
    setQuantity(catalogQty);
    setCustomProductName('');
    setStep(2);
    setSubmittedNumber(null);
  }, [hydrated, fromCatalog, catalogProductId, catalogQty, catalogDeepLinkKey]);

  useEffect(() => {
    if (!productQuery.data || customProductName.trim()) return;
    const p = productQuery.data;
    const name =
      locale === 'ar' ? p.nameAr || p.nameEn : locale === 'he' ? p.nameHe || p.nameEn : p.nameEn;
    setCustomProductName(name || p.nameEn || p.nameAr || '');
  }, [productQuery.data, locale, customProductName]);

  // Seed structured measurements from catalog product (once per product, if empty).
  useEffect(() => {
    if (!productQuery.data || !hydrated) return;
    const id = productQuery.data.id;
    if (appliedDimsProduct.current === id) return;
    const hasAny =
      dimensions.width.trim() ||
      dimensions.height.trim() ||
      dimensions.depth.trim() ||
      dimensions.seat.trim() ||
      dimensions.custom.length > 0;
    if (hasAny) return;
    appliedDimsProduct.current = id;
    setDimensions(seedDimensionsFromProduct(productQuery.data, locale));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed once per product id
  }, [productQuery.data, hydrated, locale]);

  useEffect(() => {
    if (!hydrated || skipLocalSave.current || submittedNumber || draftSavedNumber) return;
    const payload: NewOrderLocalDraft = {
      version: 3,
      step,
      productId,
      customProductName,
      quantity,
      externalOrderNumber,
      priority,
      fabric,
      fabricDescription,
      dimensionsNotes,
      dimWidth: dimensions.width,
      dimHeight: dimensions.height,
      dimDepth: dimensions.depth,
      dimSeat: dimensions.seat,
      customMeasurements: dimensions.custom,
      orderNotes,
      deliveryAddress,
      endCustomerName,
      endCustomerPhone,
      deliveryNotes,
      deliveryLat,
      deliveryLng,
      requiredDeliveryDate,
      serverDraftId: draftSaved?.id,
      serverDraftNumber: draftSaved?.number,
      updatedAt: new Date().toISOString(),
    };
    const handle = setTimeout(() => {
      void saveLocalDraft(payload);
    }, 350);
    return () => clearTimeout(handle);
  }, [
    hydrated,
    step,
    productId,
    customProductName,
    quantity,
    externalOrderNumber,
    priority,
    fabric,
    fabricDescription,
    dimensionsNotes,
    dimensions,
    orderNotes,
    deliveryAddress,
    endCustomerName,
    endCustomerPhone,
    deliveryNotes,
    deliveryLat,
    deliveryLng,
    requiredDeliveryDate,
    draftSaved,
    submittedNumber,
    draftSavedNumber,
  ]);

  useEffect(() => {
    if (!canReadAddresses || !user?.customerId || !hydrated) return;
    let cancelled = false;
    void listCustomerAddresses(user.customerId)
      .then((rows) => {
        if (cancelled) return;
        setSavedAddresses(rows);
        const def = rows.find((a) => a.isDefaultDelivery) ?? rows[0];
        if (def && !deliveryAddress.trim()) {
          setDeliveryAddress(formatAddressLine(def));
          if (def.latitude != null) setDeliveryLat(def.latitude);
          if (def.longitude != null) setDeliveryLng(def.longitude);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canReadAddresses, user?.customerId, hydrated]);

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
    if (!user?.customerId || !canSaveAddresses) return;
    const address = deliveryAddress.trim();
    if (!address) {
      setSaveAddressError(t('mobile.newOrder.saveAddressNeedAddress'));
      return;
    }
    setSavingAddress(true);
    setSaveAddressError(null);
    try {
      const created = await createCustomerAddress(user.customerId, {
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

  const resolvedName = resolveModelName({
    customProductName,
    catalogName: productQuery.data
      ? locale === 'ar'
        ? productQuery.data.nameAr || productQuery.data.nameEn
        : locale === 'he'
          ? productQuery.data.nameHe || productQuery.data.nameEn
          : productQuery.data.nameEn
      : null,
  });
  resolvedNameRef.current = resolvedName;

  const unitPrice =
    productQuery.data?.price != null && Number.isFinite(Number(productQuery.data.price))
      ? Number(productQuery.data.price)
      : null;
  const qtyNum = Number(quantity);
  const estimatedTotal =
    unitPrice != null && Number.isFinite(qtyNum) && qtyNum > 0 ? unitPrice * qtyNum : null;
  const currency = productQuery.data?.priceCurrency || 'ILS';

  const availabilityRequest: AvailabilityRequest | null =
    productId.trim() && isValidQuantity(quantity)
      ? {
          items: [{ productId, quantity: clampOrderQuantity(quantity) }],
          requestedDeliveryDate:
            requiredDeliveryDate.trim() && isValidOptionalDate(requiredDeliveryDate)
              ? requiredDeliveryDate.trim()
              : undefined,
        }
      : null;
  const availabilityQuery = useAvailabilityQuery(availabilityRequest);
  const availabilityDisplay = selectDeliveryAvailability({
    hasItems: Boolean(availabilityRequest),
    // Cold start only — keepPreviousData must not flash the calendar to “checking”.
    isLoading: availabilityQuery.isLoading && !availabilityQuery.data,
    isError: availabilityQuery.isError,
    result: availabilityQuery.data,
    requestedDeliveryDate: requiredDeliveryDate.trim() || undefined,
  });
  const availabilityUpdating =
    availabilityQuery.isFetching && Boolean(availabilityQuery.data);  const requiredDeliveryDateError =
    requiredDeliveryDate.trim() && !isValidOptionalDate(requiredDeliveryDate)
      ? t('mobile.newOrder.errors.dateInvalid')
      : undefined;

  const overallProgress =
    attachments.length === 0
      ? 0
      : attachments.reduce((sum, a) => sum + (a.status === 'uploaded' ? 1 : a.progress), 0) /
        attachments.length;

  const fail = (message: string) => {
    setError(message);
    setShake((n) => n + 1);
    void haptics.error();
  };

  const validateStep1 = () => {
    if (!resolvedName) {
      fail(t('mobile.newOrder.errors.modelRequired'));
      return false;
    }
    if (!isValidQuantity(quantity)) {
      fail(t('mobile.newOrder.errors.quantityPositive'));
      return false;
    }
    setError(null);
    return true;
  };

  const validateStep3 = () => {
    if (!isValidDeliveryAddress(deliveryAddress)) {
      fail(t('mobile.newOrder.errors.deliveryRequired'));
      return false;
    }
    if (!isValidOptionalPhone(endCustomerPhone)) {
      fail(t('mobile.newOrder.errors.phoneInvalid'));
      return false;
    }
    if (!isValidOptionalDate(requiredDeliveryDate)) {
      fail(t('mobile.newOrder.errors.dateInvalid'));
      return false;
    }
    setError(null);
    return true;
  };

  const validateForSubmit = () => validateStep1() && validateStep3();

  const goNext = () => {
    if (step === 1 && !validateStep1()) return;
    if (step === 3 && !validateStep3()) return;
    void haptics.selection();
    setStep((s) => clampWizardStep(s + 1));
  };

  const goBack = () => {
    if (busy || uploading) return;
    void haptics.selection();
    if (step > 1) {
      setStep((s) => clampWizardStep(s - 1));
      return;
    }
    if (router.canGoBack()) router.back();
  };

  const patchAttachment = (id: string, patch: Partial<PendingAttachment>) => {
    setAttachments((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  };

  const runAiFor = async (file: PendingAttachment) => {
    if (!canAi || !canUpload || file.category !== 'HANDWRITTEN_ORDER') return;
    if (!file.storageKey) return;
    setAiState('reading');
    try {
      await new Promise((r) => setTimeout(r, 280));
      setAiState('understanding');
      const res = await extractPreview({
        storageKey: file.storageKey,
        mimeHint: file.mimeType,
        sourceType: 'IMAGE',
      });
      setAiState('preparing');
      setAiJobId(res.jobId);
      const preview = res.preview ?? {};
      const currentName = resolvedNameRef.current;
      if (preview.productName?.trim() && !currentName) {
        setCustomProductName(preview.productName.trim());
        setProductId('');
      }
      if (preview.quantity?.trim()) {
        setQuantity((v) => (v === '1' || !v.trim() ? preview.quantity!.trim() : v));
      }
      if (preview.notes?.trim()) {
        setOrderNotes((v) => v.trim() || clampNotes(preview.notes!.trim(), NOTES_MAX));
      }
      if (preview.fabric?.trim()) setFabric((v) => v.trim() || preview.fabric!.trim());
      if (preview.fabricDescription?.trim()) {
        setFabricDescription((v) =>
          v.trim() || clampNotes(preview.fabricDescription!.trim(), FABRIC_DESC_MAX),
        );
      }
      if (preview.deliveryAddress?.trim()) {
        setDeliveryAddress((v) => v.trim() || preview.deliveryAddress!.trim());
      }
      if (preview.endCustomerName?.trim()) {
        setEndCustomerName((v) => v.trim() || preview.endCustomerName!.trim());
      }
      setAiState(previewNeedsInfo(preview) ? 'needsInfo' : 'ready');
    } catch {
      // Preserve the upload even when intake fails.
      setAiState('failed');
    }
  };

  const uploadOne = async (
    file: PendingAttachment,
    requestId: string | undefined,
    signal: AbortSignal,
  ) => {
    patchAttachment(file.id, { status: 'uploading', progress: 0.05, errorMessage: undefined });
    if (file.category === 'HANDWRITTEN_ORDER') setAiState('uploading');
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
      const next: PendingAttachment = {
        ...file,
        status: 'uploaded',
        progress: 1,
        storageKey: uploaded.document.storageKey,
        documentId: uploaded.document.id,
      };
      if (file.category === 'HANDWRITTEN_ORDER') void runAiFor(next);
      return true;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        patchAttachment(file.id, { status: 'cancelled', progress: 0 });
        if (file.category === 'HANDWRITTEN_ORDER') setAiState('idle');
        return false;
      }
      patchAttachment(file.id, {
        status: 'error',
        progress: 0,
        errorMessage: err instanceof Error ? err.message : 'Upload failed',
      });
      if (file.category === 'HANDWRITTEN_ORDER') setAiState('failed');
      setError(err instanceof Error ? err.message : t('mobile.newOrder.uploadFailed'));
      return false;
    }
  };

  const uploadAll = async (requestId?: string) => {
    if (!canUpload) return true;
    const pending = attachmentsRef.current.filter(
      (a) => a.status === 'ready' || a.status === 'error' || a.status === 'cancelled',
    );
    if (!pending.length) return true;

    // Abort only an in-flight batch — avoid AbortError on a cold start.
    if (uploadInFlight.current) {
      uploadAbort.current?.abort();
    }
    const controller = new AbortController();
    uploadAbort.current = controller;
    uploadInFlight.current = true;
    setUploading(true);
    setError(null);
    try {
      for (const file of pending) {
        if (controller.signal.aborted) break;
        await uploadOne(file, requestId, controller.signal);
      }
      const failed = attachmentsRef.current.some((a) => a.status === 'error');
      if (!failed) setError(null);
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
    if (aiState === 'uploading') setAiState('idle');
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
      await uploadOne(
        { ...file, status: 'ready', progress: 0 },
        draftSaved?.id,
        controller.signal,
      );
      setUploading(false);
    })();
  };

  const buildBody = (): CreateRequestInput => {
    const qty = clampOrderQuantity(quantity);
    const custom = isCustomCatalogProduct(productId, resolvedName);
    const baseNotes = composeRequestNotes({ deliveryNotes, dimensionsNotes, orderNotes });
    const notes = custom
      ? [t('mobile.newOrder.customOrderFactoryNote'), baseNotes].filter(Boolean).join('\n\n')
      : baseNotes;
    const external =
      resolveExternalOrderNumber(externalOrderNumber, draftSaved?.number) ?? undefined;
    const customMeasurements = toRequestCustomMeasurements(
      dimensions,
      t('mobile.newOrder.dimSeat'),
    );
    return {
      source: 'PORTAL',
      externalOrderNumber: external,
      priority,
      notes,
      deliveryAddress: deliveryAddress.trim() || undefined,
      endCustomerName: endCustomerName.trim() || user?.name?.trim() || undefined,
      endCustomerPhone: endCustomerPhone.trim() || user?.phone?.trim() || undefined,
      deliveryLat,
      deliveryLng,
      requiredDeliveryDate:
        requiredDeliveryDate.trim() && isValidOptionalDate(requiredDeliveryDate)
          ? requiredDeliveryDate.trim()
          : undefined,
      items: [
        {
          productId: productId.trim() ? productId : undefined,
          productName: resolvedName || t('mobile.newOrder.untitledModel'),
          quantity: qty,
          notes,
          fabric: fabric.trim() || undefined,
          description: fabricDescription.trim() || undefined,
          width: parseDimNumber(dimensions.width),
          height: parseDimNumber(dimensions.height),
          depth: parseDimNumber(dimensions.depth),
          customMeasurements: customMeasurements.length ? customMeasurements : undefined,
        },
      ],
    };
  };

  const linkAi = async (requestId: string) => {
    if (!aiJobId) return;
    try {
      await linkAiJobToRequest(aiJobId, requestId);
    } catch {
      /* non-blocking — uploads already preserved */
    }
  };

  const persistDraft = async () => {
    if (!validateStep1()) return;
    if (endCustomerPhone.trim() && !isValidOptionalPhone(endCustomerPhone)) {
      fail(t('mobile.newOrder.errors.phoneInvalid'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const body = buildBody();
      let created: { id: string; number: string };
      if (draftSaved?.id) {
        created = await updateRequest(draftSaved.id, body);
      } else {
        created = await createRequest(body, { submit: false });
      }
      setDraftSaved({ id: created.id, number: created.number });
      if (!externalOrderNumber.trim()) {
        setExternalOrderNumber(created.number);
      }
      await uploadAll(created.id);
      await linkAi(created.id);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.requests.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.salesOrders.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.reports.dealerHome() }),
      ]);
      await clearLocalDraft();
      setDraftSavedNumber(created.number);
      setSuccessKey((k) => k + 1);
      void haptics.confirmMedium();
    } catch (err) {
      fail(
        err instanceof Error && err.message
          ? err.message
          : t('mobile.newOrder.errors.saveFailed'),
      );
    } finally {
      setBusy(false);
    }
  };

  const submitOrder = async () => {
    if (submitLock.current || busy) return;
    if (!validateForSubmit()) {
      if (!resolvedName || !isValidQuantity(quantity)) setStep(1);
      else setStep(3);
      return;
    }

    submitLock.current = true;
    setBusy(true);
    setError(null);
    try {
      const body = buildBody();
      let created: { id: string; number: string };

      if (draftSaved?.id) {
        created = await updateRequest(draftSaved.id, body);
        created = await submitRequest(draftSaved.id);
      } else {
        created = await createRequest(body, { submit: true });
      }

      setDraftSaved({ id: created.id, number: created.number });
      if (!externalOrderNumber.trim()) {
        setExternalOrderNumber(created.number);
      }
      await uploadAll(created.id);
      await linkAi(created.id);

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.requests.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.salesOrders.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.reports.dealerHome() }),
      ]);

      await clearLocalDraft();
      setSubmittedNumber(created.number);
      setSuccessKey((k) => k + 1);
      void haptics.confirmMedium();
    } catch (err) {
      submitLock.current = false;
      fail(
        err instanceof Error && err.message
          ? err.message
          : t('mobile.newOrder.errors.submitFailed'),
      );
    } finally {
      setBusy(false);
    }
  };

  const resetForm = () => {
    submitLock.current = false;
    setSubmittedNumber(null);
    setDraftSavedNumber(null);
    setDraftSaved(null);
    setStep(1);
    setProductId('');
    setCustomProductName('');
    setQuantity('1');
    setExternalOrderNumber('');
    setPriority('NORMAL');
    setFabric('');
    setFabricDescription('');
    setDimensions(emptyDimensionFields());
    appliedDimsProduct.current = '';
    setOrderNotes('');
    setDeliveryAddress('');
    setEndCustomerName('');
    setEndCustomerPhone('');
    setDeliveryNotes('');
    setDeliveryLat(undefined);
    setDeliveryLng(undefined);
    setRequiredDeliveryDate('');
    setAttachments([]);
    setAiJobId(null);
    setAiState('idle');
    setError(null);
    void clearLocalDraft();
  };

  if (!allowed) {
    return (
      <KeyboardAwareScreen>
        <EmptyState title={t('mobile.noModules')} description={t('mobile.noModulesHint')} />
      </KeyboardAwareScreen>
    );
  }

  if (!hydrated) {
    return (
      <KeyboardAwareScreen>
        <AppText variant="body" color="secondary">
          {t('mobile.newOrder.loading')}
        </AppText>
      </KeyboardAwareScreen>
    );
  }

  const slideDir = isRTL ? 'left' : 'right';
  const dealer = dealerTokens(colors);
  const successVisible = Boolean(submittedNumber || draftSavedNumber);
  const dockMode = newOrderDockMode({ step, submitted: successVisible });
  const scrollPad = newOrderDockScrollPad(theme.spacing.md);
  const dockVisible = !keyboardOpen && !successVisible;
  const dockDisabled = busy || uploading;

  const onDockPrimary = () => {
    if (dockMode === 'submit') {
      void submitOrder();
      return;
    }
    goNext();
  };

  const stepTitles: Record<NewOrderStep, string> = {
    1: t('mobile.newOrder.step1Title'),
    2: t('mobile.newOrder.step2Title'),
    3: t('mobile.newOrder.step3Title'),
    4: t('mobile.newOrder.step4Title'),
  };
  const stepBodies: Record<NewOrderStep, string> = {
    1: t('mobile.newOrder.step1Body'),
    2: t('mobile.newOrder.step2Body'),
    3: t('mobile.newOrder.step3Body'),
    4: t('mobile.newOrder.step4Body'),
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAwareScreen
        style={dockVisible ? { paddingBottom: scrollPad } : undefined}
        contentContainerStyle={{
          paddingBottom: keyboardOpen
            ? theme.spacing.md
            : successVisible
              ? theme.spacing['3xl']
              : theme.spacing.md,
        }}
        header={
          <View style={{ gap: theme.spacing.md }}>
            <View
              style={{
                marginHorizontal: -theme.spacing.lg,
                marginTop: -theme.spacing.sm,
                paddingHorizontal: theme.spacing.lg,
                paddingTop: theme.spacing.sm,
                paddingBottom: theme.spacing.md,
                backgroundColor: dealer.heroWash,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
                gap: theme.spacing.md,
              }}
            >
              <AppText
                variant="largeTitle"
                align="center"
                numberOfLines={1}
              >
                {t('mobile.newOrder.title')}
              </AppText>
              {!successVisible ? <NewOrderStageRail step={step} /> : null}
            </View>
          </View>
        }
      >
        <FormShake shakeKey={shake} haptic={false}>
          <FadeIn key={`fade-${step}-${submittedNumber ?? draftSavedNumber ?? 'form'}`}>
            <SlideIn
              key={`slide-${step}-${submittedNumber ?? draftSavedNumber ?? 'form'}`}
              direction={slideDir}
            >
              {step === 1 && !successVisible ? (
                <DealerGlassCard>
                  <DealerSectionHeader
                    title={stepTitles[1]}
                    subtitle={stepBodies[1]}
                  />
                  <View style={{ gap: theme.spacing.lg }}>
                    <SecondaryButton
                      label={t('mobile.newOrder.browseCatalog')}
                      onPress={() => {
                        void haptics.selection();
                        router.navigate(catalogPickForOrderHref());
                      }}
                    />

                    <View
                      style={{
                        flexDirection: isRTL ? 'row-reverse' : 'row',
                        gap: theme.spacing.sm,
                      }}
                    >
                      <Pressable
                        onPress={() => {
                          void haptics.selection();
                          setPickSheet('favorites');
                        }}
                        style={{
                          flex: 1,
                          minHeight: theme.sizes.touch.min,
                          borderRadius: theme.radius.lg,
                          borderWidth: StyleSheet.hairlineWidth * 2,
                          borderColor: colors.border,
                          backgroundColor: colors.brandSoft,
                          paddingHorizontal: theme.spacing.md,
                          flexDirection: isRTL ? 'row-reverse' : 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: theme.spacing.xs,
                        }}
                      >
                        <Ionicons name="heart" size={16} color={colors.brand} />
                        <AppText variant="caption" weight="semibold" color="brand">
                          {t('mobile.newOrder.pickFavorites')}
                        </AppText>
                      </Pressable>
                      <Pressable
                        onPress={() => {
                          void haptics.selection();
                          setPickSheet('ordered');
                        }}
                        style={{
                          flex: 1,
                          minHeight: theme.sizes.touch.min,
                          borderRadius: theme.radius.lg,
                          borderWidth: StyleSheet.hairlineWidth * 2,
                          borderColor: colors.border,
                          backgroundColor: colors.surface,
                          paddingHorizontal: theme.spacing.md,
                          flexDirection: isRTL ? 'row-reverse' : 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: theme.spacing.xs,
                        }}
                      >
                        <Ionicons name="time-outline" size={16} color={colors.brand} />
                        <AppText variant="caption" weight="semibold" color="brand">
                          {t('mobile.newOrder.pickOrdered')}
                        </AppText>
                      </Pressable>
                    </View>

                    <TextField
                      label={t('mobile.newOrder.modelName')}
                      value={customProductName}
                      onChangeText={(v) => {
                        setCustomProductName(v);
                        // Manual typing → custom factory product (no catalog id).
                        setProductId('');
                      }}
                      placeholder={t('mobile.newOrder.modelNamePlaceholder')}
                      error={error && !resolvedName ? error : undefined}
                    />

                    {isCustomCatalogProduct(productId, customProductName) ? (
                      <View
                        style={{
                          flexDirection: isRTL ? 'row-reverse' : 'row',
                          alignItems: 'flex-start',
                          gap: theme.spacing.sm,
                          padding: theme.spacing.md,
                          borderRadius: theme.radius.lg,
                          backgroundColor: colors.warningSoft,
                          borderWidth: 1,
                          borderColor: colors.warning,
                        }}
                      >
                        <Ionicons name="construct-outline" size={18} color={colors.warning} />
                        <View style={{ flex: 1, gap: 2 }}>
                          <AppText variant="caption" weight="semibold" style={{ color: colors.warning }}>
                            {t('mobile.newOrder.customProductBadge')}
                          </AppText>
                          <AppText variant="caption" color="secondary">
                            {t('mobile.newOrder.customProductHint')}
                          </AppText>
                        </View>
                      </View>
                    ) : null}

                    {productId && resolvedName ? (
                      <View
                        style={{
                          borderRadius: theme.radius.lg,
                          borderWidth: 1,
                          borderColor: colors.brand,
                          backgroundColor: colors.brandSoft,
                          padding: theme.spacing.md,
                          gap: 4,
                        }}
                      >
                        <AppText variant="caption" color="muted">
                          {t('mobile.newOrder.selectedFromCatalog')}
                        </AppText>
                        <AppText variant="body" weight="semibold">
                          {resolvedName}
                        </AppText>
                      </View>
                    ) : null}

                    <NewOrderQtyStepper
                      value={quantity}
                      onChange={setQuantity}
                      error={
                        error && !isValidQuantity(quantity) ? error : undefined
                      }
                    />

                    <AppText variant="caption" color="muted">
                      {t('mobile.newOrder.uploadsLaterHint')}
                    </AppText>
                    {error && step === 1 ? (
                      <AppText variant="caption" color="error">
                        {error}
                      </AppText>
                    ) : null}
                  </View>
                </DealerGlassCard>
              ) : null}

              {step === 2 && !successVisible ? (
                <View style={{ gap: theme.spacing.md }}>
                  {resolvedName || productId ? (
                    <DealerGlassCard
                      intensity="solid"
                      contentStyle={{ padding: theme.spacing.md, gap: theme.spacing.xs }}
                    >
                      <AppText variant="caption" color="muted">
                        {isCustomCatalogProduct(productId, resolvedName)
                          ? t('mobile.newOrder.customProductBadge')
                          : t('mobile.newOrder.selectedFromCatalog')}
                      </AppText>
                      <AppText variant="body" weight="semibold">
                        {resolvedName || t('mobile.newOrder.loading')}
                      </AppText>
                      <View
                        style={{
                          flexDirection: isRTL ? 'row-reverse' : 'row',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: theme.spacing.md,
                          marginTop: theme.spacing.xs,
                        }}
                      >
                        <AppText variant="caption" color="secondary">
                          {t('mobile.newOrder.quantity')}: {quantity}
                        </AppText>
                        {estimatedTotal != null ? (
                          <AppText variant="caption" weight="semibold" dir="ltr">
                            {formatCurrency(estimatedTotal)}
                          </AppText>
                        ) : null}
                      </View>
                    </DealerGlassCard>
                  ) : null}

                  <DealerGlassCard
                    contentStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}
                  >
                    <DealerSectionHeader
                      title={stepTitles[2]}
                      subtitle={stepBodies[2]}
                      compact
                    />

                    <View style={{ gap: theme.spacing.md }}>
                      <View style={{ gap: theme.spacing.xs }}>
                        <TextField
                          label={t('mobile.newOrder.dealerPo')}
                          value={externalOrderNumber}
                          onChangeText={setExternalOrderNumber}
                          placeholder={t('mobile.newOrder.dealerPoPlaceholder')}
                          autoCapitalize="characters"
                        />
                        <AppText
                          variant="caption"
                          color="muted"
                          style={{ textAlign: isRTL ? 'right' : 'left' }}
                        >
                          {t('mobile.newOrder.dealerPoHint')}
                        </AppText>
                      </View>
                      <NewOrderPriorityBar value={priority} onChange={setPriority} />
                    </View>

                    <View
                      style={{
                        height: StyleSheet.hairlineWidth * 2,
                        backgroundColor: colors.border,
                      }}
                    />

                    <View style={{ gap: theme.spacing.md }}>
                      <AppText variant="label" weight="semibold">
                        {t('mobile.newOrder.fabricSection')}
                      </AppText>
                      <TextField
                        label={t('mobile.newOrder.fabricName')}
                        value={fabric}
                        onChangeText={setFabric}
                        placeholder={t('mobile.newOrder.fabricNamePlaceholder')}
                      />
                      <View style={{ gap: theme.spacing.xs }}>
                        <TextField
                          label={t('mobile.newOrder.fabricDescription')}
                          value={fabricDescription}
                          onChangeText={(v) =>
                            setFabricDescription(clampNotes(v, FABRIC_DESC_MAX))
                          }
                          placeholder={t('mobile.newOrder.fabricDescriptionPlaceholder')}
                          multiline
                          style={{ minHeight: 140, textAlignVertical: 'top' }}
                        />
                        <AppText
                          variant="caption"
                          color="muted"
                          style={{ textAlign: isRTL ? 'left' : 'right' }}
                        >
                          {fabricDescription.length}/{FABRIC_DESC_MAX}
                        </AppText>
                      </View>
                    </View>

                    <View
                      style={{
                        height: StyleSheet.hairlineWidth * 2,
                        backgroundColor: colors.border,
                      }}
                    />

                    <NewOrderDimensionsEditor value={dimensions} onChange={setDimensions} />

                    <View
                      style={{
                        height: StyleSheet.hairlineWidth * 2,
                        backgroundColor: colors.border,
                      }}
                    />

                    <View style={{ gap: theme.spacing.md }}>
                      <AppText variant="label" weight="semibold">
                        {t('mobile.newOrder.notesSection')}
                      </AppText>
                      <View style={{ gap: theme.spacing.xs }}>
                        <TextField
                          label={t('mobile.newOrder.orderNotes')}
                          value={orderNotes}
                          onChangeText={(v) => setOrderNotes(clampNotes(v, NOTES_MAX))}
                          placeholder={t('mobile.newOrder.orderNotesPlaceholder')}
                          multiline
                          style={{ minHeight: 140, textAlignVertical: 'top' }}
                        />
                        <AppText
                          variant="caption"
                          color="muted"
                          style={{ textAlign: isRTL ? 'left' : 'right' }}
                        >
                          {orderNotes.length}/{NOTES_MAX}
                        </AppText>
                      </View>
                    </View>
                  </DealerGlassCard>
                </View>
              ) : null}

              {step === 3 && !successVisible ? (
                <DealerGlassCard contentStyle={{ gap: theme.spacing.lg }}>
                  <DealerSectionHeader
                    title={stepTitles[3]}
                    subtitle={stepBodies[3]}
                    compact
                  />
                  <View style={{ gap: theme.spacing.md }}>
                    <TextField
                      label={t('mobile.newOrder.endCustomerName')}
                      value={endCustomerName}
                      onChangeText={setEndCustomerName}
                      placeholder={
                        user?.name?.trim()
                          ? t('mobile.newOrder.endCustomerNamePlaceholderDealer', {
                              name: user.name.trim(),
                            })
                          : t('mobile.newOrder.endCustomerNamePlaceholder')
                      }
                    />
                    <AppText
                      variant="caption"
                      color="muted"
                      style={{ textAlign: isRTL ? 'right' : 'left', marginTop: -theme.spacing.sm }}
                    >
                      {t('mobile.newOrder.endCustomerNameHint')}
                    </AppText>
                    <PhoneField
                      label={t('mobile.newOrder.endCustomerPhone')}
                      value={endCustomerPhone}
                      onChangeText={setEndCustomerPhone}
                      placeholder={
                        user?.phone?.trim()
                          ? t('mobile.newOrder.endCustomerPhonePlaceholderDealer', {
                              phone: user.phone.trim(),
                            })
                          : t('mobile.newOrder.endCustomerPhonePlaceholder')
                      }
                      error={
                        error && !isValidOptionalPhone(endCustomerPhone) ? error : undefined
                      }
                    />
                    <AppText
                      variant="caption"
                      color="muted"
                      style={{ textAlign: isRTL ? 'right' : 'left', marginTop: -theme.spacing.sm }}
                    >
                      {t('mobile.newOrder.endCustomerPhoneHint')}
                    </AppText>

                    <NewOrderDeliveryAddressBlock
                      savedAddresses={savedAddresses}
                      deliveryAddress={deliveryAddress}
                      deliveryNotes={deliveryNotes}
                      deliveryLat={deliveryLat}
                      notesMax={NOTES_MAX}
                      addressError={
                        error && !isValidDeliveryAddress(deliveryAddress) ? error : undefined
                      }
                      canSaveAddress={canSaveAddresses}
                      onOpenSavedAddresses={() => setAddressSheetOpen(true)}
                      onSaveAddress={openSaveAddressSheet}
                      onChangeAddress={setDeliveryAddress}
                      onClearCoords={() => {
                        setDeliveryLat(undefined);
                        setDeliveryLng(undefined);
                      }}
                      onOpenMap={() => setMapOpen(true)}
                      onChangeNotes={(v) => setDeliveryNotes(clampNotes(v, NOTES_MAX))}
                    />

                    <DeliveryAvailabilityCard
                      display={availabilityDisplay}
                      requestedDeliveryDate={requiredDeliveryDate}
                      onChangeDate={setRequiredDeliveryDate}
                      dateError={requiredDeliveryDateError}
                      updating={availabilityUpdating}
                    />

                    {error && step === 3 ? (
                      <AppText variant="caption" color="error">
                        {error}
                      </AppText>
                    ) : null}
                  </View>
                </DealerGlassCard>
              ) : null}

              {step === 4 && !successVisible ? (
                <View style={{ gap: theme.spacing.lg }}>
                  <DealerGlassCard>
                    <DealerSectionHeader
                      title={stepTitles[4]}
                      subtitle={stepBodies[4]}
                    />
                    <UploadsStep
                      attachments={attachments}
                      onChange={(next) => {
                        attachmentsRef.current = next;
                        setAttachments(next);
                      }}
                      canUpload={canUpload}
                      aiState={aiState}
                      error={error}
                      overallProgress={overallProgress}
                      uploading={uploading}
                      onUploadAll={() => void uploadAll(draftSaved?.id)}
                      onAttachmentsQueued={() => {
                        if (uploadQueueTimer.current) clearTimeout(uploadQueueTimer.current);
                        uploadQueueTimer.current = setTimeout(() => {
                          uploadQueueTimer.current = null;
                          void uploadAll(draftSaved?.id);
                        }, 250);
                      }}
                      onCancelUploads={cancelUploads}
                      onRetry={retryOne}
                      showTitle={false}
                    />
                  </DealerGlassCard>
                  <DealerGlassCard contentStyle={{ paddingTop: theme.spacing.md }}>
                    <ReviewStep
                      summary={{
                        modelName: resolvedName,
                        customerName: endCustomerName.trim() || user?.name || '—',
                        customerPhone: endCustomerPhone.trim() || user?.phone || '—',
                        address: deliveryAddress,
                        deliveryNotes,
                        fabric,
                        fabricDescription,
                        dimensionsNotes,
                        orderNotes,
                        dealerPo:
                          resolveExternalOrderNumber(
                            externalOrderNumber,
                            draftSaved?.number ?? submittedNumber,
                          ) ?? '—',
                        quantity,
                        priority: t(`mobile.newOrder.priorities.${priority}`),
                        unitPrice,
                        currency,
                        estimatedTotal,
                        requestedDeliveryDate: requiredDeliveryDate.trim() || null,
                        estimatedDeliveryDate: availabilityDisplay.suggestedDate,
                      }}
                      attachments={attachments}
                      error={error}
                      busy={busy || uploading}
                      showTitle={false}
                      hideActions
                      onBack={goBack}
                      onSaveDraft={() => void persistDraft()}
                      onSubmit={() => {
                        if (!validateForSubmit()) {
                          if (!resolvedName || !isValidQuantity(quantity)) setStep(1);
                          else setStep(3);
                          return;
                        }
                        setSubmitConfirmOpen(true);
                      }}
                      onViewOrders={() =>
                        router.replace('/(app)/(customer)/(tabs)/orders')
                      }
                      onCreateAnother={resetForm}
                    />
                  </DealerGlassCard>
                </View>
              ) : null}

              {successVisible ? (
                <DealerGlassCard>
                  <ReviewStep
                    summary={{
                      modelName: resolvedName,
                      customerName: endCustomerName.trim() || user?.name || '—',
                      customerPhone: endCustomerPhone.trim() || user?.phone || '—',
                      address: deliveryAddress,
                      deliveryNotes,
                      fabric,
                      fabricDescription,
                      dimensionsNotes,
                      orderNotes,
                      dealerPo:
                        resolveExternalOrderNumber(
                          externalOrderNumber,
                          draftSaved?.number ?? submittedNumber ?? draftSavedNumber,
                        ) ?? '—',
                      quantity,
                      priority: t(`mobile.newOrder.priorities.${priority}`),
                      unitPrice,
                      currency,
                      estimatedTotal,
                      requestedDeliveryDate: requiredDeliveryDate.trim() || null,
                      estimatedDeliveryDate: availabilityDisplay.suggestedDate,
                    }}
                    attachments={attachments}
                    error={error}
                    busy={false}
                    submittedNumber={submittedNumber}
                    draftSavedNumber={draftSavedNumber}
                    successKey={successKey}
                    onBack={goBack}
                    onSaveDraft={() => undefined}
                    onSubmit={() => undefined}
                    onViewOrders={() =>
                      router.replace('/(app)/(customer)/(tabs)/orders' as never)
                    }
                    onViewDrafts={() =>
                      router.replace(
                        '/(app)/(customer)/(tabs)/orders?focus=drafts' as never,
                      )
                    }
                    onCreateAnother={resetForm}
                  />
                </DealerGlassCard>
              ) : null}
            </SlideIn>
          </FadeIn>
        </FormShake>

        <ProductQuickPickSheet
          open={pickSheet === 'favorites'}
          onClose={() => setPickSheet(null)}
          title={t('mobile.newOrder.pickFavoritesTitle')}
          subtitle={t('mobile.newOrder.pickFavoritesBody')}
          products={favoriteProductsQuery.products}
          loading={!favorites.ready || favoriteProductsQuery.isPending}
          emptyTitle={t('mobile.catalog.favoritesEmptyTitle')}
          emptyBody={t('mobile.catalog.favoritesEmptyBody')}
          onSelect={(product) => {
            setProductId(product.id);
            const name =
              locale === 'ar'
                ? product.nameAr || product.nameEn
                : locale === 'he'
                  ? product.nameHe || product.nameEn
                  : product.nameEn || product.nameAr;
            setCustomProductName(name || product.nameEn || product.nameAr || '');
          }}
        />

        <ConfirmationSheet
          open={submitConfirmOpen}
          onClose={() => setSubmitConfirmOpen(false)}
          title={t('mobile.newOrder.submitConfirmTitle')}
          message={t('mobile.newOrder.submitConfirmBody')}
          confirmLabel={t('mobile.newOrder.submitConfirmAction')}
          cancelLabel={t('mobile.newOrder.submitConfirmCancel')}
          onConfirm={() => {
            setSubmitConfirmOpen(false);
            void submitOrder();
          }}
        />

        <ProductQuickPickSheet
          open={pickSheet === 'ordered'}
          onClose={() => setPickSheet(null)}
          title={t('mobile.newOrder.pickOrderedTitle')}
          subtitle={t('mobile.newOrder.pickOrderedBody')}
          products={orderedQuery.data ?? []}
          loading={orderedQuery.isPending}
          emptyTitle={t('mobile.catalog.orderedEmptyTitle')}
          emptyBody={t('mobile.catalog.orderedEmptyBody')}
          onSelect={(product) => {
            setProductId(product.id);
            const name =
              locale === 'ar'
                ? product.nameAr || product.nameEn
                : locale === 'he'
                  ? product.nameHe || product.nameEn
                  : product.nameEn || product.nameAr;
            setCustomProductName(name || product.nameEn || product.nameAr || '');
          }}
        />

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
      </KeyboardAwareScreen>

      {keyboardOpen ? null : (
        <NewOrderFloatingDock
          mode={dockMode}
          disabled={dockDisabled}
          primaryLoading={busy && dockMode === 'submit'}
          draftLoading={busy && dockMode === 'submit'}
          onBack={goBack}
          onPrimary={onDockPrimary}
          onSaveDraft={() => void persistDraft()}
        />
      )}
    </View>
  );
}
