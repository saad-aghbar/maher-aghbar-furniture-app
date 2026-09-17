import { useState, type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { AppText } from '@/components/AppText';
import { localeRow, pinStart, useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import { useMaherDensity } from './density';

export type DataRowCell = {
  key: string;
  content: ReactNode;
  /** Fixed width (dp) or flex share. Cells without either hug content. */
  width?: number;
  flex?: number;
  align?: 'start' | 'center' | 'end';
};

export type DataRowProps = {
  title: string;
  subtitle?: string | null;
  /** Leading slot — thumb, status dot, checkbox. */
  leading?: ReactNode;
  /** Structured cells after the title (dense desk columns). */
  cells?: DataRowCell[];
  /** Trailing slot — badge, chevron, actions. */
  trailing?: ReactNode;
  selected?: boolean;
  /** Start rail color; defaults to brand when selected, none otherwise. */
  accent?: string | null;
  onPress?: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  testID?: string;
  /** Hairline below the row. Default true. */
  divider?: boolean;
  /** Force LTR for identifier-like titles (SO / PO / SKU). */
  titleDir?: 'auto' | 'ltr';
  style?: StyleProp<ViewStyle>;
};

/**
 * Dense, pointer-friendly row for MEDIUM and larger desks. Not a DataGrid:
 * no column resize, no sorting — composition only. Selected rows get the
 * floor recipe (brand wash + 3px start rail); hover and focus are restrained.
 */
export function DataRow({
  title,
  subtitle,
  leading,
  cells,
  trailing,
  selected = false,
  accent,
  onPress,
  disabled = false,
  accessibilityLabel,
  testID,
  divider = true,
  titleDir = 'auto',
  style,
}: DataRowProps) {
  const { colors, theme } = useTheme();
  const { isRTL, locale } = useLocale();
  const density = useMaherDensity();
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const railColor = accent ?? (selected ? colors.brand : null);
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  const background = selected
    ? colors.brandSoft
    : hovered
      ? colors.surfaceSecondary
      : 'transparent';

  return (
    <AnimatedPressable
      variant="button"
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ selected, disabled }}
      disabled={disabled || !onPress}
      onPress={
        onPress
          ? () => {
              void haptics.selection();
              onPress();
            }
          : undefined
      }
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[
        {
          minHeight: density.rowMinHeight,
          flexDirection: localeRow(isRTL),
          alignItems: 'center',
          gap: theme.spacing.md,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
          backgroundColor: background,
          // Focus ring is a shape change (outline), never color alone.
          borderWidth: focused ? 1.5 : 0,
          borderColor: colors.brand,
          borderBottomWidth: focused ? 1.5 : divider ? 1 : 0,
          borderBottomColor: focused ? colors.brand : colors.borderMuted,
          borderRadius: focused ? theme.radius.sm : 0,
          opacity: disabled ? 0.55 : 1,
        },
        style,
      ]}
    >
      {railColor ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: theme.spacing.xs,
            bottom: theme.spacing.xs,
            width: 3,
            borderRadius: 2,
            backgroundColor: railColor,
            opacity: selected ? 1 : 0.55,
            ...pinStart(isRTL),
          }}
        />
      ) : null}
      {leading ? <View style={{ flexShrink: 0 }}>{leading}</View> : null}
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <AppText variant="body" weight={titleWeight} numberOfLines={1} dir={titleDir}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" color="secondary" numberOfLines={1}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {cells?.map((cell) => (
        <View
          key={cell.key}
          style={{
            width: cell.width,
            flex: cell.flex,
            minWidth: 0,
            alignItems:
              cell.align === 'center'
                ? 'center'
                : cell.align === 'end'
                  ? isRTL
                    ? 'flex-start'
                    : 'flex-end'
                  : isRTL
                    ? 'flex-end'
                    : 'flex-start',
          }}
        >
          {cell.content}
        </View>
      ))}
      {trailing ? <View style={{ flexShrink: 0 }}>{trailing}</View> : null}
    </AnimatedPressable>
  );
}
