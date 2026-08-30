import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated from 'react-native-reanimated';
import { AppText } from '@/components/AppText';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { CountUp, softFadeDown, useReducedMotion } from '@/motion';
import { useTheme } from '@/theme';

type Workers = {
  workingToday: number;
  assigned: number;
  unassigned: number;
  conflicts: number;
};

type Props = {
  workers: Workers;
  summary: string;
  labels: {
    working: string;
    assigned: string;
    unassigned: string;
    conflicts: string;
  };
};

/** People bench stamps — Workers board. */
export function WorkersBoard({ workers, summary, labels }: Props) {
  const { isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const reduce = useReducedMotion();

  const seats: Array<{ key: string; label: string; value: number; hot?: boolean }> = [
    { key: 'working', label: labels.working, value: workers.workingToday },
    { key: 'assigned', label: labels.assigned, value: workers.assigned },
    { key: 'unassigned', label: labels.unassigned, value: workers.unassigned },
    {
      key: 'conflicts',
      label: labels.conflicts,
      value: workers.conflicts,
      hot: workers.conflicts > 0,
    },
  ];

  return (
    <View style={{ gap: theme.spacing.md }}>
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          flexWrap: 'wrap',
          gap: theme.spacing.sm,
        }}
      >
        {seats.map((seat, index) => {
          const Seat = reduce || index > 2 ? View : Animated.View;
          const enter = reduce || index > 2 ? {} : { entering: softFadeDown(40 + index * 35) };
          return (
            <Seat key={seat.key} {...enter} style={{ width: '47%', flexGrow: 1, minWidth: 140 }}>
              <View
                style={{
                  borderRadius: theme.radius.lg,
                  borderWidth: 1,
                  borderColor: seat.hot ? colors.warning : colors.borderStrong,
                  backgroundColor: seat.hot ? colors.warningSoft : colors.surfaceSecondary,
                  padding: theme.spacing.md,
                  gap: 8,
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
                  <Ionicons
                    name={seat.hot ? 'warning-outline' : 'person-outline'}
                    size={16}
                    color={seat.hot ? colors.warning : colors.brand}
                  />
                  <AppText variant="caption" color="secondary">
                    {seat.label}
                  </AppText>
                </View>
                <CountUp
                  value={seat.value}
                  variant="heading"
                  color={seat.hot ? colors.warning : colors.brand}
                />
              </View>
            </Seat>
          );
        })}
      </View>
      <AppText variant="bodySecondary" color="secondary">
        {summary}
      </AppText>
    </View>
  );
}
