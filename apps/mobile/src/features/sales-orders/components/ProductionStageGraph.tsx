import { useEffect } from 'react';
import { View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import type { OrderStageView } from '../selectOrderDetail';
import { layoutStageGraph } from '../stageGraphLayout';

const NODE = 56;
const ROW_GAP = 28;
const COL_GAP = 20;

type Props = {
  stages: OrderStageView[];
  title?: string;
};

function statusColor(
  status: string,
  colors: ReturnType<typeof useTheme>['colors'],
): string {
  const s = status.toUpperCase();
  if (s === 'COMPLETED' || s === 'DONE') return colors.success;
  if (s === 'IN_PROGRESS' || s === 'ACTIVE' || s === 'READY') return colors.brand;
  if (s === 'LATE' || s === 'BLOCKED') return colors.error;
  return colors.border;
}

function StageNode({
  name,
  status,
  progressPercent,
  index,
  left,
  top,
  color,
  reduceMotion,
}: {
  name: string;
  status: string;
  progressPercent: number;
  index: number;
  left: number;
  top: number;
  color: string;
  reduceMotion: boolean;
}) {
  const { colors } = useTheme();
  const enter = useSharedValue(reduceMotion ? 1 : 0);
  const pulse = useSharedValue(1);
  const active =
    status.toUpperCase() === 'IN_PROGRESS' ||
    status.toUpperCase() === 'ACTIVE' ||
    status.toUpperCase() === 'READY';

  useEffect(() => {
    if (reduceMotion) {
      enter.value = 1;
      return;
    }
    enter.value = withDelay(
      index * 60,
      withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) }),
    );
  }, [enter, index, reduceMotion]);

  useEffect(() => {
    if (!active || reduceMotion) {
      pulse.value = 1;
      return;
    }
    pulse.value = withRepeat(
      withTiming(1.08, { duration: 900, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [active, pulse, reduceMotion]);

  const style = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [
      { scale: enter.value * pulse.value },
      { translateY: (1 - enter.value) * 8 },
    ],
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left,
          top,
          width: NODE,
          alignItems: 'center',
          gap: 4,
        },
        style,
      ]}
    >
      <View
        style={{
          width: NODE,
          height: NODE,
          borderRadius: NODE / 2,
          borderWidth: 2.5,
          borderColor: color,
          backgroundColor: colors.surface,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <AppText variant="caption" weight="semibold" style={{ color }}>
          {Math.round(progressPercent)}%
        </AppText>
      </View>
      <AppText
        variant="caption"
        weight="medium"
        numberOfLines={2}
        style={{
          textAlign: 'center',
          maxWidth: NODE + 12,
          color: colors.textSecondary,
          fontSize: 11,
        }}
      >
        {name}
      </AppText>
    </Animated.View>
  );
}

export function ProductionStageGraph({ stages, title }: Props) {
  const { t } = useLocale();
  const { colors, theme } = useTheme();
  const reduceMotion = useReducedMotion();
  const { width: windowWidth } = useWindowDimensions();
  const layout = layoutStageGraph(stages);

  if (!layout.nodes.length) return null;

  const padX = theme.spacing.md;
  const contentWidth = Math.max(220, windowWidth - theme.spacing.lg * 2 - padX * 2);
  const height =
    layout.levelCount * NODE +
    Math.max(0, layout.levelCount - 1) * ROW_GAP +
    36;

  const positions = new Map<string, { x: number; y: number }>();
  for (const node of layout.nodes) {
    const laneCount = layout.nodes.filter((n) => n.level === node.level).length;
    const rowWidth =
      laneCount * NODE + Math.max(0, laneCount - 1) * COL_GAP;
    const startX = (contentWidth - rowWidth) / 2;
    const x = startX + node.lane * (NODE + COL_GAP);
    const y = node.level * (NODE + ROW_GAP);
    positions.set(node.code, { x, y });
  }

  return (
    <View style={{ gap: theme.spacing.sm }}>
      {title ? (
        <AppText variant="label" weight="semibold">
          {title}
        </AppText>
      ) : null}
      <View
        style={{
          height,
          width: contentWidth,
          alignSelf: 'center',
          marginVertical: theme.spacing.xs,
        }}
      >
        {layout.edges.map((edge) => {
          const from = positions.get(edge.from);
          const to = positions.get(edge.to);
          if (!from || !to) return null;
          const x1 = from.x + NODE / 2;
          const y1 = from.y + NODE;
          const x2 = to.x + NODE / 2;
          const y2 = to.y;
          const midY = (y1 + y2) / 2;
          const stroke = colors.borderStrong ?? colors.border;
          return (
            <View key={`${edge.from}->${edge.to}`} pointerEvents="none">
              <View
                style={{
                  position: 'absolute',
                  left: x1 - 1,
                  top: y1,
                  width: 2,
                  height: Math.max(0, midY - y1),
                  backgroundColor: stroke,
                }}
              />
              <View
                style={{
                  position: 'absolute',
                  left: Math.min(x1, x2),
                  top: midY - 1,
                  width: Math.abs(x2 - x1) || 2,
                  height: 2,
                  backgroundColor: stroke,
                }}
              />
              <View
                style={{
                  position: 'absolute',
                  left: x2 - 1,
                  top: midY,
                  width: 2,
                  height: Math.max(0, y2 - midY),
                  backgroundColor: stroke,
                }}
              />
            </View>
          );
        })}
        {layout.nodes.map((node, index) => {
          const pos = positions.get(node.code)!;
          return (
            <StageNode
              key={node.code}
              name={node.name}
              status={node.status}
              progressPercent={node.progressPercent}
              index={index}
              left={pos.x}
              top={pos.y}
              color={statusColor(node.status, colors)}
              reduceMotion={Boolean(reduceMotion)}
            />
          );
        })}
      </View>
      <AppText variant="caption" color="muted">
        {t('mobile.orderDetail.stageGraphHint')}
      </AppText>
    </View>
  );
}
