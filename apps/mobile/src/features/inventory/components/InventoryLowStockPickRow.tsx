import { Image, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, ListItemEnter, haptics } from '@/motion';
import { useTheme } from '@/theme';
import { lowStockShortfall } from '../lowStockPick';
import type { InventoryItemCardModel } from '../selectInventory';
import { formatInventoryMaterialType, showsRawMaterialPhoto } from '../selectInventory';

type Props = {
  item: InventoryItemCardModel;
  index: number;
  selected: boolean;
  onToggle: () => void;
  onDetails: () => void;
};

const MEDIA = 56;

/** Low-stock pick card — warning rail, check well, inset shortfall, Details chip. */
export function InventoryLowStockPickRow({
  item,
  index,
  selected,
  onToggle,
  onDetails,
}: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const nameWeight = locale === 'ar' ? 'medium' : 'semibold';
  const materialTypeLabel = formatInventoryMaterialType(item.materialType, t);
  const meta = [item.sku, materialTypeLabel, item.color].filter(Boolean).join(' · ');
  const showPhoto = showsRawMaterialPhoto(item.itemClass);
  const shortBy = Math.max(lowStockShortfall(item), 0);

  return (
    <ListItemEnter index={index}>
      <View
        style={{
          borderRadius: theme.radius.xl,
          borderWidth: 1,
          borderColor: selected ? colors.brand : colors.warning,
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
            backgroundColor: colors.warning,
            opacity: 0.9,
          }}
        />

        <AnimatedPressable
          variant="card"
          accessibilityRole="button"
          accessibilityState={{ selected }}
          accessibilityLabel={item.name}
          onPress={() => {
            void haptics.selection();
            onToggle();
          }}
        >
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: theme.spacing.sm,
              paddingHorizontal: theme.spacing.lg,
              paddingVertical: theme.spacing.md,
              ...(isRTL
                ? { paddingRight: theme.spacing.lg + 4 }
                : { paddingLeft: theme.spacing.lg + 4 }),
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
              backgroundColor: selected ? colors.brandSoft : colors.warningSoft,
            }}
          >
            <StatusBadge status="OVERDUE" label={t('mobile.inventory.lowStock')} dot />
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: selected ? colors.brand : colors.surface,
                borderWidth: 1,
                borderColor: selected ? colors.brand : colors.borderStrong,
              }}
            >
              {selected ? (
                <Ionicons name="checkmark" size={16} color={colors.onBrand} />
              ) : (
                <Ionicons name="add" size={16} color={colors.textMuted} />
              )}
            </View>
          </View>

          <View
            style={{
              padding: theme.spacing.lg,
              gap: theme.spacing.md,
              ...(isRTL
                ? { paddingRight: theme.spacing.lg + 4 }
                : { paddingLeft: theme.spacing.lg + 4 }),
            }}
          >
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                gap: theme.spacing.md,
                alignItems: 'flex-start',
              }}
            >
              {showPhoto ? (
                <View
                  style={{
                    width: MEDIA,
                    height: MEDIA,
                    borderRadius: theme.radius.lg,
                    backgroundColor: colors.surfaceSecondary,
                    borderWidth: 1,
                    borderColor: colors.border,
                    overflow: 'hidden',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {item.imageUrl ? (
                    <Image
                      source={{ uri: item.imageUrl }}
                      style={{ width: MEDIA, height: MEDIA }}
                      resizeMode="cover"
                      accessibilityIgnoresInvertColors
                    />
                  ) : (
                    <AppText variant="caption" color="muted" align="center">
                      {t('mobile.inventory.noPhoto')}
                    </AppText>
                  )}
                </View>
              ) : null}
              <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                <AppText
                  variant="label"
                  weight={nameWeight}
                  numberOfLines={2}
                  style={{ textAlign: isRTL ? 'right' : 'left', fontSize: 16 }}
                >
                  {item.name}
                </AppText>
                {meta ? (
                  <AppText
                    variant="caption"
                    color="secondary"
                    numberOfLines={1}
                    dir="ltr"
                    style={{ textAlign: isRTL ? 'right' : 'left' }}
                  >
                    {meta}
                  </AppText>
                ) : null}
              </View>
            </View>

            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                flexWrap: 'wrap',
                gap: theme.spacing.sm,
                borderRadius: theme.radius.lg,
                backgroundColor: colors.surfaceSecondary,
                borderWidth: 1,
                borderColor: colors.border,
                padding: theme.spacing.sm,
              }}
            >
              <StatPill label={t('mobile.inventory.onHandShort')} value={item.quantityLabel} />
              <StatPill
                label={t('mobile.inventory.minShort')}
                value={`${item.minStock} ${item.unit}`}
              />
              <StatPill
                label={t('mobile.inventory.lowStockShortBy')}
                value={`${shortBy} ${item.unit}`}
                warning
              />
            </View>
          </View>
        </AnimatedPressable>

        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            paddingHorizontal: theme.spacing.lg,
            paddingBottom: theme.spacing.md,
            ...(isRTL
              ? { paddingRight: theme.spacing.lg + 4 }
              : { paddingLeft: theme.spacing.lg + 4 }),
          }}
        >
          <AnimatedPressable
            variant="button"
            accessibilityRole="button"
            accessibilityLabel={t('common.details')}
            onPress={() => {
              void haptics.selection();
              onDetails();
            }}
            style={{
              minHeight: 40,
              paddingHorizontal: theme.spacing.md,
              borderRadius: theme.radius.full,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.surfaceSecondary,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <AppText
              variant="caption"
              weight={nameWeight}
              style={{ color: colors.textPrimary }}
            >
              {t('common.details')}
            </AppText>
          </AnimatedPressable>
        </View>
      </View>
    </ListItemEnter>
  );
}

function StatPill({
  label,
  value,
  warning,
}: {
  label: string;
  value: string;
  warning?: boolean;
}) {
  const { colors, theme } = useTheme();
  const { isRTL, locale } = useLocale();

  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'baseline',
        gap: 6,
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: 5,
        borderRadius: theme.radius.md,
        backgroundColor: warning ? colors.warningSoft : colors.surface,
        borderWidth: 1,
        borderColor: warning ? colors.warning : colors.border,
      }}
    >
      <AppText
        variant="caption"
        color={warning ? 'warning' : 'muted'}
        weight={locale === 'ar' ? 'regular' : 'medium'}
      >
        {label}
      </AppText>
      <AppText
        variant="caption"
        weight={locale === 'ar' ? 'medium' : 'semibold'}
        color={warning ? 'warning' : 'primary'}
        dir="ltr"
      >
        {value}
      </AppText>
    </View>
  );
}
