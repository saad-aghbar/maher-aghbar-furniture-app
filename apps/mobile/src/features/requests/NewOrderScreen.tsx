import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { can } from '@maher/permissions';
import { extractPreview, linkAiJobToRequest } from '@/api/modules/ai-intake';
import {
  listCustomerAddresses,
  type CustomerAddress,
} from '@/api/modules/customers';
import {
  createRequest,
  submitRequest,
  updateRequest,
  type CreateRequestInput,
  type RequestPriority,
} from '@/api/modules/requests';
import { uploadFile } from '@/api/modules/uploads';
import { queryKeys } from '@/api/queryKeys';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { EmptyState } from '@/components/feedback/EmptyState';
import { TextField } from '@/components/forms/TextField';
import { PhoneField } from '@/components/forms/PhoneField';
import { KeyboardAwareScreen } from '@/components/layout/KeyboardAwareScreen';
import { useLocale } from '@/i18n';
import { FadeIn, FormShake, SlideIn, haptics } from '@/motion';
import { useTheme } from '@/theme';
import { useBrowseProductQuery } from '@/features/catalog/query';
import { CatalogModelPicker } from './components/CatalogModelPicker';
import { LocationMapPicker } from './components/LocationMapPicker';
import { ReviewStep } from './components/ReviewStep';
import { StepIndicator, type NewOrderStep } from './components/StepIndicator';
import { UploadsStep } from './components/UploadsStep';
import {
  clearLocalDraft,
  loadLocalDraft,
  saveLocalDraft,
  type NewOrderLocalDraft,
} from './newOrderDraft';
import type { PendingAttachment } from './pendingAttachment';
import {
  clampNotes,
  composeRequestNotes,
  formatAddressLine,
  isValidDeliveryAddress,
  isValidOptionalPhone,
  isValidQuantity,
  resolveModelName,
} from './newOrderValidation';

const PRIORITIES: RequestPriority[] = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];
const NOTES_MAX = 200;
const FABRIC_DESC_MAX = 300;

function StepNav({
  onBack,
  onNext,
  nextLabel,
  nextLoading,
  nextDisabled,
}: {
  onBack: () => void;
  onNext: () => void;
  nextLabel: string;
  nextLoading?: boolean;
  nextDisabled?: boolean;
}) {
  const { t, isRTL } = useLocale();
  const { theme } = useTheme();
  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        gap: theme.spacing.sm,
      }}
    >
      <SecondaryButton label={t('mobile.newOrder.back')} onPress={onBack} style={{ flex: 1 }} />
      <PrimaryButton
        label={nextLabel}
        onPress={onNext}
        loading={nextLoading}
        disabled={nextDisabled}
        style={{ flex: 1 }}
      />
    </View>
  );
}

