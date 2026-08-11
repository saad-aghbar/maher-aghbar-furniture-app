import { type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme';

type KeyboardAwareScreenProps = {
  children: ReactNode;
  header?: ReactNode;
  /** Sticky footer (e.g. Continue) outside the scroll area. */
  footer?: ReactNode;
  padding?: keyof ReturnType<typeof useTheme>['theme']['spacing'];
  contentContainerStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
};

export function KeyboardAwareScreen({
  children,
  header,
  footer,
  padding = 'lg',
  contentContainerStyle,
  style,
}: KeyboardAwareScreenProps) {
  const insets = useSafeAreaInsets();
  const { colors, theme } = useTheme();
  const pad = theme.spacing[padding];

  return (
    <KeyboardAvoidingView
      style={[{ flex: 1, backgroundColor: colors.background }, style]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
    >
      <View style={{ flex: 1 }}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={[
            {
              paddingTop: insets.top + pad,
              paddingBottom: footer ? pad : insets.bottom + pad,
              paddingHorizontal: pad,
              gap: theme.spacing.lg,
              flexGrow: 1,
            },
            contentContainerStyle,
          ]}
        >
          {header}
          {children}
        </ScrollView>
        {footer ? (
          <View
            style={{
              paddingHorizontal: pad,
              paddingTop: theme.spacing.md,
              paddingBottom: insets.bottom + theme.spacing.md,
              borderTopWidth: 1,
              borderTopColor: colors.border,
              backgroundColor: colors.background,
            }}
          >
            {footer}
          </View>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}
