import { useEffect, useRef, useState } from 'react';
import { Keyboard, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { can } from '@maher/permissions';
import { localizedName } from '@maher/i18n';
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
import {
  listCatalogColors,
  listCatalogFabrics,
} from '@/api/modules/catalog';
import { uploadFile } from '@/api/modules/uploads';
import { queryKeys } from '@/api/queryKeys';
import { toastMessageForError } from '@/api/queryClient';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { EmptyState } from '@/components/feedback/EmptyState';
import { TextField } from '@/components/forms/TextField';
import { PhoneField } from '@/components/forms/PhoneField';
import { KeyboardAwareScreen } from '@/components/layout/KeyboardAwareScreen';
import { ConfirmationSheet } from '@/components/sheets/ConfirmationSheet';
import { useLocale } from '@/i18n';
import { FadeIn, FormShake, ListItemEnter, SlideIn, AnimatedPressable, haptics } from '@/motion';
import { dealerTokens, useTheme } from '@/theme';
import { useBrowseProductQuery, useFavoriteProductsQuery, usePreviouslyOrderedQuery } from '@/features/catalog/query';
import { useDealerFavorites } from '@/features/catalog/useDealerFavorites';
import { useAvailabilityQuery } from '@/features/scheduling/query';
import type { AvailabilityRequest } from '@/api/modules/scheduling';
import { catalogPickForOrderHref } from '@/features/catalog/catalogPickForOrder';
import {
  customItemHref,
  customizeVariantHref,
  isCatalogOrderDeepLink,
  navigateToBasketReview,
  parseDeepLinkProductId,
  parseDeepLinkQty,
  parseDeepLinkVariantId,
  parseDeepLinkText,
} from '@/features/catalog/newOrderDeepLink';
import { DealerEmptyPanel } from '@/features/dealers/components/DealerEmptyPanel';
import { DealerBoard } from '@/features/dealers/components/DealerBoard';
import { DeliveryAvailabilityCard } from './components/DeliveryAvailabilityCard';
import { availabilityMonthWindow, localDealerMinimumRequestYmd, selectDeliveryAvailability } from './selectDeliveryAvailability';
import {
  type DealerAiIntakeState,
  previewNeedsInfo,
} from './aiIntakeHumanState';
import { LocationMapPicker } from './components/LocationMapPicker';
import { NewOrderDeliveryAddressBlock } from './components/NewOrderDeliveryAddressBlock';
import { NewOrderFloatingDock } from './components/NewOrderFloatingDock';
import { NewOrderQtyStepper } from './components/NewOrderQtyStepper';
import { NewOrderPriorityBar } from './components/NewOrderPriorityBar';
import { NewOrderStageRail } from './components/NewOrderStageRail';
import { OrderBasketItemRail } from './components/OrderBasketItemRail';
import { CropPreviewSheet } from './components/CropPreviewSheet';
import { ReviewStep } from './components/ReviewStep';
import { selectReviewBasketLine } from './selectReviewBasket';
import { ScanReviewScreen } from './ScanReviewScreen';
import {
  dealerFabricsPayload,
  emptyDealerFabricRow,
  FabricSelectionsEditor,
  type DealerFabricRow,
} from './FabricSelectionsEditor';
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
  formatDimensionsNotes,
  seedDimensionsFromProduct,
  type NewOrderDimensionFields,
} from './newOrderMeasurements';
import {
  clampOrderQuantity,
  isCustomCatalogProduct,
} from './newOrderProductKind';
import { resolveExternalOrderNumber } from './resolveExternalOrderNumber';
import {
  emptyOrderLine,
  lineToRequestItem,
  type NewOrderLine,
} from './newOrderLine';
import { useOrderBasket } from './OrderBasketProvider';
import {
  applyCatalogProductToBasket,
  lineHasProduct,
  patchBasketLine,
} from './newOrderBasket';
import {
  applyLineAttachmentsToBasket,
  attachmentsForLine,
  replaceLineAttachments,
  resolveRequestDealerPo,
  seedLineDealerPo,
  uniqueNonEmpty,
} from './newOrderItemsLayout';
import {
  previewHasLowConfidence,
  previewItemsToScanLines,
  scanLinesToBasket,
  type ScanReviewLine,
} from './scanReview';
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
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{
    productId?: string;
    qty?: string;
    fromCatalog?: string;
    variantId?: string;
    variantLabel?: string;
    variantSku?: string;
  }>();
  const fromCatalog = isCatalogOrderDeepLink(params);
  const catalogProductId = parseDeepLinkProductId(params.productId);
  const catalogQty = parseDeepLinkQty(params.qty);
  const catalogVariantId = parseDeepLinkVariantId(params.variantId);
  const catalogVariantLabel = parseDeepLinkText(params.variantLabel);
  const catalogVariantSku = parseDeepLinkText(params.variantSku);
  const catalogDeepLinkKey = fromCatalog
    ? `${catalogProductId}:${catalogQty}:${catalogVariantId}:${catalogVariantLabel}`
    : '';
  const allowed = can(user, 'request.create');
  const canUpload = can(user, 'document.manage');
  const canAi = can(user, 'request.create') || can(user, 'ai-intake.manage');
  const canReadAddresses = Boolean(user?.customerId && can(user, 'customer.read'));
  const canSaveAddresses = Boolean(user?.customerId && can(user, 'address.manage'));

  const [step, setStep] = useState<NewOrderStep>(1);
  const [shake, setShake] = useState(0);
  const [hydrated, setHydrated] = useState(false);

  const orderBasket = useOrderBasket();
  const lines = orderBasket.lines;
  const setLines = orderBasket.setLines;
  const [activeLineId, setActiveLineId] = useState<string | null>(null);
  const [externalOrderNumber, setExternalOrderNumber] = useState('');
  const [priority, setPriority] = useState<RequestPriority>('NORMAL');

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
  const [scanReviewOpen, setScanReviewOpen] = useState(false);
  const [scanLines, setScanLines] = useState<ScanReviewLine[]>([]);
  const [scanPhotoUri, setScanPhotoUri] = useState<string | null>(null);
  const [cropPreviewOpen, setCropPreviewOpen] = useState(false);
  const [aiConfirmNeeded, setAiConfirmNeeded] = useState(false);

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

  const activeLine = lines.find((line) => line.id === activeLineId) ?? lines[0] ?? emptyOrderLine();
  const productId = activeLine.productId;
  const customProductName = activeLine.customProductName;
  const quantity = activeLine.quantity;
  const fabrics = activeLine.fabrics.length ? activeLine.fabrics : [emptyDealerFabricRow()];
  const fabric = fabrics[0]?.type ?? '';
  const fabricDescription = fabrics[0]?.notes ?? '';
  const dimensions: NewOrderDimensionFields = {
    width: activeLine.dimWidth,
    height: activeLine.dimHeight,
    depth: activeLine.dimDepth,
    seat: activeLine.dimSeat,
    custom: activeLine.customMeasurements,
  };

  const patchActive = (partial: Partial<NewOrderLine>) => {
    const id = activeLine.id;
    setLines((prev) => patchBasketLine(prev, id, partial));
    if (!activeLineId) setActiveLineId(id);
  };
  const setProductId = (value: string) => patchActive({ productId: value });
  const setCustomProductName = (value: string) => patchActive({ customProductName: value });
  const setQuantity = (value: string | ((prev: string) => string)) => {
    setLines((prev) => {
      const id = activeLine.id;
      const current = prev.find((line) => line.id === id) ?? activeLine;
      const next = typeof value === 'function' ? value(current.quantity) : value;
      return patchBasketLine(prev, id, { quantity: next });
    });
  };
  const setFabrics = (
    value: DealerFabricRow[] | ((prev: DealerFabricRow[]) => DealerFabricRow[]),
  ) => {
    setLines((prev) => {
      const id = activeLine.id;
      const current = prev.find((line) => line.id === id) ?? activeLine;
      const next = typeof value === 'function' ? value(current.fabrics) : value;
      return patchBasketLine(prev, id, { fabrics: next });
    });
  };
  const setFabric = (value: string | ((prev: string) => string)) => {
    const next = typeof value === 'function' ? value(fabric) : value;
    setFabrics((rows) => {
      const copy = rows.length ? [...rows] : [emptyDealerFabricRow()];
      copy[0] = { ...emptyDealerFabricRow(), ...copy[0], type: next };
      return copy;
    });
  };
  const setFabricDescription = (value: string | ((prev: string) => string)) => {
    const next = typeof value === 'function' ? value(fabricDescription) : value;
    setFabrics((rows) => {
      const copy = rows.length ? [...rows] : [emptyDealerFabricRow()];
      copy[0] = { ...emptyDealerFabricRow(), ...copy[0], notes: next };
      return copy;
    });
  };
  const setDimensions = (value: NewOrderDimensionFields) => {
    patchActive({
      dimWidth: value.width,
      dimHeight: value.height,
      dimDepth: value.depth,
      dimSeat: value.seat,
      customMeasurements: value.custom,
    });
  };

  const productQuery = useBrowseProductQuery(productId || undefined, Boolean(productId));
  const fabricsQuery = useQuery({
    queryKey: queryKeys.catalog.fabrics(),
    queryFn: () => listCatalogFabrics(),
    enabled: allowed,
    staleTime: 60_000,
  });
  const colorsQuery = useQuery({
    queryKey: queryKeys.catalog.colors(),
    queryFn: () => listCatalogColors(),
    enabled: allowed,
    staleTime: 60_000,
  });
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
        const restored = local.lines.length ? local.lines : [emptyOrderLine({
          productId: local.productId || '',
          customProductName: local.customProductName,
          quantity: local.quantity || '1',
          dimWidth: local.dimWidth || '',
          dimHeight: local.dimHeight || '',
          dimDepth: local.dimDepth || '',
          dimSeat: local.dimSeat || '',
          customMeasurements: local.customMeasurements ?? [],
          fabrics: local.fabric?.trim()
            ? [{ ...emptyDealerFabricRow(), type: local.fabric, notes: local.fabricDescription }]
            : [emptyDealerFabricRow()],
        })];
        if (!orderBasket.lines.some(lineHasProduct)) {
          const seeded = seedLineDealerPo(restored, local.externalOrderNumber);
          setLines(seeded);
          setActiveLineId(seeded[0]?.id ?? null);
        }
        setExternalOrderNumber(local.externalOrderNumber);
        setPriority(local.priority);
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
        if (local.lines.length && !orderBasket.lines.some(lineHasProduct)) {
          const seeded = seedLineDealerPo(local.lines, local.externalOrderNumber);
          setLines(seeded);
          setActiveLineId(seeded[0]?.id ?? null);
        }
        setExternalOrderNumber(local.externalOrderNumber);
        setPriority(local.priority);
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
    setLines((prev) => {
      const next = applyCatalogProductToBasket(
        prev,
        {
          productId: catalogProductId,
          quantity: catalogQty,
          variantId: catalogVariantId,
          variantLabel: catalogVariantLabel,
          variantSku: catalogVariantSku,
          preferUpdate: true,
        },
        { preferUpdate: true },
      );
      const added = next[next.length - 1];
      if (added) setActiveLineId(added.id);
      return next;
    });
    setStep(1);
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
      version: 4,
      step,
      lines,
      productId,
      customProductName,
      quantity,
      externalOrderNumber: resolveRequestDealerPo(lines, externalOrderNumber),
      priority,
      fabric: fabrics[0]?.type ?? fabric,
      fabricDescription: fabrics[0]?.notes ?? fabricDescription,
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
    lines,
    productId,
    customProductName,
    quantity,
    externalOrderNumber,
    priority,
    fabric,
    fabricDescription,
    fabrics,
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

  const availabilityWindow = availabilityMonthWindow(
    requiredDeliveryDate.trim() || undefined,
  );
  const minRequestYmd = localDealerMinimumRequestYmd();
  const requestedYmd = requiredDeliveryDate.trim();
  const sendRequestedDate =
    Boolean(requestedYmd) &&
    isValidOptionalDate(requiredDeliveryDate) &&
    requestedYmd >= minRequestYmd;
  const availabilityRequest: AvailabilityRequest | null =
    lines.some((line) => line.productId.trim() && isValidQuantity(line.quantity))
      ? {
          items: lines
            .filter((line) => line.productId.trim() && isValidQuantity(line.quantity))
            .map((line) => ({
              productId: line.productId,
              quantity: clampOrderQuantity(line.quantity),
            })),
          requestedDeliveryDate: sendRequestedDate ? requestedYmd : undefined,
          from: availabilityWindow.from,
          to: availabilityWindow.to,
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

  const fail = (message: string) => {
    setError(message);
    setShake((n) => n + 1);
    void haptics.error();
  };

  const validateStep1 = () => {
    const named = lines.filter((line) =>
      resolveModelName({ customProductName: line.customProductName, catalogName: null }) ||
      line.productId.trim(),
    );
    if (!named.length && !resolvedName) {
      fail(t('mobile.newOrder.errors.modelRequired'));
      return false;
    }
    if (lines.some((line) => lineHasProduct(line) && !isValidQuantity(line.quantity))) {
      fail(t('mobile.newOrder.errors.quantityPositive'));
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
    const requested = requiredDeliveryDate.trim();
    if (requested && requested < localDealerMinimumRequestYmd()) {
      fail(t('mobile.newOrder.delivery.leadTimeNotice'));
      return false;
    }
    setError(null);
    return true;
  };

  const validateForSubmit = () => {
    if (aiConfirmNeeded || scanReviewOpen) {
      fail(t('mobile.newOrder.errors.scanReviewRequired'));
      return false;
    }
    return validateStep1() && validateStep3();
  };

  const goNext = () => {
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !validateStep3()) return;
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
      const items = preview.items?.length
        ? preview.items
        : preview.productName
          ? [
              {
                productName: preview.productName,
                quantity: preview.quantity,
                fabric: preview.fabric,
                material: preview.material,
                width: preview.width,
                height: preview.height,
                depth: preview.depth,
                notes: preview.notes,
                confidence: 0.8,
                lowConfidenceFields: [],
              },
            ]
          : [];
      const catalogHits = [
        ...(favoriteProductsQuery.products ?? []),
        ...(orderedQuery.data ?? []),
      ];
      if (items.length) {
        setScanLines(previewItemsToScanLines(items, catalogHits));
        setScanPhotoUri(file.uri);
        setScanReviewOpen(true);
        setAiConfirmNeeded(previewHasLowConfidence(items) || items.length > 0);
      }
      const currentName = resolvedNameRef.current;
      if (preview.productName?.trim() && !currentName && !items.length) {
        setCustomProductName(preview.productName.trim());
        setProductId('');
      }
      if (preview.quantity?.trim() && !items.length) {
        setQuantity((v) => (v === '1' || !v.trim() ? preview.quantity!.trim() : v));
      }
      if (preview.notes?.trim() && !items.length) {
        patchActive({
          notes: activeLine.notes.trim() || clampNotes(preview.notes.trim(), NOTES_MAX),
        });
      }
      if (preview.fabric?.trim() && !items.length) {
        setFabric((v) => v.trim() || preview.fabric!.trim());
        setFabrics((rows) => {
          const next = rows.length ? [...rows] : [emptyDealerFabricRow()];
          if (!next[0]?.type.trim()) next[0] = { ...emptyDealerFabricRow(), ...next[0], type: preview.fabric!.trim() };
          return next;
        });
      }
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
      setAiState(
        previewNeedsInfo(preview) && !items.length ? 'needsInfo' : 'ready',
      );
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

  const uploadBasketLinePhotos = async (
    source: typeof lines,
    requestId?: string,
  ): Promise<typeof lines> => {
    const next: typeof lines = [];
    for (const line of source) {
      if (!line.photoUris.length) {
        next.push(line);
        continue;
      }
      const ids = [...line.photoDocumentIds];
      for (let i = ids.length; i < line.photoUris.length; i += 1) {
        const uri = line.photoUris[i]!;
        const uploaded = await uploadFile({
          uri,
          fileName: `line-photo-${i + 1}.jpg`,
          mimeType: 'image/jpeg',
          category: 'CUSTOMER_ATTACHMENT',
          requestId,
        });
        ids.push(uploaded.document.id);
      }
      next.push({
        ...line,
        photoDocumentIds: ids,
        primaryImageDocumentId: line.primaryImageDocumentId || ids[0] || '',
      });
    }
    return next;
  };

  const buildBody = (sourceLines = lines): CreateRequestInput => {
    const untitled = t('mobile.newOrder.untitledModel');
    const seatLabel = t('mobile.newOrder.dimSeat');
    const basket = sourceLines.filter(lineHasProduct);
    const fallback = sourceLines[0] ?? activeLine;
    const requestPo = resolveRequestDealerPo(sourceLines, externalOrderNumber);
    const distinctPos = uniqueNonEmpty(
      sourceLines.map((line) => line.externalOrderNumber),
    );
    const items = (basket.length ? basket : [fallback]).map((line) => {
      const custom = isCustomCatalogProduct(line.productId, line.customProductName);
      const item = lineToRequestItem(line, untitled, seatLabel);
      const linePo = line.externalOrderNumber.trim();
      const extraNotes = [
        distinctPos.length > 1 && linePo ? `#${linePo}` : '',
        custom ? t('mobile.newOrder.customOrderFactoryNote') : '',
        item.notes,
      ].filter(Boolean);
      item.notes = extraNotes.length ? extraNotes.join('\n\n') : undefined;
      return item;
    });
    const baseNotes = composeRequestNotes({ deliveryNotes, orderNotes });
    const notes = items.some((item) => !item.productId)
      ? [t('mobile.newOrder.customOrderFactoryNote'), baseNotes].filter(Boolean).join('\n\n')
      : baseNotes;
    const external =
      resolveExternalOrderNumber(requestPo, draftSaved?.number) ?? undefined;
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
      items,
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
      const hydrated = await uploadBasketLinePhotos(lines, draftSaved?.id);
      setLines(hydrated);
      const body = buildBody(hydrated);
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
      const withLineFiles = applyLineAttachmentsToBasket(hydrated, attachmentsRef.current);
      setLines(withLineFiles);
      await updateRequest(created.id, buildBody(withLineFiles));
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
        toastMessageForError(err) || t('mobile.newOrder.errors.saveFailed'),
      );
    } finally {
      setBusy(false);
    }
  };

  const submitOrder = async () => {
    if (submitLock.current || busy) return;
    if (!validateForSubmit()) {
      if (!resolvedName || !isValidQuantity(quantity)) setStep(1);
      else setStep(2);
      return;
    }

    submitLock.current = true;
    setBusy(true);
    setError(null);
    try {
      const hydrated = await uploadBasketLinePhotos(lines, draftSaved?.id);
      setLines(hydrated);
      const body = buildBody(hydrated);
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
      const withLineFiles = applyLineAttachmentsToBasket(hydrated, attachmentsRef.current);
      setLines(withLineFiles);
      await updateRequest(created.id, buildBody(withLineFiles));
      created = await submitRequest(created.id);
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
        toastMessageForError(err) || t('mobile.newOrder.errors.submitFailed'),
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
    const fresh = emptyOrderLine({ quantity: '1' });
    setLines([fresh]);
    setActiveLineId(fresh.id);
    setExternalOrderNumber('');
    setPriority('NORMAL');
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

  if (!hydrated || !orderBasket.hydrated) {
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
  const scrollPad = newOrderDockScrollPad(theme.spacing.md, insets.bottom);
  const dockDisabled = busy || uploading;
  const contentBottomPad = successVisible
    ? theme.spacing['3xl']
    : keyboardOpen
      ? Math.max(scrollPad, theme.spacing['3xl'])
      : scrollPad;
  const basketLines = lines.filter(lineHasProduct);
  const reviewBasketLines = basketLines.map((line) =>
    selectReviewBasketLine(
      line,
      t('mobile.newOrder.untitledModel'),
      t('mobile.newOrder.defaultVariant'),
    ),
  );

  const onDockPrimary = () => {
    if (dockMode === 'submit') {
      void submitOrder();
      return;
    }
    goNext();
  };

  const uploadsEditor = (hint: string, lineId?: string) => {
    const scoped = lineId ? attachmentsForLine(attachments, lineId) : attachments;
    const scopedProgress =
      scoped.length === 0
        ? 0
        : scoped.reduce((sum, a) => sum + (a.status === 'uploaded' ? 1 : a.progress), 0) /
          scoped.length;
    return (
    <UploadsStep
      attachments={scoped}
      onChange={(next) => {
        const merged = lineId
          ? replaceLineAttachments(attachmentsRef.current, lineId, next)
          : next;
        attachmentsRef.current = merged;
        setAttachments(merged);
      }}
      canUpload={canUpload}
      aiState={aiState}
      error={error}
      overallProgress={scopedProgress}
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
      sectionHint={hint}
      lineId={lineId}
    />
    );
  };

  const stepTitles: Record<NewOrderStep, string> = {
    1: t('mobile.newOrder.step1Title'),
    2: t('mobile.newOrder.step2Title'),
    3: t('mobile.newOrder.step3Title'),
  };
  const stepBodies: Record<NewOrderStep, string> = {
    1: t('mobile.newOrder.step1Body'),
    2: t('mobile.newOrder.step2Body'),
    3: t('mobile.newOrder.step3Body'),
  };
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAwareScreen
        contentContainerStyle={{
          paddingBottom: contentBottomPad,
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
                weight={titleWeight}
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
                <View style={{ gap: theme.spacing.md }}>
                  {basketLines.length ? (
                    <ListItemEnter index={0}>
                    <OrderBasketItemRail
                      lines={basketLines}
                      activeId={activeLine.id}
                      onSelect={setActiveLineId}
                      onOpenBasket={() => navigateToBasketReview(router)}
                      onRemove={(id) => {
                        const nextActive =
                          activeLineId === id
                            ? basketLines.find((line) => line.id !== id)?.id ?? null
                            : activeLineId;
                        orderBasket.removeLine(id);
                        setActiveLineId(nextActive);
                        setAttachments((prev) => {
                          const next = prev.filter((row) => row.lineId !== id);
                          attachmentsRef.current = next;
                          return next;
                        });
                      }}
                    />
                    </ListItemEnter>
                  ) : (
                    <ListItemEnter index={0}>
                    <DealerBoard title={stepTitles[1]} titleWeight={titleWeight}>
                      <DealerEmptyPanel
                        nested
                        compact
                        text={t('mobile.newOrder.basketEmpty')}
                      />
                      <SecondaryButton
                        label={t('mobile.newOrder.basket')}
                        onPress={() => {
                          void haptics.selection();
                          navigateToBasketReview(router);
                        }}
                      />
                      <SecondaryButton
                        label={t('mobile.newOrder.addFromCatalog')}
                        onPress={() => {
                          void haptics.selection();
                          router.navigate(catalogPickForOrderHref());
                        }}
                      />
                    </DealerBoard>
                    </ListItemEnter>
                  )}

                  {basketLines.length ? (
                    <ListItemEnter index={1}>
                    <DealerBoard
                      title={
                        activeLine.customProductName.trim() ||
                        activeLine.variantLabel.trim() ||
                        stepTitles[1]
                      }
                      titleWeight={titleWeight}
                    >
                    <AppText variant="caption" color="muted">
                      {stepBodies[1]}
                    </AppText>
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
                          <AppText variant="caption" weight={titleWeight} style={{ color: colors.warning }}>
                            {t('mobile.newOrder.customProductBadge')}
                          </AppText>
                          <AppText variant="caption" color="secondary">
                            {t('mobile.newOrder.customProductHint')}
                          </AppText>
                        </View>
                      </View>
                    ) : null}
                    <NewOrderQtyStepper
                      value={quantity}
                      onChange={setQuantity}
                      error={
                        error && !isValidQuantity(quantity) ? error : undefined
                      }
                    />
                    <View
                      style={{
                        height: StyleSheet.hairlineWidth * 2,
                        backgroundColor: colors.border,
                      }}
                    />
                    <View style={{ gap: theme.spacing.md }}>
                      <AppText variant="label" weight={titleWeight}>
                        {t('mobile.newOrder.fabricSection')}
                      </AppText>
                      <FabricSelectionsEditor
                        value={fabrics}
                        onChange={(next) => {
                          setFabrics(next);
                        }}
                        fabricOptions={(fabricsQuery.data?.data ?? []).map((row) => ({
                          id: row.id,
                          name: localizedName(locale, row) || row.code,
                          caption: row.code,
                        }))}
                        colorOptions={(colorsQuery.data?.data ?? []).map((row) => ({
                          id: row.id,
                          name: localizedName(locale, row) || row.code,
                          caption: row.code,
                        }))}
                      />
                    </View>
                    <View
                      style={{
                        height: StyleSheet.hairlineWidth * 2,
                        backgroundColor: colors.border,
                      }}
                    />
                    <View style={{ gap: theme.spacing.xs }}>
                      <TextField
                        label={t('mobile.newOrder.dealerPo')}
                        value={activeLine.externalOrderNumber}
                        onChangeText={(value) =>
                          patchActive({ externalOrderNumber: value })
                        }
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
                    <View style={{ gap: theme.spacing.md }}>
                      <AppText variant="label" weight={titleWeight}>
                        {t('mobile.newOrder.notesSection')}
                      </AppText>
                      <View style={{ gap: theme.spacing.xs }}>
                        <TextField
                          label={t('mobile.newOrder.itemNotes')}
                          value={activeLine.notes}
                          onChangeText={(v) =>
                            patchActive({ notes: clampNotes(v, NOTES_MAX) })
                          }
                          placeholder={t('mobile.newOrder.orderNotesPlaceholder')}
                          multiline
                          style={{ minHeight: 88, textAlignVertical: 'top' }}
                        />
                        <AppText
                          variant="caption"
                          color="muted"
                          style={{ textAlign: isRTL ? 'left' : 'right' }}
                        >
                          {activeLine.notes.length}/{NOTES_MAX}
                        </AppText>
                      </View>
                    </View>
                    {uploadsEditor(
                      t('mobile.newOrder.attachmentsDetailsHint'),
                      activeLine.id,
                    )}
                    <AnimatedPressable
                      variant="button"
                      accessibilityRole="button"
                      accessibilityLabel={t('mobile.newOrder.editItem')}
                      testID="order-edit-item"
                      onPress={() => {
                        void haptics.selection();
                        if (!activeLine.productId.trim()) {
                          router.push(customItemHref(activeLine.id));
                          return;
                        }
                        router.push(
                          customizeVariantHref(
                            activeLine.productId,
                            activeLine.variantId,
                            Number(activeLine.quantity) || 1,
                            { lineId: activeLine.id },
                          ),
                        );
                      }}
                      style={{
                        minHeight: theme.sizes.touch.min,
                        borderRadius: theme.radius.xl,
                        borderWidth: 1,
                        borderColor: colors.brand,
                        backgroundColor: colors.brandSoft,
                        paddingHorizontal: theme.spacing.md,
                        flexDirection: isRTL ? 'row-reverse' : 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: theme.spacing.sm,
                      }}
                    >
                      <Ionicons name="create-outline" size={16} color={colors.brand} />
                      <AppText weight={titleWeight} color="brand">
                        {t('mobile.newOrder.editItem')}
                      </AppText>
                    </AnimatedPressable>
                    <NewOrderPriorityBar value={priority} onChange={setPriority} />
                    {error && step === 1 ? (
                      <AppText variant="caption" color="error">
                        {error}
                      </AppText>
                    ) : null}
                    </DealerBoard>
                    </ListItemEnter>
                  ) : null}
                </View>
              ) : null}

              {step === 2 && !successVisible ? (
                <ListItemEnter index={0}>
                <DealerBoard title={stepTitles[2]} titleWeight={titleWeight}>
                  <AppText variant="caption" color="muted">
                    {stepBodies[2]}
                  </AppText>
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

                    {error && step === 2 ? (
                      <AppText variant="caption" color="error">
                        {error}
                      </AppText>
                    ) : null}
                  </View>
                </DealerBoard>
                </ListItemEnter>
              ) : null}

              {step === 3 && !successVisible ? (
                <View style={{ gap: theme.spacing.lg }}>
                  <ListItemEnter index={0}>
                  <DealerBoard title={stepTitles[3]} titleWeight={titleWeight}>
                    <AppText variant="caption" color="muted">
                      {stepBodies[3]}
                    </AppText>
                    {uploadsEditor(t('mobile.newOrder.attachmentsReviewHint'))}
                  </DealerBoard>
                  </ListItemEnter>
                  <ListItemEnter index={1}>
                  <DealerBoard>
                    <ReviewStep
                      summary={{
                        modelName: lines
                          .filter(lineHasProduct)
                          .map((line) => line.customProductName || line.variantLabel || t('mobile.newOrder.untitledModel'))
                          .join(' · ') || resolvedName,
                        basketLines: reviewBasketLines,
                        customerName: endCustomerName.trim() || user?.name || '—',
                        customerPhone: endCustomerPhone.trim() || user?.phone || '—',
                        address: deliveryAddress,
                        deliveryNotes,
                        fabric:
                          dealerFabricsPayload(fabrics)
                            .map((f) => [f.type, f.color, f.role].filter(Boolean).join(' · '))
                            .join('; ') || fabric,
                        fabricDescription,
                        dimensionsNotes,
                        orderNotes,
                        dealerPo:
                          resolveExternalOrderNumber(
                            resolveRequestDealerPo(lines, externalOrderNumber),
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
                          else setStep(2);
                          return;
                        }
                        setSubmitConfirmOpen(true);
                      }}
                      onViewOrders={() =>
                        router.replace('/(app)/(customer)/(tabs)/orders')
                      }
                      onCreateAnother={resetForm}
                    />
                  </DealerBoard>
                  </ListItemEnter>
                </View>
              ) : null}

              {successVisible ? (
                <ListItemEnter index={0}>
                <DealerBoard>
                  <ReviewStep
                    summary={{
                      modelName: lines
                        .filter(lineHasProduct)
                        .map((line) => line.customProductName || line.variantLabel || t('mobile.newOrder.untitledModel'))
                        .join(' · ') || resolvedName,
                      basketLines: reviewBasketLines,
                      customerName: endCustomerName.trim() || user?.name || '—',
                      customerPhone: endCustomerPhone.trim() || user?.phone || '—',
                      address: deliveryAddress,
                      deliveryNotes,
                      fabric:
                        dealerFabricsPayload(fabrics)
                          .map((f) => [f.type, f.color, f.role].filter(Boolean).join(' · '))
                          .join('; ') || fabric,
                      fabricDescription,
                      dimensionsNotes,
                      orderNotes,
                      dealerPo:
                        resolveExternalOrderNumber(
                          resolveRequestDealerPo(lines, externalOrderNumber),
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
                </DealerBoard>
                </ListItemEnter>
              ) : null}
            </SlideIn>
          </FadeIn>
        </FormShake>

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

        <ScanReviewScreen
          open={scanReviewOpen}
          lines={scanLines}
          onChange={setScanLines}
          onClose={() => setScanReviewOpen(false)}
          onOpenCrop={() => setCropPreviewOpen(true)}
          onConfirm={() => {
            const scanned = scanLinesToBasket(scanLines);
            setLines((prev) => {
              if (!prev.some(lineHasProduct)) return scanned.length ? scanned : [emptyOrderLine()];
              return [...prev.filter(lineHasProduct), ...scanned];
            });
            setActiveLineId(scanned[0]?.id ?? null);
            setAiConfirmNeeded(false);
            setScanReviewOpen(false);
            setAiState('ready');
          }}
        />

        <CropPreviewSheet
          open={cropPreviewOpen}
          uri={scanPhotoUri}
          onClose={() => setCropPreviewOpen(false)}
        />

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
