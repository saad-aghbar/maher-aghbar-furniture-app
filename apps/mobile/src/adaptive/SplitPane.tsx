import type { ReactNode } from 'react';
import { ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { localeRow, useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import { useMaherDensity } from './density';
import { useSurfaceClearance } from './useSurfaceClearance';

export type SplitPaneProps = {
  /** Reading-start pane (list / calendar / hub). */
  primary: ReactNode;
  /** Reading-end pane. When null/undefined and `split` is true, `detailPlaceholder` renders. */
  detail?: ReactNode;
  /**
   * Side-by-side when true. When false only `primary` renders, in the same
   * tree position, so toggling on resize never remounts the primary pane.
   */
  split: boolean;
  /** Fixed primary width (dp). When omitted, `primaryRatio` drives flex. */
  primaryWidth?: number;
  /** Fraction of the row given to the primary pane when `primaryWidth` is omitted. Default 0.42. */
  primaryRatio?: number;
  /**
   * Optional third pane at the reading end (WIDE work detail). Rendered only
   * when provided. Bare boards belong in `SplitPaneAside` — unlike `primary`
   * and `detail` this pane carries no screen shell of its own.
   */
  secondary?: ReactNode;
  secondaryWidth?: number;
  detailPlaceholder?: ReactNode;
  /** Gap between panes; defaults to density `paneGap`. */
  gap?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * Two (optionally three) independently scrolling panes with a warm hairline
 * divider. Primary sits at the reading-start edge (LTR left, RTL right).
 * Not a docking system: no drag-resize, no persistence.
 */
export function SplitPane({
  primary,
  detail,
  split,
  primaryWidth,
  primaryRatio = 0.42,
  secondary,
  secondaryWidth,
  detailPlaceholder,
  gap,
  style,
  testID,
}: SplitPaneProps) {
  const { isRTL } = useLocale();
  const { colors } = useTheme();
  const density = useMaherDensity();
  const paneGap = gap ?? density.paneGap;
  const hasSecondary = split && secondary != null;

  const primaryStyle: ViewStyle = split
    ? primaryWidth != null
      ? { width: primaryWidth, minWidth: 0 }
      : { flex: primaryRatio, minWidth: 0 }
    : { flex: 1, minWidth: 0 };

  return (
    <View
      testID={testID}
      style={[{ flex: 1, flexDirection: localeRow(isRTL), minWidth: 0 }, style]}
    >
      <View testID={testID ? `${testID}-primary` : undefined} style={primaryStyle}>
        {primary}
      </View>
      {split ? (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ width: 1, backgroundColor: colors.border, marginHorizontal: paneGap / 2 }}
        />
      ) : null}
      {split ? (
        <View
          testID={testID ? `${testID}-detail` : undefined}
          style={{
            flex: primaryWidth != null ? 1 : 1 - primaryRatio,
            minWidth: 0,
          }}
        >
          {detail ?? detailPlaceholder ?? null}
        </View>
      ) : null}
      {hasSecondary ? (
        <View
          style={{ width: 1, backgroundColor: colors.border, marginHorizontal: paneGap / 2 }}
        />
      ) : null}
      {hasSecondary ? (
        <View
          testID={testID ? `${testID}-secondary` : undefined}
          style={{ width: secondaryWidth ?? 360, minWidth: 0 }}
        >
          {secondary}
        </View>
      ) : null}
    </View>
  );
}

type SplitPaneAsideProps = {
  children: ReactNode;
  testID?: string;
};

/**
 * Screen shell for the third pane. `primary` and `detail` normally hold whole
 * screens that clear the status bar and scroll themselves; an aside is usually
 * a bare board stack, so it needs the same treatment here or it sits jammed
 * under the status bar against the window edge.
 */
export function SplitPaneAside({ children, testID }: SplitPaneAsideProps) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const clearance = useSurfaceClearance();
  return (
    <ScrollView
      testID={testID}
      style={{ flex: 1 }}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        paddingTop: insets.top + theme.spacing.lg,
        paddingHorizontal: theme.spacing.lg,
        paddingBottom: clearance,
        gap: theme.spacing.md,
      }}
    >
      {children}
    </ScrollView>
  );
}

type SplitPanePlaceholderProps = {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  body?: string;
  testID?: string;
};

/**
 * Intentional empty detail pane — parchment inset panel, brand icon well.
 * Copy must be localized by the caller.
 */
export function SplitPanePlaceholder({
  icon = 'reader-outline',
  title,
  body,
  testID,
}: SplitPanePlaceholderProps) {
  const { colors, theme, colorScheme } = useTheme();
  const { locale } = useLocale();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  return (
    <View
      testID={testID}
      accessibilityRole="summary"
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: theme.spacing['3xl'],
      }}
    >
      <View
        style={{
          maxWidth: 360,
          alignItems: 'center',
          gap: theme.spacing.md,
          paddingVertical: theme.spacing['2xl'],
          paddingHorizontal: theme.spacing.xl,
          borderRadius: theme.radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surfaceSecondary,
        }}
      >
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colorScheme === 'dark' ? colors.brand : colors.brandSoft,
            borderWidth: 1,
            borderColor: colors.brand,
          }}
        >
          <Ionicons
            name={icon}
            size={22}
            color={colorScheme === 'dark' ? colors.onBrand : colors.brand}
          />
        </View>
        <AppText variant="heading" weight={titleWeight} align="center">
          {title}
        </AppText>
        {body ? (
          <AppText variant="bodySecondary" color="secondary" align="center">
            {body}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}
