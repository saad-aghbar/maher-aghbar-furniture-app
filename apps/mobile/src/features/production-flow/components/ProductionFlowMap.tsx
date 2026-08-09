import { useEffect, useMemo } from 'react';
import { View, useWindowDimensions, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useReducedMotion } from '@/motion';
import { useTheme } from '@/theme';
import {
  displayStageEdges,
  layoutStageGraph,
} from '@/features/sales-orders/stageGraphLayout';
import type { OrderStageView } from '@/features/sales-orders/selectOrderDetail';
import type { ProductionFlowStage } from '../selectProductionFlow';
import { FLOW_NODE, FlowStageNode } from './FlowStageNode';
import { FlowMapAtmosphere } from './FlowMapAtmosphere';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** Horizontal gap between parallel (barrel) nodes. */
const COL_GAP = 56;
/** Vertical gap between node bottoms and next row tops (room for labels). */
const ROW_GAP = 52;
/** Symmetric inset above first node and below last label. */
const PAD_Y = 28;
const LABEL_BAND = 44;
const STROKE = 2.75;

type Props = {
  stages: ProductionFlowStage[];
  onStagePress?: (stage: ProductionFlowStage) => void;
};

function toOrderStages(stages: ProductionFlowStage[]): OrderStageView[] {
  return stages.map((s) => ({
    code: s.code,
    name: s.name,
    status: s.status,
    progressPercent: s.progressPercent,
    dependsOnCodes: s.dependsOnCodes,
    sortOrder: s.sortOrder,
  }));
}

function normalizeStatus(status: string): string {
  const s = status.toUpperCase();
  if (s === 'DONE') return 'COMPLETED';
  return s;
}

function isDone(status: string): boolean {
  const s = normalizeStatus(status);
  return s === 'COMPLETED' || s === 'SKIPPED';
}

/** Smooth vertical S-curve — fans out for splits, funnels for merges. */
function barrelPath(x1: number, y1: number, x2: number, y2: number): string {
  const dy = Math.max(24, y2 - y1);
  const bend = Math.min(56, dy * 0.48);
  return `M ${x1} ${y1} C ${x1} ${y1 + bend}, ${x2} ${y2 - bend}, ${x2} ${y2}`;
}

/** Cubic length ≈ chord × factor (good enough for dash fill). */
function approxPathLength(x1: number, y1: number, x2: number, y2: number): number {
  const chord = Math.hypot(x2 - x1, y2 - y1);
  return Math.max(24, chord * 1.18);
}

function stageFillRatio(stage: ProductionFlowStage | undefined): number {
  if (!stage) return 0;
  if (isDone(stage.status)) return 1;
  return Math.max(0, Math.min(1, Number(stage.progressPercent ?? 0) / 100));
}

