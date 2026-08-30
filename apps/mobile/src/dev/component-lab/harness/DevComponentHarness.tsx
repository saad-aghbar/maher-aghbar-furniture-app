import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useTheme } from '@/theme';

/** Lightweight wrapper — app already provides Theme/Locale/SafeArea/Query. */
export function DevComponentHarness({ children }: { children: ReactNode }) {
  const { colors, theme } = useTheme();
  return (
    <View
      style={{
        backgroundColor: colors.background,
        borderRadius: theme.radius.lg,
        padding: theme.spacing.md,
        overflow: 'hidden',
      }}
    >
      {children}
    </View>
  );
}
