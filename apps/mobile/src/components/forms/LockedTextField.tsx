import { useRef } from 'react';
import {
  TextInput,
  View,
  type TextInputProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { AppText } from '@/components/AppText';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { resolveAppFontStyle, useTheme } from '@/theme';
import { CopyNotesButton } from './CopyNotesButton';
import { useGrowingMultilineInput } from './useGrowingMultilineInput';

export type LockedTextFieldProps = TextInputProps & {
  label: string;
  error?: string;
  locked?: boolean;
  lockReason?: string;
  containerStyle?: StyleProp<ViewStyle>;
  growMaxHeight?: number | false;
  growMinHeight?: number;
  /** Small clipboard control beside the label (notes fields). */
  copyable?: boolean;
};

export function LockedTextField({
  label,
  error,
  locked = false,
  lockReason,
  containerStyle,
  style,
  editable,
  growMaxHeight,
  growMinHeight,
  copyable = false,
  multiline,
  value,
  onContentSizeChange,
  ...rest
}: LockedTextFieldProps) {
  const { colors, theme, colorScheme } = useTheme();
  const { isRTL, locale, t } = useLocale();
  const isLocked = locked || editable === false;
  const padY = theme.spacing.md;
  const inputRef = useRef<TextInput>(null);

  const growing = useGrowingMultilineInput({
    multiline,
    growMaxHeight,
    growMinHeight,
    style,
    value: value != null ? String(value) : undefined,
    contentPadding: padY * 2,
    onContentSizeChange,
  });

  return (
    <View style={[{ gap: theme.spacing.xs, width: '100%' }, containerStyle]}>
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.sm,
        }}
      >
        <AppText variant="label" color="secondary" style={{ flex: 1 }}>
          {label}
        </AppText>
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: theme.spacing.xs,
          }}
        >
          {copyable ? (
            <CopyNotesButton
              value={typeof value === 'string' ? value : value != null ? String(value) : ''}
              label={label}
            />
          ) : null}
          {isLocked ? (
            <AppText variant="caption" color="warning">
              {t('mobile.requestEdit.locked')}
            </AppText>
          ) : null}
        </View>
      </View>
      <View
        style={{
          borderRadius: theme.radius.xl,
          borderWidth: 1,
          borderColor: error ? colors.error : colors.borderStrong,
          backgroundColor: isLocked ? colors.disabledFill : colors.surface,
          overflow: 'hidden',
          opacity: isLocked ? 0.85 : 1,
          ...orderBoardShadow(colorScheme),
        }}
      >
        <TextInput
          ref={inputRef}
          accessibilityLabel={label}
          placeholderTextColor={colors.textMuted}
          editable={!isLocked}
          multiline={multiline}
          value={value}
          style={[
            {
              minHeight: theme.sizes.touch.min,
              paddingHorizontal: theme.spacing.lg,
              paddingVertical: padY,
              backgroundColor: 'transparent',
              color: isLocked ? colors.textMuted : colors.textPrimary,
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
      </View>
      {isLocked && lockReason ? (
        <AppText variant="caption" color="warning">
          {lockReason}
        </AppText>
      ) : null}
      {error ? (
        <AppText variant="caption" color="error">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}
