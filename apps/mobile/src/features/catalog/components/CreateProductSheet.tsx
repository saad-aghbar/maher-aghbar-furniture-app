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
import { resolveTrilingualName } from '@/i18n/resolveTrilingualName';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import { CategoryPickerSheet } from './CategoryPickerSheet';
import { LocaleNameField } from './BilingualNameField';
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

const emptyForm = (categoryId: string | null = null) => ({
  name: '',
  description: '',
  categoryId,
  isActive: true,
});

/**
 * Add-product sheet — photos, name, category, description, and active.
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

  const [form, setForm] = useState(() => emptyForm(initialCategoryId));
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [photoSheet, setPhotoSheet] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [categorySheet, setCategorySheet] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(emptyForm(initialCategoryId ?? null));
    setPhotos([]);
    setPhotoIndex(0);
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
    setError(null);
    setPhotoSheet(false);
    setCategorySheet(false);
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
        message: t('catalog.productCreated'),
      });
      reset();
      onClose();
      onCreated?.(row.id);
    },
    onError: (err) => {
      void haptics.error();
      setError(isApiError(err) ? toastMessageForError(err) : t('catalog.namesRequired'));
    },
  });

  const onSubmit = async () => {
    setError(null);
    if (!form.name.trim()) {
      setError(t('catalog.namesRequired'));
      return;
    }
    const names = await resolveTrilingualName(form.name, locale);
    createMutation.mutate({
      nameEn: names.nameEn || undefined,
      nameAr: names.nameAr,
      nameHe: names.nameHe || undefined,
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
          message: t('catalog.productPhotoUploadError'),
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
          message: t('catalog.productPhotoUploadError'),
        });
      } finally {
        setPhotoUploading(false);
      }
    } finally {
      setHostYield(false);
    }
  };

  const sheetLocksScroll = photoSheet || categorySheet;

  return (
    <>
      <BottomSheet
        open={open}
        onClose={closeAll}
        title={t('catalog.addProduct')}
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
              label={t('catalog.changeProductPhoto')}
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
              label={t('catalog.product')}
              titleWeight={titleWeight}
            >
              <LocaleNameField
                value={form.name}
                onChange={(v) => set('name', v)}
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

            {error ? <DealerFormError message={error} /> : null}
          </ScrollView>

          <DealerFormFooter
            confirmLabel={t('catalog.addProduct')}
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

    </>
  );
}

