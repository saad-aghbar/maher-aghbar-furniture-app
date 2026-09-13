import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { can } from '@maher/permissions';
import { useAuth } from '@/auth/AuthProvider';
import {
  getAdminProduct,
  listProductCategories,
  listProductVariants,
  patchAdminProduct,
  type AdminProductDetail,
  type AdminProductPatch,
} from '@/api/modules/catalogAdmin';
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
import { MoreBoard } from '@/features/more/components/MoreBoard';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useAccessoryCamera } from '@/features/inventory/components/AccessoryCameraProvider';
import { useLocale } from '@/i18n';
import { resolveTrilingualIfChanged } from '@/i18n/resolveTrilingualName';
import { AnimatedPressable, haptics, ListItemEnter } from '@/motion';
import { surfaceTabBarStackInset } from '@/navigation/tabBarClearance';
import { useTheme } from '@/theme';
import { CategoryPickerSheet } from './components/CategoryPickerSheet';
import { LocaleNameField } from './components/BilingualNameField';
import { CatalogFloorEmpty } from './components/CatalogFloorList';
import { ProductGalleryBoard } from './components/ProductGalleryBoard';
import { ProductPhotoSourceSheet } from './components/ProductPhotoSourceSheet';
import { adminProductChromeTitle } from './adminProductChrome';
import { mergeProductPhotos, splitProductPhotos } from './productPhotos';
import { CreateVariantSheet } from './components/CreateVariantSheet';
import { localizedName } from '@maher/i18n';
import { renderVariantSpecLine } from '@maher/types';
import {
  pickProductPhotosFromLibrary,
  PRODUCT_PHOTO_ASPECT_RATIO,
  uploadProductImage,
  uploadProductPhotoUri,
} from './productPhotoUpload';

type Draft = {
  name: string;
  originalName: string;
  nameEn: string;
  nameAr: string;
  nameHe: string;
  description: string;
  categoryId: string | null;
  photos: string[];
  isActive: boolean;
};

function toDraft(p: AdminProductDetail, locale: string): Draft {
  const name = localizedName(locale, p, '');
  return {
    name,
    originalName: name,
    nameEn: p.nameEn ?? '',
    nameAr: p.nameAr ?? '',
    nameHe: p.nameHe ?? '',
    description: p.description ?? '',
    categoryId: p.categoryId ?? null,
    photos: mergeProductPhotos(p.imageUrl, p.galleryUrls),
    isActive: p.isActive !== false,
  };
}

type Props = { productId: string };

/**
 * Admin product manage PDP — identity and variants only. Dealers never see this screen.
 */
