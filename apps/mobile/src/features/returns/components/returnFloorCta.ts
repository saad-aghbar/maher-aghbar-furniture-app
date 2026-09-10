import type { ViewStyle } from 'react-native';
import type { Theme } from '@/theme';

/** Every returns CTA — same pill as dealer sheet footers. */
export function returnCtaStyle(theme: Theme): ViewStyle {
  return {
    borderRadius: theme.radius.full,
    minHeight: theme.sizes.touch.min,
    paddingVertical: 0,
  };
}
