import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { can } from '@maher/permissions';
import { useAuth } from '@/auth/AuthProvider';
import {
  deleteDealerPrice,
  getAdminProduct,
  listProductCategories,
  listProductDealerPrices,
  patchAdminProduct,
  upsertDealerPrice,
  type AdminBomLine,
  type AdminCustomMeasurement,
  type AdminProductDetail,
  type AdminProductPatch,
} from '@/api/modules/catalogAdmin';
import { listCustomers } from '@/api/modules/customers';
import { isApiError } from '@/api/errors';
import { queryKeys } from '@/api/queryKeys';
import { toastMessageForError } from '@/api/queryClient';
import { AppText } from '@/components/AppText';
import { BackButton } from '@/components/BackButton';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { useToast } from '@/components/feedback/Toast';
import { TextField } from '@/components/forms/TextField';
import { AppScreen } from '@/components/layout/AppScreen';
import { useNetwork } from '@/components/network/NetworkProvider';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { MoreBoard } from '@/features/more/components/MoreBoard';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useAccessoryCamera } from '@/features/inventory/components/AccessoryCameraProvider';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics, ListItemEnter } from '@/motion';
import { SURFACE_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import { resolveAppFontStyle, useTheme } from '@/theme';
import { CategoryPickerSheet } from './components/CategoryPickerSheet';
import { BomMaterialPickerSheet } from './components/BomMaterialPickerSheet';
import { MeasurementValuePanel } from './components/MeasurementValueSheet';
import { ProductGalleryBoard } from './components/ProductGalleryBoard';
import { ProductPhotoSourceSheet } from './components/ProductPhotoSourceSheet';
import { mergeProductPhotos, splitProductPhotos } from './productPhotos';
import { ProductWorkflowSection } from '@/features/workflow/components/ProductWorkflowSection';
import {
  pickProductPhotosFromLibrary,
  PRODUCT_PHOTO_ASPECT_RATIO,
  uploadProductImage,
  uploadProductPhotoUri,
} from './productPhotoUpload';

function displayUnit(unit?: string | null): string {
  const u = String(unit ?? 'cm').trim();
  return u || 'cm';
}

function num(v: number | string | null | undefined): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function strNum(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

type Draft = {
  nameEn: string;
  nameAr: string;
  description: string;
  categoryId: string | null;
  photos: string[];
  isActive: boolean;
  width: string;
  height: string;
  depth: string;
  seatHeight: string;
  basePrice: string;
  adminNotes: string;
  customMeasurements: AdminCustomMeasurement[];
  bomLines: AdminBomLine[];
};

function toDraft(p: AdminProductDetail): Draft {
  return {
    nameEn: p.nameEn ?? '',
    nameAr: p.nameAr ?? '',
    description: p.description ?? '',
    categoryId: p.categoryId ?? null,
    photos: mergeProductPhotos(p.imageUrl, p.galleryUrls),
    isActive: p.isActive !== false,
    width: num(p.width) != null ? String(num(p.width)) : '',
    height: num(p.height) != null ? String(num(p.height)) : '',
    depth: num(p.depth) != null ? String(num(p.depth)) : '',
    seatHeight: num(p.seatHeight) != null ? String(num(p.seatHeight)) : '',
    basePrice: num(p.basePrice) != null ? String(num(p.basePrice)) : '',
    adminNotes: p.adminNotes ?? '',
    customMeasurements: [...(p.customMeasurements ?? [])],
    bomLines: [...(p.bomLines ?? [])],
  };
}

type Props = { productId: string };

/**
 * Admin product manage PDP — website parity boards (product, measurements,
 * costs, seller prices, materials, admin notes). Dealers never see this screen.
 */
export function AdminProductDetailScreen({ productId }: Props) {
  const { user } = useAuth();
  const { t, formatCurrency, locale, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  /** Prefer i18n; fall back if Metro still has a stale @maher/i18n bundle. */
  const label = (key: string, fallback: string) => {
    const value = t(key);
    return value === key ? fallback : value;
  };
  const { showOfflineBanner } = useNetwork();
  const { showToast } = useToast();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { openAccessoryCamera } = useAccessoryCamera();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const allowed = can(user, 'catalog.manage');
  const canPrice = can(user, 'customer.update');

  const [draft, setDraft] = useState<Draft | null>(null);
  const [sellerSheet, setSellerSheet] = useState(false);
  const [sellerEditing, setSellerEditing] = useState(false);
  const [sellerCustomerLabel, setSellerCustomerLabel] = useState('');
  const [materialSheet, setMaterialSheet] = useState(false);
  const [measureSheet, setMeasureSheet] = useState(false);
  const [categorySheet, setCategorySheet] = useState(false);
  const [photoSheet, setPhotoSheet] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [measureValueSheet, setMeasureValueSheet] = useState(false);
  const [sellerCustomerId, setSellerCustomerId] = useState<string | null>(null);
  const [sellerPrice, setSellerPrice] = useState('');
  const [sellerQ, setSellerQ] = useState('');
  const [newMeasure, setNewMeasure] = useState<{
    nameEn: string;
    nameAr: string;
    value: string;
    unit: string;
  }>({ nameEn: '', nameAr: '', value: '', unit: 'cm' });

  const productQuery = useQuery({
    queryKey: queryKeys.catalog.adminDetail(productId),
    queryFn: () => getAdminProduct(productId),
    enabled: allowed && Boolean(productId),
  });

  const pricesQuery = useQuery({
    queryKey: queryKeys.catalog.dealerPrices(productId),
    queryFn: () => listProductDealerPrices(productId),
    enabled: allowed && Boolean(productId),
  });

  const categoriesQuery = useQuery({
    queryKey: queryKeys.catalog.productCategories(),
    queryFn: () => listProductCategories({ page: 1, pageSize: 100 }),
    enabled: allowed,
  });

  const customersQuery = useQuery({
    queryKey: ['customers', 'picker', sellerQ],
    queryFn: () => listCustomers({ page: 1, pageSize: 30, q: sellerQ || undefined }),
    enabled: sellerSheet && canPrice && !sellerEditing,
  });

  const pricedCustomerIds = useMemo(() => {
    const ids = new Set<string>();
    for (const row of pricesQuery.data ?? []) {
      if (row.customerId) ids.add(row.customerId);
    }
    return ids;
  }, [pricesQuery.data]);

  const addSellerCandidates = useMemo(() => {
    return (customersQuery.data?.data ?? []).filter((c) => !pricedCustomerIds.has(c.id));
  }, [customersQuery.data?.data, pricedCustomerIds]);

  const openAddSellerPrice = () => {
    setSellerEditing(false);
    setSellerCustomerLabel('');
    setSellerCustomerId(null);
    setSellerPrice('');
    setSellerQ('');
    setSellerSheet(true);
  };

  const openEditSellerPrice = (row: {
    customerId: string;
    price: number | string;
    name: string;
  }) => {
    setSellerEditing(true);
    setSellerCustomerLabel(row.name);
    setSellerCustomerId(row.customerId);
    setSellerPrice(String(row.price));
    setSellerQ('');
    setSellerSheet(true);
  };

  useEffect(() => {
    if (productQuery.data) setDraft(toDraft(productQuery.data));
  }, [productQuery.data]);

  const saveMutation = useMutation({
    mutationFn: (body: AdminProductPatch) => patchAdminProduct(productId, body),
    onSuccess: (data) => {
      void haptics.confirmMedium();
      setDraft(toDraft(data));
      void queryClient.invalidateQueries({ queryKey: queryKeys.catalog.adminDetail(productId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.catalog.lists() });
      showToast({ message: t('mobile.adminProduct.saved'), variant: 'success' });
    },
    onError: (err) => {
      void haptics.error();
      showToast({
        message: isApiError(err) ? toastMessageForError(err) : t('mobile.adminProduct.saveError'),
        variant: 'error',
      });
    },
  });

  const upsertPriceMutation = useMutation({
    mutationFn: () => {
      if (!sellerCustomerId) throw new Error('customer');
      const price = strNum(sellerPrice);
      if (price == null) throw new Error('price');
      return upsertDealerPrice({
        customerId: sellerCustomerId,
        productId,
        price,
      });
    },
    onSuccess: () => {
      void haptics.confirmLight();
      setSellerSheet(false);
      setSellerEditing(false);
      setSellerCustomerLabel('');
      setSellerCustomerId(null);
      setSellerPrice('');
      void queryClient.invalidateQueries({ queryKey: queryKeys.catalog.dealerPrices(productId) });
      showToast({ message: t('catalog.sellerPriceSaved'), variant: 'success' });
    },
    onError: (err) => {
      void haptics.error();
      showToast({
        message: isApiError(err) ? toastMessageForError(err) : t('mobile.adminProduct.saveError'),
        variant: 'error',
      });
    },
  });

  const deletePriceMutation = useMutation({
    mutationFn: (row: { customerId: string; id: string }) =>
      deleteDealerPrice(row.customerId, row.id),
    onSuccess: () => {
      void haptics.selection();
      void queryClient.invalidateQueries({ queryKey: queryKeys.catalog.dealerPrices(productId) });
    },
  });

  const productionCost = num(productQuery.data?.productionCost ?? productQuery.data?.manufacturingCost);
  const categories = categoriesQuery.data?.data ?? [];
  const dealerPrices = pricesQuery.data ?? [];
  const footerPad =
    theme.spacing['3xl'] + SURFACE_TAB_BAR_CLEARANCE + Math.max(insets.bottom, theme.spacing.sm);
  const sheetLocksPageScroll =
    measureSheet ||
    materialSheet ||
    categorySheet ||
    photoSheet ||
    sellerSheet;

  const categoryLabel = useMemo(() => {
    const id = draft?.categoryId;
    if (!id) return null;
    const cat = categories.find((c) => c.id === id) ?? productQuery.data?.category;
    if (!cat) return null;
    if (locale === 'ar') return cat.nameAr || cat.nameEn;
    if (locale === 'he') return cat.nameHe || cat.nameEn;
    return cat.nameEn || cat.nameAr;
  }, [draft?.categoryId, categories, productQuery.data?.category, locale]);

  const onSave = () => {
    if (!draft) return;
    const split = splitProductPhotos(draft.photos);
    const body: AdminProductPatch = {
      nameEn: draft.nameEn.trim(),
      nameAr: draft.nameAr.trim(),
      description: draft.description.trim() || null,
      categoryId: draft.categoryId,
      imageUrl: split.imageUrl,
      galleryUrls: split.galleryUrls,
      isActive: draft.isActive,
      width: strNum(draft.width),
      height: strNum(draft.height),
      depth: strNum(draft.depth),
      seatHeight: strNum(draft.seatHeight),
      basePrice: strNum(draft.basePrice) ?? undefined,
      adminNotes: draft.adminNotes.trim() || null,
      customMeasurements: draft.customMeasurements,
      bomDefaults: {
        materials: draft.bomLines.map((l) => ({
          sku: l.sku,
          qty: l.qty,
          unitCost: l.unitCost,
          category: l.category ?? undefined,
        })),
      },
    };
    saveMutation.mutate(body);
  };

  if (!allowed) {
    return (
      <AppScreen>
        <EmptyState title={t('mobile.noModules')} description={t('mobile.noModulesHint')} />
      </AppScreen>
    );
  }

  if (productQuery.isPending && !productQuery.data) {
    return (
      <AppScreen>
        <View style={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
          <ActivityIndicator color={colors.brand} />
        </View>
      </AppScreen>
    );
  }

  if (productQuery.isError && !productQuery.data) {
    return (
      <AppScreen>
        {showOfflineBanner ? <OfflineBanner /> : null}
        <ErrorState
          title={t('mobile.productDetail.errorTitle')}
          description={t('mobile.productDetail.errorBody')}
          retryLabel={t('mobile.productDetail.retry')}
          onRetry={() => void productQuery.refetch()}
        />
      </AppScreen>
    );
  }

  if (!draft) {
    return (
      <AppScreen>
        <ActivityIndicator color={colors.brand} />
      </AppScreen>
    );
  }

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => (d ? { ...d, [key]: value } : d));

  const appendPhotos = (urls: string[]) => {
    if (!urls.length) return;
    setDraft((d) => {
      if (!d) return d;
      const next = [...d.photos];
      for (const u of urls) {
        if (u && !next.includes(u)) next.push(u);
      }
      return { ...d, photos: next };
    });
  };

  const removePhotoAt = (index: number) => {
    setDraft((d) => {
      if (!d) return d;
      const next = d.photos.filter((_, i) => i !== index);
      setPhotoIndex((cur) => {
        if (!next.length) return 0;
        if (cur >= next.length) return next.length - 1;
        if (cur > index) return cur - 1;
        return cur;
      });
      return { ...d, photos: next };
    });
  };

  const takeProductPhotoFlow = async () => {
    const localUri = await openAccessoryCamera({
      title: t('catalog.takeProductPhoto'),
      hint: t('catalog.productPhotosTapHint'),
      aspectRatio: PRODUCT_PHOTO_ASPECT_RATIO,
    });
    if (!localUri) return;
    setPhotoUploading(true);
    try {
      const url = await uploadProductPhotoUri(localUri);
      appendPhotos([url]);
      void haptics.confirmLight();
      showToast({
        variant: 'success',
        message: label('catalog.productPhotoSaved', 'Product photos updated.'),
      });
    } catch (err) {
      void haptics.error();
      showToast({
        variant: 'error',
        message: isApiError(err)
          ? toastMessageForError(err)
          : label('catalog.productPhotoUploadError', 'Couldn’t upload photo.'),
      });
    } finally {
      setPhotoUploading(false);
    }
  };

  const chooseProductPhotoFlow = async () => {
    const picked = await pickProductPhotosFromLibrary(t, { selectionLimit: 12 });
    if (!picked.length) return;
    setPhotoUploading(true);
    try {
      const urls: string[] = [];
      for (const asset of picked) {
        urls.push(await uploadProductImage(asset.uri, asset.fileName, asset.mimeType));
      }
      appendPhotos(urls);
      void haptics.confirmLight();
      showToast({
        variant: 'success',
        message: label('catalog.productPhotoSaved', 'Product photos updated.'),
      });
    } catch (err) {
      void haptics.error();
      showToast({
        variant: 'error',
        message: isApiError(err)
          ? toastMessageForError(err)
          : label('catalog.productPhotoUploadError', 'Couldn’t upload photo.'),
      });
    } finally {
      setPhotoUploading(false);
    }
  };

  return (
    <AppScreen edges={{ top: true, bottom: false }} style={{ paddingHorizontal: 0 }}>
      <View
        style={{
          paddingHorizontal: theme.spacing.lg,
          paddingBottom: theme.spacing.sm,
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
          minHeight: theme.sizes.touch.min,
        }}
      >
        <BackButton onPress={() => router.back()} label={t('mobile.productDetail.back')} />
        <AppText variant="title" weight={titleWeight} style={{ flex: 1 }} numberOfLines={1}>
          {t('catalog.product')}
        </AppText>
      </View>

      <ScrollView
        scrollEnabled={!sheetLocksPageScroll}
        refreshControl={
          <RefreshControl
            refreshing={productQuery.isRefetching && !productQuery.isPending}
            onRefresh={() => {
              void productQuery.refetch();
              void pricesQuery.refetch();
            }}
            tintColor={colors.brand}
          />
        }
        contentContainerStyle={{
          paddingHorizontal: theme.spacing.lg,
          paddingBottom: footerPad,
          gap: theme.spacing.md,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {showOfflineBanner ? <OfflineBanner /> : null}

        {/* Product board */}
        <ListItemEnter index={0}>
          <SectionBoard title={t('catalog.product')} titleWeight={titleWeight}>
            <ProductGalleryBoard
              photos={draft.photos}
              selectedIndex={photoIndex}
              onSelectIndex={setPhotoIndex}
              onRemoveAt={removePhotoAt}
              onAddPress={() => setPhotoSheet(true)}
              uploading={photoUploading}
            />

            <View style={{ gap: theme.spacing.sm }}>
              <View style={{ gap: theme.spacing.xs }}>
                <AppText variant="label" color="secondary">
                  {t('catalog.category')}
                </AppText>
                <AnimatedPressable
                  variant="button"
                  accessibilityRole="button"
                  accessibilityLabel={t('catalog.category')}
                  onPress={() => {
                    void haptics.selection();
                    setCategorySheet(true);
                  }}
                  style={{
                    minHeight: theme.sizes.touch.min,
                    borderRadius: theme.radius.xl,
                    borderWidth: 1,
                    borderColor: colors.borderStrong,
                    backgroundColor: colors.surface,
                    paddingHorizontal: theme.spacing.lg,
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    alignItems: 'center',
                    gap: theme.spacing.sm,
                    overflow: 'hidden',
                    ...orderBoardShadow(colorScheme),
                  }}
                >
                  {draft.categoryId ? (
                    <View
                      pointerEvents="none"
                      style={{
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        ...(isRTL ? { right: 0 } : { left: 0 }),
                        width: 3,
                        backgroundColor: colors.brand,
                        opacity: 0.7,
                      }}
                    />
                  ) : null}
                  <View
                    style={{
                      flex: 1,
                      ...(isRTL
                        ? { paddingRight: draft.categoryId ? 4 : 0 }
                        : { paddingLeft: draft.categoryId ? 4 : 0 }),
                    }}
                  >
                    <AppText
                      variant="body"
                      numberOfLines={1}
                      style={{
                        color: categoryLabel ? colors.textPrimary : colors.textMuted,
                      }}
                    >
                      {categoryLabel ?? t('catalog.pickCategory')}
                    </AppText>
                  </View>
                  <Ionicons name="chevron-down" size={18} color={colors.brand} />
                </AnimatedPressable>
              </View>
            </View>

            <TextField
              label={t('catalog.nameEn')}
              value={draft.nameEn}
              onChangeText={(v) => set('nameEn', v)}
            />
            <TextField
              label={t('catalog.nameAr')}
              value={draft.nameAr}
              onChangeText={(v) => set('nameAr', v)}
            />
            <TextField
              label={t('catalog.description')}
              value={draft.description}
              onChangeText={(v) => set('description', v)}
              multiline
              growMinHeight={72}
            />
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: theme.spacing.md,
              }}
            >
              <AppText variant="body">{t('catalog.active')}</AppText>
              <Switch
                value={draft.isActive}
                onValueChange={(v) => {
                  void haptics.selection();
                  set('isActive', v);
                }}
                trackColor={{ false: colors.border, true: colors.brandSoft }}
                thumbColor={draft.isActive ? colors.brand : colors.surfaceSecondary}
              />
            </View>
          </SectionBoard>
        </ListItemEnter>

        {/* Measurements */}
        <ListItemEnter index={1}>
          <SectionBoard
            title={t('catalog.measurements')}
            titleWeight={titleWeight}
            actionLabel={t('catalog.addMeasurement')}
            onAction={() => {
              setNewMeasure({ nameEn: '', nameAr: '', value: '', unit: 'cm' });
              setMeasureValueSheet(false);
              setMeasureSheet(true);
            }}
          >
            <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
              {(
                [
                  ['width', t('catalog.width')],
                  ['height', t('catalog.height')],
                  ['depth', t('catalog.depth')],
                  ['seatHeight', t('catalog.seatHeight')],
                ] as const
              ).map(([key, label]) => (
                <View key={key} style={{ width: '47%', flexGrow: 1 }}>
                  <TextField
                    label={label}
                    value={draft[key]}
                    onChangeText={(v) => set(key, v)}
                    keyboardType="decimal-pad"
                  />
                </View>
              ))}
            </View>
            {draft.customMeasurements.length ? (
              <View style={{ gap: theme.spacing.sm }}>
                <View
                  style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <AppText
                    variant="caption"
                    style={{
                      textTransform: 'uppercase',
                      letterSpacing: 0.7,
                      fontSize: 11,
                      color: colors.brand,
                    }}
                  >
                    {t('catalog.customMeasurements')}
                  </AppText>
                  <AppText variant="caption" color="muted" dir="ltr">
                    {draft.customMeasurements.length}
                  </AppText>
                </View>
                <CappedNestedScroll
                  itemCount={draft.customMeasurements.length}
                  rowEstimate={FLOOR_ROW_ESTIMATE.measurement}
                  gap={theme.spacing.sm}
                >
                  {draft.customMeasurements.map((m, idx) => {
                    const name =
                      locale === 'ar' ? m.nameAr || m.nameEn : m.nameEn || m.nameAr;
                    const secondary =
                      locale === 'ar'
                        ? m.nameEn && m.nameEn !== name
                          ? m.nameEn
                          : null
                        : m.nameAr && m.nameAr !== name
                          ? m.nameAr
                          : null;
                    const valueLabel =
                      m.value != null ? `${m.value} ${displayUnit(m.unit)}` : '—';
                    return (
                      <MeasurementFloorRow
                        key={`${m.nameEn}-${idx}`}
                        index={idx}
                        name={name || '—'}
                        secondary={secondary}
                        valueLabel={valueLabel}
                        onRemove={() => {
                          set(
                            'customMeasurements',
                            draft.customMeasurements.filter((_, i) => i !== idx),
                          );
                        }}
                      />
                    );
                  })}
                </CappedNestedScroll>
              </View>
            ) : (
              <View
                style={{
                  borderRadius: theme.radius.xl,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.surfaceSecondary,
                  paddingVertical: theme.spacing.xl,
                  paddingHorizontal: theme.spacing.lg,
                  alignItems: 'center',
                  gap: theme.spacing.sm,
                }}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Ionicons name="resize-outline" size={20} color={colors.textMuted} />
                </View>
                <AppText variant="caption" color="muted" style={{ textAlign: 'center' }}>
                  {t('catalog.noCustomMeasurements')}
                </AppText>
              </View>
            )}
          </SectionBoard>
        </ListItemEnter>

        {/* Costs */}
        <ListItemEnter index={2}>
          <SectionBoard title={t('catalog.costs')} titleWeight={titleWeight}>
            <View style={{ gap: theme.spacing.md }}>
              <View style={{ gap: theme.spacing.xs }}>
                <TextField
                  label={t('catalog.basePrice')}
                  value={draft.basePrice}
                  onChangeText={(v) => set('basePrice', v)}
                  keyboardType="decimal-pad"
                />
                <AppText variant="caption" color="muted">
                  {t('catalog.basePriceHint')}
                </AppText>
              </View>
              <View
                style={{
                  padding: theme.spacing.md,
                  borderRadius: theme.radius.xl,
                  backgroundColor: colors.surfaceSecondary,
                  borderWidth: 1,
                  borderColor: colors.border,
                  gap: 4,
                }}
              >
                <AppText variant="caption" color="muted">
                  {t('catalog.manufacturingCost')}
                </AppText>
                <AppText variant="title" weight="semibold" dir="ltr">
                  {productionCost != null ? formatCurrency(productionCost) : '—'}
                </AppText>
                <AppText variant="caption" color="muted">
                  {t('catalog.productionCostHint')}
                </AppText>
              </View>
            </View>
          </SectionBoard>
        </ListItemEnter>

        {/* Seller prices */}
        <ListItemEnter index={3}>
          <SectionBoard
            title={t('catalog.sellerPrices')}
            titleWeight={titleWeight}
            actionLabel={canPrice ? t('catalog.addSellerPrice') : undefined}
            onAction={canPrice ? openAddSellerPrice : undefined}
          >
            <AppText variant="caption" color="muted">
              {t('catalog.sellerPricesHint')}
            </AppText>
            {dealerPrices.length === 0 ? (
              <View
                style={{
                  borderRadius: theme.radius.xl,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.surfaceSecondary,
                  paddingVertical: theme.spacing.xl,
                  paddingHorizontal: theme.spacing.lg,
                  alignItems: 'center',
                  gap: theme.spacing.sm,
                }}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Ionicons name="pricetag-outline" size={20} color={colors.textMuted} />
                </View>
                <AppText variant="caption" color="muted" style={{ textAlign: 'center' }}>
                  {t('customers.noPrices')}
                </AppText>
              </View>
            ) : (
              <View style={{ gap: theme.spacing.sm }}>
                <View
                  style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <AppText
                    variant="caption"
                    style={{
                      textTransform: 'uppercase',
                      letterSpacing: 0.7,
                      fontSize: 11,
                      color: colors.brand,
                    }}
                  >
                    {t('catalog.sellerPrices')}
                  </AppText>
                  <AppText variant="caption" color="muted" dir="ltr">
                    {dealerPrices.length}
                  </AppText>
                </View>
                <CappedNestedScroll
                  itemCount={dealerPrices.length}
                  rowEstimate={FLOOR_ROW_ESTIMATE.seller}
                  gap={theme.spacing.sm}
                >
                  {dealerPrices.map((row, index) => {
                    const name =
                      locale === 'ar'
                        ? row.customer?.nameAr || row.customer?.name || row.customer?.nameEn
                        : locale === 'he'
                          ? row.customer?.nameHe || row.customer?.name || row.customer?.nameEn
                          : row.customer?.nameEn || row.customer?.name || row.customer?.nameAr;
                    const initial = (name || row.customer?.code || '?')
                      .trim()
                      .charAt(0)
                      .toUpperCase();
                    return (
                      <SellerPriceFloorRow
                        key={row.id}
                        index={index}
                        name={name || '—'}
                        code={row.customer?.code ?? ''}
                        initial={initial}
                        priceLabel={formatCurrency(Number(row.price))}
                        canEdit={canPrice}
                        canDelete={canPrice}
                        deleting={deletePriceMutation.isPending}
                        onEdit={() =>
                          openEditSellerPrice({
                            customerId: row.customerId,
                            price: row.price,
                            name: name || row.customer?.code || '—',
                          })
                        }
                        onDelete={() =>
                          deletePriceMutation.mutate({
                            customerId: row.customerId,
                            id: row.id,
                          })
                        }
                      />
                    );
                  })}
                </CappedNestedScroll>
              </View>
            )}
          </SectionBoard>
        </ListItemEnter>

        {/* Materials / BOM */}
        <ListItemEnter index={4}>
          <SectionBoard
            title={t('catalog.bomMaterials')}
            titleWeight={titleWeight}
            actionLabel={t('catalog.addMaterial')}
            onAction={() => {
              setMaterialSheet(true);
            }}
          >
            {draft.bomLines.length === 0 ? (
              <View
                style={{
                  borderRadius: theme.radius.xl,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.surfaceSecondary,
                  paddingVertical: theme.spacing.xl,
                  paddingHorizontal: theme.spacing.lg,
                  alignItems: 'center',
                  gap: theme.spacing.sm,
                }}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Ionicons name="cube-outline" size={20} color={colors.textMuted} />
                </View>
                <AppText variant="caption" color="muted" style={{ textAlign: 'center' }}>
                  {t('catalog.noBomMaterials')}
                </AppText>
              </View>
            ) : (
              <CappedNestedScroll
                itemCount={draft.bomLines.length}
                rowEstimate={FLOOR_ROW_ESTIMATE.bom}
                gap={theme.spacing.sm}
              >
                {draft.bomLines.map((line, idx) => {
                  const qtyNum = Math.max(0, Number(line.qty) || 0);
                  const lineTotal = qtyNum * (Number(line.unitCost) || 0);
                  return (
                    <BomFloorRow
                      key={`${line.sku}-${idx}`}
                      index={idx}
                      name={
                        locale === 'ar' ? line.nameAr || line.nameEn : line.nameEn || line.nameAr
                      }
                      sku={line.sku}
                      unitCostLabel={formatCurrency(line.unitCost)}
                      lineTotalLabel={formatCurrency(lineTotal)}
                      qty={String(line.qty)}
                      onQtyChange={(v) => {
                        const q = Math.max(0, Number(v) || 0);
                        set(
                          'bomLines',
                          draft.bomLines.map((l, i) =>
                            i === idx ? { ...l, qty: q, lineCost: q * l.unitCost } : l,
                          ),
                        );
                      }}
                      onRemove={() => {
                        set(
                          'bomLines',
                          draft.bomLines.filter((_, i) => i !== idx),
                        );
                      }}
                    />
                  );
                })}
              </CappedNestedScroll>
            )}
          </SectionBoard>
        </ListItemEnter>

        {/* Admin notes */}
        <ListItemEnter index={5}>
          <SectionBoard title={t('catalog.adminNotes')} titleWeight={titleWeight}>
            <AppText variant="caption" color="muted">
              {t('catalog.adminNotesHint')}
            </AppText>
            <TextField
              value={draft.adminNotes}
              onChangeText={(v) => set('adminNotes', v)}
              placeholder={t('catalog.adminNotesPlaceholder')}
              multiline
              growMinHeight={100}
            />
          </SectionBoard>
        </ListItemEnter>

        <ListItemEnter index={6}>
          <SectionBoard
            title={t('mobile.production.workflow.productSectionTitle')}
            titleWeight={titleWeight}
          >
            <ProductWorkflowSection
              productId={productId}
              showHeading={false}
              titleWeight={titleWeight}
            />
          </SectionBoard>
        </ListItemEnter>

        <ListItemEnter index={7}>
          <PrimaryButton
            label={label('mobile.adminProduct.save', 'Save product')}
            loading={saveMutation.isPending}
            disabled={saveMutation.isPending}
            onPress={onSave}
            haptic="medium"
            trailing={
              saveMutation.isPending ? null : (
                <Ionicons name="checkmark" size={18} color={colors.onBrand} />
              )
            }
            style={{
              borderRadius: theme.radius.xl,
              ...(colorScheme === 'dark'
                ? {
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: 0.35,
                    shadowRadius: 10,
                    elevation: 4,
                  }
                : {
                    shadowColor: colors.brand,
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: 0.28,
                    shadowRadius: 12,
                    elevation: 4,
                  }),
            }}
          />
        </ListItemEnter>
      </ScrollView>

      <CategoryPickerSheet
        open={categorySheet}
        onClose={() => setCategorySheet(false)}
        categories={categories}
        selectedId={draft.categoryId}
        onSelect={(id) => set('categoryId', id)}
      />

      <ProductPhotoSourceSheet
        open={photoSheet}
        onClose={() => setPhotoSheet(false)}
        hasPhoto={draft.photos.length > 0}
        onTakePhoto={() => {
          void takeProductPhotoFlow();
        }}
        onChoosePhoto={() => {
          void chooseProductPhotoFlow();
        }}
        onRemovePhoto={
          draft.photos.length
            ? () => {
                removePhotoAt(photoIndex);
                void haptics.selection();
              }
            : undefined
        }
      />

      {/* Add / edit seller price */}
      <BottomSheet
        open={sellerSheet}
        onClose={() => {
          setSellerSheet(false);
          setSellerEditing(false);
          setSellerCustomerLabel('');
        }}
        title={
          sellerEditing
            ? label('catalog.editSellerPrice', 'Edit seller price')
            : label('catalog.addSellerPrice', 'Add seller price')
        }
        fitContent
        maxHeight={520}
      >
        <View style={{ gap: theme.spacing.md }}>
          {sellerEditing ? (
            <View
              style={{
                borderRadius: theme.radius.xl,
                borderWidth: 1,
                borderColor: colors.borderStrong,
                backgroundColor: colors.surfaceSecondary,
                padding: theme.spacing.md,
                gap: 2,
                overflow: 'hidden',
                ...orderBoardShadow(colorScheme),
              }}
            >
              <AppText variant="caption" color="muted">
                {label('catalog.seller', 'Seller')}
              </AppText>
              <AppText variant="label" weight={titleWeight}>
                {sellerCustomerLabel || '—'}
              </AppText>
            </View>
          ) : (
            <>
              <TextField
                label={t('mobile.catalog.search')}
                value={sellerQ}
                onChangeText={setSellerQ}
                placeholder={t('mobile.orders.filterDealerSearch')}
                returnKeyType="search"
              />
              <ScrollView style={{ maxHeight: 200 }} keyboardShouldPersistTaps="handled">
                {addSellerCandidates.length === 0 ? (
                  <View
                    style={{
                      paddingVertical: theme.spacing.lg,
                      paddingHorizontal: theme.spacing.sm,
                      alignItems: 'center',
                      gap: theme.spacing.xs,
                    }}
                  >
                    <AppText variant="caption" color="muted" style={{ textAlign: 'center' }}>
                      {customersQuery.isLoading
                        ? t('common.loading')
                        : label(
                            'catalog.noSellersLeftForPrice',
                            'Every seller already has a price. Edit a card to change one.',
                          )}
                    </AppText>
                  </View>
                ) : (
                  addSellerCandidates.map((c) => {
                    const active = sellerCustomerId === c.id;
                    const name =
                      locale === 'ar'
                        ? c.nameAr || c.name || c.nameEn
                        : locale === 'he'
                          ? c.nameHe || c.name || c.nameEn
                          : c.nameEn || c.name || c.nameAr;
                    return (
                      <Pressable
                        key={c.id}
                        onPress={() => {
                          void haptics.selection();
                          setSellerCustomerId(c.id);
                        }}
                        style={{
                          paddingVertical: theme.spacing.sm,
                          paddingHorizontal: theme.spacing.sm,
                          borderRadius: theme.radius.lg,
                          backgroundColor: active ? colors.brandSoft : 'transparent',
                          borderWidth: 1,
                          borderColor: active ? colors.brand : colors.border,
                          marginBottom: theme.spacing.xs,
                        }}
                      >
                        <AppText variant="label" weight={active ? 'semibold' : 'regular'}>
                          {name}
                        </AppText>
                        <AppText variant="caption" color="muted" dir="ltr">
                          {c.code}
                        </AppText>
                      </Pressable>
                    );
                  })
                )}
              </ScrollView>
            </>
          )}
          <TextField
            label={t('catalog.price')}
            value={sellerPrice}
            onChangeText={setSellerPrice}
            keyboardType="decimal-pad"
          />
          <PrimaryButton
            label={t('common.save')}
            loading={upsertPriceMutation.isPending}
            disabled={!sellerCustomerId || !sellerPrice.trim()}
            onPress={() => upsertPriceMutation.mutate()}
            style={{ borderRadius: theme.radius.xl }}
          />
        </View>
      </BottomSheet>

      {/* Add material */}
      <BomMaterialPickerSheet
        open={materialSheet}
        onClose={() => setMaterialSheet(false)}
        existingSkus={draft.bomLines.map((l) => l.sku)}
        onPick={(line) => set('bomLines', [...draft.bomLines, line])}
      />

      {/* Add custom measurement */}
      <BottomSheet
        open={measureSheet}
        onClose={() => {
          setMeasureValueSheet(false);
          setMeasureSheet(false);
        }}
        title={
          measureValueSheet
            ? t('catalog.pickMeasurementValue')
            : t('catalog.addMeasurement')
        }
        fitContent
        maxHeight={560}
      >
        {measureValueSheet ? (
          <MeasurementValuePanel
            active={measureValueSheet}
            selected={newMeasure.value}
            unit={newMeasure.unit}
            onBack={() => setMeasureValueSheet(false)}
            onSelect={(value, unit) => {
              setNewMeasure((s) => ({ ...s, value, unit }));
              setMeasureValueSheet(false);
            }}
          />
        ) : (
          <View style={{ gap: theme.spacing.md }}>
            <TextField
              label={t('catalog.measurementNameEn')}
              value={newMeasure.nameEn}
              onChangeText={(v) => setNewMeasure((s) => ({ ...s, nameEn: v }))}
            />
            <TextField
              label={t('catalog.measurementNameAr')}
              value={newMeasure.nameAr}
              onChangeText={(v) => setNewMeasure((s) => ({ ...s, nameAr: v }))}
            />
            <View style={{ gap: theme.spacing.xs }}>
              <AppText variant="label" color="secondary">
                {t('catalog.measurementValue')}
              </AppText>
              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'stretch',
                  gap: theme.spacing.sm,
                }}
              >
                <TextField
                  value={newMeasure.value}
                  onChangeText={(v) => setNewMeasure((s) => ({ ...s, value: v }))}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  containerStyle={{ flex: 1, width: undefined }}
                />
                <View
                  style={{
                    minWidth: 48,
                    paddingHorizontal: theme.spacing.sm,
                    borderRadius: theme.radius.xl,
                    borderWidth: 1,
                    borderColor: colors.borderStrong,
                    backgroundColor: colors.brandSoft,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <AppText variant="caption" weight="semibold" style={{ color: colors.brand }} dir="ltr">
                    {newMeasure.unit}
                  </AppText>
                </View>
                <AnimatedPressable
                  variant="button"
                  accessibilityRole="button"
                  accessibilityLabel={t('catalog.pickMeasurementValue')}
                  onPress={() => {
                    void haptics.selection();
                    setMeasureValueSheet(true);
                  }}
                  style={{
                    minWidth: theme.sizes.touch.min + 8,
                    minHeight: theme.sizes.touch.min,
                    paddingHorizontal: theme.spacing.md,
                    borderRadius: theme.radius.xl,
                    borderWidth: 1,
                    borderColor: colors.borderStrong,
                    backgroundColor: colors.surface,
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 2,
                    overflow: 'hidden',
                    ...orderBoardShadow(colorScheme),
                  }}
                >
                  <View
                    pointerEvents="none"
                    style={{
                      position: 'absolute',
                      top: 0,
                      bottom: 0,
                      ...(isRTL ? { right: 0 } : { left: 0 }),
                      width: 3,
                      backgroundColor: colors.brand,
                      opacity: 0.7,
                    }}
                  />
                  <Ionicons name="options-outline" size={18} color={colors.brand} />
                  <AppText variant="caption" weight="semibold" style={{ color: colors.brand }}>
                    {t('catalog.pickValue')}
                  </AppText>
                </AnimatedPressable>
              </View>
            </View>
            <PrimaryButton
              label={t('catalog.addMeasurement')}
              disabled={!newMeasure.nameEn.trim() || !newMeasure.nameAr.trim()}
              onPress={() => {
                void haptics.confirmLight();
                set('customMeasurements', [
                  ...draft.customMeasurements,
                  {
                    nameEn: newMeasure.nameEn.trim(),
                    nameAr: newMeasure.nameAr.trim(),
                    value: strNum(newMeasure.value),
                    unit: newMeasure.unit,
                  },
                ]);
                setNewMeasure({ nameEn: '', nameAr: '', value: '', unit: 'cm' });
                setMeasureValueSheet(false);
                setMeasureSheet(false);
              }}
              style={{ borderRadius: theme.radius.xl }}
            />
          </View>
        )}
      </BottomSheet>
    </AppScreen>
  );
}

function BomFloorRow({
  index,
  name,
  sku,
  unitCostLabel,
  lineTotalLabel,
  qty,
  onQtyChange,
  onRemove,
}: {
  index: number;
  name: string;
  sku: string;
  unitCostLabel: string;
  lineTotalLabel: string;
  qty: string;
  onQtyChange: (v: string) => void;
  onRemove: () => void;
}) {
  const { colors, theme, colorScheme } = useTheme();
  const { isRTL, locale, t } = useLocale();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  const chipStyle = {
    flexShrink: 0 as const,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  };

  return (
    <ListItemEnter index={index}>
      <View
        style={{
          borderRadius: theme.radius.xl,
          borderWidth: 1,
          borderColor: colors.borderStrong,
          backgroundColor: colors.surfaceSecondary,
          overflow: 'hidden',
          ...orderBoardShadow(colorScheme),
        }}
      >
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            ...(isRTL ? { right: 0 } : { left: 0 }),
            width: 3,
            backgroundColor: colors.brand,
            opacity: 0.75,
          }}
        />
        <View
          style={{
            gap: theme.spacing.sm,
            paddingVertical: theme.spacing.md,
            paddingHorizontal: theme.spacing.md,
            ...(isRTL
              ? { paddingRight: theme.spacing.md + 4 }
              : { paddingLeft: theme.spacing.md + 4 }),
          }}
        >
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'flex-start',
              gap: theme.spacing.md,
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.brandSoft,
                borderWidth: 1,
                borderColor: colors.border,
                marginTop: 2,
              }}
            >
              <Ionicons name="cube-outline" size={18} color={colors.brand} />
            </View>

            <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
              <AppText
                variant="label"
                weight={titleWeight}
                style={{ textAlign: isRTL ? 'right' : 'left' }}
              >
                {name}
              </AppText>
              {sku ? (
                <AppText
                  variant="caption"
                  color="muted"
                  dir="ltr"
                  style={{ textAlign: isRTL ? 'right' : 'left' }}
                >
                  {sku}
                </AppText>
              ) : null}
              <AppText
                variant="caption"
                color="muted"
                dir="ltr"
                style={{ textAlign: isRTL ? 'right' : 'left' }}
              >
                {t('catalog.unitCost')}: {unitCostLabel}
              </AppText>
            </View>
          </View>

          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: theme.spacing.sm,
            }}
          >
            <View style={[chipStyle, { minWidth: 72 }]}>
              <TextInput
                value={qty}
                onChangeText={onQtyChange}
                keyboardType="decimal-pad"
                accessibilityLabel={t('catalog.qty')}
                placeholder="0"
                placeholderTextColor={colors.textMuted}
                style={{
                  minWidth: 40,
                  padding: 0,
                  margin: 0,
                  fontSize: theme.typography.variants.label.fontSize,
                  lineHeight: theme.typography.variants.label.lineHeight,
                  color: colors.brand,
                  fontWeight: titleWeight === 'semibold' ? '600' : '500',
                  textAlign: 'center',
                  ...resolveAppFontStyle(locale, { variant: 'label' }),
                }}
              />
            </View>

            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                gap: theme.spacing.sm,
              }}
            >
              <View style={chipStyle}>
                <AppText
                  variant="label"
                  weight={titleWeight}
                  dir="ltr"
                  style={{ color: colors.brand }}
                >
                  {lineTotalLabel}
                </AppText>
              </View>

              <AnimatedPressable
                variant="button"
                accessibilityRole="button"
                accessibilityLabel={t('common.delete')}
                onPress={() => {
                  void haptics.selection();
                  onRemove();
                }}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.errorSoft,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Ionicons name="trash-outline" size={16} color={colors.error} />
              </AnimatedPressable>
            </View>
          </View>
        </View>
      </View>
    </ListItemEnter>
  );
}

