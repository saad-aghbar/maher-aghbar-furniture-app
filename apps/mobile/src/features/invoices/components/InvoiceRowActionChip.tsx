import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';

type Tone = 'brand' | 'danger';

type Props = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  tone?: Tone;
};

/** Floor payment / document chip — 44px, icon well, full radius. */
export function InvoiceRowActionChip({ label, icon, onPress, tone = 'brand' }: Props) {
  const { isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const ink = tone === 'danger' ? colors.error : colors.brand;
  const wash = tone === 'danger' ? colors.errorSoft ?? colors.surface : colors.brandSoft;

  return (
    <AnimatedPressable
      variant="button"
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        void haptics.selection();
        onPress();
      }}
      style={{
        minHeight: 44,
        paddingHorizontal: 12,
        borderRadius: theme.radius.full,
        borderWidth: 1.5,
        borderColor: ink,
        backgroundColor: wash,
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: ink,
        }}
      >
        <Ionicons name={icon} size={15} color={ink} />
      </View>
      <AppText variant="caption" weight={titleWeight} style={{ color: ink }}>
        {label}
      </AppText>
    </AnimatedPressable>
  );
}
