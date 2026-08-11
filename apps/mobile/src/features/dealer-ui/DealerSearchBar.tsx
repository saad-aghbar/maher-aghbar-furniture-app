import { Pressable, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  onClear?: () => void;
  accessibilityLabel?: string;
};

export function DealerSearchBar({
  value,
  onChangeText,
  placeholder,
  onClear,
  accessibilityLabel,
}: Props) {
  const { isRTL, t } = useLocale();
  const { colors, theme } = useTheme();

  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        minHeight: 44,
        paddingHorizontal: theme.spacing.md,
        borderRadius: theme.radius.xl,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Ionicons name="search" size={20} color={colors.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        accessibilityLabel={accessibilityLabel ?? placeholder}
        style={{
          flex: 1,
          minHeight: 44,
          color: colors.textPrimary,
          textAlign: isRTL ? 'right' : 'left',
          fontSize: 16,
        }}
      />
      {value.length > 0 ? (
        <Pressable
          onPress={() => {
            onChangeText('');
            onClear?.();
          }}
          accessibilityRole="button"
          accessibilityLabel={t('mobile.dealerUi.clearSearch')}
          hitSlop={8}
          style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="close-circle" size={20} color={colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}
