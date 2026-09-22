'use client';

import { apiFetch, apiUpload, apiUploadFromUrl } from '@/lib/api-client';
import { localDealerMinimumRequestYmd } from '@/components/availability-card';
import { DeliveryLocationMapLazy } from '@/components/delivery-location-map-lazy';
import { useRouter } from '@/i18n/navigation';
import { useOrderBasket } from '@/components/order-basket-provider';
import { lineHasProduct, lineToRequestItem } from '@/lib/basket';
import {
  ActionDock,
  Alert,
  Board,
  Button,
  Combobox,
  DateField,
  FormSection,
  ImageSourceField,
  Input,
  Ledger,
  LedgerRow,
  Ltr,
  Select,
  Sheet,
  StageStrip,
  Stamp,
  TextArea,
  type StageStripStage,
} from '@maher/ui';
import { useKitCopy } from '@/lib/kit-copy';
import { DeliveryAvailabilityBoard } from '@/components/orders/delivery-availability-board';
import { localizedName } from '@maher/i18n';
import type { AuthUser } from '@maher/types';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';

interface CatalogProduct {
  id: string;
  sku: string;
  nameEn: string;
  nameAr?: string;
  nameHe?: string;
}

interface PendingFile {
  id: string;
  file?: File;
  url?: string;
  storageKey?: string;
  category: 'ORDER_IMAGE' | 'HANDWRITTEN_ORDER';
  name: string;
}

interface CustomDim {
  id: string;
  label: string;
  value: string;
}

interface ExtractPreview {
  productName?: string;
  quantity?: string;
  fabric?: string;
  fabricDescription?: string;
  notes?: string;
  width?: string;
  height?: string;
  depth?: string;
  material?: string;
  endCustomerName?: string;
  deliveryAddress?: string;
  projectName?: string;
}

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function looksLikeUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim(),
  );
}

function fillIfEmpty(current: string, next?: string | null) {
  if (current.trim()) return current;
  return next?.trim() || current;
}

export default function CreateOrderPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-2xl p-6 text-sm text-text-secondary">…</div>}>
      <CreateOrderForm />
    </Suspense>
  );
}

