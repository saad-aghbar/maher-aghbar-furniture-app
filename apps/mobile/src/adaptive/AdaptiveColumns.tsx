import { Children, type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { localeRow, useLocale } from '@/i18n';
import { useMaherDensity } from './density';
import { useMaherLayout } from './useMaherLayout';

type AdaptiveColumnsProps = {
  children: ReactNode;
  /** Force a column count; defaults to `columnCapacity` for the window class. */
  columns?: number;
  /** Never exceed this many columns even when capacity allows. */
  maxColumns?: number;
  /** Gap between cells (both axes). Defaults to density `boardGap`. */
  gap?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * Lays children into equal columns without measuring (percentage widths), so
 * there is no first-paint jump. One column on COMPACT — identical to a plain
 * stack — so phone composition is untouched.
 */
export function AdaptiveColumns({
  children,
  columns,
  maxColumns,
  gap,
  style,
  testID,
}: AdaptiveColumnsProps) {
  const { columnCapacity } = useMaherLayout();
  const density = useMaherDensity();
  const { isRTL } = useLocale();
  const items = Children.toArray(children).filter(Boolean);
  const wanted = columns ?? columnCapacity;
  const capped = maxColumns ? Math.min(wanted, maxColumns) : wanted;
  const count = Math.max(1, Math.min(capped, items.length || 1));
  const cellGap = gap ?? density.boardGap;

  if (count === 1) {
    return (
      <View testID={testID} style={[{ gap: cellGap }, style]}>
        {items}
      </View>
    );
  }

  const half = cellGap / 2;
  return (
    <View
      testID={testID}
      style={[
        {
          flexDirection: localeRow(isRTL),
          flexWrap: 'wrap',
          marginHorizontal: -half,
          rowGap: cellGap,
        },
        style,
      ]}
    >
      {items.map((child, index) => (
        <View
          key={(child as { key?: string | number | null }).key ?? index}
          style={{ width: `${100 / count}%`, paddingHorizontal: half, minWidth: 0 }}
        >
          {child}
        </View>
      ))}
    </View>
  );
}
