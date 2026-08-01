import { type ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { colors, spacing } from '../theme/tokens';
import { Text } from './Text';

/** Scrollable page container with pull-to-refresh and consistent gutters. */
export function Screen({
  children,
  refreshing,
  onRefresh,
  footer,
}: {
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  footer?: ReactNode;
}) {
  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={Boolean(refreshing)}
              onRefresh={onRefresh}
              tintColor={colors.brand}
              colors={[colors.brand]}
            />
          ) : undefined
        }
      >
        {children}
      </ScrollView>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </View>
  );
}

export function ScreenHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerText}>
        <Text variant="title">{title}</Text>
        {subtitle ? (
          <Text variant="caption" color="secondary">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {actions}
    </View>
  );
}

export function Section({
  title,
  action,
  children,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      {title || action ? (
        <View style={styles.sectionHead}>
          {title ? <Text variant="heading">{title}</Text> : <View />}
          {action}
        </View>
      ) : null}
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

/** Two-column responsive grid used for metric tiles. */
export function Grid({ children }: { children: ReactNode }) {
  return <View style={styles.grid}>{children}</View>;
}

export function Row({
  label,
  value,
  latin = false,
}: {
  label: string;
  value: string;
  latin?: boolean;
}) {
  return (
    <View style={styles.kvRow}>
      <Text variant="caption" color="secondary" style={styles.kvLabel}>
        {label}
      </Text>
      <Text variant="caption" latin={latin} style={styles.kvValue}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  headerText: { flex: 1, gap: 2 },
  section: { gap: spacing.sm },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionBody: { gap: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  kvRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: 6,
  },
  kvLabel: { flexShrink: 0 },
  kvValue: { flex: 1, textAlign: 'right' },
  footer: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
});
