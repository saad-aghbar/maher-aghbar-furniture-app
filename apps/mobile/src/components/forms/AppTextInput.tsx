import { forwardRef } from 'react';
import { Keyboard, TextInput, type TextInputProps } from 'react-native';
import { getActiveLocale } from '@/i18n';
import { applyAppTypeface } from '@/theme/fonts';

/**
 * App TextInput with the locale typeface (KO Sans / Rubik).
 */
export const AppTextInput = forwardRef<TextInput, TextInputProps>(
  function AppTextInput({ style, ...props }, ref) {
    return (
      <TextInput
        ref={ref}
        {...props}
        style={applyAppTypeface(getActiveLocale(), style)}
        onSubmitEditing={(e) => {
          props.onSubmitEditing?.(e);
          if (props.returnKeyType === 'search') Keyboard.dismiss();
        }}
      />
    );
  },
);
