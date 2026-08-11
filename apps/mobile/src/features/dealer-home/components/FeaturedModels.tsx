import { View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import {
  DealerProductCard,
  DealerSectionHeader,
} from '@/features/dealer-ui';
import { TertiaryButton } from '@/components/buttons/TertiaryButton';
import { useLocale } from '@/i18n';
import { ListItemEnter } from '@/motion';
import { useTheme } from '@/theme';
import type { ProductCardModel } from '@/features/catalog/selectProductCard';

type Props = {
  products: ProductCardModel[];
};

export function FeaturedModels({ products }: Props) {
  const { t, formatCurrency, isRTL } = useLocale();
  const { theme } = useTheme();
  const router = useRouter();

  if (products.length === 0) return null;

  const rows: ProductCardModel[][] = [];
  for (let i = 0; i < products.length; i += 2) {
    rows.push(products.slice(i, i + 2));
  }

  return (
    <View style={{ marginBottom: theme.spacing.lg, gap: theme.spacing.sm }}>
      <DealerSectionHeader
        title={t('mobile.dealerHome.featuredModels')}
        action={
          <TertiaryButton
            label={t('mobile.dealerHome.seeAll')}
            onPress={() => router.push('/(app)/(customer)/(tabs)/catalog' as Href)}
          />
        }
      />
      {rows.map((row, rowIndex) => (
        <View
          key={`row-${rowIndex}`}
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            gap: theme.spacing.md,
          }}
        >
          {row.map((product, index) => (
            <ListItemEnter key={product.id} index={rowIndex * 2 + index} style={{ flex: 1 }}>
              <DealerProductCard
                title={product.name}
                priceLabel={
                  product.price != null ? formatCurrency(product.price) : undefined
                }
                imageUri={product.imageUrl}
                onPress={() =>
                  router.push(`/(app)/(customer)/catalog/${product.id}` as Href)
                }
              />
            </ListItemEnter>
          ))}
          {row.length === 1 ? <View style={{ flex: 1 }} /> : null}
        </View>
      ))}
    </View>
  );
}
