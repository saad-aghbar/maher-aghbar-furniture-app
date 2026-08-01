import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, type ViewStyle } from 'react-native';
import { useI18n } from '../providers/i18n-provider';
import { colors, radius, spacing } from '../theme/tokens';
import { Button } from './Button';
import { FadeInView } from './motion';
import { Text } from './Text';

export function Skeleton({ height = 16, width, style }: { height?: number; width?: number | `${number}%`; style?: ViewStyle }) {
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      accessibilityElementsHidden
      style={[styles.skeleton, { height, width: width ?? '100%', opacity: pulse }, style]}
    />
  );
}

/** Standard loading placeholder for a list-style screen. */
export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <View style={styles.stack}>
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={styles.skeletonCard}>
          <Skeleton height={14} width="55%" />
          <Skeleton height={11} width="35%" />
          <Skeleton height={11} width="70%" />
        </View>
      ))}
    </View>
  );
}

export function EmptyState({
  title,
  description,
  icon,
  action,
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <FadeInView style={styles.center}>
      {icon ? <View style={styles.emptyIcon}>{icon}</View> : null}
      <Text variant="heading" style={styles.centerText}>
        {title}
      </Text>
      {description ? (
        <Text variant="caption" color="secondary" style={styles.centerText}>
          {description}
        </Text>
      ) : null}
      {action ? <View style={styles.actionWrap}>{action}</View> : null}
    </FadeInView>
  );
}

export function ErrorState({
  title,
  description,
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  const { t } = useI18n();
  return (
    <FadeInView style={styles.center}>
      <Text variant="heading" color="error" style={styles.centerText}>
        {title ?? t('common.loadFailed', 'Failed to load data')}
      </Text>
      {description ? (
        <Text variant="caption" color="secondary" style={styles.centerText}>
          {description}
        </Text>
      ) : null}
      {onRetry ? (
        <View style={styles.actionWrap}>
          <Button label={t('common.retry', 'Retry')} onPress={onRetry} variant="secondary" />
        </View>
      ) : null}
    </FadeInView>
  );
}

const styles = StyleSheet.create({
  skeleton: { backgroundColor: colors.surfaceMuted, borderRadius: radius.sm },
  stack: { gap: spacing.sm },
  skeletonCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  center: { alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.xs },
  centerText: { textAlign: 'center' },
  emptyIcon: { marginBottom: spacing.sm, opacity: 0.5 },
  actionWrap: { marginTop: spacing.md },
});
