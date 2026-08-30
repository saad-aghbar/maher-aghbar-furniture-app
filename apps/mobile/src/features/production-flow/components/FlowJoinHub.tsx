import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { AppText } from '@/components/AppText';
import { AnimatedPressable } from '@/motion';
import { useTheme } from '@/theme';

export const FLOW_JOIN = 44;

const LABEL_PAD = 56;

type Props = {
  left: number;
  top: number;
  label: string;
  /** 0–100; ignored when preview */
  progressPercent: number;
  allDone: boolean;
  preview?: boolean;
  onPress?: () => void;
};

/** Display-only AND-sync hub between parallel bands. */
export function FlowJoinHub({
  left,
  top,
  label,
  progressPercent,
  allDone,
  preview = false,
  onPress,
}: Props) {
  const { colors, theme } = useTheme();
  const size = FLOW_JOIN;
  const r = size / 2 - 3;
  const cx = size / 2;
  const cy = size / 2;
  const pct = Math.max(0, Math.min(100, Math.round(progressPercent)));
  const fill = preview ? 0 : Math.max(0, Math.min(1, pct / 100));
  const ring = allDone && !preview ? colors.success : colors.brand;

  const content = (
    <View style={{ alignItems: 'center', gap: 6 }}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.surface,
          borderWidth: 1.5,
          borderColor: ring,
          alignItems: 'center',
          justifyContent: 'center',
          ...theme.elevation.raised,
        }}
      >
        <Svg width={size} height={size} style={{ position: 'absolute' }}>
          <Circle
            cx={cx}
            cy={cy}
            r={r}
            stroke={colors.border}
            strokeWidth={2.5}
            fill="none"
            opacity={0.5}
          />
          {fill > 0.01 ? (
            <Path
              d={describeArc(cx, cy, r, -90, -90 + fill * 360)}
              stroke={ring}
              strokeWidth={2.5}
              fill="none"
              strokeLinecap="round"
            />
          ) : null}
        </Svg>
        {preview ? (
          <View
            style={{
              width: 10,
              height: 10,
              borderRadius: 5,
              backgroundColor: ring,
              opacity: 0.85,
            }}
          />
        ) : (
          <AppText
            variant="caption"
            weight="semibold"
            dir="ltr"
            style={{
              fontSize: pct >= 100 ? 11 : 12,
              color: allDone ? colors.success : colors.brand,
              textAlign: 'center',
            }}
          >
            {`${pct}%`}
          </AppText>
        )}
      </View>
      <AppText
        variant="caption"
        weight="medium"
        numberOfLines={1}
        style={{
          fontSize: 11,
          color: colors.textSecondary,
          textAlign: 'center',
          width: size + LABEL_PAD,
        }}
      >
        {label}
      </AppText>
    </View>
  );

  // Same centering trick as FlowStageNode: wider wrap + negative margin so the
  // circle stays on `left` while the label is truly centered under it.
  const wrapStyle = {
    position: 'absolute' as const,
    left,
    top,
    width: size + LABEL_PAD,
    marginLeft: -(LABEL_PAD / 2),
    alignItems: 'center' as const,
  };

  if (!onPress) {
    return <View style={wrapStyle}>{content}</View>;
  }
  return (
    <AnimatedPressable
      variant="button"
      accessibilityRole="button"
      accessibilityLabel={
        preview ? label : `${label}, ${pct}%`
      }
      onPress={onPress}
      style={wrapStyle}
    >
      {content}
    </AnimatedPressable>
  );
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const large = endAngle - startAngle <= 180 ? 0 : 1;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${large} 0 ${end.x} ${end.y}`;
}
