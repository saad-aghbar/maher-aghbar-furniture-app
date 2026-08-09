import { Image, View, type ImageStyle, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme';

const lockupLight = require('../../assets/brand/lockup-on-light.png');
const lockupDark = require('../../assets/brand/lockup-on-dark.png');
const markLight = require('../../assets/brand/logomark-on-light.png');
const markDark = require('../../assets/brand/logomark-on-dark.png');
/** Sofa “M” only — no EST / year (floating watermarks). */
const monogramLight = require('../../assets/brand/watermark-mark.png');
const monogramDark = require('../../assets/brand/watermark-mark-dark.png');

type BrandMarkProps = {
  size?: 'md' | 'lg' | 'xl' | 'hero';
  /**
   * - `lockup` — full primary logo
   * - `mark` — compact M + EST. 1995
   * - `monogram` — M only (no EST / date) for floating watermarks
   */
  variant?: 'mark' | 'lockup' | 'monogram';
  /**
   * `auto` follows theme; `on-dark` / `on-light` force artwork for forced auth mood.
   */
  tone?: 'auto' | 'on-dark' | 'on-light';
  style?: StyleProp<ImageStyle>;
  containerStyle?: StyleProp<ViewStyle>;
};

const HEIGHTS = { md: 36, lg: 48, xl: 64, hero: 88 } as const;
const ASPECT = { mark: 1.6, lockup: 1.7, monogram: 1.15 } as const;

/**
 * Brand artwork — never mirror in RTL (wrap stays LTR).
 */
export function BrandMark({
  size = 'xl',
  variant = 'lockup',
  tone = 'auto',
  style,
  containerStyle,
}: BrandMarkProps) {
  const { colorScheme } = useTheme();
  const onDark =
    tone === 'on-dark' ? true : tone === 'on-light' ? false : colorScheme === 'dark';
  const source =
    variant === 'monogram'
      ? onDark
        ? monogramDark
        : monogramLight
      : variant === 'mark'
        ? onDark
          ? markDark
          : markLight
        : onDark
          ? lockupDark
          : lockupLight;
  const height = HEIGHTS[size];
  const width = height * ASPECT[variant];

  return (
    <View
      style={[{ direction: 'ltr', alignItems: 'center' }, containerStyle]}
      // Prevent RTL layout from flipping the lockup
      collapsable={false}
    >
      <Image
        source={source}
        accessibilityRole="image"
        accessibilityLabel="Maher Al-Aghbar Furniture"
        resizeMode="contain"
        style={[{ height, width }, style]}
      />
    </View>
  );
}
