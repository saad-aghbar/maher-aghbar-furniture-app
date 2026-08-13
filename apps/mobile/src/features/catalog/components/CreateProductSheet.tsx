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
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
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
import { BomFloorRow } from './BomFloorRow';
import { BomMaterialPickerSheet } from './BomMaterialPickerSheet';
import { CategoryPickerSheet } from './CategoryPickerSheet';
import { MeasurementFloorRow, displayMeasurementUnit } from './MeasurementFloorRow';
import { MeasurementValuePanel } from './MeasurementValueSheet';
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
  const { t, isRTL, locale, formatCurrency } = useLocale();
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
  const [measureValueSheet, setMeasureValueSheet] = useState(false);
  const [editingMeasureIndex, setEditingMeasureIndex] = useState<number | null>(null);
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
    setMeasureSheet(false);
    setMeasureValueSheet(false);
    setEditingMeasureIndex(null);
    setNewMeasure({ nameEn: '', nameAr: '', value: '', unit: 'cm' });
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

  const manufacturingCost = useMemo(
    () =>
      bomLines.reduce(
        (sum, line) => sum + Math.max(0, Number(line.qty) || 0) * (Number(line.unitCost) || 0),
        0,
      ),
    [bomLines],
  );

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

  const saveCustomMeasurement = () => {
    if (!newMeasure.nameEn.trim() || !newMeasure.nameAr.trim()) {
      void haptics.error();
      showToast({
        variant: 'error',
        message: label(
          'catalog.measurementNamesRequired',
          'English and Arabic names are required.',
        ),
      });
      return;
    }
    const next = {
      nameEn: newMeasure.nameEn.trim(),
      nameAr: newMeasure.nameAr.trim(),
      value: strNum(newMeasure.value),
      unit: newMeasure.unit.trim() || 'cm',
    };
    setCustomMeasurements((rows) =>
      editingMeasureIndex != null
        ? rows.map((row, i) => (i === editingMeasureIndex ? next : row))
        : [...rows, next],
    );
    setNewMeasure({ nameEn: '', nameAr: '', value: '', unit: 'cm' });
    setEditingMeasureIndex(null);
    setMeasureValueSheet(false);
    setMeasureSheet(false);
    void haptics.confirmLight();
  };

  const sheetLocksScroll =
    photoSheet || categorySheet || materialSheet || measureSheet || measureValueSheet;

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
                      setNewMeasure({ nameEn: '', nameAr: '', value: '', unit: 'cm' });
                      setEditingMeasureIndex(null);
                      setMeasureValueSheet(false);
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
                  <View style={{ gap: theme.spacing.sm }}>
                    {customMeasurements.map((m, i) => {
                      const name =
                        locale === 'ar' ? m.nameAr || m.nameEn : m.nameEn || m.nameAr;
                      const valueLabel =
                        m.value != null
                          ? `${m.value} ${displayMeasurementUnit(m.unit)}`
                          : '—';
                      return (
                        <MeasurementFloorRow
                          key={`${m.nameEn}-${i}`}
                          index={i}
                          name={name || '—'}
                          valueLabel={valueLabel}
                          onEdit={() => {
                            setNewMeasure({
                              nameEn: m.nameEn,
                              nameAr: m.nameAr,
                              value: m.value != null ? String(m.value) : '',
                              unit: displayMeasurementUnit(m.unit),
                            });
                            setEditingMeasureIndex(i);
                            setMeasureValueSheet(false);
                            setMeasureSheet(true);
                          }}
                          onRemove={() => {
                            setCustomMeasurements((rows) => rows.filter((_, idx) => idx !== i));
                          }}
                        />
                      );
                    })}
                  </View>
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
                <View style={{ gap: theme.spacing.sm }}>
                  {bomLines.map((line, i) => {
                    const qtyNum = Math.max(0, Number(line.qty) || 0);
                    const lineTotal = qtyNum * (Number(line.unitCost) || 0);
                    return (
                      <BomFloorRow
                        key={`${line.sku}-${i}`}
                        index={i}
                        name={
                          locale === 'ar' ? line.nameAr || line.nameEn : line.nameEn || line.nameAr
                        }
                        sku={line.sku}
                        unitCostLabel={formatCurrency(line.unitCost)}
                        lineTotalLabel={formatCurrency(lineTotal)}
                        qty={String(line.qty)}
                        onQtyChange={(v) => {
                          const q = Math.max(0, Number(v) || 0);
                          setBomLines((rows) =>
                            rows.map((l, idx) =>
                              idx === i ? { ...l, qty: q, lineCost: q * l.unitCost } : l,
                            ),
                          );
                        }}
                        onRemove={() => {
                          setBomLines((rows) => rows.filter((_, idx) => idx !== i));
                        }}
                      />
                    );
                  })}
                </View>
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
                  {formatCurrency(manufacturingCost)}
                </AppText>
                <AppText variant="caption" color="muted">
                  {t('catalog.productionCostHint')}
                </AppText>
              </View>
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
        allowCreate
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
        onClose={() => {
          setMeasureValueSheet(false);
          setEditingMeasureIndex(null);
          setMeasureSheet(false);
        }}
        title={
          measureValueSheet
            ? label('catalog.pickMeasurementValue', 'Choose value')
            : editingMeasureIndex != null
              ? t('common.edit')
              : t('catalog.addMeasurement')
        }
        fitContent
        maxHeight={560}
        overlay
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
              onChangeText={(v) => setNewMeasure((m) => ({ ...m, nameEn: v }))}
            />
            <TextField
              label={t('catalog.measurementNameAr')}
              value={newMeasure.nameAr}
              onChangeText={(v) => setNewMeasure((m) => ({ ...m, nameAr: v }))}
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
                  onChangeText={(v) => setNewMeasure((m) => ({ ...m, value: v }))}
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
                  accessibilityLabel={label('catalog.pickMeasurementValue', 'Choose value')}
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
                    {label('catalog.pickValue', 'Pick')}
                  </AppText>
                </AnimatedPressable>
              </View>
            </View>
            <PrimaryButton
              label={
                editingMeasureIndex != null
                  ? t('common.save')
                  : t('catalog.addMeasurement')
              }
              onPress={saveCustomMeasurement}
              style={{ borderRadius: theme.radius.xl }}
            />
          </View>
        )}
      </BottomSheet>
    </>
  );
}