function MeasurementFloorRow({
  index,
  name,
  secondary,
  valueLabel,
  onRemove,
}: {
  index: number;
  name: string;
  secondary?: string | null;
  valueLabel: string;
  onRemove: () => void;
}) {
  const { colors, theme, colorScheme } = useTheme();
  const { isRTL, locale, t } = useLocale();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  return (
    <ListItemEnter index={index}>
      <View
        style={{
          borderRadius: theme.radius.xl,
          borderWidth: 1,
          borderColor: colors.borderStrong,
          backgroundColor: colors.surfaceSecondary,
          overflow: 'hidden',
          ...orderBoardShadow(colorScheme),
        }}
      >
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            ...(isRTL ? { right: 0 } : { left: 0 }),
            width: 3,
            backgroundColor: colors.brand,
            opacity: 0.75,
          }}
        />
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: theme.spacing.md,
            paddingVertical: theme.spacing.md,
            paddingHorizontal: theme.spacing.md,
            ...(isRTL
              ? { paddingRight: theme.spacing.md + 4 }
              : { paddingLeft: theme.spacing.md + 4 }),
          }}
        >
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.brandSoft,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Ionicons name="resize-outline" size={18} color={colors.brand} />
          </View>

          <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
            <AppText
              variant="label"
              weight={titleWeight}
              numberOfLines={1}
              style={{ textAlign: isRTL ? 'right' : 'left' }}
            >
              {name}
            </AppText>
            {secondary ? (
              <AppText
                variant="caption"
                color="muted"
                numberOfLines={1}
                style={{ textAlign: isRTL ? 'right' : 'left' }}
              >
                {secondary}
              </AppText>
            ) : null}
          </View>

          <View
            style={{
              paddingHorizontal: theme.spacing.md,
              paddingVertical: theme.spacing.sm,
              borderRadius: theme.radius.lg,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.borderStrong,
            }}
          >
            <AppText
              variant="label"
              weight={titleWeight}
              dir="ltr"
              style={{ color: colors.brand }}
            >
              {valueLabel}
            </AppText>
          </View>

          <AnimatedPressable
            variant="button"
            accessibilityRole="button"
            accessibilityLabel={t('common.delete')}
            onPress={() => {
              void haptics.selection();
              onRemove();
            }}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.errorSoft,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Ionicons name="trash-outline" size={16} color={colors.error} />
          </AnimatedPressable>
        </View>
      </View>
    </ListItemEnter>
  );
}

