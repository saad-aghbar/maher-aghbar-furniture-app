import {
  View,
  type TextInputProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { AppText } from '@/components/AppText';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n/useLocale';
import { resolveAppFontStyle, useTheme } from '@/theme';
import { AppTextInput } from './AppTextInput';
import { CopyNotesButton } from './CopyNotesButton';
import { SearchBarShell } from './SearchBarShell';
import { useGrowingMultilineInput } from './useGrowingMultilineInput';

export type TextFieldProps = TextInputProps & {
  label?: string;
  error?: string;
  containerStyle?: StyleProp<ViewStyle>;
  /**
   * Fully rounded (pill) field. Search bars use this by default when
   * `returnKeyType="search"` — pass explicitly for other search fields.
   */
  pill?: boolean;
  /**
   * Multiline auto-grow cap (px). Default ~5–6 lines. Pass `false` to disable
   * grow-and-scroll (plain multiline).
   */
  growMaxHeight?: number | false;
  /** Floor height while empty / short. Defaults to style minHeight or 88. */
  growMinHeight?: number;
  /** Small clipboard control beside the label (notes fields). */
  copyable?: boolean;
};

export function TextField({
  label,
  error,
  containerStyle,
  style,
  pill,
  growMaxHeight,
  growMinHeight,
  copyable = false,
  multiline,
  value,
  onContentSizeChange,
  ...rest
}: TextFieldProps) {
  const { colors, theme, colorScheme } = useTheme();
  const { isRTL, locale } = useLocale();
  const rounded = pill ?? rest.returnKeyType === 'search';
  const radius = rounded ? theme.radius.full : theme.radius.xl;
  const padY = theme.spacing.md;

  const growing = useGrowingMultilineInput({
    multiline,
    growMaxHeight,
    growMinHeight,
    style,
    value: value != null ? String(value) : undefined,
    contentPadding: padY * 2,
    onContentSizeChange,
  });

  const input = (
    <AppTextInput
      accessibilityLabel={label ?? rest.placeholder}
      placeholderTextColor={colors.textMuted}
      multiline={multiline}
      value={value}
      style={[
        {
          flex: rounded ? 1 : undefined,
          minWidth: rounded ? 0 : undefined,
          minHeight: theme.sizes.touch.min - (rounded ? 8 : 0),
          paddingHorizontal: rounded ? 0 : theme.spacing.lg,
          paddingVertical: rounded ? 0 : padY,
          backgroundColor: 'transparent',
          color: colors.textPrimary,
          fontSize: theme.typography.variants.body.fontSize,
          lineHeight: theme.typography.variants.body.lineHeight,
          textAlign: isRTL ? 'right' : 'left',
          writingDirection: isRTL ? 'rtl' : 'ltr',
          ...resolveAppFontStyle(locale, { variant: 'body' }),
        },
        style,
        growing.inputStyle,
      ]}
      {...rest}
      {...growing.inputProps}
    />
  );

  return (
    <View style={[{ gap: theme.spacing.xs, width: '100%' }, containerStyle]}>
      {label || copyable ? (
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: theme.spacing.sm,
            minHeight: copyable ? theme.sizes.touch.min - 8 : undefined,
          }}
        >
          {label ? (
            <AppText variant="label" color="secondary" style={{ flex: 1 }}>
              {label}
            </AppText>
          ) : (
            <View style={{ flex: 1 }} />
          )}
          {copyable ? (
            <CopyNotesButton
              value={typeof value === 'string' ? value : value != null ? String(value) : ''}
              label={label}
            />
          ) : null}
        </View>
      ) : null}
      {rounded ? (
        <SearchBarShell error={Boolean(error)}>{input}</SearchBarShell>
      ) : (
        <View
          style={{
            borderRadius: radius,
            borderWidth: 1,
            borderColor: error ? colors.error : colors.borderStrong,
            backgroundColor: colors.surface,
            overflow: 'hidden',
            ...orderBoardShadow(colorScheme),
          }}
        >
          {input}
        </View>
      )}
      {error ? (
        <AppText
          variant="caption"
          color="error"
          accessibilityRole="alert"
          accessibilityLiveRegion="assertive"
        >
          {error}
        </AppText>
      ) : null}
    </View>
  );
}
