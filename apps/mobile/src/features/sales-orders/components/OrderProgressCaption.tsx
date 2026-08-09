import { View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { formatOrderProgressPercent } from '../formatOrderProgressCaption';

type Props = {
  progressPercent: number;
  progressLabel?: string | null;
  variant?: 'caption' | 'label';
  weight?: 'regular' | 'medium' | 'semibold';
  color?: 'primary' | 'secondary' | 'muted' | 'brand';
  numberOfLines?: number;
  style?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
};

/**
 * Stage label + percent as separate runs so Arabic never splits "41" from "%".
 */
export function OrderProgressCaption({
  progressPercent,
  progressLabel,
  variant = 'caption',
  weight = 'semibold',
  color = 'brand',
  numberOfLines = 1,
  style,
  containerStyle,
}: Props) {
  const { isRTL } = useLocale();
  const label = progressLabel?.trim();
  const pct = formatOrderProgressPercent(progressPercent);

  if (!label) {
    return (
      <AppText
        variant={variant}
        weight={weight}
        color={color}
        dir="ltr"
        numberOfLines={numberOfLines}
        style={style}
      >
        {pct}
      </AppText>
    );
  }

  return (
    <View
      style={[
        {
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: 6,
          flexShrink: 1,
          maxWidth: '100%',
        },
        containerStyle,
      ]}
    >
      <AppText
        variant={variant}
        weight={weight}
        color={color}
        numberOfLines={numberOfLines}
        style={[{ flexShrink: 1 }, style]}
      >
        {label}
      </AppText>
      <AppText
        variant={variant}
        weight={weight}
        color={color}
        dir="ltr"
        numberOfLines={1}
        style={[{ flexShrink: 0, fontVariant: ['tabular-nums'] }, style]}
      >
        {pct}
      </AppText>
    </View>
  );
}
