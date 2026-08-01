import { StyleSheet, View } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useI18n } from '../providers/i18n-provider';
import { colors, radius, shadow, spacing } from '../theme/tokens';
import { PressableScale } from './motion';
import { Text } from './Text';

/**
 * Tappable summary row used by every list screen.
 * `meta` is rendered LTR because it holds numbers, codes, and dates.
 *
 * Rows render immediately with no entrance animation: they mount and unmount
 * constantly while scrolling, so animating them reads as flicker.
 */
export function ListRow({
  title,
  meta,
  description,
  right,
  footer,
  onPress,
  accent,
}: {
  title: string;
  meta?: string;
  description?: string;
  right?: React.ReactNode;
  footer?: React.ReactNode;
  onPress?: () => void;
  accent?: string;
}) {
  const { direction } = useI18n();
  const Chevron = direction === 'rtl' ? ChevronLeft : ChevronRight;

  const content = (
    <>
      <View style={styles.main}>
        <View style={styles.textCol}>
          <Text variant="subheading" numberOfLines={1}>
            {title}
          </Text>
          {meta ? (
            <Text variant="micro" color="tertiary" latin numberOfLines={1} style={styles.meta}>
              {meta}
            </Text>
          ) : null}
          {description ? (
            <Text variant="caption" color="secondary" numberOfLines={2} style={styles.meta}>
              {description}
            </Text>
          ) : null}
        </View>
        <View style={styles.rightCol}>
          {right}
          {onPress ? <Chevron size={18} color={colors.textTertiary} /> : null}
        </View>
      </View>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </>
  );

  if (!onPress) {
    return <View style={[styles.row, accent ? { borderColor: accent } : null]}>{content}</View>;
  }

  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      scaleTo={0.99}
      style={[styles.row, accent ? { borderColor: accent } : null]}
    >
      {content}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...(shadow.card as object),
  },
  main: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  textCol: { flex: 1, minWidth: 0 },
  rightCol: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  meta: { marginTop: 2 },
  footer: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
