import { Image, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { DealerPriceRow } from '@/api/modules/customers';
import { AppText } from '@/components/AppText';
import { resolveOrderMediaUri } from '@/features/sales-orders/components/OrderCardMedia';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import { DealerEmptyPanel } from './DealerEmptyPanel';

type Props = {
  prices: DealerPriceRow[];
  emptyLabel: string;
  canDelete: boolean;
  onAdd?: () => void;
  onDelete: (priceId: string) => void;
  productName: (row: DealerPriceRow) => string;
};

/** Match payments / invoices ledger window. */
const LIST_MAX_H = 320;
const THUMB = 40;

/**
 * Compact scrollable dealer price list.
 */
export function DealerPriceList({
  prices,
  emptyLabel,
  canDelete,
  onAdd,
  onDelete,
  productName,
}: Props) {
  const { t, formatCurrency, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  return (
    <View>
      <View
        style={{
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.sm,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        }}
      >
        <AppText
          variant="caption"
          color="muted"
          weight={titleWeight}
          numberOfLines={1}
          style={{
            flex: 1,
            textTransform: 'uppercase',
            letterSpacing: 0.4,
            fontSize: 11,
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {`${t('customers.priceList')} · ${prices.length}`}
        </AppText>
        {onAdd ? (
          <AnimatedPressable
            variant="button"
            accessibilityRole="button"
            accessibilityLabel={t('customers.addPrice')}
            onPress={() => {
              void haptics.selection();
              onAdd();
            }}
            style={{
              paddingHorizontal: theme.spacing.md,
              paddingVertical: 6,
              borderRadius: theme.radius.lg,
              borderWidth: 1,
              borderColor: colors.borderStrong,
              backgroundColor: colors.surface,
            }}
          >
            <AppText variant="caption" color="brand" weight="semibold">
              {t('customers.addPrice')}
            </AppText>
          </AnimatedPressable>
        ) : null}
      </View>

      {prices.length === 0 ? (
        <DealerEmptyPanel text={emptyLabel} icon="pricetag-outline" nested />
      ) : (
        <ScrollView
          nestedScrollEnabled
          showsVerticalScrollIndicator
          style={{ maxHeight: LIST_MAX_H }}
          contentContainerStyle={{
            paddingHorizontal: theme.spacing.sm,
            paddingVertical: theme.spacing.sm,
            gap: 6,
          }}
          keyboardShouldPersistTaps="handled"
        >
          {prices.map((row) => {
            const name = productName(row);
            const imageUri = resolveOrderMediaUri(row.product?.imageUrl ?? null);

            return (
              <View
                key={row.id}
                style={{
                  borderRadius: theme.radius.md,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: colors.border,
                  backgroundColor: colors.surfaceSecondary,
                  paddingHorizontal: theme.spacing.sm,
                  paddingVertical: theme.spacing.sm,
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  gap: theme.spacing.sm,
                }}
              >
                <View
                  style={{
                    width: THUMB,
                    height: THUMB,
                    borderRadius: theme.radius.sm,
                    backgroundColor: colors.surface,
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: colors.border,
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
                    <Ionicons name="cube-outline" size={18} color={colors.brand} />
                  )}
                </View>

                <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
                  <AppText
                    variant="caption"
                    weight={titleWeight}
                    numberOfLines={1}
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
                    weight={titleWeight}
                    color="brand"
                    numberOfLines={1}
                    dir="ltr"
                    style={{
                      fontSize: 12,
                      lineHeight: 16,
                      textAlign: isRTL ? 'right' : 'left',
                    }}
                  >
                    {formatCurrency(Number(row.price))}
                  </AppText>
                </View>

                {canDelete ? (
                  <AnimatedPressable
                    variant="button"
                    accessibilityRole="button"
                    accessibilityLabel={t('common.delete')}
                    onPress={() => {
                      void haptics.selection();
                      onDelete(row.id);
                    }}
                    hitSlop={8}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="trash-outline" size={16} color={colors.error} />
                  </AnimatedPressable>
                ) : null}
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}
