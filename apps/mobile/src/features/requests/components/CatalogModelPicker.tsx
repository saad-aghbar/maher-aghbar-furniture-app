import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { listBrowseProducts, type BrowseProduct } from '@/features/catalog/api';
import { DealerSearchBar } from '@/features/dealer-ui';
import { useLocale } from '@/i18n';
import { haptics } from '@/motion';
import { useTheme } from '@/theme';

type CatalogModelPickerProps = {
  open: boolean;
  onClose: () => void;
  onSelect: (product: BrowseProduct) => void;
};

export function CatalogModelPicker({ open, onClose, onSelect }: CatalogModelPickerProps) {
  const { t, locale, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<BrowseProduct[]>([]);
  const [error, setError] = useState<string | null>(null);

  const search = async (query: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await listBrowseProducts({ q: query || undefined, page: 1, pageSize: 30 });
      setItems(res.data);
    } catch {
      setError(t('mobile.newOrder.catalogError'));
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) void search(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load when sheet opens
  }, [open]);

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('mobile.newOrder.browseCatalog')}
      sheetHeight={520}
    >
      <View style={{ gap: theme.spacing.md }}>
        <DealerSearchBar
          value={q}
          onChangeText={(v) => {
            setQ(v);
            void search(v.trim());
          }}
          placeholder={t('mobile.newOrder.searchCatalogPlaceholder')}
          accessibilityLabel={t('mobile.newOrder.searchCatalog')}
        />
        {error ? (
          <AppText variant="caption" color="error">
            {error}
          </AppText>
        ) : null}
        {loading ? (
          <AppText variant="caption" color="muted">
            {t('mobile.newOrder.loading')}
          </AppText>
        ) : null}
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          style={{ maxHeight: 320 }}
          keyboardShouldPersistTaps="handled"
          ItemSeparatorComponent={() => <View style={{ height: theme.spacing.sm }} />}
          ListEmptyComponent={
            !loading ? (
              <AppText variant="caption" color="muted">
                {t('mobile.newOrder.noCatalogResults')}
              </AppText>
            ) : null
          }
          renderItem={({ item }) => {
            const name =
              locale === 'ar'
                ? item.nameAr || item.nameEn
                : locale === 'he'
                  ? item.nameHe || item.nameEn
                  : item.nameEn || item.nameAr;
            const category =
              locale === 'ar'
                ? item.category?.nameAr || item.category?.nameEn
                : locale === 'he'
                  ? item.category?.nameHe || item.category?.nameEn || item.category?.nameAr
                  : item.category?.nameEn || item.category?.nameAr;
            return (
              <Pressable
                onPress={() => {
                  void haptics.selection();
                  onSelect(item);
                  onClose();
                }}
                style={{
                  paddingVertical: theme.spacing.md,
                  paddingHorizontal: theme.spacing.md,
                  minHeight: theme.sizes.touch.min,
                  justifyContent: 'center',
                  borderRadius: theme.radius.lg,
                  borderWidth: StyleSheet.hairlineWidth * 2,
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                  alignItems: isRTL ? 'flex-end' : 'flex-start',
                }}
              >
                <AppText
                  variant="label"
                  weight="semibold"
                  style={{ textAlign: isRTL ? 'right' : 'left' }}
                >
                  {name}
                </AppText>
                {category ? (
                  <AppText
                    variant="caption"
                    color="muted"
                    style={{ textAlign: isRTL ? 'right' : 'left' }}
                  >
                    {category}
                  </AppText>
                ) : null}
              </Pressable>
            );
          }}
        />
      </View>
    </BottomSheet>
  );
}
