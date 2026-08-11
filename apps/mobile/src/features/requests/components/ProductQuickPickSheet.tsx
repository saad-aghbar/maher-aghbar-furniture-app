import { Dimensions, FlatList, Image, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import type { BrowseProduct } from '@/features/catalog/api';
import { toProductCard } from '@/features/catalog/selectProductCard';
import { useLocale } from '@/i18n';
import { haptics } from '@/motion';
import { useTheme } from '@/theme';

type ProductQuickPickSheetProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  products: BrowseProduct[];
  loading?: boolean;
  emptyTitle: string;
  emptyBody: string;
  onSelect: (product: BrowseProduct) => void;
};

export function ProductQuickPickSheet({
  open,
  onClose,
  title,
  subtitle,
  products,
  loading,
  emptyTitle,
  emptyBody,
  onSelect,
}: ProductQuickPickSheetProps) {
  const { t, locale, isRTL, formatCurrency } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const dark = colorScheme === 'dark';
  const pad = theme.spacing.lg;
  const gap = theme.spacing.md;
  const cardW = (Dimensions.get('window').width - pad * 2 - gap - theme.spacing.lg) / 2;

  const cards = products.map((p) => toProductCard(p, locale));

  return (
    <BottomSheet open={open} onClose={onClose} title={title} sheetHeight={560}>
      <View style={{ gap: theme.spacing.md, flex: 1 }}>
        {subtitle ? (
          <AppText
            variant="caption"
            color="muted"
            style={{ textAlign: isRTL ? 'right' : 'left' }}
          >
            {subtitle}
          </AppText>
        ) : null}

        {loading ? (
          <AppText variant="caption" color="muted">
            {t('mobile.newOrder.loading')}
          </AppText>
        ) : null}

        {!loading && cards.length === 0 ? (
          <View
            style={{
              padding: theme.spacing.xl,
              borderRadius: theme.radius.xl,
              backgroundColor: colors.brandSoft,
              borderWidth: StyleSheet.hairlineWidth * 2,
              borderColor: colors.border,
              gap: theme.spacing.sm,
              alignItems: 'center',
            }}
          >
            <Ionicons name="heart-outline" size={28} color={colors.brand} />
            <AppText variant="label" weight="semibold" style={{ textAlign: 'center' }}>
              {emptyTitle}
            </AppText>
            <AppText variant="caption" color="muted" style={{ textAlign: 'center' }}>
              {emptyBody}
            </AppText>
          </View>
        ) : (
          <FlatList
            data={cards}
            keyExtractor={(item) => item.id}
            numColumns={2}
            columnWrapperStyle={{ gap }}
            contentContainerStyle={{ gap, paddingBottom: theme.spacing.xl }}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const product = products.find((p) => p.id === item.id)!;
              return (
                <Pressable
                  onPress={() => {
                    void haptics.confirmMedium();
                    onSelect(product);
                    onClose();
                  }}
                  style={{
                    width: cardW,
                    borderRadius: theme.radius.xl,
                    overflow: 'hidden',
                    borderWidth: StyleSheet.hairlineWidth * 2,
                    borderColor: dark ? 'rgba(255,255,255,0.14)' : 'rgba(63,52,44,0.1)',
                    backgroundColor: colors.surface,
                  }}
                >
                  <View
                    style={{
                      aspectRatio: 1,
                      backgroundColor: colors.surfaceSecondary,
                    }}
                  >
                    {item.imageUrl ? (
                      <Image
                        source={{ uri: item.imageUrl }}
                        style={{ width: '100%', height: '100%' }}
                        resizeMode="cover"
                      />
                    ) : (
                      <View
                        style={{
                          flex: 1,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Ionicons name="cube-outline" size={28} color={colors.textMuted} />
                      </View>
                    )}
                  </View>
                  <View style={{ padding: theme.spacing.sm, gap: 2 }}>
                    <AppText
                      variant="caption"
                      weight="semibold"
                      numberOfLines={2}
                      style={{ textAlign: isRTL ? 'right' : 'left' }}
                    >
                      {item.name}
                    </AppText>
                    {item.price != null ? (
                      <AppText variant="caption" color="brand" dir="ltr">
                        {formatCurrency(item.price)}
                      </AppText>
                    ) : null}
                  </View>
                </Pressable>
              );
            }}
          />
        )}
      </View>
    </BottomSheet>
  );
}
