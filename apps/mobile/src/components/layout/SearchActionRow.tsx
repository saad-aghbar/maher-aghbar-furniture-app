import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useLocale } from '@/i18n';
import { rowDirection } from '@/i18n/rtl';
import { useTheme } from '@/theme';

type Props = {
  /** Search field / SearchBarShell — sits on the reading-start edge. */
  children: ReactNode;
  /** Filter / QR / refresh — sits on the opposite edge and swaps in AR. */
  trailing?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/**
 * Shared search + trailing-action row for Home / Orders / Inventory / Products.
 * Mag + placeholder follow the start edge; actions sit on the other side.
 */
export function SearchActionRow({ children, trailing, style }: Props) {
  const { isRTL } = useLocale();
  const { theme } = useTheme();

  return (
    <View
      style={[
        {
          flexDirection: rowDirection(isRTL),
          alignItems: 'center',
          gap: theme.spacing.sm,
        },
        style,
      ]}
    >
      <View style={{ flex: 1, minWidth: 0 }}>{children}</View>
      {trailing}
    </View>
  );
}
