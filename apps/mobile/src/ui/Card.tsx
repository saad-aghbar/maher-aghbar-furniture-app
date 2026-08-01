import { type ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { colors, radius, shadow, spacing } from '../theme/tokens';
import { Text } from './Text';

export function Card({
  title,
  subtitle,
  actions,
  children,
  padded = true,
  style,
}: {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children?: ReactNode;
  padded?: boolean;
  style?: ViewStyle;
}) {
  const hasHeader = Boolean(title || subtitle || actions);
  return (
    <View style={[styles.card, style]}>
      {hasHeader ? (
        <View style={[styles.header, !padded && styles.headerPadded]}>
          <View style={styles.headerText}>
            {title ? <Text variant="heading">{title}</Text> : null}
            {subtitle ? (
              <Text variant="caption" color="secondary" style={styles.subtitle}>
                {subtitle}
              </Text>
            ) : null}
          </View>
          {actions}
        </View>
      ) : null}
      <View style={padded ? styles.body : undefined}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...(shadow.card as object),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  headerPadded: { paddingBottom: spacing.sm },
  headerText: { flex: 1, gap: 2 },
  subtitle: { marginTop: 2 },
  body: { padding: spacing.md },
});
