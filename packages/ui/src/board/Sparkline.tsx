import { useId } from 'react';
import type { CSSProperties, SVGAttributes } from 'react';
import { cn } from '../cn';
import { toneInk, type BoardTone } from './tone';

export interface SparklineProps extends Omit<SVGAttributes<SVGSVGElement>, 'points'> {
  points: number[];
  tone?: BoardTone;
  /** Pixel height; width is fluid. */
  height?: number;
  area?: boolean;
  /** Mark the last point with a dot. */
  endDot?: boolean;
  /** `zero` anchors the floor at 0 (counts, money); `auto` fits the visible range (rates). */
  baseline?: 'zero' | 'auto';
}

/** Sparkline — a 7–30 point trend line with a soft area. Time flows in reading direction. */
export function Sparkline({
  points,
  tone = 'brand',
  height = 40,
  area = true,
  endDot = true,
  baseline = 'zero',
  className,
  ...props
}: SparklineProps) {
  const id = useId();
  const w = 100;
  const h = height;
  const n = points.length;
  if (n === 0) return null;
  const rawMax = Math.max(...points);
  const rawMin = Math.min(...points);
  const max = baseline === 'zero' ? Math.max(rawMax, 1) : rawMax;
  const min = baseline === 'zero' ? Math.min(rawMin, 0) : rawMin;
  const span = max - min || 1;
  const pad = 3;
  const coords = points.map((p, i) => {
    const x = n === 1 ? w / 2 : (i / (n - 1)) * w;
    const y = pad + (1 - (p - min) / span) * (h - pad * 2);
    return [x, y] as const;
  });
  const line = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
  const areaPath = `${line} L${w},${h} L0,${h} Z`;
  const ink = toneInk(tone);
  const last = coords[coords.length - 1] ?? ([0, h] as const);
  const [lx, ly] = last;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className={cn('block w-full overflow-visible rtl:-scale-x-100', className)}
      style={{ height: h } as CSSProperties}
      aria-hidden
      {...props}
    >
      <defs>
        <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={ink} stopOpacity="0.18" />
          <stop offset="100%" stopColor={ink} stopOpacity="0" />
        </linearGradient>
      </defs>
      {area ? <path d={areaPath} fill={`url(#${id}-fill)`} className="maher-spark-area" /> : null}
      <path
        d={line}
        fill="none"
        stroke={ink}
        strokeWidth={1.75}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        className="maher-spark-line"
        pathLength={100}
      />
      {endDot ? (
        <circle cx={lx} cy={ly} r={2.4} fill={ink} className="maher-spark-dot" vectorEffect="non-scaling-stroke" />
      ) : null}
    </svg>
  );
}
