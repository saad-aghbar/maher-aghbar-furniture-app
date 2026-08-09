import { useEffect, useMemo, useState } from 'react';
import {
  ScrollView,
  Switch,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { localizedName } from '@maher/i18n';
import {
  createAdminProduct,
  listProductCategories,
  type AdminBomLine,
  type AdminCustomMeasurement,
  type AdminProductCreate,
} from '@/api/modules/catalogAdmin';
import { isApiError } from '@/api/errors';
import { queryKeys } from '@/api/queryKeys';
import { toastMessageForError } from '@/api/queryClient';
import { AppText } from '@/components/AppText';
import { useToast } from '@/components/feedback/Toast';
import { TextField } from '@/components/forms/TextField';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { useSheetOverlayYield } from '@/components/sheets/SheetOverlayYield';
import {
  DealerFormError,
  DealerFormFooter,
  DealerFormSection,
} from '@/features/dealers/components/dealerSheetForm';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useAccessoryCamera } from '@/features/inventory/components/AccessoryCameraProvider';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import { BomMaterialPickerSheet } from './BomMaterialPickerSheet';
import { CategoryPickerSheet } from './CategoryPickerSheet';
import { ProductGalleryBoard } from './ProductGalleryBoard';
import { ProductPhotoSourceSheet } from './ProductPhotoSourceSheet';
import { splitProductPhotos } from '../productPhotos';
import {
  pickProductPhotosFromLibrary,
  PRODUCT_PHOTO_ASPECT_RATIO,
  uploadProductImage,
  uploadProductPhotoUri,
} from '../productPhotoUpload';

type Props = {
  open: boolean;
  onClose: () => void;
  /** Pre-select category when browsing a section. */
  initialCategoryId?: string | null;
  onCreated?: (productId: string) => void;
};