export function AdminProductDetailScreen({ productId }: Props) {
  const { user } = useAuth();
  const { t, locale, isRTL } = useLocale();
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

  const [draft, setDraft] = useState<Draft | null>(null);
  const [categorySheet, setCategorySheet] = useState(false);
  const [photoSheet, setPhotoSheet] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [createVariantSheet, setCreateVariantSheet] = useState(false);

  const productQuery = useQuery({
    queryKey: queryKeys.catalog.adminDetail(productId),
    queryFn: () => getAdminProduct(productId),
    enabled: allowed && Boolean(productId),
  });
  const categoriesQuery = useQuery({
    queryKey: queryKeys.catalog.productCategories(),
    queryFn: () => listProductCategories({ page: 1, pageSize: 100 }),
    enabled: allowed,
  });
  const variantsQuery = useQuery({
    queryKey: queryKeys.catalog.variants(productId, { includeInactive: true }),
    queryFn: () => listProductVariants(productId, true),
    enabled: allowed && Boolean(productId),
  });

  useEffect(() => {
    if (productQuery.data) setDraft(toDraft(productQuery.data, locale));
  }, [productQuery.data, locale]);

  const saveMutation = useMutation({
    mutationFn: (body: AdminProductPatch) => patchAdminProduct(productId, body),
    onSuccess: (data) => {
      void haptics.confirmMedium();
      setDraft(toDraft(data, locale));
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

  const categories = categoriesQuery.data?.data ?? [];
  /** Scroll content must clear the floating pill — leftover stack inset plus extra last-card pad. */
  const footerPad =
    theme.spacing['5xl'] + surfaceTabBarStackInset(insets.bottom, theme.spacing.md);
  const sheetLocksPageScroll = categorySheet || photoSheet;

  const categoryLabel = useMemo(() => {
    const id = draft?.categoryId;
    if (!id) return null;
    const cat = categories.find((c) => c.id === id) ?? productQuery.data?.category;
    if (!cat) return null;
    if (locale === 'ar') return cat.nameAr || cat.nameEn;
    if (locale === 'he') return cat.nameHe || cat.nameEn;
    return cat.nameEn || cat.nameAr;
  }, [draft?.categoryId, categories, productQuery.data?.category, locale]);

  const onSave = async () => {
    if (!draft) return;
    const names = await resolveTrilingualIfChanged({
      typed: draft.name,
      locale,
      original: draft.originalName,
      existing: {
        nameEn: draft.nameEn,
        nameAr: draft.nameAr,
        nameHe: draft.nameHe,
      },
    });
    const split = splitProductPhotos(draft.photos);
    const body: AdminProductPatch = {
      nameEn: names.nameEn,
      nameAr: names.nameAr,
      nameHe: names.nameHe || null,
      description: draft.description.trim() || null,
      categoryId: draft.categoryId,
      imageUrl: split.imageUrl,
      galleryUrls: split.galleryUrls,
      isActive: draft.isActive,
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

  const sku = productQuery.data?.sku?.trim() ?? '';
  const chromeTitle = adminProductChromeTitle({
    locale,
    nameEn: draft.nameEn,
    nameAr: draft.nameAr,
    nameHe: draft.nameHe,
    sku,
    fallback: t('catalog.product'),
  });

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
          {chromeTitle}
        </AppText>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        scrollEnabled={!sheetLocksPageScroll}
        refreshControl={
          <RefreshControl
            refreshing={productQuery.isRefetching && !productQuery.isPending}
            onRefresh={() => {
              void productQuery.refetch();
            }}
            tintColor={colors.brand}
          />
        }
        contentContainerStyle={{
          paddingHorizontal: theme.spacing.lg,
          paddingBottom: footerPad,
          gap: theme.spacing.md,
          flexGrow: 1,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {showOfflineBanner ? <OfflineBanner /> : null}

        {/* Product board */}
        <ListItemEnter index={0}>
          <SectionBoard titleWeight={titleWeight}>
            <ProductGalleryBoard
              photos={draft.photos}
              selectedIndex={photoIndex}
              onSelectIndex={setPhotoIndex}
              onRemoveAt={removePhotoAt}
              onAddPress={() => setPhotoSheet(true)}
              uploading={photoUploading}
            />

            {sku ? (
              <View style={{ gap: theme.spacing.xs }}>
                <AppText variant="label" color="secondary">
                  {t('catalog.sku')}
                </AppText>
                <View
                  style={{
                    minHeight: theme.sizes.touch.min,
                    borderRadius: theme.radius.xl,
                    borderWidth: 1,
                    borderColor: colors.borderStrong,
                    backgroundColor: colors.surfaceSecondary,
                    paddingHorizontal: theme.spacing.lg,
                    justifyContent: 'center',
                    overflow: 'hidden',
                    ...orderBoardShadow(colorScheme),
                  }}
                >
                  <AppText variant="body" weight={titleWeight} dir="ltr" numberOfLines={1}>
                    {sku}
                  </AppText>
                </View>
              </View>
            ) : null}

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

            <LocaleNameField
              value={draft.name}
              onChange={(v) => set('name', v)}
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

        <ListItemEnter index={1}>
          <SectionBoard
            title={t('catalog.variants')}
            titleWeight={titleWeight}
            actionLabel={t('catalog.addVariant')}
            onAction={() => setCreateVariantSheet(true)}
          >
            <AppText variant="caption" color="muted">
              {t('catalog.variantsHint')}
            </AppText>
            {(variantsQuery.data ?? []).length === 0 ? (
              <CatalogFloorEmpty
                icon="layers-outline"
                title={t('catalog.noVariants')}
                body={t('catalog.createStandardVariantHint')}
              />
            ) : (
              (variantsQuery.data ?? []).map((row) => (
                <AnimatedPressable
                  key={row.id}
                  variant="button"
                  accessibilityRole="button"
                  accessibilityLabel={t('catalog.openVariant')}
                  onPress={() => {
                    void haptics.selection();
                    router.push(`/(app)/(admin)/products/${productId}/variants/${row.id}`);
                  }}
                  style={{
                    borderRadius: theme.radius.xl,
                    borderWidth: 1,
                    borderColor: colors.borderStrong,
                    backgroundColor: colors.surfaceSecondary,
                    padding: theme.spacing.md,
                    gap: 4,
                    ...orderBoardShadow(colorScheme),
                  }}
                >
                  <AppText variant="body" weight={titleWeight}>
                    {localizedName(locale, row)}
                    {row.isDefault ? ` · ${t('catalog.standardVariant')}` : ''}
                    {row.isActive ? '' : ` · ${t('catalog.variantInactive')}`}
                  </AppText>
                  <AppText variant="caption" color="muted" numberOfLines={2}>
                    {renderVariantSpecLine(
                      {
                        nameAr: row.nameAr,
                        nameEn: row.nameEn,
                        nameHe: row.nameHe ?? null,
                        measurements: row.measurements ?? [],
                        options: (row.options ?? []).map((opt) => ({
                          specOptionValueId: opt.specOptionValueId,
                          nameAr: opt.specOptionValue?.nameAr,
                          nameEn: opt.specOptionValue?.nameEn,
                          nameHe: opt.specOptionValue?.nameHe,
                          code: opt.specOptionValue?.code,
                        })),
                        includedItems: row.includedItems ?? [],
                        composition: row.composition ?? [],
                        factoryNotesAr: row.factoryNotesAr ?? null,
                        factoryNotesEn: row.factoryNotesEn ?? null,
                        factoryNotesHe: row.factoryNotesHe ?? null,
                      },
                      locale,
                    )}
                  </AppText>
                </AnimatedPressable>
              ))
            )}
          </SectionBoard>
        </ListItemEnter>

        <ListItemEnter index={2}>
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
        allowCreate
      />

      <CreateVariantSheet
        open={createVariantSheet}
        productId={productId}
        onClose={() => setCreateVariantSheet(false)}
        onCreated={(row) => {
          setCreateVariantSheet(false);
          router.push(`/(app)/(admin)/products/${productId}/variants/${row.id}`);
        }}
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

    </AppScreen>
    );
  }


function SectionBoard({
  title,
  titleWeight,
  actionLabel,
  onAction,
  children,
}: {
  title?: string;
  titleWeight: 'medium' | 'semibold';
  actionLabel?: string;
  onAction?: () => void;
  children: ReactNode;
}) {
  const { colors, theme } = useTheme();
  const { isRTL } = useLocale();
  const showHeader = Boolean(title) || Boolean(actionLabel && onAction);

  return (
    <MoreBoard
      style={{
        padding: theme.spacing.lg,
        paddingLeft: isRTL ? theme.spacing.lg : theme.spacing.lg + 4,
        paddingRight: isRTL ? theme.spacing.lg + 4 : theme.spacing.lg,
        gap: theme.spacing.md,
      }}
    >
      {showHeader ? (
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
          {title ? (
            <AppText variant="label" weight={titleWeight} style={{ flex: 1 }}>
              {title}
            </AppText>
          ) : (
            <View style={{ flex: 1 }} />
          )}
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
      ) : null}
      {children}
    </MoreBoard>
  );
}
