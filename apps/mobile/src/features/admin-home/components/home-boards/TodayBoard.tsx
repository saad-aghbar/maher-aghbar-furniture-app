import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import { AppText } from '@/components/AppText';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, CountUp, ListItemEnter, softFadeDown, useReducedMotion } from '@/motion';
import { useTheme } from '@/theme';
import { barFill, tileTotal, useMgmtNav, type LabeledTile } from './boardShared';

type Props = { tiles: LabeledTile[] };

/** Day progress rail + stamp chips — Today board. */
export function TodayBoard({ tiles }: Props) {
  const { isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const reduce = useReducedMotion();
  const nav = useMgmtNav();
  const total = tileTotal(tiles);
  const max = Math.max(...tiles.map((t) => t.tile.count), 1);

  return (
    <View style={{ gap: theme.spacing.md }}>
      <View
        style={{
          borderRadius: theme.radius.lg,
          borderWidth: 1,
          borderColor: colors.borderStrong,
          backgroundColor: colors.surfaceSecondary,
          padding: theme.spacing.md,
          gap: theme.spacing.sm,
          ...orderBoardShadow(colorScheme),
        }}
      >
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            justifyContent: 'flex-end',
            alignItems: 'baseline',
          }}
        >
          <CountUp value={total} variant="heading" color={colors.brand} />
        </View>
        <View
          style={{
            height: 10,
            borderRadius: theme.radius.full,
            backgroundColor: colors.border,
            overflow: 'hidden',
            flexDirection: isRTL ? 'row-reverse' : 'row',
          }}
        >
          {tiles.slice(0, 6).map((row, i) => {
            const flex = Math.max(row.tile.count, 0.15);
            const tones = [colors.brand, colors.info, colors.warning, colors.success];
            return (
              <View
                key={row.tile.key}
                style={{
                  flex,
                  backgroundColor: tones[i % tones.length],
                  opacity: 0.85 - i * 0.08,
                }}
              />
            );
          })}
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
          const enter = reduce || index > 2 ? {} : { entering: softFadeDown(40 + index * 40) };
          return (
            <Stamp key={tile.key} {...enter} style={{ width: '47%', flexGrow: 1, minWidth: 140 }}>
              <ListItemEnter index={Math.min(index, 2)}>
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
                    padding: theme.spacing.md,
                    gap: 8,
                    ...orderBoardShadow(colorScheme),
                  }}
                >
                  <AppText variant="caption" color="secondary" numberOfLines={1}>
                    {label}
                  </AppText>
                  <CountUp value={tile.count} variant="title" color={colors.brand} />
                  <View
                    style={{
                      height: 4,
                      borderRadius: 2,
                      backgroundColor: colors.border,
                      overflow: 'hidden',
                    }}
                  >
                    <View
                      style={{
                        width: `${Math.round(barFill(tile.count, max) * 100)}%`,
                        height: '100%',
                        backgroundColor: colors.brand,
                        alignSelf: isRTL ? 'flex-end' : 'flex-start',
                      }}
                    />
                  </View>
                </AnimatedPressable>
              </ListItemEnter>
            </Stamp>
          );
        })}
      </View>
    </View>
  );
}