function strNum(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

const emptyForm = (categoryId: string | null = null) => ({
  nameEn: '',
  nameAr: '',
  nameHe: '',
  description: '',
  categoryId,
  isActive: true,
  width: '',
  height: '',
  depth: '',
  seatHeight: '',
  basePrice: '',
  manufacturingCost: '',
  adminNotes: '',
});

/**
 * Add-product sheet — floor boards for photo, identity, category, dimensions,
 * materials, costs, and admin notes. Seller prices are set after create on PDP.
 */
export function CreateProductSheet({
  open,
  onClose,
  initialCategoryId = null,
  onCreated,
}: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const { showToast } = useToast();
  const { openAccessoryCamera } = useAccessoryCamera();
  const { setOpen: setHostYield } = useSheetOverlayYield();
  const queryClient = useQueryClient();
  const { height } = useWindowDimensions();
  const sheetHeight = Math.min(Math.round(height * 0.92), 820);
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  const label = (key: string, fallback: string) => {
    const value = t(key);
    return value === key ? fallback : value;
  };

  const [form, setForm] = useState(() => emptyForm(initialCategoryId));
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [customMeasurements, setCustomMeasurements] = useState<AdminCustomMeasurement[]>([]);
  const [bomLines, setBomLines] = useState<AdminBomLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [photoSheet, setPhotoSheet] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [categorySheet, setCategorySheet] = useState(false);
  const [materialSheet, setMaterialSheet] = useState(false);
  const [measureSheet, setMeasureSheet] = useState(false);
  const [newMeasure, setNewMeasure] = useState({
    nameEn: '',
    nameAr: '',
    value: '',
    unit: 'cm',
  });

  useEffect(() => {
    if (!open) return;
    setForm(emptyForm(initialCategoryId ?? null));
    setPhotos([]);
    setPhotoIndex(0);
    setCustomMeasurements([]);
    setBomLines([]);
    setError(null);
  }, [open, initialCategoryId]);

  const categoriesQuery = useQuery({
    queryKey: queryKeys.catalog.productCategories(),
    queryFn: () => listProductCategories({ page: 1, pageSize: 100 }),
    enabled: open,
  });

  const categories = categoriesQuery.data?.data ?? [];

  const categoryLabel = useMemo(() => {
    if (!form.categoryId) return null;
    const cat = categories.find((c) => c.id === form.categoryId);
    return cat ? localizedName(locale, cat) : null;
  }, [form.categoryId, categories, locale]);

  const set = <K extends keyof ReturnType<typeof emptyForm>>(key: K, value: ReturnType<typeof emptyForm>[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const reset = () => {
    setForm(emptyForm(initialCategoryId));
    setPhotos([]);
    setPhotoIndex(0);
    setCustomMeasurements([]);
    setBomLines([]);
    setError(null);
    setPhotoSheet(false);
    setCategorySheet(false);
    setMaterialSheet(false);
    setMeasureSheet(false);
    setNewMeasure({ nameEn: '', nameAr: '', value: '', unit: 'cm' });
  };

  const closeAll = () => {
    reset();
    onClose();
  };

  const createMutation = useMutation({
    mutationFn: (body: AdminProductCreate) => createAdminProduct(body),
    onSuccess: async (row) => {
      void haptics.confirmLight();
      await queryClient.invalidateQueries({ queryKey: queryKeys.catalog.lists() });
      await queryClient.invalidateQueries({ queryKey: queryKeys.catalog.adminDetails() });
      showToast({
        variant: 'success',
        message: label('catalog.productCreated', 'Product created.'),
      });
      reset();
      onClose();
      onCreated?.(row.id);
    },
    onError: (err) => {
      void haptics.error();
      setError(isApiError(err) ? toastMessageForError(err) : label('catalog.namesRequired', 'Fill required fields.'));
    },
  });

  const onSubmit = () => {
    setError(null);
    if (!form.nameEn.trim() || !form.nameAr.trim()) {
      setError(label('catalog.namesRequired', 'English and Arabic names are required.'));
      return;
    }
    createMutation.mutate({
      nameEn: form.nameEn.trim(),
      nameAr: form.nameAr.trim(),
      nameHe: form.nameHe.trim() || undefined,
      description: form.description.trim() || undefined,
      categoryId: form.categoryId,
      ...(() => {
        const split = splitProductPhotos(photos);
        return {
          imageUrl: split.imageUrl ?? undefined,
          galleryUrls: split.galleryUrls,
        };
      })(),
      isActive: form.isActive,
      width: strNum(form.width),
      height: strNum(form.height),
      depth: strNum(form.depth),
      seatHeight: strNum(form.seatHeight),
      basePrice: strNum(form.basePrice) ?? undefined,
      manufacturingCost: strNum(form.manufacturingCost) ?? undefined,
      adminNotes: form.adminNotes.trim() || undefined,
      customMeasurements: customMeasurements.length ? customMeasurements : undefined,
      bomDefaults: bomLines.length
        ? {
            materials: bomLines.map((l) => ({
              sku: l.sku,
              qty: l.qty,
              unitCost: l.unitCost,
              category: l.category ?? undefined,
            })),
          }
        : undefined,
    });
  };

  const appendPhotos = (urls: string[]) => {
    if (!urls.length) return;
    setPhotos((prev) => {
      const next = [...prev];
      for (const u of urls) {
        if (u && !next.includes(u)) next.push(u);
      }
      return next;
    });
    setPhotoIndex((prev) => (photos.length === 0 ? 0 : prev));
  };

  const removePhotoAt = (index: number) => {
    setPhotos((prev) => {
      const next = prev.filter((_, i) => i !== index);
      setPhotoIndex((cur) => {
        if (!next.length) return 0;
        if (cur >= next.length) return next.length - 1;
        if (cur > index) return cur - 1;
        return cur;
      });
      return next;
    });
  };

  const takeProductPhotoFlow = async () => {
    // Keep the Add-product host Modal yielded while the camera layer is up.
    setHostYield(true);
    try {
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
      } catch {
        void haptics.error();
        showToast({
          variant: 'error',
          message: label('catalog.productPhotoUploadError', 'Couldn’t upload photo.'),
        });
      } finally {
        setPhotoUploading(false);
      }
    } finally {
      setHostYield(false);
    }
  };

  const chooseProductPhotoFlow = async () => {
    // iOS image picker races with an open RN Modal — yield the host first.
    setHostYield(true);
    await new Promise<void>((resolve) => setTimeout(resolve, 120));
    try {
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
      } catch {
        void haptics.error();
        showToast({
          variant: 'error',
          message: label('catalog.productPhotoUploadError', 'Couldn’t upload photo.'),
        });
      } finally {
        setPhotoUploading(false);
      }
    } finally {
      setHostYield(false);
    }
  };

  const addCustomMeasurement = () => {
    if (!newMeasure.nameEn.trim() || !newMeasure.nameAr.trim()) {
      setError(label('catalog.measurementNamesRequired', 'English and Arabic names are required.'));
      return;
    }
    const value = strNum(newMeasure.value);
    setCustomMeasurements((rows) => [
      ...rows,
      {
        nameEn: newMeasure.nameEn.trim(),
        nameAr: newMeasure.nameAr.trim(),
        value,
        unit: newMeasure.unit.trim() || 'cm',
      },
    ]);
    setNewMeasure({ nameEn: '', nameAr: '', value: '', unit: 'cm' });
    setMeasureSheet(false);
    setError(null);
    void haptics.selection();
  };

  const sheetLocksScroll = photoSheet || categorySheet || materialSheet || measureSheet;

  return (
    <>
      <BottomSheet
        open={open}
        onClose={closeAll}
        title={label('catalog.addProduct', 'Add product')}
        sheetHeight={sheetHeight}
      >
        <View style={{ flex: 1, gap: theme.spacing.md }}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            scrollEnabled={!sheetLocksScroll}
            showsVerticalScrollIndicator={false}
            style={{ flex: 1 }}
            contentContainerStyle={{
              gap: theme.spacing.md,
              paddingBottom: theme.spacing.sm,
            }}
          >
            <DealerFormSection
              icon="images-outline"
              label={label('catalog.changeProductPhoto', 'Product photos')}
              titleWeight={titleWeight}
            >
              <ProductGalleryBoard
                photos={photos}
                selectedIndex={photoIndex}
                onSelectIndex={setPhotoIndex}
                onRemoveAt={removePhotoAt}
                onAddPress={() => setPhotoSheet(true)}
                uploading={photoUploading}
              />
            </DealerFormSection>

            <DealerFormSection
              icon="cube-outline"
              label={label('catalog.product', 'Product')}
              titleWeight={titleWeight}
            >
              <TextField
                label={t('catalog.nameEn')}
                value={form.nameEn}
                onChangeText={(v) => set('nameEn', v)}
              />
              <TextField
                label={t('catalog.nameAr')}
                value={form.nameAr}
                onChangeText={(v) => set('nameAr', v)}
              />
              <TextField
                label={t('catalog.nameHe')}
                value={form.nameHe}
                onChangeText={(v) => set('nameHe', v)}
              />
              <TextField
                label={t('catalog.description')}
                value={form.description}
                onChangeText={(v) => set('description', v)}
                multiline
                growMaxHeight={140}
              />
              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: theme.spacing.md,
                  paddingVertical: theme.spacing.xs,
                }}
              >
                <AppText variant="label" style={{ flex: 1, textAlign: isRTL ? 'right' : 'left' }}>
                  {t('catalog.active')}
                </AppText>
                <Switch
                  value={form.isActive}
                  onValueChange={(v) => set('isActive', v)}
                  trackColor={{ false: colors.border, true: colors.brand }}
                  thumbColor={colors.surface}
                />
              </View>
            </DealerFormSection>

            <DealerFormSection
              icon="grid-outline"
              label={t('catalog.category')}
              titleWeight={titleWeight}
            >
              <AppText
                variant="caption"
                color="muted"
                style={{ textAlign: isRTL ? 'right' : 'left', lineHeight: 16 }}
              >
                {t('catalog.pickCategoryHint')}
              </AppText>
              <AnimatedPressable
                variant="button"
                accessibilityRole="button"
                accessibilityLabel={t('catalog.pickCategory')}
                onPress={() => {
                  void haptics.selection();
                  setCategorySheet(true);
                }}
                style={{
                  minHeight: theme.sizes.touch.min,
                  borderRadius: theme.radius.xl,
                  borderWidth: 1,
                  borderColor: colors.borderStrong,
                  backgroundColor: colors.surfaceSecondary,
                  paddingHorizontal: theme.spacing.md,
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  gap: theme.spacing.sm,
                  ...orderBoardShadow(colorScheme),
                }}
              >
                <Ionicons name="pricetag-outline" size={18} color={colors.brand} />
                <AppText
                  variant="body"
                  weight={categoryLabel ? 'medium' : 'regular'}
                  color={categoryLabel ? 'primary' : 'muted'}
                  style={{ flex: 1, textAlign: isRTL ? 'right' : 'left' }}
                  numberOfLines={1}
                >
                  {categoryLabel || t('catalog.noCategory')}
                </AppText>
                <Ionicons
                  name={isRTL ? 'chevron-back' : 'chevron-forward'}
                  size={16}
                  color={colors.textMuted}
                />
              </AnimatedPressable>
            </DealerFormSection>

            <DealerFormSection
              icon="resize-outline"
              label={t('catalog.measurements')}
              titleWeight={titleWeight}
            >
              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  gap: theme.spacing.sm,
                }}
              >
                <View style={{ flex: 1 }}>
                  <TextField
                    label={label('catalog.width', 'Width (cm)')}
                    value={form.width}
                    onChangeText={(v) => set('width', v)}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <TextField
                    label={label('catalog.height', 'Height (cm)')}
                    value={form.height}
                    onChangeText={(v) => set('height', v)}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>
              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  gap: theme.spacing.sm,
                }}
              >
                <View style={{ flex: 1 }}>
                  <TextField
                    label={label('catalog.depth', 'Depth (cm)')}
                    value={form.depth}
                    onChangeText={(v) => set('depth', v)}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <TextField
                    label={t('catalog.seatHeight')}
                    value={form.seatHeight}
                    onChangeText={(v) => set('seatHeight', v)}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              <View style={{ gap: theme.spacing.sm }}>
                <View
                  style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <AppText variant="label" weight={titleWeight}>
                    {t('catalog.customMeasurements')}
                  </AppText>
                  <AnimatedPressable
                    variant="button"
                    accessibilityRole="button"
                    accessibilityLabel={t('catalog.addMeasurement')}
                    onPress={() => {
                      void haptics.selection();
                      setMeasureSheet(true);
                    }}
                    style={{
                      paddingHorizontal: theme.spacing.md,
                      paddingVertical: theme.spacing.sm,
                      borderRadius: theme.radius.full,
                      borderWidth: 1,
                      borderColor: colors.brand,
                      backgroundColor: colors.brandSoft,
                    }}
                  >
                    <AppText variant="caption" weight="semibold" color="brand">
                      + {t('catalog.addMeasurement')}
                    </AppText>
                  </AnimatedPressable>
                </View>
                {customMeasurements.length === 0 ? (
                  <AppText
                    variant="caption"
                    color="muted"
                    style={{ textAlign: isRTL ? 'right' : 'left' }}
                  >
                    {t('catalog.noCustomMeasurements')}
                  </AppText>
                ) : (
                  customMeasurements.map((m, i) => (
                    <View
                      key={`${m.nameEn}-${i}`}
                      style={{
                        flexDirection: isRTL ? 'row-reverse' : 'row',
                        alignItems: 'center',
                        gap: theme.spacing.sm,
                        paddingVertical: theme.spacing.sm,
                        borderTopWidth: i === 0 ? 0 : 1,
                        borderTopColor: colors.border,
                      }}
                    >
                      <View style={{ flex: 1, gap: 2 }}>
                        <AppText
                          variant="body"
                          weight="medium"
                          style={{ textAlign: isRTL ? 'right' : 'left' }}
                        >
                          {locale === 'ar' ? m.nameAr || m.nameEn : m.nameEn || m.nameAr}
                        </AppText>
                        <AppText
                          variant="caption"
                          color="muted"
                          dir="ltr"
                          style={{ textAlign: isRTL ? 'right' : 'left' }}
                        >
                          {m.value != null ? `${m.value} ${m.unit || 'cm'}` : '—'}
                        </AppText>
                      </View>
                      <AnimatedPressable
                        variant="button"
                        accessibilityRole="button"
                        accessibilityLabel={t('common.delete')}
                        onPress={() => {
                          void haptics.selection();
                          setCustomMeasurements((rows) => rows.filter((_, idx) => idx !== i));
                        }}
                        style={{ padding: theme.spacing.sm }}
                      >
                        <Ionicons name="trash-outline" size={18} color={colors.error} />
                      </AnimatedPressable>
                    </View>
                  ))
                )}
              </View>
            </DealerFormSection>

            <DealerFormSection
              icon="layers-outline"
              label={label('catalog.materials', 'Materials')}
              titleWeight={titleWeight}
            >
              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <AppText
                  variant="caption"
                  color="muted"
                  style={{ flex: 1, textAlign: isRTL ? 'right' : 'left', lineHeight: 16 }}
                >
                  {label(
                    'catalog.bomHint',
                    'Optional bill of materials used for production cost.',
                  )}
                </AppText>
                <AnimatedPressable
                  variant="button"
                  accessibilityRole="button"
                  accessibilityLabel={label('catalog.addMaterial', 'Add material')}
                  onPress={() => {
                    void haptics.selection();
                    setMaterialSheet(true);
                  }}
                  style={{
                    marginStart: theme.spacing.sm,
                    paddingHorizontal: theme.spacing.md,
                    paddingVertical: theme.spacing.sm,
                    borderRadius: theme.radius.full,
                    borderWidth: 1,
                    borderColor: colors.brand,
                    backgroundColor: colors.brandSoft,
                  }}
                >
                  <AppText variant="caption" weight="semibold" color="brand">
                    + {label('catalog.addMaterial', 'Add')}
                  </AppText>
                </AnimatedPressable>
              </View>
              {bomLines.length === 0 ? (
                <AppText
                  variant="caption"
                  color="muted"
                  style={{ textAlign: isRTL ? 'right' : 'left' }}
                >
                  {label('catalog.noBomLines', 'No materials yet.')}
                </AppText>
              ) : (
                bomLines.map((line, i) => (
                  <View
                    key={`${line.sku}-${i}`}
                    style={{
                      flexDirection: isRTL ? 'row-reverse' : 'row',
                      alignItems: 'center',
                      gap: theme.spacing.sm,
                      paddingVertical: theme.spacing.sm,
                      borderTopWidth: i === 0 ? 0 : 1,
                      borderTopColor: colors.border,
                    }}
                  >
                    <View style={{ flex: 1, gap: 2 }}>
                      <AppText
                        variant="body"
                        weight="medium"
                        style={{ textAlign: isRTL ? 'right' : 'left' }}
                      >
                        {locale === 'ar' ? line.nameAr || line.nameEn : line.nameEn || line.nameAr}
                      </AppText>
                      <AppText
                        variant="caption"
                        color="muted"
                        dir="ltr"
                        style={{ textAlign: isRTL ? 'right' : 'left' }}
                      >
                        {line.sku} · ×{line.qty}
                      </AppText>
                    </View>
                    <AnimatedPressable
                      variant="button"
                      accessibilityRole="button"
                      accessibilityLabel={t('common.delete')}
                      onPress={() => {
                        void haptics.selection();
                        setBomLines((rows) => rows.filter((_, idx) => idx !== i));
                      }}
                      style={{ padding: theme.spacing.sm }}
                    >
                      <Ionicons name="trash-outline" size={18} color={colors.error} />
                    </AnimatedPressable>
                  </View>
                ))
              )}
            </DealerFormSection>

            <DealerFormSection
              icon="cash-outline"
              label={t('catalog.costs')}
              titleWeight={titleWeight}
            >
              <TextField
                label={t('catalog.basePrice')}
                value={form.basePrice}
                onChangeText={(v) => set('basePrice', v)}
                keyboardType="decimal-pad"
              />
              <AppText
                variant="caption"
                color="muted"
                style={{ textAlign: isRTL ? 'right' : 'left', lineHeight: 16 }}
              >
                {t('catalog.basePriceHint')}
              </AppText>
              <TextField
                label={t('catalog.manufacturingCost')}
                value={form.manufacturingCost}
                onChangeText={(v) => set('manufacturingCost', v)}
                keyboardType="decimal-pad"
              />
            </DealerFormSection>

            <DealerFormSection
              icon="lock-closed-outline"
              label={t('catalog.adminNotes')}
              titleWeight={titleWeight}
            >
              <AppText
                variant="caption"
                color="muted"
                style={{ textAlign: isRTL ? 'right' : 'left', lineHeight: 16 }}
              >
                {t('catalog.adminNotesHint')}
              </AppText>
              <TextField
                label={t('catalog.adminNotes')}
                value={form.adminNotes}
                onChangeText={(v) => set('adminNotes', v)}
                multiline
                growMaxHeight={160}
                placeholder={t('catalog.adminNotesPlaceholder')}
              />
            </DealerFormSection>

            {error ? <DealerFormError message={error} /> : null}
          </ScrollView>

          <DealerFormFooter
            confirmLabel={label('catalog.addProduct', 'Add product')}
            onConfirm={onSubmit}
            onCancel={closeAll}
            loading={createMutation.isPending}
            disabled={photoUploading}
          />
        </View>
      </BottomSheet>

      <ProductPhotoSourceSheet
        open={photoSheet}
        onClose={() => setPhotoSheet(false)}
        overlay
        hasPhoto={photos.length > 0}
        onTakePhoto={() => {
          void takeProductPhotoFlow();
        }}
        onChoosePhoto={() => {
          void chooseProductPhotoFlow();
        }}
        onRemovePhoto={
          photos.length
            ? () => {
                removePhotoAt(photoIndex);
                void haptics.selection();
              }
            : undefined
        }
      />

      <CategoryPickerSheet
        open={categorySheet}
        onClose={() => setCategorySheet(false)}
        categories={categories}
        selectedId={form.categoryId}
        onSelect={(id) => set('categoryId', id)}
      />

      <BomMaterialPickerSheet
        open={materialSheet}
        onClose={() => setMaterialSheet(false)}
        existingSkus={bomLines.map((l) => l.sku)}
        onPick={(line) => {
          setBomLines((rows) => [...rows, line]);
        }}
      />

      <BottomSheet
        open={measureSheet}
        onClose={() => setMeasureSheet(false)}
        title={t('catalog.addMeasurement')}
        fitContent
        maxHeight={520}
        overlay
      >
        <View style={{ gap: theme.spacing.md }}>
          <TextField
            label={t('catalog.measurementNameEn')}
            value={newMeasure.nameEn}
            onChangeText={(v) => setNewMeasure((m) => ({ ...m, nameEn: v }))}
          />
          <TextField
            label={t('catalog.measurementNameAr')}
            value={newMeasure.nameAr}
            onChangeText={(v) => setNewMeasure((m) => ({ ...m, nameAr: v }))}
          />
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              gap: theme.spacing.sm,
            }}
          >
            <View style={{ flex: 1 }}>
              <TextField
                label={t('catalog.measurementValue')}
                value={newMeasure.value}
                onChangeText={(v) => setNewMeasure((m) => ({ ...m, value: v }))}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={{ flex: 1 }}>
              <TextField
                label={label('catalog.unit', 'Unit')}
                value={newMeasure.unit}
                onChangeText={(v) => setNewMeasure((m) => ({ ...m, unit: v }))}
                autoCapitalize="none"
              />
            </View>
          </View>
          <DealerFormFooter
            confirmLabel={t('catalog.addMeasurement')}
            onConfirm={addCustomMeasurement}
            onCancel={() => setMeasureSheet(false)}
          />
        </View>
      </BottomSheet>
    </>
  );
}

