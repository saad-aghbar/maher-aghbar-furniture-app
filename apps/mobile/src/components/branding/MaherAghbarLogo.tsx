import { memo } from 'react';
import Svg, { Path } from 'react-native-svg';
import { brandColors } from '@/theme/brand';

/**
 * Static SVG helpers kept for tests / fallbacks.
 * Runtime intro uses the authentic lockup PNG in `AnimatedBrandIntro`.
 */
export const LOGO_VIEWBOX = { w: 200, h: 140 } as const;
export const PATH_STEM = 'M 36 128 L 36 12';
export const PATH_CURVE =
  'M 52 58 L 52 88 C 52 112, 72 128, 100 128 C 128 128, 148 112, 148 88 L 148 72';
export const STEM_LENGTH = 116;
export const CURVE_LENGTH = 220;

type Props = {
  width?: number;
  height?: number;
  color?: string;
  testID?: string;
};

function MaherAghbarLogoComponent({
  width = 140,
  height,
  color = brandColors.primary,
  testID = 'brand-logo-fallback',
}: Props) {
  const h = height ?? (width * LOGO_VIEWBOX.h) / LOGO_VIEWBOX.w;
  return (
    <Svg
      width={width}
      height={h}
      viewBox={`0 0 ${LOGO_VIEWBOX.w} ${LOGO_VIEWBOX.h}`}
      accessible={false}
      testID={testID}
    >
      <Path
        d={PATH_STEM}
        stroke={color}
        strokeWidth={12}
        fill="none"
        strokeLinecap="butt"
      />
      <Path
        d={PATH_CURVE}
        stroke={color}
        strokeWidth={11}
        fill="none"
        strokeLinecap="butt"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export const MaherAghbarLogo = memo(MaherAghbarLogoComponent);
