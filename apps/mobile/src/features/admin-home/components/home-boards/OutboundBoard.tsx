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

const PIPELINE_ORDER = ['finishedWaiting', 'leavingToday', 'overduePickup', 'shippedAwaitingDealer'];

/** Ready → Leaving → Dealer pipeline — Outbound board. */
export function OutboundBoard({ tiles }: Props) {
  const { isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const reduce = useReducedMotion();
  const nav = useMgmtNav();

  const ordered = [...tiles].sort((a, b) => {
    const ai = PIPELINE_ORDER.indexOf(a.tile.key);
    const bi = PIPELINE_ORDER.indexOf(b.tile.key);
    return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
  });

  return (
    <View style={{ gap: theme.spacing.sm }}>
      {ordered.map(({ tile, label }, index) => {
        const Node = reduce || index > 2 ? View : Animated.View;
        const enter = reduce || index > 2 ? {} : { entering: softFadeDown(45 + index * 40) };
        const isLast = index === ordered.length - 1;
        return (
          <Node key={tile.key} {...enter}>
            <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: theme.spacing.sm }}>
              <View style={{ alignItems: 'center', width: 20 }}>
                <View
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 6,
                    backgroundColor: colors.brand,
                    borderWidth: 2,
                    borderColor: colors.brandSoft,
                  }}
                />
                {!isLast ? (
                  <View
                    style={{
                      width: 2,
                      flex: 1,
                      minHeight: 18,
                      backgroundColor: colors.borderStrong,
                      marginVertical: 4,
                    }}
                  />
                ) : null}
              </View>
              <AnimatedPressable
                variant="card"
                accessibilityRole="button"
                accessibilityLabel={`${label} ${tile.count}`}
                onPress={() => nav(tile.href, tile.filter)}
                style={{
                  flex: 1,
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  gap: theme.spacing.md,
                  borderRadius: theme.radius.lg,
                  borderWidth: 1,
                  borderColor: colors.borderStrong,
                  backgroundColor: colors.surfaceSecondary,
                  padding: theme.spacing.md,
                  marginBottom: isLast ? 0 : theme.spacing.xs,
                  ...orderBoardShadow(colorScheme),
                }}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText variant="caption" color="secondary" numberOfLines={1}>
                    {label}
                  </AppText>
                  <CountUp value={tile.count} variant="heading" color={colors.brand} />
                </View>
                <Ionicons
                  name={isRTL ? 'chevron-back' : 'chevron-forward'}
                  size={16}
                  color={colors.textMuted}
                />
              </AnimatedPressable>
            </View>
          </Node>
        );
      })}
    </View>
  );
}
