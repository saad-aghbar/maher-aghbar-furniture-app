import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { ListItemEnter, AnimatedPressable, haptics } from '@/motion';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import type { ProductCardModel } from '../selectProductCard';
import { ProductCardMedia } from './ProductCardMedia';

/** Soft portrait crop for store grid cards. */
export const PRODUCT_CARD_MEDIA_RATIO = 1.05;

type ProductCardProps = {
  product: ProductCardModel;
  index?: number;
  width: number;
  onPress?: () => void;
};

/**
 * Store product card (B2B) — photo, name, muted subtitle (category / dims), price.
 * No wishlist, cart, or stock badges (factory / dealer system).
 */
export function ProductCard({ product, index = 0, width, onPress }: ProductCardProps) {
  const { formatCurrency, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const subtitle = [product.categoryName, product.dimensionHint].filter(Boolean).join(' · ');

  return (
    <ListItemEnter index={index}>
      <AnimatedPressable
        variant="card"
        accessibilityRole="button"
        accessibilityLabel={product.name}
        onPress={() => {
          void haptics.selection();
          onPress?.();
        }}
        style={{
          width,
          backgroundColor: colors.surface,
          borderRadius: theme.radius.xl,
          overflow: 'hidden',
          marginBottom: theme.spacing.md,
          borderWidth: 1,
          borderColor: colors.border,
          ...orderBoardShadow(colorScheme),
        }}
      >
        <ProductCardMedia
          imageUrls={product.imageUrls}
          imageUrl={product.imageUrl}
          width={width}
          aspectRatio={PRODUCT_CARD_MEDIA_RATIO}
          galleryCount={product.galleryCount}
        />

        <View
          style={{
            gap: 4,
            paddingHorizontal: theme.spacing.md,
            paddingTop: theme.spacing.sm + 2,
            paddingBottom: theme.spacing.md,
          }}
        >
          <AppText
            variant="label"
            weight={titleWeight}
            numberOfLines={2}
            style={{ lineHeight: 20, fontSize: 15, minHeight: 40 }}
          >
            {product.name}
          </AppText>

          {subtitle ? (
            <AppText
              variant="caption"
              color="muted"
              numberOfLines={1}
              style={{ fontSize: 12, lineHeight: 16 }}
            >
              {subtitle}
              {product.dimensionHint ? ` · ${product.dimensionHint}` : ''}
            </AppText>
          ) : product.dimensionHint ? (
            <AppText
              variant="caption"
              color="muted"
              dir="ltr"
              numberOfLines={1}
              style={{ fontSize: 12, lineHeight: 16, fontVariant: ['tabular-nums'] }}
            >
              {product.dimensionHint}
            </AppText>
          ) : null}

          <AppText
            variant="body"
            weight="semibold"
            numberOfLines={1}
            dir="ltr"
            style={{
              marginTop: 4,
              fontSize: 15,
              lineHeight: 20,
              fontVariant: ['tabular-nums'],
              color: colors.textPrimary,
            }}
          >
            {product.price != null ? formatCurrency(product.price) : '—'}
          </AppText>
        </View>
      </AnimatedPressable>
    </ListItemEnter>
  );
}
