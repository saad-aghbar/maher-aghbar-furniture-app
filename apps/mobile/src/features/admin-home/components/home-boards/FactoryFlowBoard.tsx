import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated from 'react-native-reanimated';
import { AppText } from '@/components/AppText';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, CountUp, softFadeDown, useReducedMotion } from '@/motion';
import { useTheme } from '@/theme';
import { useMgmtNav } from './boardShared';
import type { MgmtFlowPhase } from '../../api';

type Props = { phases: MgmtFlowPhase[] };

/** Connected phase journey — Factory flow board. */
export function FactoryFlowBoard({ phases }: Props) {
  const { isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const reduce = useReducedMotion();
  const nav = useMgmtNav();
  const total = phases.reduce((s, p) => s + p.count, 0) || 1;

  return (
    <View style={{ gap: theme.spacing.md }}>
      <View
        style={{
          height: 8,
          borderRadius: theme.radius.full,
          backgroundColor: colors.border,
          overflow: 'hidden',
          flexDirection: isRTL ? 'row-reverse' : 'row',
        }}
      >
        {phases.map((phase, i) => (
          <View
            key={`fill-${phase.key}`}
            style={{
              flex: Math.max(phase.count, 0.2),
              backgroundColor: i % 2 === 0 ? colors.brand : colors.info,
              opacity: 0.75,
            }}
          />
        ))}
      </View>

      <View style={{ gap: theme.spacing.sm }}>
        {phases.map((phase, index) => {
          const Node = reduce || index > 2 ? View : Animated.View;
          const enter = reduce || index > 2 ? {} : { entering: softFadeDown(50 + index * 35) };
          const share = Math.round((phase.count / total) * 100);
          return (
            <Node key={phase.key} {...enter}>
              <AnimatedPressable
                variant="card"
                accessibilityRole="button"
                accessibilityLabel={`${phase.label} ${phase.count}`}
                onPress={() => nav(phase.href, phase.filter)}
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  gap: theme.spacing.md,
                  borderRadius: theme.radius.lg,
                  borderWidth: 1,
                  borderColor: colors.borderStrong,
                  backgroundColor: colors.surfaceSecondary,
                  paddingVertical: theme.spacing.md,
                  paddingHorizontal: theme.spacing.md,
                  ...orderBoardShadow(colorScheme),
                }}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    borderWidth: 2,
                    borderColor: colors.brand,
                    backgroundColor: colors.brandSoft,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <AppText variant="caption" weight="semibold" style={{ color: colors.brand }}>
                    {index + 1}
                  </AppText>
                </View>
                <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
                  <AppText variant="label" weight="semibold" numberOfLines={1}>
                    {phase.label}
                  </AppText>
                  <View
                    style={{
                      height: 3,
                      borderRadius: 2,
                      backgroundColor: colors.border,
                      overflow: 'hidden',
                      marginTop: 4,
                    }}
                  >
                    <View
                      style={{
                        width: `${Math.max(8, share)}%`,
                        height: '100%',
                        backgroundColor: colors.brand,
                        alignSelf: isRTL ? 'flex-end' : 'flex-start',
                      }}
                    />
                  </View>
                </View>
                <CountUp value={phase.count} variant="title" color={colors.brand} />
                <Ionicons
                  name={isRTL ? 'chevron-back' : 'chevron-forward'}
                  size={16}
                  color={colors.textMuted}
                />
              </AnimatedPressable>
            </Node>
          );
        })}
      </View>
    </View>
  );
}
