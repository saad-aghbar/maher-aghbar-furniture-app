import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { SearchHit, SearchHitType } from '@/api/modules/search';
import { AppText } from '@/components/AppText';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';

type Props = {
  hit: SearchHit;
  onPress: () => void;
};

function typeIcon(type: SearchHitType): keyof typeof Ionicons.glyphMap {
  switch (type) {
    case 'sales_order':
      return 'cube-outline';
    case 'request':
      return 'document-text-outline';
    case 'invoice':
      return 'receipt-outline';
    case 'product':
      return 'albums-outline';
    case 'inventory':
      return 'layers-outline';
    case 'customer':
      return 'people-outline';
    default:
      return 'search-outline';
  }
}

/**
 * Shared search hit card — lifted paper, accent rail, type stamp.
 * Type-agnostic so orders, invoices, materials, and requests share one aesthetic.
 */
export function SearchHitCard({ hit, onPress }: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const typeLabel = t(`mobile.search.types.${hit.type}`);

  return (
    <AnimatedPressable
      variant="card"
      accessibilityRole="button"
      accessibilityLabel={`${typeLabel}. ${hit.title}. ${hit.subtitle ?? ''}`}
      onPress={() => {
        void haptics.selection();
        onPress();
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
          ...(isRTL ? { right: 0 } : { left: 0 }),
          width: 3,
          backgroundColor: colors.brand,
          opacity: 0.55,
        }}
      />

      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: theme.spacing.md,
          paddingVertical: theme.spacing.md,
          paddingHorizontal: theme.spacing.lg,
          ...(isRTL
            ? { paddingRight: theme.spacing.lg + 4 }
            : { paddingLeft: theme.spacing.lg + 4 }),
        }}
      >
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            backgroundColor: colors.brandSoft,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name={typeIcon(hit.type)} size={20} color={colors.brand} />
        </View>

        <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
          <View
            style={{
              alignSelf: isRTL ? 'flex-end' : 'flex-start',
              paddingHorizontal: theme.spacing.sm,
              paddingVertical: 3,
              borderRadius: theme.radius.full,
              backgroundColor: colors.surfaceSecondary,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <AppText
              variant="caption"
              weight="semibold"
              style={{
                color: colors.textMuted,
                letterSpacing: locale === 'ar' ? 0 : 0.6,
                textTransform: 'uppercase',
                fontSize: 10,
                lineHeight: 13,
              }}
            >
              {typeLabel}
            </AppText>
          </View>

          <AppText variant="label" weight={titleWeight} numberOfLines={2}>
            {hit.title}
          </AppText>

          {hit.subtitle ? (
            <AppText variant="caption" color="secondary" numberOfLines={2}>
              {hit.subtitle}
            </AppText>
          ) : null}
        </View>

        <Ionicons
          name={isRTL ? 'chevron-back' : 'chevron-forward'}
          size={18}
          color={colors.textMuted}
        />
      </View>
    </AnimatedPressable>
  );
}
