import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import {
  INVENTORY_CATEGORY_GROUPS,
  type InventoryCategoryGroup,
} from '../api';

const GROUP_ICON: Record<InventoryCategoryGroup, keyof typeof Ionicons.glyphMap> = {
  fabric: 'color-palette-outline',
  foam: 'layers-outline',
  wood: 'leaf-outline',
  accessories: 'construct-outline',
};

type Props = {
  open: boolean;
  selected: InventoryCategoryGroup;
  onClose: () => void;
  onSelect: (group: InventoryCategoryGroup) => void;
};

export function InventoryMaterialTypeSheet({
  open,
  selected,
  onClose,
  onSelect,
}: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const title = t('mobile.inventory.pickMaterialType');
  const sheetTitle =
    title === 'mobile.inventory.pickMaterialType' ? 'Material type' : title;
  const hint = t('mobile.inventory.pickMaterialTypeHint');
  const hintText =
    hint === 'mobile.inventory.pickMaterialTypeHint'
      ? 'Fabric, foam, wood, or accessories.'
      : hint;

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={sheetTitle}
      fitContent
      overlay
    >
      <View style={{ gap: theme.spacing.sm }}>
        <AppText
          variant="caption"
          color="muted"
          style={{ textAlign: isRTL ? 'right' : 'left' }}
        >
          {hintText}
        </AppText>
        {INVENTORY_CATEGORY_GROUPS.map((group) => {
          const active = group === selected;
          return (
            <AnimatedPressable
              key={group}
              variant="button"
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => {
                void haptics.selection();
                onSelect(group);
                onClose();
              }}
              style={{
                minHeight: theme.sizes.touch.min,
                borderRadius: theme.radius.xl,
                borderWidth: 1,
                borderColor: active ? colors.brand : colors.borderStrong,
                backgroundColor: active ? colors.brandSoft : colors.surfaceSecondary,
                paddingHorizontal: theme.spacing.md,
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                gap: theme.spacing.sm,
                overflow: 'hidden',
                ...orderBoardShadow(colorScheme),
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Ionicons name={GROUP_ICON[group]} size={18} color={colors.brand} />
              </View>
              <AppText
                variant="body"
                weight={titleWeight}
                style={{ flex: 1, textAlign: isRTL ? 'right' : 'left' }}
              >
                {t(`mobile.inventory.groups.${group}`)}
              </AppText>
              {active ? (
                <Ionicons name="checkmark" size={18} color={colors.brand} />
              ) : null}
            </AnimatedPressable>
          );
        })}
      </View>
    </BottomSheet>
  );
}
