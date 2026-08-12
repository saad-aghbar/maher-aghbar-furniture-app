import { forwardRef } from 'react';
import { Keyboard, TextInput, type TextInputProps } from 'react-native';
import { KEYBOARD_DISMISS_NATIVE_ID } from './KeyboardDismissAccessory';

/**
 * App TextInput that always attaches the shared keyboard Done accessory.
 */
export const AppTextInput = forwardRef<TextInput, TextInputProps>(
  function AppTextInput(props, ref) {
    return (
      <TextInput
        ref={ref}
        {...props}
        inputAccessoryViewID={KEYBOARD_DISMISS_NATIVE_ID}
        onSubmitEditing={(e) => {
          props.onSubmitEditing?.(e);
          if (props.returnKeyType === 'search') Keyboard.dismiss();
        }}
      />
    );
  },
);
