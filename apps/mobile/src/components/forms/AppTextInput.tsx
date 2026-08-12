import { forwardRef } from 'react';
import { Keyboard, TextInput, type TextInputProps } from 'react-native';
import { getActiveLocale } from '@/i18n';
import { applyAppTypeface } from '@/theme/fonts';
import { KEYBOARD_DISMISS_NATIVE_ID } from './KeyboardDismissAccessory';

/**
 * App TextInput that always attaches the shared keyboard Done accessory
 * and the locale typeface (KO Sans / Rubik).
 */
export const AppTextInput = forwardRef<TextInput, TextInputProps>(
  function AppTextInput({ style, ...props }, ref) {
    return (
      <TextInput
        ref={ref}
        {...props}
        style={applyAppTypeface(getActiveLocale(), style)}
        inputAccessoryViewID={KEYBOARD_DISMISS_NATIVE_ID}
        onSubmitEditing={(e) => {
          props.onSubmitEditing?.(e);
          if (props.returnKeyType === 'search') Keyboard.dismiss();
        }}
      />
    );
  },
);
