import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme';

type Props = {
  checked: boolean;
};

/** Rounded-square chocolate checkbox (image 3). */
export function BrandCheckbox({ checked }: Props) {
  const { colors, theme } = useTheme();

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={{
        width: 22,
        height: 22,
        borderRadius: 8,
        borderWidth: checked ? 0 : 1.5,
        borderColor: colors.borderStrong,
        backgroundColor: checked ? colors.brandHover : colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {checked ? <Ionicons name="checkmark" size={14} color={colors.onBrand} /> : null}
    </View>
  );
}
