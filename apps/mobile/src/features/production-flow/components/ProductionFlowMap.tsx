import { useEffect, useMemo, useState } from 'react';
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
import { useLocale } from '@/i18n';
import { layoutStageGraph } from '@/features/sales-orders/stageGraphLayout';
import type { OrderStageView } from '@/features/sales-orders/selectOrderDetail';
import type { ProductionFlowStage } from '../selectProductionFlow';
import {
  insertParallelJoinHubs,
  isJoinHubCode,
  joinHubProgress,
  layoutMapEdges,
  type ParallelJoinMeta,
} from '../parallelJoinLayout';
import { FLOW_NODE, FlowStageNode } from './FlowStageNode';
import { FLOW_JOIN, FlowJoinHub } from './FlowJoinHub';
import { FlowMapAtmosphere } from './FlowMapAtmosphere';
import { ParallelJoinSheet } from './ParallelJoinSheet';

const AnimatedPath = Animated.createAnimatedComponent(Path);

type Props = {
  stages: ProductionFlowStage[];
  onStagePress?: (stage: ProductionFlowStage) => void;
  /** Template editor preview — quieter nodes, no progress clutter. */
  preview?: boolean;
  /** Extra space below the last node (e.g. tab-bar clearance). */
  bottomInset?: number;
  /** Product-times editor may show estimates; order flow leaves pending nodes empty. */
  showEstimatedDuration?: boolean;
};

function toOrderStages(stages: ProductionFlowStage[]): OrderStageView[] {
  const resolveKey = (s: ProductionFlowStage, index: number) =>
    s.graphKey || s.snapshotNodeId || `${s.code}#${index}`;

  // Map library codes and graph keys → layout identity so deps still resolve.
  const keyAlias = new Map<string, string>();
  stages.forEach((s, i) => {
    const gk = resolveKey(s, i);
    keyAlias.set(gk, gk);
    if (!keyAlias.has(s.code)) keyAlias.set(s.code, gk);
  });

  return stages.map((s, index) => {
    const graphKey = resolveKey(s, index);
    return {
      // Layout identity must be unique — library codes can repeat (e.g. two CARPENTRY).
      code: graphKey,
      name: s.name,
      status: s.status,
      progressPercent: s.progressPercent,
      dependsOnCodes: (s.dependsOnCodes ?? []).map((d) => keyAlias.get(d) ?? d),
      sortOrder: s.sortOrder,
    };
  });
}

function stageLookupKey(stage: ProductionFlowStage, index: number): string {
  return stage.graphKey || stage.snapshotNodeId || `${stage.code}#${index}`;
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
  showEstimatedDuration = false,
}: Props) {
  const { width: winW } = useWindowDimensions();
  const { colors } = useTheme();
  const { t } = useLocale();
  const reduceMotion = useReducedMotion();
  const [selectedJoin, setSelectedJoin] = useState<ParallelJoinMeta | null>(null);

  const baseLayout = useMemo(() => layoutStageGraph(toOrderStages(stages)), [stages]);
  const layout = useMemo(() => insertParallelJoinHubs(baseLayout), [baseLayout]);
  const edges = useMemo(() => layoutMapEdges(layout), [layout]);
  const stageByKey = useMemo(() => {
    const map = new Map<string, ProductionFlowStage>();
    stages.forEach((s, i) => {
      map.set(stageLookupKey(s, i), s);
      // Fallback for graphs that still edge by library code only.
      if (!map.has(s.code)) map.set(s.code, s);
    });
    return map;
  }, [stages]);
  const joinByCode = useMemo(
    () => new Map(layout.joins.map((j) => [j.joinCode, j])),
    [layout.joins],
  );

  const lanesByLevel = useMemo(() => {
    const map = new Map<number, number>();
    for (const node of layout.nodes) {
      map.set(node.level, (map.get(node.level) ?? 0) + 1);
    }
    return map;
  }, [layout.nodes]);

  const maxLanes = Math.max(1, layout.maxLanes);
  const colGap = maxLanes >= 4 ? 72 : maxLanes >= 3 ? 64 : 56;
  const rowGap = layout.levelCount >= 5 ? 64 : 56;
  const labelBand = 48;
  const padY = 32;
  const colW = FLOW_NODE + colGap;
  const rowH = FLOW_NODE + labelBand + rowGap;
  const contentW = Math.max(winW - 16, maxLanes * colW + padY * 2);
  const height = Math.max(
    160,
    padY +
      Math.max(0, layout.levelCount - 1) * rowH +
      FLOW_NODE +
      labelBand +
      24,
  );
  const centerX = contentW / 2;

  const laneX = (lane: number, level: number) => {
    const lanesInLevel = Math.max(1, lanesByLevel.get(level) ?? 1);
    const span = (lanesInLevel - 1) * colW;
    return centerX - span / 2 + lane * colW;
  };

  const nodeSize = (code: string) => (isJoinHubCode(code) ? FLOW_JOIN : FLOW_NODE);

  const nodeCenter = (code: string) => {
    const node = layout.nodes.find((n) => n.code === code);
    if (!node) return null;
    const size = nodeSize(code);
    return {
      x: isJoinHubCode(code) ? centerX : laneX(node.lane, node.level),
      top: padY + node.level * rowH + (FLOW_NODE - size) / 2,
      bottom: padY + node.level * rowH + (FLOW_NODE - size) / 2 + size,
      level: node.level,
      lane: node.lane,
      stage: stageByKey.get(code),
      join: joinByCode.get(code),
    };
  };

  const trackColor = colors.textMuted;
  const fillColor = colors.brand;

  const feederStagesForJoin = (join: ParallelJoinMeta | null) => {
    if (!join) return [];
    return join.feederCodes
      .map((c) => stageByKey.get(c))
      .filter((s): s is ProductionFlowStage => Boolean(s));
  };

  return (
    <>
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

        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: centerX - 1,
            top: padY,
            bottom: padY,
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
            const fromJoin = isJoinHubCode(e.from);
            const fillRatio = fromJoin
              ? preview
                ? 0
                : joinHubProgress(a.join?.feederCodes ?? [], stageByKey).percent / 100
              : stageFillRatio(a.stage, preview);
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
          if (isJoinHubCode(node.code)) {
            const join = joinByCode.get(node.code);
            if (!join) return null;
            const { percent, allDone } = joinHubProgress(join.feederCodes, stageByKey);
            const top = padY + node.level * rowH + (FLOW_NODE - FLOW_JOIN) / 2;
            const left = centerX - FLOW_JOIN / 2;
            return (
              <FlowJoinHub
                key={node.code}
                left={left}
                top={top}
                label={t('mobile.productionFlow.joinLabel')}
                progressPercent={preview ? 0 : percent}
                allDone={allDone}
                preview={preview}
                onPress={() => setSelectedJoin(join)}
              />
            );
          }

          const stage = stageByKey.get(node.code);
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

      <ParallelJoinSheet
        open={Boolean(selectedJoin)}
        onClose={() => setSelectedJoin(null)}
        feederStages={feederStagesForJoin(selectedJoin)}
        preview={preview}
        onFeederPress={onStagePress}
      />
    </>
  );
}
