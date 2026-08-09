import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import type { InventoryCategoryGroup, InventoryGroupSummary } from '../api';

const GROUP_ICON: Record<InventoryCategoryGroup, keyof typeof Ionicons.glyphMap> = {
  fabric: 'color-palette-outline',
  foam: 'layers-outline',
  wood: 'leaf-outline',
  accessories: 'construct-outline',
};

type InventoryGroupCardProps = {
  group: InventoryGroupSummary;
  onPress: () => void;
};

/** Classic group board — floor elevation + icon circle. */
export function InventoryGroupCard({ group, onPress }: InventoryGroupCardProps) {
  const { t, locale, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const title = t(`mobile.inventory.groups.${group.categoryGroup}`);
  const qty =
    group.primaryUnit != null
      ? t('mobile.inventory.totalQtyWithUnit', {
          qty: String(group.totalOnHand),
          unit: group.primaryUnit,
        })
      : t('mobile.inventory.totalQty', { qty: String(group.totalOnHand) });
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const low = group.lowStockCount > 0;

  return (
    <AnimatedPressable
      variant="card"
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={() => {
        void haptics.selection();
        onPress();
      }}
      style={{
        minHeight: theme.sizes.touch.min * 1.6,
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: low ? colors.warning : colors.borderStrong,
        backgroundColor: colors.surface,
        overflow: 'hidden',
        ...orderBoardShadow(colorScheme),
      }}
    >
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 8,
          bottom: 8,
          ...(isRTL ? { right: 0 } : { left: 0 }),
          width: 3,
          borderRadius: 2,
          backgroundColor: low ? colors.warning : colors.brand,
          opacity: low ? 0.9 : 0.5,
        }}
      />

      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.sm,
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.sm + 2,
          ...(isRTL
            ? { paddingRight: theme.spacing.lg + 4 }
            : { paddingLeft: theme.spacing.lg + 4 }),
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          backgroundColor: colors.surfaceSecondary,
        }}
      >
        <AppText
          variant="caption"
          weight={titleWeight}
          style={{
            letterSpacing: locale === 'ar' ? 0 : 0.55,
            textTransform: locale === 'ar' ? 'none' : 'uppercase',
            fontSize: 11,
            color: colors.brand,
          }}
        >
          {t('mobile.inventory.categoryRail')}
        </AppText>
        {low ? (
          <View
            style={{
              paddingHorizontal: theme.spacing.sm,
              paddingVertical: 2,
              borderRadius: theme.radius.full,
              backgroundColor: `${colors.warning}22`,
              borderWidth: 1,
              borderColor: `${colors.warning}55`,
            }}
          >
            <AppText
              variant="caption"
              weight="medium"
              style={{ color: colors.warning, fontSize: 10 }}
            >
              {t('mobile.inventory.lowStockCount', { count: group.lowStockCount })}
            </AppText>
          </View>
        ) : null}
      </View>

      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          gap: theme.spacing.md,
          alignItems: 'center',
          padding: theme.spacing.lg,
          ...(isRTL
            ? { paddingRight: theme.spacing.lg + 4 }
            : { paddingLeft: theme.spacing.lg + 4 }),
        }}
      >
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: colors.brandSoft,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons
            name={GROUP_ICON[group.categoryGroup]}
            size={22}
            color={colors.brand}
          />
        </View>
        <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
          <AppText
            variant="heading"
            weight={titleWeight}
            style={{ textAlign: isRTL ? 'right' : 'left' }}
          >
            {title}
          </AppText>
          <AppText
            variant="caption"
            color="secondary"
            weight="regular"
            style={{ textAlign: isRTL ? 'right' : 'left' }}
          >
            {t('mobile.inventory.materialCount', { count: group.materialCount })}
          </AppText>
          <AppText
            variant="caption"
            color="muted"
            weight="regular"
            dir="ltr"
            style={{ textAlign: isRTL ? 'right' : 'left' }}
          >
            {qty}
          </AppText>
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
