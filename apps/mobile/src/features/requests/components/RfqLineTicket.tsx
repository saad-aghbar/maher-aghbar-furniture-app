import { useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { manufacturingComplexityDisplayKey } from '@maher/types';
import { resolveDocumentUrl } from '@/api/modules/uploads';
import { AppText } from '@/components/AppText';
import { EmptyProductImage } from '@/components/media/EmptyProductImage';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import type { RequestItem } from '../types';

type Props = {
  requestId: string;
  item: RequestItem;
};

export function RfqLineTicket({ requestId, item }: Props) {
  const { t, locale, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const router = useRouter();
  const kind = manufacturingComplexityDisplayKey(item.manufacturingComplexity);
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const [imageUri, setImageUri] = useState<string | null>(null);

  useEffect(() => {
    const id = item.primaryImageDocumentId || item.photoDocumentIds?.[0];
    if (!id) {
      setImageUri(null);
      return;
    }
    let cancelled = false;
    void resolveDocumentUrl(id)
      .then((url) => {
        if (!cancelled) setImageUri(url);
      })
      .catch(() => {
        if (!cancelled) setImageUri(null);
      });
    return () => {
      cancelled = true;
    };
  }, [item.photoDocumentIds, item.primaryImageDocumentId]);

  return (
    <AnimatedPressable
      variant="card"
      accessibilityRole="button"
      accessibilityLabel={item.productName}
      testID={item.id ? `rfq-line-${item.id}` : undefined}
      onPress={() => {
        if (!item.id) return;
        void haptics.selection();
        router.push(
          `/(app)/(admin)/requests/${requestId}/lines/${item.id}` as Href,
        );
      }}
      style={{
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: colors.borderStrong,
        backgroundColor: colors.surface,
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
          width: 3,
          backgroundColor: colors.brand,
          opacity: 0.55,
          ...(isRTL ? { right: 0 } : { left: 0 }),
        }}
      />
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          gap: theme.spacing.md,
          padding: theme.spacing.md,
          ...(isRTL ? { paddingRight: theme.spacing.lg + 4 } : { paddingLeft: theme.spacing.lg + 4 }),
        }}
      >
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: theme.radius.lg,
            overflow: 'hidden',
            backgroundColor: colors.surfaceSecondary,
          }}
        >
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={{ width: 72, height: 72 }} />
          ) : (
            <EmptyProductImage />
          )}
        </View>
        <View style={{ flex: 1, gap: theme.spacing.xs }}>
          <AppText variant="body" weight={titleWeight} numberOfLines={2}>
            {item.productName}
          </AppText>
          {item.variantLabel || item.variantSku ? (
            <AppText variant="caption" color="muted">
              {item.variantLabel || item.variantSku}
            </AppText>
          ) : null}
          <AppText variant="caption">
            {t(`mobile.lineKind.${kind}`)} · × {String(item.quantity)}
          </AppText>
        </View>
      </View>
    </AnimatedPressable>
  );
}
