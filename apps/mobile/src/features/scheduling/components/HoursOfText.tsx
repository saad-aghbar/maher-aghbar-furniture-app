import { View, type StyleProp, type TextStyle } from 'react-native';
import { AppText } from '@/components/AppText';
import { compactHoursOfParts, compactHoursOfSegments, useLocale } from '@/i18n';
import type { TypographyVariantName } from '@/theme';

type Props = {
  allocated: string | number;
  available: string | number;
  variant?: TypographyVariantName;
  weight?: 'regular' | 'medium' | 'semibold';
  color?: 'primary' | 'secondary' | 'muted';
  style?: StyleProp<TextStyle>;
};

/**
 * Allocated / available hours as five sibling nodes in a forced-LTR row.
 * Nested Text is one BiDi paragraph and reorders Arabic `14 س / 7.5 س`.
 */
export function HoursOfText({
  allocated,
  available,
  variant = 'caption',
  weight = 'semibold',
  color = 'primary',
  style,
}: Props) {
  const { locale, t } = useLocale();
  const parts = compactHoursOfParts(locale, allocated, available);
  const [first, unit, slash, second] = compactHoursOfSegments(locale, allocated, available);
  const spoken = t('mobile.adminScheduling.capacity.hoursOfA11y', {
    allocated: parts.allocated,
    available: parts.available,
  });
  const unitStyle = locale === 'ar' ? { marginLeft: 4 } : undefined;

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={spoken}
      style={{ flexDirection: 'row', alignItems: 'baseline', direction: 'ltr' }}
    >
      <AppText variant={variant} weight={weight} color={color} dir="ltr" face="latin" style={style}>
        {first}
      </AppText>
      <AppText variant={variant} weight={weight} color={color} style={[style, unitStyle]}>
        {unit}
      </AppText>
      <AppText
        variant={variant}
        weight={weight}
        color={color}
        dir="ltr"
        face="latin"
        style={[style, { paddingHorizontal: 4 }]}
      >
        {slash}
      </AppText>
      <AppText variant={variant} weight={weight} color={color} dir="ltr" face="latin" style={style}>
        {second}
      </AppText>
      <AppText variant={variant} weight={weight} color={color} style={[style, unitStyle]}>
        {unit}
      </AppText>
    </View>
  );
}
