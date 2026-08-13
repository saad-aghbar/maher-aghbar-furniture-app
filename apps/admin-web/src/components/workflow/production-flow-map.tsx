'use client';

import { cn } from '@maher/ui';
import { useMemo } from 'react';
import { displayStageEdges, layoutStageGraph } from '@/lib/stage-graph-layout';

export type FlowMapStage = {
  id: string;
  code: string;
  name: string;
  status: string;
  progressPercent: number;
  dependsOnCodes: string[];
  sortOrder: number;
  estimatedMinutes?: number | null;
  optional?: boolean;
  hasError?: boolean;
};

type Props = {
  stages: FlowMapStage[];
  selectedId?: string | null;
  onStageClick?: (stage: FlowMapStage) => void;
  rtl?: boolean;
  showDurations?: boolean;
  /** Editor/preview uses numbered brand circles; runtime keeps progress colors. */
  variant?: 'runtime' | 'editor';
};

const NODE = 56;
const LEVEL_GAP = 108;
const LANE_GAP = 132;
const OVERFLOW_NODES = 12;

function normalizeStatus(status: string): string {
  const s = status.toUpperCase();
  if (s === 'DONE') return 'COMPLETED';
  return s;
}

function tone(status: string): 'done' | 'active' | 'blocked' | 'skipped' | 'pending' {
  const s = normalizeStatus(status);
  if (s === 'COMPLETED') return 'done';
  if (s === 'SKIPPED') return 'skipped';
  if (s === 'BLOCKED') return 'blocked';
  if (s === 'IN_PROGRESS' || s === 'READY') return 'active';
  return 'pending';
}

function fmtMinutes(value?: number | null): string | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null;
  const whole = Math.round(value);
  const h = Math.floor(whole / 60);
  const m = whole % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function barrelPath(x1: number, y1: number, x2: number, y2: number): string {
  const dy = Math.max(24, y2 - y1);
  const bend = Math.min(56, dy * 0.48);
  return `M ${x1} ${y1} C ${x1} ${y1 + bend}, ${x2} ${y2 - bend}, ${x2} ${y2}`;
}

export function ProductionFlowMap({
  stages,
  selectedId,
  onStageClick,
  rtl,
  showDurations,
  variant = 'runtime',
}: Props) {
  const layout = useMemo(() => layoutStageGraph(stages), [stages]);
  const edges = useMemo(() => displayStageEdges(layout), [layout]);
  const byCode = useMemo(() => new Map(layout.nodes.map((n) => [n.code, n])), [layout.nodes]);
  const editor = variant === 'editor';

  const width = Math.max(280, layout.maxLanes * LANE_GAP + 48);
  const height = Math.max(160, layout.levelCount * LEVEL_GAP + 48);
  const overflow = stages.length >= OVERFLOW_NODES;

  const cx = (lane: number) => {
    const raw = 40 + lane * LANE_GAP + NODE / 2;
    return rtl ? width - raw : raw;
  };
  const cy = (level: number) => 28 + level * LEVEL_GAP + NODE / 2;

  if (!stages.length) return null;

  return (
    <div className={cn(overflow && 'max-h-[70vh] overflow-auto')}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        role={onStageClick ? 'group' : 'img'}
        className="mx-auto max-w-full"
      >
        {edges.map((edge) => {
          const from = byCode.get(edge.from);
          const to = byCode.get(edge.to);
          if (!from || !to) return null;
          const done = !editor && tone(from.status) === 'done';
          return (
            <path
              key={`${edge.from}-${edge.to}`}
              d={barrelPath(cx(from.lane), cy(from.level) + NODE / 2, cx(to.lane), cy(to.level) - NODE / 2)}
              fill="none"
              stroke={
                editor
                  ? 'var(--maher-brand)'
                  : done
                    ? 'var(--maher-brand)'
                    : 'var(--maher-border-strong)'
              }
              strokeWidth={editor || done ? 2.5 : 1.5}
              strokeLinecap="round"
              opacity={editor ? 0.55 : 1}
            />
          );
        })}
        {layout.nodes.map((node, index) => {
          const t = tone(node.status);
          const selected = selectedId === node.id;
          const x = cx(node.lane);
          const y = cy(node.level);
          const duration = showDurations ? fmtMinutes(node.estimatedMinutes) : null;
          const number = index + 1;
          return (
            <g
              key={node.id}
              transform={`translate(${x}, ${y})`}
              className={cn(
                'workflow-flow-node',
                onStageClick && 'cursor-pointer',
              )}
              onClick={() => onStageClick?.(node)}
            >
              {selected ? (
                <circle
                  r={NODE / 2 + 8}
                  fill="var(--maher-brand-soft)"
                  opacity={0.55}
                />
              ) : null}
              {node.hasError ? (
                <circle
                  r={NODE / 2 + 5}
                  fill="none"
                  stroke="var(--maher-error)"
                  strokeWidth={2.5}
                />
              ) : null}
              <circle
                r={NODE / 2}
                className={cn(
                  editor && 'fill-[var(--maher-brand-soft)]',
                  !editor && t === 'done' && 'fill-[var(--maher-brand)]',
                  !editor && t === 'active' && 'fill-[var(--maher-brand-soft)]',
                  !editor && t === 'blocked' && 'fill-[var(--maher-error-soft)]',
                  !editor && t === 'skipped' && 'fill-[var(--maher-surface-muted)]',
                  !editor && t === 'pending' && 'fill-[var(--maher-surface)]',
                )}
                stroke={
                  node.hasError
                    ? 'var(--maher-error)'
                    : selected
                      ? 'var(--maher-brand)'
                      : editor
                        ? 'var(--maher-brand)'
                        : t === 'blocked'
                          ? 'var(--maher-error)'
                          : 'var(--maher-border-strong)'
                }
                strokeWidth={selected ? 3 : 2}
              />
              {node.optional ? (
                <circle
                  r={NODE / 2 + 4}
                  fill="none"
                  stroke="var(--maher-brand)"
                  strokeWidth={1.25}
                  strokeDasharray="4 3"
                  opacity={0.8}
                />
              ) : null}
              <text
                textAnchor="middle"
                dominantBaseline="middle"
                className={cn(
                  'pointer-events-none text-[11px] font-bold',
                  !editor && t === 'done' ? 'fill-white' : 'fill-[var(--maher-text-primary)]',
                )}
                style={{ fontSize: editor ? 16 : 11, fontWeight: 700 }}
              >
                {editor ? number : `${Math.round(node.progressPercent)}%`}
              </text>
              <text
                y={NODE / 2 + 16}
                textAnchor="middle"
                className="fill-[var(--maher-text-primary)]"
                style={{ fontSize: 11, fontWeight: 600 }}
              >
                {node.name.length > 18 ? `${node.name.slice(0, 16)}…` : node.name}
              </text>
              {duration ? (
                <text
                  y={NODE / 2 + 30}
                  textAnchor="middle"
                  className="fill-[var(--maher-text-tertiary)]"
                  style={{ fontSize: 10 }}
                >
                  {duration}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