function SellerPriceFloorRow({
  index,
  name,
  code,
  initial,
  priceLabel,
  canEdit,
  canDelete,
  deleting,
  onEdit,
  onDelete,
}: {
  index: number;
  name: string;
  code: string;
  initial: string;
  priceLabel: string;
  canEdit?: boolean;
  canDelete: boolean;
  deleting?: boolean;
  onEdit?: () => void;
  onDelete: () => void;
}) {
  const { colors, theme, colorScheme } = useTheme();
  const { isRTL, locale, t } = useLocale();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  return (
    <ListItemEnter index={Math.min(index, 6)}>
      <View
        style={{
          borderRadius: theme.radius.xl,
          borderWidth: 1,
          borderColor: colors.borderStrong,
          backgroundColor: colors.surfaceSecondary,
          overflow: 'hidden',
          ...orderBoardShadow(colorScheme),
        }}
      >
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            ...(isRTL ? { right: 0 } : { left: 0 }),
            width: 3,
            backgroundColor: colors.brand,
            opacity: 0.75,
          }}
        />
        <View
          style={{
            gap: theme.spacing.sm,
            paddingVertical: theme.spacing.md,
            paddingHorizontal: theme.spacing.md,
            ...(isRTL
              ? { paddingRight: theme.spacing.md + 4 }
              : { paddingLeft: theme.spacing.md + 4 }),
          }}
        >
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'flex-start',
              gap: theme.spacing.md,
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.brandSoft,
                borderWidth: 1,
                borderColor: colors.border,
                marginTop: 2,
              }}
            >
              <AppText variant="label" weight={titleWeight} style={{ color: colors.brand }}>
                {initial}
              </AppText>
            </View>

            <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
              <AppText
                variant="label"
                weight={titleWeight}
                style={{ textAlign: isRTL ? 'right' : 'left' }}
              >
                {name}
              </AppText>
              {code ? (
                <AppText
                  variant="caption"
                  color="muted"
                  dir="ltr"
                  style={{ textAlign: isRTL ? 'right' : 'left' }}
                >
                  {code}
                </AppText>
              ) : null}
            </View>
          </View>

          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: theme.spacing.sm,
            }}
          >
            {canEdit && onEdit ? (
              <AnimatedPressable
                variant="button"
                accessibilityRole="button"
                accessibilityLabel={t('common.edit')}
                onPress={() => {
                  void haptics.selection();
                  onEdit();
                }}
                style={{
                  flexShrink: 0,
                  paddingHorizontal: theme.spacing.md,
                  paddingVertical: theme.spacing.sm,
                  borderRadius: theme.radius.lg,
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.borderStrong,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <AppText
                  variant="label"
                  weight={titleWeight}
                  style={{ color: colors.brand }}
                >
                  {t('common.edit')}
                </AppText>
              </AnimatedPressable>
            ) : (
              <View />
            )}

            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                gap: theme.spacing.sm,
              }}
            >
              <View
                style={{
                  flexShrink: 0,
                  paddingHorizontal: theme.spacing.md,
                  paddingVertical: theme.spacing.sm,
                  borderRadius: theme.radius.lg,
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.borderStrong,
                }}
              >
                <AppText
                  variant="label"
                  weight={titleWeight}
                  dir="ltr"
                  style={{ color: colors.brand }}
                >
                  {priceLabel}
                </AppText>
              </View>

              {canDelete ? (
                <AnimatedPressable
                  variant="button"
                  accessibilityRole="button"
                  accessibilityLabel={t('common.delete')}
                  disabled={deleting}
                  onPress={() => {
                    void haptics.selection();
                    onDelete();
                  }}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: colors.errorSoft,
                    borderWidth: 1,
                    borderColor: colors.border,
                    opacity: deleting ? 0.5 : 1,
                  }}
                >
                  <Ionicons name="trash-outline" size={16} color={colors.error} />
                </AnimatedPressable>
              ) : null}
            </View>
          </View>
        </View>
      </View>
    </ListItemEnter>
  );
}