export function NewOrderScreen() {
  const { user } = useAuth();
  const { t, locale, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ productId?: string; qty?: string }>();

  const allowed = can(user, 'request.create');
  const canUpload = can(user, 'document.manage');
  const canAi = can(user, 'request.create') || can(user, 'ai-intake.manage');
  const canReadAddresses = Boolean(user?.customerId && can(user, 'customer.read'));

  const [step, setStep] = useState<NewOrderStep>(1);
  const [shake, setShake] = useState(0);
  const [hydrated, setHydrated] = useState(false);

  const [productId, setProductId] = useState(params.productId ?? '');
  const [customProductName, setCustomProductName] = useState('');
  const [quantity, setQuantity] = useState(params.qty ?? '1');
  const [externalOrderNumber, setExternalOrderNumber] = useState('');
  const [priority, setPriority] = useState<RequestPriority>('NORMAL');

  const [fabric, setFabric] = useState('');
  const [fabricDescription, setFabricDescription] = useState('');
  const [dimensionsNotes, setDimensionsNotes] = useState('');
  const [orderNotes, setOrderNotes] = useState('');

  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [endCustomerName, setEndCustomerName] = useState('');
  const [endCustomerPhone, setEndCustomerPhone] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [deliveryLat, setDeliveryLat] = useState<number | undefined>();
  const [deliveryLng, setDeliveryLng] = useState<number | undefined>();
  const [savedAddresses, setSavedAddresses] = useState<CustomerAddress[]>([]);
  const [mapOpen, setMapOpen] = useState(false);

  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [aiJobId, setAiJobId] = useState<string | null>(null);
  const [aiBanner, setAiBanner] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftSaved, setDraftSaved] = useState<{ id: string; number: string } | null>(null);
  const [submittedNumber, setSubmittedNumber] = useState<string | null>(null);
  const [successKey, setSuccessKey] = useState(0);

  const productQuery = useBrowseProductQuery(productId || undefined, Boolean(productId));
  const skipLocalSave = useRef(true);
  const submitLock = useRef(false);
  const uploadAbort = useRef<AbortController | null>(null);
  const attachmentsRef = useRef(attachments);
  attachmentsRef.current = attachments;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const local = await loadLocalDraft();
      if (cancelled) return;
      if (local) {
        setStep(Math.min(6, Math.max(1, local.step)) as NewOrderStep);
        setProductId(local.productId || params.productId || '');
        setCustomProductName(local.customProductName);
        setQuantity(local.quantity || params.qty || '1');
        setExternalOrderNumber(local.externalOrderNumber);
        setPriority(local.priority);
        setFabric(local.fabric);
        setFabricDescription(local.fabricDescription);
        setDimensionsNotes(local.dimensionsNotes);
        setOrderNotes(local.orderNotes);
        setDeliveryAddress(local.deliveryAddress);
        setEndCustomerName(local.endCustomerName);
        setEndCustomerPhone(local.endCustomerPhone);
        setDeliveryNotes(local.deliveryNotes);
        setDeliveryLat(local.deliveryLat);
        setDeliveryLng(local.deliveryLng);
        if (local.serverDraftId && local.serverDraftNumber) {
          setDraftSaved({ id: local.serverDraftId, number: local.serverDraftNumber });
        }
      } else {
        if (params.productId) setProductId(String(params.productId));
        if (params.qty) setQuantity(String(params.qty));
      }
      setHydrated(true);
      skipLocalSave.current = false;
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydrated || skipLocalSave.current || submittedNumber) return;
    const payload: NewOrderLocalDraft = {
      version: 1,
      step,
      productId,
      customProductName,
      quantity,
      externalOrderNumber,
      priority,
      fabric,
      fabricDescription,
      dimensionsNotes,
      orderNotes,
      deliveryAddress,
      endCustomerName,
      endCustomerPhone,
      deliveryNotes,
      deliveryLat,
      deliveryLng,
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
    orderNotes,
    deliveryAddress,
    endCustomerName,
    endCustomerPhone,
    deliveryNotes,
    deliveryLat,
    deliveryLng,
    draftSaved,
    submittedNumber,
  ]);

  useEffect(() => {
    if (!productQuery.data || customProductName.trim()) return;
    const p = productQuery.data;
    const name =
      locale === 'ar' ? p.nameAr || p.nameEn : locale === 'he' ? p.nameHe || p.nameEn : p.nameEn;
    setCustomProductName(name || p.nameEn || p.nameAr || '');
  }, [productQuery.data, locale, customProductName]);

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

  const unitPrice =
    productQuery.data?.price != null && Number.isFinite(Number(productQuery.data.price))
      ? Number(productQuery.data.price)
      : null;
  const qtyNum = Number(quantity);
  const estimatedTotal =
    unitPrice != null && Number.isFinite(qtyNum) && qtyNum > 0 ? unitPrice * qtyNum : null;
  const currency = productQuery.data?.priceCurrency || 'JOD';

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
    setError(null);
    return true;
  };

  const validateStep2 = () => {
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
    setError(null);
    return true;
  };

  const validateForSubmit = () =>
    validateStep1() && validateStep2() && validateStep3();

  const goNext = () => {
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !validateStep2()) return;
    if (step === 3 && !validateStep3()) return;
    void haptics.selection();
    setStep((s) => Math.min(6, s + 1) as NewOrderStep);
  };

  const goBack = () => {
    if (busy || uploading) return;
    void haptics.selection();
    if (step > 1) {
      setStep((s) => (s - 1) as NewOrderStep);
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
    setAiBusy(true);
    setAiBanner(t('mobile.newOrder.aiReviewing'));
    try {
      const res = await extractPreview({
        storageKey: file.storageKey,
        mimeHint: file.mimeType,
        sourceType: 'IMAGE',
      });
      setAiJobId(res.jobId);
      const preview = res.preview ?? {};
      if (preview.productName?.trim() && !resolvedName) {
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
      setAiBanner(t('mobile.newOrder.aiFilled'));
    } catch {
      // Preserve the upload even when AI fails.
      setAiBanner(t('mobile.newOrder.aiFailedKeepUpload'));
    } finally {
      setAiBusy(false);
    }
  };

  const uploadOne = async (
    file: PendingAttachment,
    requestId: string | undefined,
    signal: AbortSignal,
  ) => {
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
      if (
        (typeof DOMException !== 'undefined' &&
          err instanceof DOMException &&
          err.name === 'AbortError') ||
        (err instanceof Error && err.name === 'AbortError')
      ) {
        patchAttachment(file.id, { status: 'cancelled', progress: 0 });
        return false;
      }
      patchAttachment(file.id, {
        status: 'error',
        progress: 0,
        errorMessage: err instanceof Error ? err.message : 'Upload failed',
      });
      return false;
    }
  };

  const uploadAll = async (requestId?: string) => {
    if (!canUpload) return true;
    const pending = attachmentsRef.current.filter(
      (a) => a.status === 'ready' || a.status === 'error' || a.status === 'cancelled',
    );
    if (!pending.length) return true;

    uploadAbort.current?.abort();
    const controller = new AbortController();
    uploadAbort.current = controller;
    setUploading(true);
    setError(null);
    try {
      for (const file of pending) {
        if (controller.signal.aborted) break;
        await uploadOne(file, requestId, controller.signal);
      }
      const failed = attachmentsRef.current.some((a) => a.status === 'error');
      return !failed;
    } finally {
      setUploading(false);
    }
  };

  const cancelUploads = () => {
    uploadAbort.current?.abort();
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
      await uploadOne(
        { ...file, status: 'ready', progress: 0 },
        draftSaved?.id,
        controller.signal,
      );
      setUploading(false);
    })();
  };

  const buildBody = (): CreateRequestInput => {
    const qty = Number(quantity);
    const notes = composeRequestNotes({ deliveryNotes, dimensionsNotes, orderNotes });
    return {
      source: 'PORTAL',
      externalOrderNumber: externalOrderNumber.trim() || undefined,
      priority,
      notes,
      deliveryAddress: deliveryAddress.trim() || undefined,
      endCustomerName: endCustomerName.trim() || undefined,
      endCustomerPhone: endCustomerPhone.trim() || undefined,
      deliveryLat,
      deliveryLng,
      items: [
        {
          productId: productId || undefined,
          productName: resolvedName || t('mobile.newOrder.untitledModel'),
          quantity: qty,
          notes,
          fabric: fabric.trim() || undefined,
          description: fabricDescription.trim() || undefined,
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
    if (!validateStep1() || !validateStep2()) return;
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
      await uploadAll(created.id);
      await linkAi(created.id);
      void haptics.confirmMedium();
      Alert.alert(
        t('mobile.newOrder.draftSavedTitle'),
        t('mobile.newOrder.draftSavedBody', { number: created.number }),
      );
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
      if (!resolvedName) setStep(1);
      else if (!isValidQuantity(quantity)) setStep(2);
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

      // Backend-confirmed success only after create/submit returns.
      setDraftSaved({ id: created.id, number: created.number });
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
    setDraftSaved(null);
    setStep(1);
    setProductId('');
    setCustomProductName('');
    setQuantity('1');
    setExternalOrderNumber('');
    setPriority('NORMAL');
    setFabric('');
    setFabricDescription('');
    setDimensionsNotes('');
    setOrderNotes('');
    setDeliveryAddress('');
    setEndCustomerName('');
    setEndCustomerPhone('');
    setDeliveryNotes('');
    setDeliveryLat(undefined);
    setDeliveryLng(undefined);
    setAttachments([]);
    setAiJobId(null);
    setAiBanner(null);
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
            {!submittedNumber ? (
              <Pressable
                onPress={goBack}
                accessibilityRole="button"
                accessibilityLabel={t('mobile.newOrder.back')}
                style={{ minHeight: theme.sizes.touch.min, justifyContent: 'center' }}
              >
                <AppText variant="label" weight="semibold" color="brand">
                  {t('mobile.newOrder.back')}
                </AppText>
              </Pressable>
            ) : null}
            <AppText
              variant="largeTitle"
              style={{ flex: 1, textAlign: isRTL ? 'right' : 'left' }}
              numberOfLines={1}
            >
              {t('mobile.newOrder.title')}
            </AppText>
          </View>
          {!submittedNumber ? <StepIndicator step={step} /> : null}
        </View>
      }
    >
      <FormShake shakeKey={shake} haptic={false}>
        <FadeIn key={`fade-${step}-${submittedNumber ?? 'form'}`}>
          <SlideIn key={`slide-${step}-${submittedNumber ?? 'form'}`} direction={slideDir}>
            {step === 1 && !submittedNumber ? (
              <View style={{ gap: theme.spacing.lg }}>
                <AppText variant="title" weight="semibold">
                  {t('mobile.newOrder.step1Title')}
                </AppText>
                <AppText variant="body" color="secondary">
                  {t('mobile.newOrder.step1Body')}
                </AppText>
                <SecondaryButton
                  label={t('mobile.newOrder.browseCatalog')}
                  onPress={() => setPickerOpen(true)}
                />
                <TextField
                  label={t('mobile.newOrder.modelName')}
                  value={customProductName}
                  onChangeText={(v) => {
                    setCustomProductName(v);
                    if (!v.trim()) setProductId('');
                  }}
                  placeholder={t('mobile.newOrder.modelNamePlaceholder')}
                  error={error && !resolvedName ? error : undefined}
                />
                <AppText variant="caption" color="muted">
                  {t('mobile.newOrder.uploadsLaterHint')}
                </AppText>
                {error && step === 1 ? (
                  <AppText variant="caption" color="error">
                    {error}
                  </AppText>
                ) : null}
                <PrimaryButton label={t('mobile.newOrder.continue')} onPress={goNext} />
              </View>
            ) : null}

            {step === 2 && !submittedNumber ? (
              <View style={{ gap: theme.spacing.lg }}>
                <AppText variant="title" weight="semibold">
                  {t('mobile.newOrder.step2Title')}
                </AppText>
                <AppText variant="body" color="secondary">
                  {resolvedName}
                </AppText>
                <TextField
                  label={t('mobile.newOrder.dealerPo')}
                  value={externalOrderNumber}
                  onChangeText={setExternalOrderNumber}
                  placeholder={t('mobile.newOrder.dealerPoPlaceholder')}
                  autoCapitalize="characters"
                />
                <TextField
                  label={t('mobile.newOrder.quantity')}
                  value={quantity}
                  onChangeText={setQuantity}
                  keyboardType="decimal-pad"
                  error={error && !(Number(quantity) > 0) ? error : undefined}
                />
                <View style={{ gap: theme.spacing.sm }}>
                  <AppText variant="label" color="secondary">
                    {t('mobile.newOrder.priority')}
                  </AppText>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
                    {PRIORITIES.map((p) => {
                      const active = priority === p;
                      return (
                        <Pressable
                          key={p}
                          onPress={() => {
                            void haptics.selection();
                            setPriority(p);
                          }}
                          style={{
                            paddingHorizontal: theme.spacing.md,
                            paddingVertical: theme.spacing.sm,
                            borderRadius: theme.radius.md,
                            borderWidth: 1,
                            borderColor: active ? colors.brand : colors.border,
                            backgroundColor: active ? colors.brandSoft : colors.surface,
                          }}
                        >
                          <AppText
                            variant="caption"
                            weight={active ? 'semibold' : 'medium'}
                            style={{ color: active ? colors.brand : colors.textPrimary }}
                          >
                            {t(`mobile.newOrder.priorities.${p}`)}
                          </AppText>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
                {error && step === 2 ? (
                  <AppText variant="caption" color="error">
                    {error}
                  </AppText>
                ) : null}
                <StepNav onBack={goBack} onNext={goNext} nextLabel={t('mobile.newOrder.continue')} />
              </View>
            ) : null}

            {step === 3 && !submittedNumber ? (
              <View style={{ gap: theme.spacing.lg }}>
                <AppText variant="title" weight="semibold">
                  {t('mobile.newOrder.step3Title')}
                </AppText>
                <AppText variant="body" color="secondary">
                  {t('mobile.newOrder.step3Body')}
                </AppText>
                <TextField
                  label={t('mobile.newOrder.endCustomerName')}
                  value={endCustomerName}
                  onChangeText={setEndCustomerName}
                  placeholder={t('mobile.newOrder.endCustomerNamePlaceholder')}
                />
                <PhoneField
                  label={t('mobile.newOrder.endCustomerPhone')}
                  value={endCustomerPhone}
                  onChangeText={setEndCustomerPhone}
                  placeholder={t('mobile.newOrder.endCustomerPhonePlaceholder')}
                  error={
                    error && !isValidOptionalPhone(endCustomerPhone) ? error : undefined
                  }
                />
                {savedAddresses.length > 0 ? (
                  <View style={{ gap: theme.spacing.sm }}>
                    <AppText variant="label" color="secondary">
                      {t('mobile.newOrder.savedAddresses')}
                    </AppText>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
                      {savedAddresses.map((addr) => {
                        const line = formatAddressLine(addr);
                        const active = deliveryAddress.trim() === line;
                        return (
                          <Pressable
                            key={addr.id}
                            onPress={() => {
                              void haptics.selection();
                              setDeliveryAddress(line);
                              setDeliveryLat(addr.latitude ?? undefined);
                              setDeliveryLng(addr.longitude ?? undefined);
                            }}
                            style={{
                              paddingHorizontal: theme.spacing.md,
                              paddingVertical: theme.spacing.sm,
                              borderRadius: theme.radius.md,
                              borderWidth: 1,
                              borderColor: active ? colors.brand : colors.border,
                              backgroundColor: active ? colors.brandSoft : colors.surface,
                              maxWidth: '100%',
                            }}
                          >
                            <AppText
                              variant="caption"
                              weight={active ? 'semibold' : 'medium'}
                              style={{ color: active ? colors.brand : colors.textPrimary }}
                            >
                              {addr.label?.trim() || line}
                            </AppText>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                ) : null}
                <View style={{ gap: theme.spacing.xs }}>
                  <AppText variant="label" color="secondary">
                    {t('mobile.newOrder.deliveryAddress')}
                  </AppText>
                  <View
                    style={{
                      flexDirection: isRTL ? 'row-reverse' : 'row',
                      gap: theme.spacing.sm,
                      alignItems: 'flex-start',
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <TextField
                        value={deliveryAddress}
                        onChangeText={(v) => {
                          setDeliveryAddress(v);
                          if (!v.trim()) {
                            setDeliveryLat(undefined);
                            setDeliveryLng(undefined);
                          }
                        }}
                        placeholder={t('mobile.newOrder.deliveryAddressPlaceholder')}
                        multiline
                        error={
                          error && !isValidDeliveryAddress(deliveryAddress) ? error : undefined
                        }
                        accessibilityLabel={t('mobile.newOrder.deliveryAddress')}
                      />
                    </View>
                    <Pressable
                      onPress={() => {
                        void haptics.selection();
                        setMapOpen(true);
                      }}
                      accessibilityLabel={t('mobile.newOrder.openMap')}
                      style={{
                        minHeight: theme.sizes.touch.min,
                        paddingHorizontal: theme.spacing.md,
                        borderRadius: theme.radius.md,
                        borderWidth: 1,
                        borderColor:
                          deliveryLat != null ? colors.brand : colors.border,
                        backgroundColor:
                          deliveryLat != null ? colors.brandSoft : colors.surface,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginTop: 4,
                      }}
                    >
                      <AppText
                        variant="caption"
                        weight="semibold"
                        style={{
                          color: deliveryLat != null ? colors.brand : colors.textMuted,
                        }}
                      >
                        {t('mobile.newOrder.mapPinShort')}
                      </AppText>
                    </Pressable>
                  </View>
                </View>
                <View style={{ gap: theme.spacing.xs }}>
                  <TextField
                    label={t('mobile.newOrder.deliveryNotes')}
                    value={deliveryNotes}
                    onChangeText={(v) => setDeliveryNotes(clampNotes(v, NOTES_MAX))}
                    placeholder={t('mobile.newOrder.deliveryNotesPlaceholder')}
                    multiline
                    style={{ minHeight: 88, textAlignVertical: 'top' }}
                  />
                  <AppText
                    variant="caption"
                    color="muted"
                    style={{ textAlign: isRTL ? 'left' : 'right' }}
                  >
                    {deliveryNotes.length}/{NOTES_MAX}
                  </AppText>
                </View>
                {error && step === 3 ? (
                  <AppText variant="caption" color="error">
                    {error}
                  </AppText>
                ) : null}
                <StepNav onBack={goBack} onNext={goNext} nextLabel={t('mobile.newOrder.continue')} />
              </View>
            ) : null}

            {step === 4 && !submittedNumber ? (
              <View style={{ gap: theme.spacing.lg }}>
                <AppText variant="title" weight="semibold">
                  {t('mobile.newOrder.step4Title')}
                </AppText>
                <AppText variant="body" color="secondary">
                  {t('mobile.newOrder.step4Body')}
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
                    onChangeText={(v) => setFabricDescription(clampNotes(v, FABRIC_DESC_MAX))}
                    placeholder={t('mobile.newOrder.fabricDescriptionPlaceholder')}
                    multiline
                    style={{ minHeight: 88, textAlignVertical: 'top' }}
                  />
                  <AppText
                    variant="caption"
                    color="muted"
                    style={{ textAlign: isRTL ? 'left' : 'right' }}
                  >
                    {fabricDescription.length}/{FABRIC_DESC_MAX}
                  </AppText>
                </View>
                <View style={{ gap: theme.spacing.xs }}>
                  <TextField
                    label={t('mobile.newOrder.dimensionsNotes')}
                    value={dimensionsNotes}
                    onChangeText={(v) => setDimensionsNotes(clampNotes(v, NOTES_MAX))}
                    placeholder={t('mobile.newOrder.dimensionsNotesPlaceholder')}
                    multiline
                    style={{ minHeight: 88, textAlignVertical: 'top' }}
                  />
                  <AppText
                    variant="caption"
                    color="muted"
                    style={{ textAlign: isRTL ? 'left' : 'right' }}
                  >
                    {dimensionsNotes.length}/{NOTES_MAX}
                  </AppText>
                </View>
                <View style={{ gap: theme.spacing.xs }}>
                  <TextField
                    label={t('mobile.newOrder.orderNotes')}
                    value={orderNotes}
                    onChangeText={(v) => setOrderNotes(clampNotes(v, NOTES_MAX))}
                    placeholder={t('mobile.newOrder.orderNotesPlaceholder')}
                    multiline
                    style={{ minHeight: 88, textAlignVertical: 'top' }}
                  />
                  <AppText
                    variant="caption"
                    color="muted"
                    style={{ textAlign: isRTL ? 'left' : 'right' }}
                  >
                    {orderNotes.length}/{NOTES_MAX}
                  </AppText>
                </View>
                <StepNav onBack={goBack} onNext={goNext} nextLabel={t('mobile.newOrder.continue')} />
              </View>
            ) : null}

            {step === 5 && !submittedNumber ? (
              <UploadsStep
                attachments={attachments}
                onChange={setAttachments}
                canUpload={canUpload}
                aiBanner={aiBanner}
                aiBusy={aiBusy}
                error={error}
                overallProgress={overallProgress}
                uploading={uploading}
                onUploadAll={() => void uploadAll(draftSaved?.id)}
                onCancelUploads={cancelUploads}
                onRetry={retryOne}
                onBack={goBack}
                onNext={goNext}
              />
            ) : null}

            {step === 6 || submittedNumber ? (
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
                  dealerPo: externalOrderNumber,
                  quantity,
                  priority: t(`mobile.newOrder.priorities.${priority}`),
                  unitPrice,
                  currency,
                  estimatedTotal,
                }}
                attachments={attachments}
                error={error}
                busy={busy || uploading}
                submittedNumber={submittedNumber}
                successKey={successKey}
                onBack={goBack}
                onSaveDraft={() => void persistDraft()}
                onSubmit={() => void submitOrder()}
                onViewOrders={() => router.replace('/(app)/(customer)/(tabs)/orders')}
                onCreateAnother={resetForm}
              />
            ) : null}
          </SlideIn>
        </FadeIn>
      </FormShake>

      <CatalogModelPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(product) => {
          setProductId(product.id);
          const name =
            locale === 'ar'
              ? product.nameAr || product.nameEn
              : locale === 'he'
                ? product.nameHe || product.nameEn
                : product.nameEn || product.nameAr;
          setCustomProductName(name || product.nameEn || product.nameAr || '');
          void haptics.selection();
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
          setMapOpen(false);
        }}
        onClear={() => {
          setDeliveryLat(undefined);
          setDeliveryLng(undefined);
        }}
      />
    </KeyboardAwareScreen>
  );
}
