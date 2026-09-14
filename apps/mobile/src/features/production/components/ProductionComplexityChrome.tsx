import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import type { ProductionComplexityFilter } from '../api';

export type ProductionKindFilter = 'all' | ProductionComplexityFilter;

const KINDS: ProductionKindFilter[] = ['all', 'STANDARD', 'MODIFIED', 'CUSTOM'];

const KIND_ICON: Record<ProductionKindFilter, keyof typeof Ionicons.glyphMap> = {
  all: 'apps-outline',
  STANDARD: 'cube-outline',
  MODIFIED: 'options-outline',
  CUSTOM: 'color-wand-outline',
};

type Props = {
  value: ProductionKindFilter;
  onChange: (next: ProductionKindFilter) => void;
};

/**
 * All / Standard / Modified / Custom — period cells with a 3px bottom bar.
 */
export function ProductionComplexityChrome({ value, onChange }: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        gap: theme.spacing.sm,
      }}
    >
      {KINDS.map((item) => {
        const active = item === value;
        const label = t(`mobile.production.kindFilter.${item}`);
        return (
          <AnimatedPressable
            key={item}
            variant="button"
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={label}
            onPress={() => {
              if (item === value) return;
              void haptics.selection();
              onChange(item);
            }}
            style={{
              flex: 1,
              minWidth: 0,
              minHeight: 48,
              borderRadius: theme.radius.lg,
              borderWidth: 1,
              borderColor: active ? colors.brand : colors.borderStrong,
              backgroundColor: active ? colors.brandSoft : colors.surfaceSecondary,
              paddingVertical: theme.spacing.sm,
              paddingHorizontal: 4,
              overflow: 'hidden',
              alignItems: 'center',
              gap: 4,
              ...orderBoardShadow(colorScheme),
            }}
          >
            {active ? (
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  bottom: 0,
                  height: 3,
                  backgroundColor: colors.brand,
                }}
              />
            ) : null}
            <View
              style={{
                width: 26,
                height: 26,
                borderRadius: 13,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: active ? colors.brand : colors.border,
              }}
            >
              <Ionicons
                name={KIND_ICON[item]}
                size={13}
                color={active ? colors.brand : colors.textSecondary}
              />
            </View>
            <AppText
              variant="caption"
              weight={titleWeight}
              numberOfLines={1}
              align="center"
              style={{
                fontSize: 10,
                lineHeight: 12,
                letterSpacing: locale === 'ar' ? 0 : 0.4,
                textTransform: locale === 'ar' ? 'none' : 'uppercase',
                color: active ? colors.brand : colors.textSecondary,
              }}
            >
              {label}
            </AppText>
          </AnimatedPressable>
        );
      })}
    </View>
  );
}
