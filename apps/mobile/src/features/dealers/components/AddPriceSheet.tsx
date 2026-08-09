import { useEffect, useMemo, useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { localizedName } from '@maher/i18n';
import { isApiError } from '@/api/errors';
import type { BrowseCategory } from '@/api/modules/catalog';
import {
  listProductCategories,
  type AdminProductListItem,
} from '@/api/modules/catalogAdmin';
import { toastMessageForError } from '@/api/queryClient';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { useToast } from '@/components/feedback/Toast';
import { SearchBarShell } from '@/components/forms/SearchBarShell';
import { TextField } from '@/components/forms/TextField';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { CategoryPickerSheet } from '@/features/catalog/components/CategoryPickerSheet';
import { resolveOrderMediaUri } from '@/features/sales-orders/components/OrderCardMedia';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { resolveAppFontStyle, useTheme } from '@/theme';
import { useUpsertDealerPriceMutation } from '../query';

type Props = {
  open: boolean;
  onClose: () => void;
  customerId: string;
  products: AdminProductListItem[];
  /** Product ids that already have a dealer price — hidden from the picker. */
  pricedProductIds?: ReadonlySet<string> | string[];
};

type ProductSection = {
  key: string;
  title: string;
  items: AdminProductListItem[];
};

const THUMB = 56;
const LIST_MAX_H = 280;

function productLabel(p: AdminProductListItem, locale: string): string {
  return localizedName(
    locale,
    {
      name: p.nameEn,
      nameAr: p.nameAr,
      nameEn: p.nameEn,
      nameHe: p.nameHe,
    },
    '—',
  );
}

function categoryLabel(
  p: AdminProductListItem,
  locale: string,
  fallback: string,
): string {
  const cat = p.category;
  if (!cat) return fallback;
  return localizedName(
    locale,
    {
      name: cat.nameEn,
      nameAr: cat.nameAr,
      nameEn: cat.nameEn,
      nameHe: cat.nameHe,
    },
    cat.code || fallback,
  );
}

function groupProducts(
  products: AdminProductListItem[],
  locale: string,
  uncategorized: string,
): ProductSection[] {
  const map = new Map<string, ProductSection>();
  for (const p of products) {
    const key = p.categoryId || p.category?.id || '__none__';
    const title = categoryLabel(p, locale, uncategorized);
    const existing = map.get(key);
    if (existing) {
      existing.items.push(p);
    } else {
      map.set(key, { key, title, items: [p] });
    }
  }
  return Array.from(map.values()).sort((a, b) => {
    if (a.key === '__none__') return 1;
    if (b.key === '__none__') return -1;
    return a.title.localeCompare(b.title, locale);
  });
}

/**
 * Add dealer price — searchable catalog picker with category sections and photo cards.
 */
export function AddPriceSheet({
  open,
  onClose,
  customerId,
  products,
  pricedProductIds,
}: Props) {
  const { t, formatCurrency, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const { showToast } = useToast();
  const { height } = useWindowDimensions();
  const mutation = useUpsertDealerPriceMutation(customerId);
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  const [productId, setProductId] = useState<string | null>(null);
  const [price, setPrice] = useState('');
  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [categorySheetOpen, setCategorySheetOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sheetHeight = Math.min(Math.round(height * 0.82), 680);

  const pricedIds = useMemo(() => {
    if (!pricedProductIds) return new Set<string>();
    return pricedProductIds instanceof Set
      ? pricedProductIds
      : new Set(pricedProductIds);
  }, [pricedProductIds]);

  const catalog = useMemo(
    () => products.filter((p) => !pricedIds.has(p.id)),
    [products, pricedIds],
  );

  const categoriesQuery = useQuery({
    queryKey: ['product-categories', 'add-price'],
    queryFn: () => listProductCategories({ page: 1, pageSize: 100 }),
    enabled: open || categorySheetOpen,
  });

  useEffect(() => {
    if (!open) {
      setProductId(null);
      setPrice('');
      setQuery('');
      setCategoryId(null);
      setCategorySheetOpen(false);
      setError(null);
    }
  }, [open]);

  /** Always show every category — not only ones with unpriced products left. */
  const categories = useMemo((): BrowseCategory[] => {
    const map = new Map<string, BrowseCategory>();
    for (const c of categoriesQuery.data?.data ?? []) {
      map.set(c.id, {
        id: c.id,
        code: c.code ?? '',
        nameEn: c.nameEn,
        nameAr: c.nameAr ?? c.nameEn,
        nameHe: c.nameHe,
      });
    }
    for (const p of products) {
      const c = p.category;
      const id = p.categoryId || c?.id;
      if (!id || !c || map.has(id)) continue;
      map.set(id, {
        id,
        code: c.code ?? '',
        nameEn: c.nameEn,
        nameAr: c.nameAr ?? c.nameEn,
        nameHe: c.nameHe,
      });
    }
    return Array.from(map.values()).sort((a, b) =>
      (a.nameEn || a.code).localeCompare(b.nameEn || b.code, locale),
    );
  }, [categoriesQuery.data?.data, products, locale]);

  const selectedCategoryLabel = useMemo(() => {
    if (!categoryId) return null;
    const cat = categories.find((c) => c.id === categoryId);
    if (!cat) return null;
    return localizedName(
      locale,
      {
        name: cat.nameEn,
        nameAr: cat.nameAr,
        nameEn: cat.nameEn,
        nameHe: cat.nameHe,
      },
      cat.code || t('catalog.category'),
    );
  }, [categoryId, categories, locale, t]);

  const needle = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    let list = catalog;
    if (categoryId) {
      list = list.filter((p) => (p.categoryId || p.category?.id) === categoryId);
    }
    if (!needle) return list;
    return list.filter((p) => {
      const hay = [
        p.nameEn,
        p.nameAr,
        p.nameHe,
        p.category?.nameEn,
        p.category?.nameAr,
        p.category?.nameHe,
        p.category?.code,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [catalog, categoryId, needle]);

  const sections = useMemo(
    () => groupProducts(filtered, locale, t('catalog.noCategory')),
    [filtered, locale, t],
  );

  const selected = useMemo(
    () => catalog.find((p) => p.id === productId) ?? null,
    [catalog, productId],
  );

  const reset = () => {
    setProductId(null);
    setPrice('');
    setQuery('');
    setCategoryId(null);
    setCategorySheetOpen(false);
    setError(null);
    onClose();
  };

  const onSelectProduct = (p: AdminProductListItem) => {
    void haptics.selection();
    setProductId(p.id);
    if (!price.trim() && p.basePrice != null && Number(p.basePrice) > 0) {
      setPrice(String(p.basePrice));
    }
  };

  const onSubmit = async () => {
    const n = Number(price);
    if (!productId || !Number.isFinite(n) || n <= 0) {
      setError(t('customers.dealerPriceRequired'));
      return;
    }
    try {
      await mutation.mutateAsync({ productId, price: n });
      void haptics.confirmLight();
      showToast({ variant: 'success', message: t('catalog.sellerPriceSaved') });
      reset();
    } catch (err) {
      void haptics.error();
      setError(isApiError(err) ? toastMessageForError(err) : t('customers.dealerPriceRequired'));
    }
  };

  const productionCost = (p: AdminProductListItem) => {
    const n = Number(p.productionCost ?? p.manufacturingCost);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  return (
    <>
      <BottomSheet
        open={open}
        onClose={reset}
        title={t('customers.addPrice')}
        sheetHeight={sheetHeight}
      >
        <View style={{ gap: theme.spacing.md, flex: 1 }}>
          <AppText
            variant="caption"
            color="muted"
            style={{ textAlign: isRTL ? 'right' : 'left', lineHeight: 18 }}
          >
            {t('customers.priceListHint')}
          </AppText>

          <View style={{ gap: theme.spacing.xs }}>
            <AppText
              variant="caption"
              color="secondary"
              weight={titleWeight}
              style={{ textAlign: isRTL ? 'right' : 'left' }}
            >
              {t('catalog.category')}
            </AppText>
            <AnimatedPressable
              variant="button"
              accessibilityRole="button"
              accessibilityLabel={t('catalog.pickCategory')}
              onPress={() => {
                void haptics.selection();
                setCategorySheetOpen(true);
              }}
              style={{
                minHeight: theme.sizes.touch.min,
                borderRadius: theme.radius.xl,
                borderWidth: 1,
                borderColor: categoryId ? colors.brand : colors.borderStrong,
                backgroundColor: colors.surface,
                paddingHorizontal: theme.spacing.lg,
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                gap: theme.spacing.sm,
                overflow: 'hidden',
                ...orderBoardShadow(colorScheme),
              }}
            >
              {categoryId ? (
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
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.surfaceSecondary,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Ionicons name="grid-outline" size={16} color={colors.brand} />
              </View>
              <View
                style={{
                  flex: 1,
                  ...(isRTL
                    ? { paddingRight: categoryId ? 4 : 0 }
                    : { paddingLeft: categoryId ? 4 : 0 }),
                }}
              >
                <AppText
                  variant="body"
                  numberOfLines={1}
                  style={{
                    color: selectedCategoryLabel ? colors.textPrimary : colors.textMuted,
                    textAlign: isRTL ? 'right' : 'left',
                  }}
                >
                  {selectedCategoryLabel ?? t('mobile.catalog.chips.all')}
                </AppText>
              </View>
              <Ionicons name="chevron-down" size={18} color={colors.brand} />
            </AnimatedPressable>
          </View>

          <SearchBarShell>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t('catalog.searchProducts')}
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              clearButtonMode="while-editing"
              style={[
                {
                  flex: 1,
                  minWidth: 0,
                  paddingVertical: theme.spacing.sm,
                  fontSize: 16,
                  color: colors.textPrimary,
                  textAlign: isRTL ? 'right' : 'left',
                  writingDirection: isRTL ? 'rtl' : 'ltr',
                },
                resolveAppFontStyle(locale, {
                  weight: 'regular',
                  variant: 'body',
                  systemWeight: theme.typography.weights.regular,
                }),
              ]}
            />
            {query.length > 0 ? (
              <AnimatedPressable
                variant="button"
                accessibilityRole="button"
                accessibilityLabel={t('catalog.searchProducts')}
                onPress={() => setQuery('')}
                hitSlop={8}
              >
                <Ionicons name="close-circle" size={18} color={colors.textMuted} />
              </AnimatedPressable>
            ) : null}
          </SearchBarShell>

          <ScrollView
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            style={{ maxHeight: LIST_MAX_H, flexGrow: 0 }}
            contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: theme.spacing.xs }}
            showsVerticalScrollIndicator
          >
            {sections.length === 0 ? (
              <AppText
                variant="caption"
                color="muted"
                style={{ textAlign: isRTL ? 'right' : 'left', paddingVertical: theme.spacing.sm }}
              >
                {t('catalog.noProducts')}
              </AppText>
            ) : (
              sections.map((section) => (
                <View key={section.key} style={{ gap: theme.spacing.sm }}>
                  <AppText
                    variant="caption"
                    color="muted"
                    weight={titleWeight}
                    style={{
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                      fontSize: 11,
                      textAlign: isRTL ? 'right' : 'left',
                      paddingHorizontal: 2,
                    }}
                  >
                    {`${section.title} · ${section.items.length}`}
                  </AppText>

                  <View style={{ gap: 6 }}>
                    {section.items.map((p) => {
                      const active = productId === p.id;
                      const name = productLabel(p, locale);
                      const imageUri = resolveOrderMediaUri(p.imageUrl ?? null);
                      const cost = productionCost(p);

                      return (
                        <AnimatedPressable
                          key={p.id}
                          variant="card"
                          accessibilityRole="button"
                          accessibilityState={{ selected: active }}
                          accessibilityLabel={name}
                          onPress={() => onSelectProduct(p)}
                          style={{
                            flexDirection: isRTL ? 'row-reverse' : 'row',
                            alignItems: 'center',
                            gap: theme.spacing.md,
                            paddingHorizontal: theme.spacing.sm,
                            paddingVertical: theme.spacing.sm,
                            borderRadius: theme.radius.lg,
                            borderWidth: 1.5,
                            borderColor: active ? colors.brand : colors.border,
                            backgroundColor: active ? colors.brandSoft : colors.surfaceSecondary,
                          }}
                        >
                          <View
                            style={{
                              width: THUMB,
                              height: THUMB,
                              borderRadius: theme.radius.md,
                              backgroundColor: colors.surface,
                              borderWidth: StyleSheet.hairlineWidth,
                              borderColor: active ? colors.brand : colors.borderStrong,
                              overflow: 'hidden',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            {imageUri ? (
                              <Image
                                source={{ uri: imageUri }}
                                style={StyleSheet.absoluteFillObject}
                                resizeMode="cover"
                                accessibilityIgnoresInvertColors
                              />
                            ) : (
                              <Ionicons name="cube-outline" size={22} color={colors.brand} />
                            )}
                          </View>

                          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                            <AppText
                              variant="label"
                              weight={titleWeight}
                              numberOfLines={2}
                              style={{
                                fontSize: 13,
                                lineHeight: 17,
                                textAlign: isRTL ? 'right' : 'left',
                              }}
                            >
                              {name}
                            </AppText>
                            <AppText
                              variant="caption"
                              color="muted"
                              numberOfLines={1}
                              style={{
                                fontSize: 11,
                                textAlign: isRTL ? 'right' : 'left',
                              }}
                            >
                              {categoryLabel(p, locale, t('catalog.category'))}
                            </AppText>
                            {cost != null ? (
                              <AppText
                                variant="caption"
                                color="secondary"
                                numberOfLines={1}
                                style={{
                                  fontSize: 11,
                                  textAlign: isRTL ? 'right' : 'left',
                                }}
                              >
                                {`${t('sales.productionPrice')} · ${formatCurrency(cost)}`}
                              </AppText>
                            ) : null}
                          </View>

                          {active ? (
                            <Ionicons name="checkmark-circle" size={22} color={colors.brand} />
                          ) : (
                            <Ionicons
                              name={isRTL ? 'chevron-back' : 'chevron-forward'}
                              size={16}
                              color={colors.textMuted}
                            />
                          )}
                        </AnimatedPressable>
                      );
                    })}
                  </View>
                </View>
              ))
            )}
          </ScrollView>

          {selected ? (
            <AppText
              variant="caption"
              color="brand"
              weight="semibold"
              numberOfLines={1}
              style={{ textAlign: isRTL ? 'right' : 'left' }}
            >
              {productLabel(selected, locale)}
            </AppText>
          ) : null}

          <TextField
            label={t('customers.dealerPrice')}
            value={price}
            onChangeText={setPrice}
            keyboardType="decimal-pad"
          />

          {error ? (
            <AppText variant="caption" color="error" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {error}
            </AppText>
          ) : null}

          <PrimaryButton
            label={t('customers.addPrice')}
            onPress={() => void onSubmit()}
            loading={mutation.isPending}
            style={{ borderRadius: theme.radius.xl }}
          />
          <SecondaryButton
            label={t('common.cancel')}
            onPress={reset}
            style={{ borderRadius: theme.radius.xl }}
          />
        </View>
      </BottomSheet>

      <CategoryPickerSheet
        open={categorySheetOpen}
        onClose={() => setCategorySheetOpen(false)}
        categories={categories}
        selectedId={categoryId}
        title={t('catalog.pickCategory')}
        hint={t('catalog.pickCategoryHint')}
        emptySelectionLabel={t('mobile.catalog.chips.all')}
        requireConfirm
        confirmLabel={t('common.confirm')}
        onSelect={(id) => setCategoryId(id)}
      />
    </>
  );
}
