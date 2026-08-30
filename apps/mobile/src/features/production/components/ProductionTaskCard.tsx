import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics, ProgressBar } from '@/motion';
import { useTheme } from '@/theme';
import type { ProductionTaskRow } from '../selectProduction';

type ProductionTaskCardProps = {
  task: ProductionTaskRow;
  onPress: () => void;
  onOpenFloor?: () => void;
};

function priorityLabel(priority: string, t: (key: string) => string): string {
  const key = `mobile.production.priority.${priority}`;
  const label = t(key);
  return label === key ? priority : label;
}

/**
 * Floor task row: status, progress bar, assignee, priority — tap opens task sheet.
 */
export function ProductionTaskCard({ task, onPress, onOpenFloor }: ProductionTaskCardProps) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();

  const pct = Math.max(0, Math.min(100, Math.round(task.progressPercent || 0)));
  const urgent = task.priority === 'URGENT' || task.priority === 'HIGH';
  const blocked = task.status === 'BLOCKED' || task.openBlockerCount > 0;
  const accent = blocked
    ? colors.error
    : urgent
      ? colors.warning
      : task.status === 'IN_PROGRESS' || pct > 0
        ? colors.brand
        : colors.borderStrong;

  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  return (
    <AnimatedPressable
      variant="card"
      accessibilityRole="button"
      accessibilityLabel={`${task.name} ${pct}%`}
      onPress={() => {
        void haptics.selection();
        onPress();
      }}
      onLongPress={
        onOpenFloor
          ? () => {
              void haptics.selection();
              onOpenFloor();
            }
          : undefined
      }
      style={{
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: blocked
          ? colors.error
          : urgent
            ? colors.warning
            : colors.borderStrong,
        backgroundColor: colors.surface,
        overflow: 'hidden',
        ...theme.elevation.card,
      }}
    >
      <View
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          ...(isRTL ? { right: 0 } : { left: 0 }),
          width: 3,
          backgroundColor: accent,
          opacity: blocked || urgent ? 1 : 0.45,
        }}
      />

      <View
        style={{
          gap: theme.spacing.sm,
          paddingTop: theme.spacing.md,
          paddingBottom: theme.spacing.md,
          paddingHorizontal: theme.spacing.md,
          ...(isRTL
            ? { paddingRight: theme.spacing.md + 4 }
            : { paddingLeft: theme.spacing.md + 4 }),
        }}
      >
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'flex-start',
            gap: theme.spacing.sm,
          }}
        >
          <View style={{ flex: 1 }}>
            <AppText variant="body" weight={titleWeight} numberOfLines={2}>
              {task.name}
            </AppText>
          </View>
          <Ionicons
            name={isRTL ? 'chevron-back' : 'chevron-forward'}
            size={18}
            color={colors.textMuted}
          />
        </View>

        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: theme.spacing.sm,
          }}
        >
          <StatusBadge status={task.status} dot />
          <StatusBadge
            status={task.priority}
            label={priorityLabel(task.priority, t)}
            dot
          />
        </View>

        <View
          style={{
            gap: theme.spacing.xs,
            paddingTop: theme.spacing.xs,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.border,
          }}
        >
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: theme.spacing.sm,
            }}
          >
            <AppText variant="caption" color="secondary">
              {t('mobile.production.progress')}
            </AppText>
            <AppText
              variant="caption"
              weight="semibold"
              style={{ color: accent }}
              dir="ltr"
            >
              {`${pct}%`}
            </AppText>
          </View>
          <ProgressBar
            progress={pct / 100}
            height={5}
            fillStyle={{ backgroundColor: accent }}
            trackStyle={{ backgroundColor: colors.surfaceSecondary }}
          />
        </View>

        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: theme.spacing.xs,
          }}
        >
          <Ionicons
            name="person-outline"
            size={14}
            color={task.assigneeName ? colors.textSecondary : colors.textMuted}
          />
          <AppText
            variant="caption"
            color={task.assigneeName ? 'secondary' : 'muted'}
            style={{ flex: 1 }}
            numberOfLines={1}
          >
            {task.assigneeName ?? t('mobile.production.unassigned')}
          </AppText>
          {!task.canAssign && !task.isCompleted ? (
            <AppText variant="caption" color="muted" numberOfLines={1} style={{ maxWidth: '42%' }}>
              {t('mobile.production.stageAssignLockedShort')}
            </AppText>
          ) : null}
        </View>
      </View>
    </AnimatedPressable>
  );
}
