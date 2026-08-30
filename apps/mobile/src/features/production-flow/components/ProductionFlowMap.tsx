import { useEffect, useMemo } from 'react';
import { View, useWindowDimensions, StyleSheet } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
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

type Props = {
  stages: ProductionFlowStage[];
  onStagePress?: (stage: ProductionFlowStage) => void;
  /** Template editor preview — quieter nodes, no progress clutter. */
  preview?: boolean;
  /** Extra space below the last stage ring (e.g. floating tab bar clearance). */
  bottomInset?: number;
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

function approxPathLength(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.max(32, Math.hypot(dx, dy) * 1.18);
}

function stageFillRatio(stage: ProductionFlowStage | undefined, preview: boolean): number {
  if (preview || !stage) return 0;
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
      60 + index * 28,
      withTiming(1, { duration: 380, easing: Easing.out(Easing.cubic) }),
    );
    fill.value = withDelay(
      100 + index * 28,
      withTiming(fillRatio, { duration: 560, easing: Easing.out(Easing.cubic) }),
    );
  }, [appear, fill, fillRatio, index, reduceMotion]);

  const trackProps = useAnimatedProps(() => ({
    strokeOpacity: 0.4 + appear.value * 0.55,
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
        strokeWidth={2.25}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        animatedProps={trackProps}
      />
      {fillRatio > 0.001 || !reduceMotion ? (
        <AnimatedPath
          d={d}
          stroke={fillColor}
          strokeWidth={2.25}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={`${pathLength} ${pathLength}`}
          animatedProps={fillProps}
        />
      ) : null}
    </>
  );
}

export function ProductionFlowMap({
  stages,
  onStagePress,
  preview = false,
  bottomInset = 0,
}: Props) {
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
  // Breathe more when the graph is wide / deep.
  const colGap = maxLanes >= 4 ? 72 : maxLanes >= 3 ? 64 : 56;
  const rowGap = layout.levelCount >= 5 ? 64 : 56;
  const labelBand = 48;
  const padY = 32;
  const padBottom = padY + bottomInset;
  const padX = 40;
  const colW = FLOW_NODE + colGap;
  const rowH = FLOW_NODE + labelBand + rowGap;
  const contentW = Math.max(winW - 16, maxLanes * colW + padX * 2);
  const height = Math.max(
    160,
    padY +
      Math.max(0, layout.levelCount - 1) * rowH +
      FLOW_NODE +
      labelBand +
      padBottom,
  );
  const centerX = contentW / 2;

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
      top: padY + node.level * rowH,
      bottom: padY + node.level * rowH + FLOW_NODE,
      level: node.level,
      lane: node.lane,
      stage: stageByCode.get(code),
    };
  };

  const trackColor = colors.textMuted;
  const fillColor = colors.brand;

  return (
    <View
      style={{
        width: contentW,
        height,
        alignSelf: 'center',
        overflow: 'hidden',
        borderRadius: 16,
      }}
    >
      <FlowMapAtmosphere />

      {/* Soft center rail for visual spine */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: centerX - 1,
          top: padY,
          bottom: padBottom,
          width: 2,
          borderRadius: 1,
          backgroundColor: colors.border,
          opacity: 0.35,
        }}
      />

      <Svg
        width={contentW}
        height={height}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      >
        <Defs>
          <LinearGradient id="flowEdgeFade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={trackColor} stopOpacity="0.35" />
            <Stop offset="1" stopColor={trackColor} stopOpacity="0.85" />
          </LinearGradient>
        </Defs>
        {edges.map((e, i) => {
          const a = nodeCenter(e.from);
          const b = nodeCenter(e.to);
          if (!a || !b) return null;
          const d = barrelPath(a.x, a.bottom, b.x, b.top);
          const pathLength = approxPathLength(a.x, a.bottom, b.x, b.top);
          const fillRatio = stageFillRatio(a.stage, preview);
          return (
            <EdgePath
              key={`${e.from}-${e.to}`}
              d={d}
              index={i}
              pathLength={pathLength}
              fillRatio={fillRatio}
              trackColor={trackColor}
              fillColor={fillColor}
              reduceMotion={reduceMotion}
            />
          );
        })}
        {edges.map((e) => {
          const b = nodeCenter(e.to);
          if (!b) return null;
          return (
            <Circle
              key={`dot-${e.from}-${e.to}`}
              cx={b.x}
              cy={b.top}
              r={3}
              fill={colors.brandSoft}
              stroke={colors.brand}
              strokeWidth={1.25}
              opacity={0.9}
            />
          );
        })}
      </Svg>

      {layout.nodes.map((node, index) => {
        const stage = stageByCode.get(node.code);
        if (!stage) return null;
        const cx = laneX(node.lane, node.level);
        const left = cx - FLOW_NODE / 2;
        const top = padY + node.level * rowH;
        const previewStage = preview
          ? {
              ...stage,
              progressPercent: 0,
              status: 'PENDING',
              estimateReviewRequired: false,
            }
          : stage;
        return (
          <FlowStageNode
            key={node.code}
            stage={previewStage}
            index={typeof stage.sortOrder === 'number' ? stage.sortOrder : index}
            left={left}
            top={top}
            reduceMotion={reduceMotion}
            preview={preview}
            onPress={onStagePress ? () => onStagePress(stage) : undefined}
          />
        );
      })}
    </View>
  );
}
