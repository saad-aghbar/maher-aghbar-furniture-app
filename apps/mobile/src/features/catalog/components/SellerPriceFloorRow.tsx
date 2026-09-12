import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics, ListItemEnter } from '@/motion';
import { useTheme } from '@/theme';

type Props = {
  index: number;
  name: string;
  code: string;
  initial: string;
  priceLabel: string;
  canEdit?: boolean;
  canDelete: boolean;
  deleting?: boolean;
  onEdit?: () => void;
  onDelete: () => void;
};

/** Seller price row — same floor card used on product and variant boards. */
export function SellerPriceFloorRow({
  index,
  name,
  code,
  initial,
  priceLabel,
  canEdit,
  canDelete,
  deleting,
  onEdit,
  onDelete,
}: Props) {
  const { colors, theme, colorScheme } = useTheme();
  const { isRTL, locale, t } = useLocale();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  return (
    <ListItemEnter index={Math.min(index, 6)}>
      <View
        style={{
          borderRadius: theme.radius.xl,
          borderWidth: 1,
          borderColor: colors.borderStrong,
          backgroundColor: colors.surfaceSecondary,
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
            opacity: 0.75,
          }}
        />
        <View
          style={{
            gap: theme.spacing.sm,
            paddingVertical: theme.spacing.md,
            paddingHorizontal: theme.spacing.md,
            ...(isRTL
              ? { paddingRight: theme.spacing.md + 4 }
              : { paddingLeft: theme.spacing.md + 4 }),
          }}
        >
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'flex-start',
              gap: theme.spacing.md,
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.brandSoft,
                borderWidth: 1,
                borderColor: colors.border,
                marginTop: 2,
              }}
            >
              <AppText variant="label" weight={titleWeight} style={{ color: colors.brand }}>
                {initial}
              </AppText>
            </View>

            <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
              <AppText
                variant="label"
                weight={titleWeight}
                style={{ textAlign: isRTL ? 'right' : 'left' }}
              >
                {name}
              </AppText>
              {code ? (
                <AppText
                  variant="caption"
                  color="muted"
                  dir="ltr"
                  style={{ textAlign: isRTL ? 'right' : 'left' }}
                >
                  {code}
                </AppText>
              ) : null}
            </View>
          </View>

          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: theme.spacing.sm,
            }}
          >
            {canEdit && onEdit ? (
              <AnimatedPressable
                variant="button"
                accessibilityRole="button"
                accessibilityLabel={t('common.edit')}
                onPress={() => {
                  void haptics.selection();
                  onEdit();
                }}
                style={{
                  flexShrink: 0,
                  paddingHorizontal: theme.spacing.md,
                  paddingVertical: theme.spacing.sm,
                  borderRadius: theme.radius.lg,
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.borderStrong,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <AppText variant="label" weight={titleWeight} style={{ color: colors.brand }}>
                  {t('common.edit')}
                </AppText>
              </AnimatedPressable>
            ) : (
              <View />
            )}

            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                gap: theme.spacing.sm,
              }}
            >
              <View
                style={{
                  flexShrink: 0,
                  paddingHorizontal: theme.spacing.md,
                  paddingVertical: theme.spacing.sm,
                  borderRadius: theme.radius.lg,
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.borderStrong,
                }}
              >
                <AppText
                  variant="label"
                  weight={titleWeight}
                  dir="ltr"
                  style={{ color: colors.brand }}
                >
                  {priceLabel}
                </AppText>
              </View>

              {canDelete ? (
                <AnimatedPressable
                  variant="button"
                  accessibilityRole="button"
                  accessibilityLabel={t('common.delete')}
                  disabled={deleting}
                  onPress={() => {
                    void haptics.selection();
                    onDelete();
                  }}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: colors.errorSoft,
                    borderWidth: 1,
                    borderColor: colors.border,
                    opacity: deleting ? 0.5 : 1,
                  }}
                >
                  <Ionicons name="trash-outline" size={16} color={colors.error} />
                </AnimatedPressable>
              ) : null}
            </View>
          </View>
        </View>
      </View>
    </ListItemEnter>
  );
}