function EdgePath({
  d,
  index,
  pathLength,
  fillRatio,
  trackColor,
  fillColor,
  reduceMotion,
}: {
  d: string;
  index: number;
  pathLength: number;
  fillRatio: number;
  trackColor: string;
  fillColor: string;
  reduceMotion: boolean;
}) {
  const appear = useSharedValue(reduceMotion ? 1 : 0);
  const fill = useSharedValue(reduceMotion ? fillRatio : 0);

  useEffect(() => {
    if (reduceMotion) {
      appear.value = 1;
      fill.value = fillRatio;
      return;
    }
    appear.value = withDelay(
      90 + index * 45,
      withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) }),
    );
    fill.value = withDelay(
      140 + index * 45,
      withTiming(fillRatio, { duration: 640, easing: Easing.out(Easing.cubic) }),
    );
  }, [appear, fill, fillRatio, index, reduceMotion]);

  const trackProps = useAnimatedProps(() => ({
    strokeOpacity: 0.55 + appear.value * 0.45,
  }));

  const fillProps = useAnimatedProps(() => ({
    strokeDashoffset: pathLength * (1 - fill.value),
    strokeOpacity: appear.value,
  }));

  return (
    <>
      <AnimatedPath
        d={d}
        stroke={trackColor}
        strokeWidth={STROKE}
        fill="none"
        strokeLinecap="round"
        animatedProps={trackProps}
      />
      {fillRatio > 0.001 || !reduceMotion ? (
        <AnimatedPath
          d={d}
          stroke={fillColor}
          strokeWidth={STROKE}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${pathLength} ${pathLength}`}
          animatedProps={fillProps}
        />
      ) : null}
    </>
  );
}

export function ProductionFlowMap({ stages, onStagePress }: Props) {
  const { width: winW } = useWindowDimensions();
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const layout = layoutStageGraph(toOrderStages(stages));
  const edges = useMemo(() => displayStageEdges(layout), [layout]);
  const stageByCode = useMemo(() => new Map(stages.map((s) => [s.code, s])), [stages]);

  const lanesByLevel = useMemo(() => {
    const map = new Map<number, number>();
    for (const node of layout.nodes) {
      map.set(node.level, (map.get(node.level) ?? 0) + 1);
    }
    return map;
  }, [layout.nodes]);

  const maxLanes = Math.max(1, layout.maxLanes);
  const colW = FLOW_NODE + COL_GAP;
  const rowH = FLOW_NODE + LABEL_BAND + ROW_GAP;
  const contentW = Math.max(winW - 24, maxLanes * colW + 64);
  // Symmetric pad: top inset = bottom inset under last label.
  const height = Math.max(
    140,
    PAD_Y +
      Math.max(0, layout.levelCount - 1) * rowH +
      FLOW_NODE +
      LABEL_BAND +
      PAD_Y,
  );
  const centerX = contentW / 2;

  /** Center each level’s nodes as a group — singles sit on the spine; pairs form a barrel. */
  const laneX = (lane: number, level: number) => {
    const lanesInLevel = Math.max(1, lanesByLevel.get(level) ?? 1);
    const span = (lanesInLevel - 1) * colW;
    return centerX - span / 2 + lane * colW;
  };

  const nodeCenter = (code: string) => {
    const node = layout.nodes.find((n) => n.code === code);
    if (!node) return null;
    return {
      x: laneX(node.lane, node.level),
      top: PAD_Y + node.level * rowH,
      bottom: PAD_Y + node.level * rowH + FLOW_NODE,
      stage: stageByCode.get(code),
    };
  };

  return (
    <View
      style={{
        width: contentW,
        height,
        alignSelf: 'center',
        overflow: 'hidden',
        borderRadius: 12,
      }}
    >
      <FlowMapAtmosphere />

      <Svg
        width={contentW}
        height={height}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      >
        {edges.map((e, i) => {
          const a = nodeCenter(e.from);
          const b = nodeCenter(e.to);
          if (!a || !b) return null;
          const d = barrelPath(a.x, a.bottom, b.x, b.top);
          const pathLength = approxPathLength(a.x, a.bottom, b.x, b.top);
          // Line after a stage fills green to that stage’s progress (source, not destination).
          const fillRatio = stageFillRatio(a.stage);
          return (
            <EdgePath
              key={`${e.from}-${e.to}`}
              d={d}
              index={i}
              pathLength={pathLength}
              fillRatio={fillRatio}
              trackColor={colors.borderStrong}
              fillColor={colors.success}
              reduceMotion={reduceMotion}
            />
          );
        })}
      </Svg>

      {layout.nodes.map((node, index) => {
        const stage = stageByCode.get(node.code);
        if (!stage) return null;
        const cx = laneX(node.lane, node.level);
        const left = cx - FLOW_NODE / 2;
        const top = PAD_Y + node.level * rowH;
        return (
          <FlowStageNode
            key={node.code}
            stage={stage}
            index={index}
            left={left}
            top={top}
            reduceMotion={reduceMotion}
            onPress={onStagePress ? () => onStagePress(stage) : undefined}
          />
        );
      })}
    </View>
  );
}
