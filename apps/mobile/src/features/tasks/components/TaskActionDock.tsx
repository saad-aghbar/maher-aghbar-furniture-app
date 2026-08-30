import { useEffect } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { AnimatedPressable, haptics } from '@/motion';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import { HoldToConfirmButton } from './HoldToConfirmButton';

export type TaskDockAction = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  /** Primary filled tile (timer start/resume). */
  primary?: boolean;
  /** Hold-to-confirm finish control. */
  holdConfirm?: boolean;
  holdLabel?: string;
};

type Props = {
  actions: TaskDockAction[];
  bottomOffset: number;
  /** Measured chrome height so floor scroll can clear the dock. */
  onHeight?: (height: number) => void;
};

function chunkPairs<T>(items: T[]): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += 2) {
    rows.push(items.slice(i, i + 2));
  }
  return rows;
}

/**
 * Floating 2×2 task actions — sits above the worker touch bar.
 */
export function TaskActionDock({ actions, bottomOffset, onHeight }: Props) {
  const { isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const dark = colorScheme === 'dark';

  useEffect(() => {
    if (actions.length === 0) onHeight?.(0);
  }, [actions.length, onHeight]);

  if (actions.length === 0) return null;

  const cells = actions.slice(0, 4);
  const rows = chunkPairs(cells);

  const reportHeight = (e: LayoutChangeEvent) => {
    onHeight?.(e.nativeEvent.layout.height);
  };

  return (
    <View
      pointerEvents="box-none"
      onLayout={reportHeight}
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: bottomOffset,
        paddingHorizontal: theme.spacing.lg,
        paddingBottom: theme.spacing.sm,
      }}
    >
      <View
        style={{
          borderRadius: theme.radius.xl,
          borderWidth: 1,
          borderColor: colors.borderStrong,
          backgroundColor: dark ? 'rgba(42,36,37,0.96)' : colors.surface,
          padding: theme.spacing.sm,
          gap: theme.spacing.sm,
          ...(dark
            ? {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.35,
                shadowRadius: 16,
                elevation: 10,
              }
            : {
                shadowColor: '#1E1A1B',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.14,
                shadowRadius: 18,
                elevation: 8,
              }),
        }}
      >
        {rows.map((row, rowIndex) => (
          <View
            key={`dock-row-${rowIndex}`}
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              gap: theme.spacing.sm,
            }}
          >
            {row.map((action) => (
              <View key={action.key} style={{ flex: 1 }}>
                <DockCell
                  action={action}
                  titleWeight={titleWeight}
                  isRTL={isRTL}
                />
              </View>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

function DockCell({
  action,
  titleWeight,
  isRTL,
}: {
  action: TaskDockAction;
  titleWeight: 'medium' | 'semibold';
  isRTL: boolean;
}) {
  const { colors, theme } = useTheme();

  if (action.holdConfirm) {
    return (
      <HoldToConfirmButton
        label={action.label}
        holdLabel={action.holdLabel}
        onConfirm={action.onPress}
        disabled={action.disabled}
        loading={action.loading}
        style={{ minHeight: 52, borderRadius: theme.radius.lg }}
      />
    );
  }

  const blocked = Boolean(action.disabled || action.loading);
  const filled = Boolean(action.primary);

  return (
    <AnimatedPressable
      variant="button"
      accessibilityRole="button"
      accessibilityLabel={action.label}
      accessibilityState={{ disabled: blocked, busy: action.loading }}
      disabled={blocked}
      onPress={() => {
        if (blocked) return;
        void haptics.selection();
        action.onPress();
      }}
      style={{
        minHeight: 52,
        borderRadius: theme.radius.lg,
        paddingHorizontal: theme.spacing.sm,
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: filled
          ? blocked
            ? colors.disabledFill
            : colors.brand
          : colors.surfaceSecondary,
        borderWidth: 1,
        borderColor: filled
          ? blocked
            ? colors.border
            : colors.brand
          : colors.borderStrong,
        opacity: blocked && !action.loading ? 0.55 : 1,
      }}
    >
      <Ionicons
        name={action.icon}
        size={18}
        color={
          filled
            ? blocked
              ? colors.disabled
              : colors.onBrand
            : colors.brand
        }
      />
      <AppText
        variant="caption"
        weight={titleWeight}
        numberOfLines={2}
        align="center"
        style={{
          flexShrink: 1,
          color: filled
            ? blocked
              ? colors.disabled
              : colors.onBrand
            : colors.textPrimary,
          fontSize: 12,
          lineHeight: 15,
        }}
      >
        {action.label}
      </AppText>
    </AnimatedPressable>
  );
}