function CreateOrderForm() {
  const locale = useLocale();
  const t = useTranslations('navigation');
  const tc = useTranslations('catalog');
  const tCommon = useTranslations('common');
  const kit = useKitCopy();
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const initialProductId = searchParams.get('productId') ?? '';

  const basket = useOrderBasket();
  const basketLines = basket.lines.filter(lineHasProduct);
  const [productId, setProductId] = useState(initialProductId);
  const [customProductName, setCustomProductName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [preferredDeliveryDate, setPreferredDeliveryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [fabric, setFabric] = useState('');
  const [fabricDescription, setFabricDescription] = useState('');
  const [extraFabrics, setExtraFabrics] = useState<Array<{ id: string; type: string; color: string; role: string }>>([]);
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [depth, setDepth] = useState('');
  const [customDims, setCustomDims] = useState<CustomDim[]>([]);
  const [externalOrderNumber, setExternalOrderNumber] = useState('');
  const [endCustomerName, setEndCustomerName] = useState('');
  const [endCustomerPhone, setEndCustomerPhone] = useState('');
  const [endCustomerFax, setEndCustomerFax] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryLat, setDeliveryLat] = useState<number | null>(null);
  const [deliveryLng, setDeliveryLng] = useState<number | null>(null);

  const [orderImages, setOrderImages] = useState<PendingFile[]>([]);
  const [imageUrlDraft, setImageUrlDraft] = useState('');
  const [handwrittenFiles, setHandwrittenFiles] = useState<PendingFile[]>([]);
  const [handwrittenUrlDraft, setHandwrittenUrlDraft] = useState('');

  const [aiJobId, setAiJobId] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmDraft, setConfirmDraft] = useState(false);
  const [confirmNumber, setConfirmNumber] = useState('');

  const meQuery = useQuery({
    queryKey: ['auth-me'],
    queryFn: () => apiFetch<AuthUser>('/api/v1/auth/me'),
  });

  const productsQuery = useQuery({
    queryKey: ['catalog-browse-products'],
    queryFn: () =>
      apiFetch<{ data: CatalogProduct[] }>('/api/v1/catalog/browse/products?pageSize=100').then(
        (r) => r.data ?? [],
      ),
  });

  const selectedProduct = useMemo(
    () => (productsQuery.data ?? []).find((p) => p.id === productId),
    [productId, productsQuery.data],
  );

  useEffect(() => {
    if (initialProductId) setProductId(initialProductId);
  }, [initialProductId]);

  const customerId = meQuery.data?.customerId ?? null;

  const companyQuery = useQuery({
    queryKey: ['customer-company', customerId],
    enabled: Boolean(customerId),
    queryFn: () =>
      apiFetch<{ id: string; fax?: string | null; phone?: string | null; nameEn?: string | null }>(
        `/api/v1/customers/${customerId}`,
      ),
  });

  // Prefill end-customer fields with the dealer profile so the name is fixed & visible.
  useEffect(() => {
    const me = meQuery.data;
    if (!me) return;
    const profileName = me.name?.trim() ?? '';
    const profilePhone = me.phone?.trim() ?? '';
    if (profileName) {
      setEndCustomerName((current) => {
        const trimmed = current.trim();
        if (!trimmed || looksLikeUuid(trimmed)) return profileName;
        return current;
      });
    }
    if (profilePhone) {
      setEndCustomerPhone((current) => (current.trim() ? current : profilePhone));
    }
  }, [meQuery.data]);

  // Prefill fax from dealer company fax when empty.
  useEffect(() => {
    const companyFax = companyQuery.data?.fax?.trim() ?? '';
    if (!companyFax) return;
    setEndCustomerFax((current) => (current.trim() ? current : companyFax));
  }, [companyQuery.data?.fax]);

  const productName = selectedProduct
    ? localizedName(locale, selectedProduct)
    : customProductName.trim();

  const [savedAddressId, setSavedAddressId] = useState('');
  const [saveLabel, setSaveLabel] = useState('');
  const [savingAddress, setSavingAddress] = useState(false);

  const suggestAddress = useCallback((address: string, placeLabel?: string) => {
    // Always replace delivery address when the map pin moves
    setDeliveryAddress(address);
    // Suggest a short place name for the save-label field (user can edit freely)
    if (placeLabel?.trim()) setSaveLabel(placeLabel.trim());
  }, []);

  const addressesQuery = useQuery({
    queryKey: ['customer-addresses', customerId],
    enabled: Boolean(customerId),
    queryFn: () =>
      apiFetch<
        Array<{
          id: string;
          label: string;
          city: string;
          area?: string | null;
          street?: string | null;
          country: string;
          latitude?: string | number | null;
          longitude?: string | number | null;
          isDefaultDelivery?: boolean;
        }>
      >(`/api/v1/customers/${customerId}/addresses`),
  });

  function formatSavedAddress(a: {
    label: string;
    city: string;
    area?: string | null;
    street?: string | null;
    country: string;
  }) {
    const street = a.street?.trim() ?? '';
    // Freeform map saves store the full line in street — don't re-append city/country
    if (street.includes(',')) return street;
    const line = [street, a.area, a.city].filter(Boolean).join(', ');
    return line || a.label;
  }

  function guessCityFromAddress(address: string): string {
    const parts = address
      .split(',')
      .map((p) => p.trim())
      .filter((p) => p && !/^\d{4,}$/.test(p) && !/^[A-Z]{2}$/i.test(p));
    // Prefer a mid/late token that looks like a city name (not a long street line)
    const candidate =
      parts.find((p) => /amman|ramallah|nablus|irbid|aqaba|tel aviv|ramla|jaffa/i.test(p)) ||
      parts[parts.length - 2] ||
      parts[0] ||
      'Amman';
    return candidate.slice(0, 80);
  }

  function applySavedAddress(id: string) {
    setSavedAddressId(id);
    const row = (addressesQuery.data ?? []).find((a) => a.id === id);
    if (!row) return;
    setDeliveryAddress(formatSavedAddress(row));
    setSaveLabel(row.label);
    const lat = row.latitude != null ? Number(row.latitude) : NaN;
    const lng = row.longitude != null ? Number(row.longitude) : NaN;
    setDeliveryLat(Number.isFinite(lat) ? lat : null);
    setDeliveryLng(Number.isFinite(lng) ? lng : null);
  }

  async function saveCurrentAddress() {
    if (!customerId) return;
    const address = deliveryAddress.trim();
    if (!address) {
      setError(tc('deliveryAddressRequired'));
      return;
    }
    setSavingAddress(true);
    setError(null);
    try {
      const label = saveLabel.trim() || address.split(',').map((p) => p.trim()).filter(Boolean)[0] || tc('savedAddressDefaultLabel');
      const created = await apiFetch<{ id: string }>(`/api/v1/customers/${customerId}/addresses`, {
        method: 'POST',
        body: JSON.stringify({
          label,
          city: guessCityFromAddress(address),
          street: address,
          country: 'JO',
          latitude: deliveryLat ?? undefined,
          longitude: deliveryLng ?? undefined,
          isDefaultDelivery: (addressesQuery.data ?? []).length === 0,
        }),
      });
      await addressesQuery.refetch();
      setSavedAddressId(created.id);
      setBanner(tc('addressSaved'));
    } catch {
      setError(tc('actionFailed'));
    } finally {
      setSavingAddress(false);
    }
  }
  function applyPreview(preview: ExtractPreview) {
    setCustomProductName((v) => fillIfEmpty(v, preview.productName));
    // AI may suggest a catalog name. Do not silently attach productId —
    // that would reclassify a custom intake as STANDARD.
    setQuantity((v) => (v === '1' || !v.trim() ? preview.quantity?.trim() || v : v));
    setFabric((v) => fillIfEmpty(v, preview.fabric));
    setFabricDescription((v) => fillIfEmpty(v, preview.fabricDescription));
    setNotes((v) => fillIfEmpty(v, preview.notes));
    setWidth((v) => fillIfEmpty(v, preview.width));
    setHeight((v) => fillIfEmpty(v, preview.height));
    setDepth((v) => fillIfEmpty(v, preview.depth));
    setEndCustomerName((v) => fillIfEmpty(v, preview.endCustomerName));
    setDeliveryAddress((v) => fillIfEmpty(v, preview.deliveryAddress));
    setBanner(tc('aiFilledForm'));
  }

  async function uploadPending(
    pending: PendingFile,
    requestId?: string,
  ): Promise<{ storageKey: string; mimeType?: string }> {
    if (pending.storageKey) {
      return { storageKey: pending.storageKey, mimeType: pending.file?.type };
    }
    const qs = new URLSearchParams({ category: pending.category });
    if (requestId) qs.set('requestId', requestId);

    if (pending.file) {
      const form = new FormData();
      form.append('file', pending.file);
      const res = await apiUpload<{ document: { storageKey: string; mimeType?: string } }>(
        `/api/v1/uploads?${qs}`,
        form,
      );
      return { storageKey: res.document.storageKey, mimeType: res.document.mimeType ?? pending.file.type };
    }
    if (pending.url?.trim()) {
      const res = await apiUploadFromUrl<{ document: { storageKey: string; mimeType?: string } }>(
        `/api/v1/uploads/from-url?${qs}`,
        { url: pending.url.trim() },
      );
      return { storageKey: res.document.storageKey, mimeType: res.document.mimeType };
    }
    throw new Error(tCommon('uploadFailed'));
  }

  function patchPendingStorage(pending: PendingFile) {
    if (pending.category === 'ORDER_IMAGE') {
      setOrderImages((prev) => prev.map((p) => (p.id === pending.id ? pending : p)));
    } else {
      setHandwrittenFiles((prev) => prev.map((p) => (p.id === pending.id ? pending : p)));
    }
  }

  async function runAiExtract(pending: PendingFile) {
    setAiBusy(true);
    setError(null);
    setBanner(tc('aiReviewing'));
    try {
      const uploaded = await uploadPending(pending);
      const withKey: PendingFile = { ...pending, storageKey: uploaded.storageKey };
      patchPendingStorage(withKey);

      const sourceType =
        uploaded.mimeType?.includes('pdf') || pending.name.toLowerCase().endsWith('.pdf')
          ? 'PDF'
          : 'IMAGE';
      const res = await apiFetch<{ jobId: string; preview: ExtractPreview }>(
        '/api/v1/ai-intake/extract-preview',
        {
          method: 'POST',
          body: JSON.stringify({
            storageKey: uploaded.storageKey,
            mimeHint: uploaded.mimeType,
            sourceType,
          }),
        },
      );
      setAiJobId(res.jobId);
      applyPreview(res.preview ?? {});
    } catch {
      setBanner(null);
      setError(tc('aiExtractFailed'));
    } finally {
      setAiBusy(false);
    }
  }

  async function addImageFile(file: File) {
    const pending: PendingFile = {
      id: newId(),
      file,
      category: 'ORDER_IMAGE',
      name: file.name,
    };
    setOrderImages((prev) => [...prev, pending]);
    setImageUrlDraft('');
    await runAiExtract(pending);
    return '';
  }

  function addImageUrl() {
    const trimmed = imageUrlDraft.trim();
    if (!trimmed) return;
    const pending: PendingFile = {
      id: newId(),
      url: trimmed,
      category: 'ORDER_IMAGE',
      name: trimmed.split('/').pop() || 'image',
    };
    setOrderImages((prev) => [...prev, pending]);
    setImageUrlDraft('');
  }

  async function addHandwrittenFile(file: File) {
    const pending: PendingFile = {
      id: newId(),
      file,
      category: 'HANDWRITTEN_ORDER',
      name: file.name,
    };
    setHandwrittenFiles((prev) => [...prev, pending]);
    setHandwrittenUrlDraft('');
    await runAiExtract(pending);
    return '';
  }

  function addHandwrittenUrl() {
    const trimmed = handwrittenUrlDraft.trim();
    if (!trimmed) return;
    const pending: PendingFile = {
      id: newId(),
      url: trimmed,
      category: 'HANDWRITTEN_ORDER',
      name: trimmed.split('/').pop() || 'handwritten',
    };
    setHandwrittenFiles((prev) => [...prev, pending]);
    setHandwrittenUrlDraft('');
  }

  async function submit(asDraft: boolean) {
    setLoading(true);
    setError(null);
    try {
      const address = deliveryAddress.trim();
      const itemsFromBasket = basketLines.map((line) => lineToRequestItem(line, tc('name')));
      if (itemsFromBasket.length) {
        if (!address) throw new Error(tc('deliveryAddressRequired'));
      } else {
        const name = productName.trim();
        const qty = Number(quantity);
        if (!name) throw new Error(tc('customerProductRequired'));
        if (!(qty > 0)) throw new Error(tc('quantityPositive'));
        if (!address) throw new Error(tc('deliveryAddressRequired'));
      }

      const me = meQuery.data;
      const typedName = endCustomerName.trim();
      const typedPhone = endCustomerPhone.trim();
      const typedFax = endCustomerFax.trim();
      const resolvedName =
        (typedName && !looksLikeUuid(typedName) ? typedName : undefined) ||
        me?.name?.trim() ||
        undefined;
      const resolvedPhone = typedPhone || me?.phone?.trim() || undefined;
      const resolvedFax = typedFax || companyQuery.data?.fax?.trim() || undefined;

      const measurements = customDims
        .map((d) => ({ label: d.label.trim(), value: d.value.trim() }))
        .filter((d) => d.label && d.value);

      const query = asDraft ? '?submit=false' : '?submit=true';
      const created = await apiFetch<{ id: string; number: string }>(`/api/v1/requests${query}`, {
        method: 'POST',
        body: JSON.stringify({
          source: 'PORTAL',
          externalOrderNumber: externalOrderNumber.trim() || undefined,
          requiredDeliveryDate: preferredDeliveryDate || undefined,
          endCustomerName: resolvedName,
          endCustomerPhone: resolvedPhone,
          endCustomerFax: resolvedFax,
          deliveryAddress: address,
          deliveryLat: deliveryLat ?? undefined,
          deliveryLng: deliveryLng ?? undefined,
          notes: notes.trim() || undefined,
          items: itemsFromBasket.length
            ? itemsFromBasket
            : [
            {
              productId: productId || undefined,
              productName: productName.trim(),
              quantity: Number(quantity),
              fabric: fabric.trim() || undefined,
              color: extraFabrics[0]?.color?.trim() || undefined,
              fabrics: [
                ...(fabric.trim()
                  ? [{ key: 'primary', type: fabric.trim(), notes: fabricDescription.trim() || null }]
                  : []),
                ...extraFabrics
                  .filter((f) => f.type.trim())
                  .map((f) => ({
                    key: f.id,
                    type: f.type.trim(),
                    color: f.color.trim() || null,
                    role: f.role.trim() || null,
                  })),
              ].filter((f) => f.type),
              description: fabricDescription.trim() || undefined,
              notes: notes.trim() || undefined,
              width: width ? Number(width) : undefined,
              height: height ? Number(height) : undefined,
              depth: depth ? Number(depth) : undefined,
              customMeasurements: measurements.length ? measurements : undefined,
            },
          ],
        }),
      });

      for (const pending of [...orderImages, ...handwrittenFiles]) {
        await uploadPending(pending, created.id);
      }

      if (aiJobId) {
        try {
          await apiFetch(`/api/v1/ai-intake/jobs/${aiJobId}/link-request`, {
            method: 'POST',
            body: JSON.stringify({ requestId: created.id }),
          });
        } catch {
          /* non-blocking */
        }
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['customer-orders'] }),
        queryClient.invalidateQueries({ queryKey: ['customer-requests'] }),
        queryClient.invalidateQueries({ queryKey: ['customer-orders-combined'] }),
      ]);

      setConfirmDraft(asDraft);
      setConfirmNumber(created.number);
      setConfirmOpen(true);
      if (itemsFromBasket.length) basket.clear();
    } catch (err) {
      const message = err instanceof Error && err.message ? err.message : tc('actionFailed');
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setProductId('');
    setCustomProductName('');
    setQuantity('1');
    setPreferredDeliveryDate('');
    setNotes('');
    setFabric('');
    setFabricDescription('');
    setWidth('');
    setHeight('');
    setDepth('');
    setCustomDims([]);
    setExternalOrderNumber('');
    setEndCustomerName(meQuery.data?.name?.trim() ?? '');
    setEndCustomerPhone(meQuery.data?.phone?.trim() ?? '');
    setEndCustomerFax(companyQuery.data?.fax?.trim() ?? '');
    setDeliveryAddress('');
    setDeliveryLat(null);
    setDeliveryLng(null);
    setOrderImages([]);
    setImageUrlDraft('');
    setHandwrittenFiles([]);
    setHandwrittenUrlDraft('');
    setAiJobId(null);
    setBanner(null);
    setError(null);
    setSavedAddressId('');
    setSaveLabel('');
    setConfirmOpen(false);
    setConfirmNumber('');
  }

  const canSubmit = basketLines.length
    ? Boolean(deliveryAddress.trim())
    : Boolean(productName.trim()) && Number(quantity) > 0 && Boolean(deliveryAddress.trim());
  const busy = loading || aiBusy;

  const orderDone = basketLines.length > 0 || (Boolean(productName.trim()) && Number(quantity) > 0);
  const customerDone = Boolean(deliveryAddress.trim());
  const fabricDone = Boolean(fabric.trim() || fabricDescription.trim());
  const attachmentsDone = orderImages.length + handwrittenFiles.length > 0;
  const steps: StageStripStage[] = [
    { key: 'order', label: tc('orderSection'), state: orderDone ? 'done' : 'current' },
    { key: 'fabric', label: tc('fabricSection'), state: fabricDone ? 'done' : orderDone ? 'current' : 'todo' },
    { key: 'customer', label: tc('customerSection'), state: customerDone ? 'done' : orderDone && fabricDone ? 'current' : 'todo' },
    { key: 'attachments', label: tc('attachmentsSection'), state: attachmentsDone ? 'done' : 'todo' },
  ];
  const lineCount = basketLines.length || (productName.trim() ? 1 : 0);

  return (
    <div className="maher-stagger space-y-5 pb-24 md:pb-0">
      <Board tone={canSubmit ? 'success' : 'brand'} wash="top" as="section">
        <div className="px-5 pt-5 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-[24px] font-semibold leading-8 tracking-[-0.02em] text-[var(--maher-text-primary)] sm:text-[28px] sm:leading-9 rtl:tracking-normal">{t('createOrder')}</h1>
              <p className="mt-1 max-w-[56ch] text-[14px] leading-5 text-[var(--maher-text-secondary)]">{tc('deliveryLeadTimeNotice')}</p>
            </div>
            <Stamp tone={canSubmit ? 'success' : 'neutral'} size="sm">{tc('lines')}: {lineCount}</Stamp>
          </div>
        </div>
        <Board.Body>
          <StageStrip stages={steps} compact />
        </Board.Body>
      </Board>

      {error ? <Alert variant="error">{error}</Alert> : null}
      {banner ? <Alert variant={aiBusy ? 'info' : 'success'}>{banner}</Alert> : null}

      <div className="grid gap-5 xl:grid-cols-12">
      <div className="space-y-5 xl:col-span-8">
      {basketLines.length ? (
        <Board tone="brand">
          <Board.Header title={t('basket')} meta={<Stamp tone="brand" size="sm">{basketLines.length}</Stamp>} actions={<Button size="sm" variant="ghost" onClick={() => router.push('/dealer/basket')}>{tCommon('edit')}</Button>} />
          <Ledger className="px-5 pb-3">
            {basketLines.map((line) => (
              <LedgerRow key={line.id} label={line.customProductName || line.variantLabel || line.productId} hint={line.variantLabel || undefined} value={<Ltr>× {line.quantity}</Ltr>} />
            ))}
          </Ledger>
        </Board>
      ) : null}

      <Sheet
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={confirmDraft ? tc('orderDraftSavedTitle') : tc('orderSubmittedTitle')}
        tone={confirmDraft ? 'neutral' : 'success'}
        closeLabel={tCommon('close')}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                resetForm();
              }}
            >
              {tc('createAnotherOrder')}
            </Button>
            <Button
              onClick={() => {
                setConfirmOpen(false);
                router.push('/dealer/orders');
              }}
            >
              {tc('viewMyOrders')}
            </Button>
          </>
        }
      >
        <p className="text-sm text-text-secondary">
          {confirmDraft
            ? tc('orderDraftSavedBody', { number: confirmNumber })
            : tc('orderSubmittedBody', { number: confirmNumber })}
        </p>
        {confirmNumber ? (
          <p className="mt-3 text-[24px] font-semibold tracking-tight text-[var(--maher-text-primary)]">
            <Ltr>{confirmNumber}</Ltr>
          </p>
        ) : null}
      </Sheet>

      <FormSection title={tc('orderSection')} columns={1} tone={orderDone ? 'success' : 'brand'}>
          <Input
            label={tc('dealerCustomerOrderNumber')}
            value={externalOrderNumber}
            onChange={(e) => setExternalOrderNumber(e.target.value)}
            placeholder="PO-12345"
            dir="ltr"
            disabled={busy}
          />

          <Combobox<string>
            label={tc('modelName')}
            value={productId || null}
            placeholder={tc('select')}
            clearable
            disabled={busy}
            options={(productsQuery.data ?? []).map((product) => ({ value: product.id, label: localizedName(locale, product), description: product.sku }))}
            onChange={(value) => {
              setProductId(value ?? '');
              if (value) setCustomProductName('');
            }}
          />

          <Input
            label={tc('modelNameManual')}
            value={customProductName}
            onChange={(e) => {
              setCustomProductName(e.target.value);
              if (e.target.value.trim()) setProductId('');
            }}
            placeholder={tc('productItem')}
            disabled={busy || Boolean(productId)}
          />

          <Input
            label={tc('quantity')}
            type="number"
            min="0.001"
            step="any"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
            disabled={busy}
          />

          <DateField
            label={tc('preferredDeliveryDate')}
            hint={tc('deliveryLeadTimeNotice')}
            value={preferredDeliveryDate}
            onChange={(next) => {
              const min = localDealerMinimumRequestYmd();
              if (next && next < min) return;
              setPreferredDeliveryDate(next);
            }}
            minDate={localDealerMinimumRequestYmd()}
            variant="dealer"
            copy={kit.date}
            locale={locale}
            disabled={busy}
            clearable
          />

          <div className="grid grid-cols-3 gap-3">
            <Input
              label={tc('width')}
              value={width}
              onChange={(e) => setWidth(e.target.value)}
              dir="ltr"
              disabled={busy}
            />
            <Input
              label={tc('height')}
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              dir="ltr"
              disabled={busy}
            />
            <Input
              label={tc('depth')}
              value={depth}
              onChange={(e) => setDepth(e.target.value)}
              dir="ltr"
              disabled={busy}
            />
          </div>

          {customDims.length > 0 ? (
            <div className="space-y-3">
              {customDims.map((dim) => (
                <div key={dim.id} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
                  <Input
                    label={tc('dimensionLabel')}
                    value={dim.label}
                    onChange={(e) =>
                      setCustomDims((prev) =>
                        prev.map((d) => (d.id === dim.id ? { ...d, label: e.target.value } : d)),
                      )
                    }
                    placeholder={tc('dimensionLabelPlaceholder')}
                    disabled={busy}
                  />
                  <Input
                    label={tc('dimensionValue')}
                    value={dim.value}
                    onChange={(e) =>
                      setCustomDims((prev) =>
                        prev.map((d) => (d.id === dim.id ? { ...d, value: e.target.value } : d)),
                      )
                    }
                    dir="ltr"
                    disabled={busy}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => setCustomDims((prev) => prev.filter((d) => d.id !== dim.id))}
                  >
                    {tc('removeDimension')}
                  </Button>
                </div>
              ))}
            </div>
          ) : null}

          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={() =>
              setCustomDims((prev) => [...prev, { id: newId(), label: '', value: '' }])
            }
          >
            {tc('addDimension')}
          </Button>

          <TextArea
            label={tc('orderNotes')}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            disabled={busy}
          />
      </FormSection>

      {productId || basketLines.some((l) => l.productId) ? (
        <DeliveryAvailabilityBoard
          title={tc('availabilityTitle')}
          description={tc('deliveryLeadTimeNotice')}
          items={basketLines.length ? basketLines.filter((l) => l.productId).map((l) => ({ productId: l.productId, quantity: Number(l.quantity) || 1 })) : [{ productId, quantity: Number(quantity) || 1 }]}
          requestedDate={preferredDeliveryDate || undefined}
          selected={preferredDeliveryDate || undefined}
          onSelect={(ymd) => {
            if (ymd >= localDealerMinimumRequestYmd()) setPreferredDeliveryDate(ymd);
          }}
        />
      ) : null}

      <FormSection title={tc('fabricSection')} columns={1} tone={fabricDone ? 'success' : 'neutral'}>
          <Input
            label={tc('fabricName')}
            value={fabric}
            onChange={(e) => setFabric(e.target.value)}
            disabled={busy}
          />
          <TextArea
            label={tc('fabricDescription')}
            value={fabricDescription}
            onChange={(e) => setFabricDescription(e.target.value)}
            rows={2}
            disabled={busy}
          />
          {extraFabrics.map((row) => (
            <div key={row.id} className="grid gap-3 sm:grid-cols-3">
              <Input
                label={tc('fabricName')}
                value={row.type}
                onChange={(e) =>
                  setExtraFabrics((rows) =>
                    rows.map((r) => (r.id === row.id ? { ...r, type: e.target.value } : r)),
                  )
                }
                disabled={busy}
              />
              <Input
                label={tc('fabricColor')}
                value={row.color}
                onChange={(e) =>
                  setExtraFabrics((rows) =>
                    rows.map((r) => (r.id === row.id ? { ...r, color: e.target.value } : r)),
                  )
                }
                disabled={busy}
              />
              <Input
                label={tc('fabricRole')}
                value={row.role}
                onChange={(e) =>
                  setExtraFabrics((rows) =>
                    rows.map((r) => (r.id === row.id ? { ...r, role: e.target.value } : r)),
                  )
                }
                disabled={busy}
              />
            </div>
          ))}
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={() =>
              setExtraFabrics((rows) => [
                ...rows,
                { id: `fab-${rows.length + 2}`, type: '', color: '', role: '' },
              ])
            }
          >
            {tc('addFabric')}
          </Button>
      </FormSection>

      <FormSection title={tc('customerSection')} columns={1} tone={customerDone ? 'success' : 'warning'}>
          <Input
            label={tc('endCustomerName')}
            value={endCustomerName}
            onChange={(e) => setEndCustomerName(e.target.value)}
            placeholder={tc('defaultsToYourProfile')}
            autoComplete="name"
            disabled={busy}
          />
          <Input
            label={tc('endCustomerPhone')}
            value={endCustomerPhone}
            onChange={(e) => setEndCustomerPhone(e.target.value)}
            placeholder={tc('defaultsToYourProfile')}
            autoComplete="tel"
            dir="ltr"
            disabled={busy}
          />
          <Input
            label={tc('endCustomerFax')}
            value={endCustomerFax}
            onChange={(e) => setEndCustomerFax(e.target.value)}
            placeholder={tc('defaultsToCompanyFax')}
            autoComplete="off"
            dir="ltr"
            disabled={busy}
          />
          <TextArea
            label={tc('deliveryAddress')}
            value={deliveryAddress}
            onChange={(e) => {
              setDeliveryAddress(e.target.value);
              setSavedAddressId('');
            }}
            rows={2}
            required
            disabled={busy}
          />

          {customerId ? (
            <div className="space-y-3">
              <Select
                label={tc('savedAddresses')}
                value={savedAddressId}
                onChange={(e) => applySavedAddress(e.target.value)}
                disabled={busy || !(addressesQuery.data ?? []).length}
              >
                <option value="">{tc('chooseSavedAddress')}</option>
                {(addressesQuery.data ?? []).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                    {a.isDefaultDelivery ? ` (${tc('defaultDelivery')})` : ''}
                  </option>
                ))}
              </Select>

              <div className="grid grid-cols-[1fr_auto] items-end gap-2">
                <Input
                  label={tc('saveAddressLabel')}
                  value={saveLabel}
                  onChange={(e) => setSaveLabel(e.target.value)}
                  placeholder={tc('saveAddressLabelPlaceholder')}
                  disabled={busy || !deliveryAddress.trim()}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={busy || !deliveryAddress.trim() || savingAddress}
                  loading={savingAddress}
                  onClick={() => void saveCurrentAddress()}
                >
                  {tc('saveAddress')}
                </Button>
              </div>
            </div>
          ) : null}

          <DeliveryLocationMapLazy
            lat={deliveryLat}
            lng={deliveryLng}
            disabled={busy}
            hint={tc('pickLocationOnMap')}
            onChange={(nextLat, nextLng) => {
              setDeliveryLat(nextLat);
              setDeliveryLng(nextLng);
              setSavedAddressId('');
            }}
            onAddressSuggest={suggestAddress}
          />
      </FormSection>

      <FormSection title={tc('attachmentsSection')} columns={1} tone={attachmentsDone ? 'success' : 'neutral'}>
          <div className="space-y-2">
            <ImageSourceField
              label={tc('orderImages')}
              value={imageUrlDraft}
              onChange={setImageUrlDraft}
              hint={tCommon('photoUrlHint')}
              uploadLabel={tCommon('uploadFromDevice')}
              uploadingLabel={tCommon('uploading')}
              accept="image/jpeg,image/png,image/webp,image/heic"
              showPreview={false}
              disabled={busy}
              onUploadFile={addImageFile}
            />
            {imageUrlDraft.trim() ? (
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={addImageUrl}>
                  {tc('addImage')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  loading={aiBusy}
                  onClick={() => {
                    const pending: PendingFile = {
                      id: newId(),
                      url: imageUrlDraft.trim(),
                      category: 'ORDER_IMAGE',
                      name: imageUrlDraft.trim().split('/').pop() || 'image',
                    };
                    setOrderImages((prev) => [...prev, pending]);
                    setImageUrlDraft('');
                    void runAiExtract(pending);
                  }}
                >
                  {tc('readWithAi')}
                </Button>
              </div>
            ) : null}
            {orderImages.length > 0 ? (
              <ul className="space-y-1 text-xs text-text-secondary">
                {orderImages.map((img) => (
                  <li key={img.id} className="flex items-center justify-between gap-2">
                    <span className="truncate">{img.name}</span>
                    <button
                      type="button"
                      className="text-brand hover:underline"
                      disabled={busy}
                      onClick={() => setOrderImages((prev) => prev.filter((p) => p.id !== img.id))}
                    >
                      {tCommon('delete')}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="space-y-2">
            <ImageSourceField
              label={tc('handwrittenOrders')}
              value={handwrittenUrlDraft}
              onChange={setHandwrittenUrlDraft}
              hint={tCommon('photoUrlHint')}
              uploadLabel={tCommon('uploadFromDevice')}
              uploadingLabel={tCommon('uploading')}
              accept="image/*,application/pdf"
              showPreview={false}
              disabled={busy}
              onUploadFile={addHandwrittenFile}
            />
            {handwrittenUrlDraft.trim() ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  onClick={addHandwrittenUrl}
                >
                  {tc('addHandwritten')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  loading={aiBusy}
                  onClick={() => {
                    const pending: PendingFile = {
                      id: newId(),
                      url: handwrittenUrlDraft.trim(),
                      category: 'HANDWRITTEN_ORDER',
                      name: handwrittenUrlDraft.trim().split('/').pop() || 'handwritten',
                    };
                    setHandwrittenFiles((prev) => [...prev, pending]);
                    setHandwrittenUrlDraft('');
                    void runAiExtract(pending);
                  }}
                >
                  {tc('readWithAi')}
                </Button>
              </div>
            ) : null}
            {handwrittenFiles.length > 0 ? (
              <ul className="space-y-1 text-xs text-text-secondary">
                {handwrittenFiles.map((file) => (
                  <li key={file.id} className="flex items-center justify-between gap-2">
                    <span className="truncate">{file.name}</span>
                    <button
                      type="button"
                      className="text-brand hover:underline"
                      disabled={busy}
                      onClick={() =>
                        setHandwrittenFiles((prev) => prev.filter((p) => p.id !== file.id))
                      }
                    >
                      {tCommon('delete')}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
      </FormSection>

      </div>

      <div className="xl:col-span-4">
        <Board tone={canSubmit ? 'success' : 'neutral'} wash={canSubmit ? 'top' : 'none'} className="xl:sticky xl:top-28">
          <Board.Header title={tc('orderSection')} meta={<Stamp tone={canSubmit ? 'success' : 'neutral'} size="sm">{lineCount}</Stamp>} />
          <Ledger className="px-5">
            {basketLines.length ? (
              basketLines.map((line) => <LedgerRow key={line.id} label={line.customProductName || line.variantLabel || line.productId} value={<Ltr>× {line.quantity}</Ltr>} />)
            ) : (
              <LedgerRow label={productName.trim() || tc('modelName')} value={<Ltr>× {quantity || '1'}</Ltr>} tone={productName.trim() ? 'success' : 'neutral'} stamp />
            )}
            <LedgerRow label={tc('preferredDeliveryDate')} value={preferredDeliveryDate ? <Ltr>{preferredDeliveryDate}</Ltr> : '—'} tone={preferredDeliveryDate ? 'info' : 'neutral'} stamp />
            <LedgerRow label={tc('fabricSection')} value={fabric.trim() || (fabricDescription.trim() ? tc('fabricDescription') : '—')} />
            <LedgerRow label={tc('deliveryAddress')} value={deliveryAddress.trim() ? <span className="line-clamp-2 text-end">{deliveryAddress}</span> : '—'} tone={customerDone ? 'success' : 'warning'} stamp />
            <LedgerRow label={tc('attachmentsSection')} value={<Ltr>{orderImages.length + handwrittenFiles.length}</Ltr>} />
          </Ledger>
          <Board.Footer>
            <Button onClick={() => void submit(false)} loading={loading && !aiBusy} disabled={!canSubmit || busy} className="flex-1">
              {tCommon('submit')}
            </Button>
            <Button variant="secondary" onClick={() => void submit(true)} loading={loading && !aiBusy} disabled={!canSubmit || busy}>
              {tc('saveDraft')}
            </Button>
          </Board.Footer>
        </Board>
      </div>
      </div>

      <ActionDock className="md:hidden" note={<Stamp tone={canSubmit ? 'success' : 'neutral'} size="sm">{tc('lines')}: {lineCount}</Stamp>}>
        <Button variant="secondary" onClick={() => void submit(true)} loading={loading} disabled={!canSubmit || busy}>
          {tc('saveDraft')}
        </Button>
        <Button onClick={() => void submit(false)} loading={loading} disabled={!canSubmit || busy} className="flex-1">
          {tCommon('submit')}
        </Button>
      </ActionDock>
    </div>
  );
}
