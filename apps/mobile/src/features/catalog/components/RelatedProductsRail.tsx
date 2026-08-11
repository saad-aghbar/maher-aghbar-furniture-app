import { ScrollView, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import {
  DealerProductCard,
  DealerSectionHeader,
} from '@/features/dealer-ui';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import {
  flattenCatalogPages,
  useCatalogInfiniteQuery,
  usePreviouslyOrderedQuery,
} from '../query';
import { toProductCard } from '../selectProductCard';
import { useDealerFavorites } from '../useDealerFavorites';

type Props = {
  productId: string;
  categoryId: string | null;
  enabled: boolean;
  productDetailHref?: (id: string) => Href;
};

/** Same-category browse rail — no dedicated related-products API. */
export function RelatedProductsRail({
  productId,
  categoryId,
  enabled,
  productDetailHref,
}: Props) {
  const { user } = useAuth();
  const { t, formatCurrency, locale } = useLocale();
  const { theme } = useTheme();
  const router = useRouter();
  const favorites = useDealerFavorites(user?.id);
  const orderedQuery = usePreviouslyOrderedQuery(enabled);
  const orderedSet = new Set((orderedQuery.data ?? []).map((p) => p.id));

  const query = useCatalogInfiniteQuery(
    { categoryId: categoryId || undefined },
    enabled && Boolean(categoryId),
  );

  const related = flattenCatalogPages(query.data)
    .filter((p) => p.id !== productId)
    .slice(0, 8)
    .map((p) => toProductCard(p, locale));

  if (!categoryId || related.length === 0) return null;

  const cardW = 148;

  return (
    <View style={{ gap: theme.spacing.sm, marginHorizontal: -theme.spacing.lg }}>
      <View style={{ paddingHorizontal: theme.spacing.lg }}>
        <DealerSectionHeader title={t('mobile.productDetail.related')} />
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          gap: theme.spacing.md,
          paddingHorizontal: theme.spacing.lg,
          paddingBottom: theme.spacing.sm,
          overflow: 'visible',
        }}
        style={{ overflow: 'visible' }}
      >
        {related.map((item, index) => (
          <View key={item.id} style={{ width: cardW }}>
            <DealerProductCard
              title={item.name}
              priceLabel={item.price != null ? formatCurrency(item.price) : undefined}
              categoryLabel={item.categoryName}
              imageUri={item.imageUrl}
              width={cardW}
              index={index}
              favorited={favorites.isFavorite(item.id)}
              orderedBefore={orderedSet.has(item.id)}
              onToggleFavorite={() => favorites.toggleFavorite(item.id)}
              onPress={() => {
                router.push(
                  productDetailHref
                    ? productDetailHref(item.id)
                    : (`/(app)/(customer)/catalog/${item.id}` as Href),
                );
              }}
            />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
