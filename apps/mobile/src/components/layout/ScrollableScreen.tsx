import { type ReactNode } from 'react';
import {
  ScrollView,
  type ScrollViewProps,
  type StyleProp, type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMaherDensity } from '@/adaptive/density';
import { useTheme } from '@/theme';
import { useSurfaceClearance } from '@/adaptive/useSurfaceClearance';

type ScrollableScreenProps = {
  children: ReactNode;
  header?: ReactNode;
  padding?: keyof ReturnType<typeof useTheme>['theme']['spacing'];
  contentContainerStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
  scrollProps?: Omit<ScrollViewProps, 'contentContainerStyle' | 'style' | 'children'>;
};

export function ScrollableScreen({
  children,
  header,
  padding = 'lg',
  contentContainerStyle,
  style,
  scrollProps,
}: ScrollableScreenProps) {
  const insets = useSafeAreaInsets();
  const { colors, theme } = useTheme();
  const density = useMaherDensity();
  const surfaceClearance = useSurfaceClearance();
  const pad = theme.spacing[padding];

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      style={[
        {
          flex: 1,
          backgroundColor: colors.background,
          width: '100%',
          alignSelf: 'center',
          maxWidth: density.contentMaxWidth,
        },
        style,
      ]}
      contentContainerStyle={[
        {
          paddingTop: insets.top + pad,
          paddingBottom: surfaceClearance + pad,
          paddingHorizontal: pad,
          gap: theme.spacing.lg,
          flexGrow: 1,
        },
        contentContainerStyle,
      ]}
      {...scrollProps}
    >
      {header}
      {children}
    </ScrollView>
  );
}
