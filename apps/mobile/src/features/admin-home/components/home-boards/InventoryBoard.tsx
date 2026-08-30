import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import { AppText } from '@/components/AppText';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, CountUp, softFadeDown, useReducedMotion } from '@/motion';
import { useTheme } from '@/theme';
import { useMgmtNav, type LabeledTile } from './boardShared';

type Props = { tiles: LabeledTile[] };

function cellTone(
  key: string,
  colors: { brand: string; info: string; success: string; warning: string },
): string {
  if (key.includes('raw') || key.includes('material')) return colors.warning;
  if (key.includes('semi')) return colors.info;
  if (key.includes('finished')) return colors.success;
  return colors.brand;
}

/** Floor cells raw / SEMI / FG — Inventory board. */
export function InventoryBoard({ tiles }: Props) {
  const { isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const reduce = useReducedMotion();
  const nav = useMgmtNav();

  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        flexWrap: 'wrap',
        gap: theme.spacing.sm,
      }}
    >
      {tiles.map(({ tile, label }, index) => {
        const Cell = reduce || index > 2 ? View : Animated.View;
        const enter = reduce || index > 2 ? {} : { entering: softFadeDown(40 + index * 40) };
        const accent = cellTone(tile.key, colors);
        return (
          <Cell key={tile.key} {...enter} style={{ width: '47%', flexGrow: 1, minWidth: 148 }}>
            <AnimatedPressable
              variant="card"
              accessibilityRole="button"
              accessibilityLabel={`${label} ${tile.count}`}
              onPress={() => nav(tile.href, tile.filter)}
              style={{
                borderRadius: theme.radius.lg,
                borderWidth: 1,
                borderColor: colors.borderStrong,
                backgroundColor: colors.surface,
                overflow: 'hidden',
                minHeight: 108,
                ...orderBoardShadow(colorScheme),
              }}
            >
              <View
                style={{
                  height: 5,
                  backgroundColor: accent,
                }}
              />
              <View style={{ padding: theme.spacing.md, gap: 8, flex: 1, justifyContent: 'space-between' }}>
                <AppText variant="caption" color="secondary" numberOfLines={2}>
                  {label}
                </AppText>
                <CountUp value={tile.count} variant="heading" color={accent} />
              </View>
            </AnimatedPressable>
          </Cell>
        );
      })}
    </View>
  );
}
