import { forwardRef } from 'react';
import { Keyboard, TextInput, type TextInputProps } from 'react-native';
import { getActiveLocale } from '@/i18n';
import { applyAppTypeface } from '@/theme/fonts';
import { scaleTextStyle } from '@/theme/fontScale';
import { useFontScale } from '@/theme/FontScaleProvider';

/**
 * App TextInput with the locale typeface (IBM Plex).
 */
export const AppTextInput = forwardRef<TextInput, TextInputProps>(
  function AppTextInput({ style, ...props }, ref) {
    const { fontScale } = useFontScale();
    return (
      <TextInput
        ref={ref}
        {...props}
        allowFontScaling={false}
        style={scaleTextStyle(applyAppTypeface(getActiveLocale(), style), fontScale)}
        onSubmitEditing={(e) => {
          props.onSubmitEditing?.(e);
          if (props.returnKeyType === 'search') Keyboard.dismiss();
        }}
      />
    );
  },
);
