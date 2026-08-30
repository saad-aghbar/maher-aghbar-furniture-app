import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { AppText } from '@/components/AppText';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, CountUp, softFadeDown, useReducedMotion } from '@/motion';
import { useTheme } from '@/theme';
import { useMgmtNav, type LabeledTile } from './boardShared';

type Props = { tiles: LabeledTile[] };

function PulseDot({ hot }: { hot: boolean }) {
  const { colors } = useTheme();
  const reduce = useReducedMotion();
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (reduce || !hot) return;
    pulse.value = withRepeat(
      withTiming(0.35, { duration: 1100, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [hot, pulse, reduce]);

  const style = useAnimatedStyle(() => ({
    opacity: hot && !reduce ? pulse.value : 0.55,
    transform: [{ scale: hot && !reduce ? 0.85 + pulse.value * 0.2 : 1 }],
  }));

  return (
    <Animated.View
      style={[
        {
          width: 10,
          height: 10,
          borderRadius: 5,
          backgroundColor: hot ? colors.warning : colors.success,
        },
        style,
      ]}
    />
  );
}

/** Shortage pulse chips — Materials board. */
export function MaterialsBoard({ tiles }: Props) {
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
        const Chip = reduce || index > 2 ? View : Animated.View;
        const enter = reduce || index > 2 ? {} : { entering: softFadeDown(40 + index * 40) };
        const hot = tile.count > 0;
        return (
          <Chip key={tile.key} {...enter} style={{ width: '47%', flexGrow: 1, minWidth: 148 }}>
            <AnimatedPressable
              variant="card"
              accessibilityRole="button"
              accessibilityLabel={`${label} ${tile.count}`}
              onPress={() => nav(tile.href, tile.filter)}
              style={{
                borderRadius: theme.radius.lg,
                borderWidth: 1,
                borderColor: hot ? colors.warning : colors.borderStrong,
                backgroundColor: hot ? colors.warningSoft : colors.surfaceSecondary,
                padding: theme.spacing.md,
                gap: theme.spacing.sm,
                ...orderBoardShadow(colorScheme),
              }}
            >
              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <PulseDot hot={hot} />
                <AppText variant="caption" color="secondary" style={{ flex: 1 }} numberOfLines={2}>
                  {label}
                </AppText>
              </View>
              <CountUp
                value={tile.count}
                variant="heading"
                color={hot ? colors.warning : colors.brand}
              />
            </AnimatedPressable>
          </Chip>
        );
      })}
    </View>
  );
}
