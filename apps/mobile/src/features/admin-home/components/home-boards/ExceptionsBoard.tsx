import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated from 'react-native-reanimated';
import { AppText } from '@/components/AppText';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, CountUp, softFadeDown, useReducedMotion } from '@/motion';
import { useTheme } from '@/theme';
import { useMgmtNav, type LabeledTile } from './boardShared';

type Props = { tiles: LabeledTile[] };

/** Dark stamp tickets — Exceptions board. */
export function ExceptionsBoard({ tiles }: Props) {
  const { isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const reduce = useReducedMotion();
  const nav = useMgmtNav();
  const ink = colorScheme === 'dark' ? '#1C1816' : '#2A2420';
  const gold = '#E8C98A';

  return (
    <View style={{ gap: theme.spacing.sm }}>
      {tiles.map(({ tile, label }, index) => {
        const Stamp = reduce || index > 2 ? View : Animated.View;
        const enter = reduce || index > 2 ? {} : { entering: softFadeDown(40 + index * 35) };
        return (
          <Stamp key={tile.key} {...enter}>
            <AnimatedPressable
              variant="card"
              accessibilityRole="button"
              accessibilityLabel={`${label} ${tile.count}`}
              onPress={() => nav(tile.href, tile.filter)}
              style={{
                borderRadius: theme.radius.lg,
                backgroundColor: ink,
                overflow: 'hidden',
                borderWidth: 1,
                borderColor: 'rgba(232,201,138,0.28)',
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
                  backgroundColor: gold,
                }}
              />
              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  gap: theme.spacing.md,
                  padding: theme.spacing.md,
                  ...(isRTL
                    ? { paddingRight: theme.spacing.md + 4 }
                    : { paddingLeft: theme.spacing.md + 4 }),
                }}
              >
                <Ionicons name="alert-circle" size={20} color={gold} />
                <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
                  <AppText
                    variant="caption"
                    weight="semibold"
                    numberOfLines={1}
                    style={{
                      color: gold,
                      letterSpacing: locale === 'ar' ? 0 : 1,
                      textTransform: 'uppercase',
                    }}
                  >
                    {label}
                  </AppText>
                </View>
                <CountUp value={tile.count} variant="title" color={gold} />
                <Ionicons
                  name={isRTL ? 'chevron-back' : 'chevron-forward'}
                  size={16}
                  color="rgba(245,241,234,0.55)"
                />
              </View>
            </AnimatedPressable>
          </Stamp>
        );
      })}
    </View>
  );
}
