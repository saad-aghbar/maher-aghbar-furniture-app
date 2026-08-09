import { useEffect, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { TextField } from '@/components/forms/TextField';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { listBrowseProducts, type BrowseProduct } from '@/features/catalog/api';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';

type CatalogModelPickerProps = {
  open: boolean;
  onClose: () => void;
  onSelect: (product: BrowseProduct) => void;
};

export function CatalogModelPicker({ open, onClose, onSelect }: CatalogModelPickerProps) {
  const { t, locale } = useLocale();
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
        <TextField
          label={t('mobile.newOrder.searchCatalog')}
          value={q}
          onChangeText={(v) => {
            setQ(v);
            void search(v.trim());
          }}
          placeholder={t('mobile.newOrder.searchCatalogPlaceholder')}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
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
                  onSelect(item);
                  onClose();
                }}
                style={{
                  paddingVertical: theme.spacing.md,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                  minHeight: theme.sizes.touch.min,
                  justifyContent: 'center',
                }}
              >
                <AppText variant="label" weight="semibold">
                  {name}
                </AppText>
                {category ? (
                  <AppText variant="caption" color="muted">
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
