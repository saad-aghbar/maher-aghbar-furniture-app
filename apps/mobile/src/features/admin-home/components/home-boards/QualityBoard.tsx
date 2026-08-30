import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated from 'react-native-reanimated';
import { AppText } from '@/components/AppText';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, CountUp, softFadeDown, useReducedMotion } from '@/motion';
import { useTheme } from '@/theme';
import { tileTotal, useMgmtNav, type LabeledTile } from './boardShared';

type Props = { tiles: LabeledTile[] };

/** Shield dial + split stamps — Quality board. */
export function QualityBoard({ tiles }: Props) {
  const { isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const reduce = useReducedMotion();
  const nav = useMgmtNav();
  const total = tileTotal(tiles);
  const waiting = tiles.find((t) => t.tile.key.includes('waiting'))?.tile.count ?? 0;
  const dial = total > 0 ? Math.round(((total - waiting) / total) * 100) : 100;

  return (
    <View style={{ gap: theme.spacing.md }}>
      <View
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: theme.spacing.lg,
          borderRadius: theme.radius.xl,
          borderWidth: 1,
          borderColor: colors.borderStrong,
          backgroundColor: colors.surfaceSecondary,
          ...orderBoardShadow(colorScheme),
        }}
      >
        <View
          style={{
            width: 88,
            height: 88,
            borderRadius: 44,
            borderWidth: 6,
            borderColor: colors.brand,
            backgroundColor: colors.brandSoft,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
          }}
        >
          <Ionicons name="shield-checkmark" size={22} color={colors.brand} />
          <AppText variant="title" weight="semibold" style={{ color: colors.brand }}>
            {dial}%
          </AppText>
        </View>
      </View>

      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          flexWrap: 'wrap',
          gap: theme.spacing.sm,
        }}
      >
        {tiles.map(({ tile, label }, index) => {
          const Stamp = reduce || index > 2 ? View : Animated.View;
          const enter = reduce || index > 2 ? {} : { entering: softFadeDown(45 + index * 35) };
          const hot = tile.key.includes('fail') || tile.key.includes('waiting');
          return (
            <Stamp key={tile.key} {...enter} style={{ width: '47%', flexGrow: 1, minWidth: 140 }}>
              <AnimatedPressable
                variant="card"
                accessibilityRole="button"
                accessibilityLabel={`${label} ${tile.count}`}
                onPress={() => nav(tile.href, tile.filter)}
                style={{
                  borderRadius: theme.radius.lg,
                  borderWidth: 1,
                  borderColor: hot ? colors.warning : colors.borderStrong,
                  backgroundColor: colors.surface,
                  padding: theme.spacing.md,
                  gap: 6,
                  ...orderBoardShadow(colorScheme),
                }}
              >
                <AppText variant="caption" color="secondary" numberOfLines={2}>
                  {label}
                </AppText>
                <CountUp
                  value={tile.count}
                  variant="heading"
                  color={hot ? colors.warning : colors.success}
                />
              </AnimatedPressable>
            </Stamp>
          );
        })}
      </View>
    </View>
  );
}
