import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import { WAREHOUSE_TYPES, type WarehouseType } from '../api';

const TYPE_ICON: Record<WarehouseType, keyof typeof Ionicons.glyphMap> = {
  RAW_MATERIALS: 'cube-outline',
  SEMI_FINISHED: 'layers-outline',
  FINISHED_GOODS: 'checkmark-done-outline',
};

type Props = {
  open: boolean;
  selected: WarehouseType;
  onClose: () => void;
  onSelect: (type: WarehouseType) => void;
};

export function WarehouseTypeSheet({ open, selected, onClose, onSelect }: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('mobile.inventory.pickWarehouseType')}
      fitContent
      overlay
    >
      <View style={{ gap: theme.spacing.sm }}>
        <AppText
          variant="caption"
          color="muted"
          style={{ textAlign: isRTL ? 'right' : 'left' }}
        >
          {t('mobile.inventory.pickWarehouseTypeHint')}
        </AppText>
        {WAREHOUSE_TYPES.map((type) => {
          const active = type === selected;
          return (
            <AnimatedPressable
              key={type}
              variant="button"
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => {
                void haptics.selection();
                onSelect(type);
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
                <Ionicons name={TYPE_ICON[type]} size={18} color={colors.brand} />
              </View>
              <AppText
                variant="body"
                weight={titleWeight}
                style={{ flex: 1, textAlign: isRTL ? 'right' : 'left' }}
              >
                {t(`mobile.inventory.warehouseTypes.${type}`)}
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