/** Floor board row heights used to pin nested lists inside the page ScrollView. */
const FLOOR_ROW_ESTIMATE = {
  measurement: 84,
  seller: 92,
  bom: 152,
} as const;

const FLOOR_LIST_VISIBLE_ROWS = 3;

/**
 * Nested ScrollViews ignore maxHeight inside a parent ScrollView on iOS.
 * Few items stay natural height; longer lists pin a fixed box and scroll in-place.
 */
function CappedNestedScroll({
  itemCount,
  rowEstimate,
  gap,
  visibleRows = FLOOR_LIST_VISIBLE_ROWS,
  children,
}: {
  itemCount: number;
  rowEstimate: number;
  gap: number;
  visibleRows?: number;
  children: ReactNode;
}) {
  const scrollable = itemCount > visibleRows;
  const capHeight =
    visibleRows * rowEstimate + Math.max(0, visibleRows - 1) * gap;

  if (!scrollable) {
    return <View style={{ gap }}>{children}</View>;
  }

  return (
    <View style={{ height: capHeight, overflow: 'hidden' }}>
      <ScrollView
        nestedScrollEnabled
        showsVerticalScrollIndicator
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1 }}
        contentContainerStyle={{ gap, paddingBottom: 2 }}
      >
        {children}
      </ScrollView>
    </View>
  );
}

function SectionBoard({
  title,
  titleWeight,
  actionLabel,
  onAction,
  children,
}: {
  title: string;
  titleWeight: 'medium' | 'semibold';
  actionLabel?: string;
  onAction?: () => void;
  children: ReactNode;
}) {
  const { colors, theme } = useTheme();
  const { isRTL } = useLocale();

  return (
    <MoreBoard
      style={{
        padding: theme.spacing.lg,
        paddingLeft: isRTL ? theme.spacing.lg : theme.spacing.lg + 4,
        paddingRight: isRTL ? theme.spacing.lg + 4 : theme.spacing.lg,
        gap: theme.spacing.md,
      }}
    >
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.sm,
          paddingBottom: theme.spacing.sm,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        }}
      >
        <AppText variant="label" weight={titleWeight} style={{ flex: 1 }}>
          {title}
        </AppText>
        {actionLabel && onAction ? (
          <SecondaryButton
            label={`+ ${actionLabel}`}
            onPress={() => {
              void haptics.selection();
              onAction();
            }}
            style={{
              borderRadius: theme.radius.xl,
              paddingHorizontal: theme.spacing.md,
              minHeight: 36,
            }}
          />
        ) : null}
      </View>
      {children}
    </MoreBoard>
  );
}
