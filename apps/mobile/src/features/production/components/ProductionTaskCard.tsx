import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { Divider } from '@/components/layout/Divider';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
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
 * Production task floor card — header band, inset assignee/plan, progress.
 */
export function ProductionTaskCard({ task, onPress, onOpenFloor }: ProductionTaskCardProps) {
  const { t, isRTL, locale, formatDateTime } = useLocale();
  const { colors, theme, colorScheme } = useTheme();

  const pct = Math.max(0, Math.min(100, Math.round(task.progressPercent || 0)));
  const urgent = task.priority === 'URGENT' || task.priority === 'HIGH';
  const blocked = task.status === 'BLOCKED' || task.openBlockerCount > 0;
  const accent = blocked
    ? colors.error
    : urgent
      ? colors.warning
      : task.status === 'IN_PROGRESS' || pct > 0
        ? colors.brand
        : colors.brand;
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
        ...orderBoardShadow(colorScheme),
      }}
    >
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          ...(isRTL ? { right: 0 } : { left: 0 }),
          width: 3,
          backgroundColor: accent,
          opacity: blocked || urgent ? 0.9 : 0.55,
        }}
      />

      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.sm,
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.md,
          ...(isRTL
            ? { paddingRight: theme.spacing.lg + 4 }
            : { paddingLeft: theme.spacing.lg + 4 }),
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          backgroundColor: colors.surfaceSecondary,
        }}
      >
        <View
          style={{
            flex: 1,
            minWidth: 0,
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: theme.spacing.sm,
            flexWrap: 'wrap',
          }}
        >
          <StatusBadge status={task.status} dot />
          <StatusBadge
            status={task.priority}
            label={priorityLabel(task.priority, t)}
            dot
          />
        </View>
        <AppText variant="caption" color="brand" weight={titleWeight}>
          {t('common.details')}
        </AppText>
      </View>

      <View
        style={{
          padding: theme.spacing.lg,
          gap: theme.spacing.md,
          ...(isRTL
            ? { paddingRight: theme.spacing.lg + 4 }
            : { paddingLeft: theme.spacing.lg + 4 }),
        }}
      >
        <AppText
          variant="label"
          weight={titleWeight}
          numberOfLines={2}
          style={{ textAlign: isRTL ? 'right' : 'left', fontSize: 17 }}
        >
          {task.name}
        </AppText>

        <View
          style={{
            borderRadius: theme.radius.lg,
            backgroundColor: colors.surfaceSecondary,
            borderWidth: 1,
            borderColor: colors.border,
            overflow: 'hidden',
          }}
        >
          <MetaRow
            label={t('mobile.production.assignedWorker')}
            value={
              task.assigneeName
                ? task.assigneeName
                : t('mobile.production.unassigned')
            }
            isRTL={isRTL}
            muted={!task.assigneeName}
          />
          {task.plannedCompletion ? (
            <>
              <Divider compact plain style={{ marginVertical: 0 }} />
              <MetaRow
                label={t('mobile.production.plannedDate')}
                value={formatDateTime(task.plannedCompletion)}
                isRTL={isRTL}
              />
            </>
          ) : null}
          {!task.canAssign && !task.isCompleted ? (
            <>
              <Divider compact plain style={{ marginVertical: 0 }} />
              <MetaRow
                label={t('mobile.production.stageAssignLockedShort')}
                value="—"
                isRTL={isRTL}
                muted
              />
            </>
          ) : null}
        </View>

        <View style={{ gap: theme.spacing.xs }}>
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: theme.spacing.sm,
            }}
          >
            <AppText
              variant="caption"
              color="muted"
              style={{
                flex: 1,
                textAlign: isRTL ? 'right' : 'left',
                fontSize: 10,
                letterSpacing: locale === 'ar' ? 0 : 0.45,
                textTransform: locale === 'ar' ? 'none' : 'uppercase',
              }}
            >
              {t('mobile.production.progress')}
            </AppText>
            <AppText
              weight={titleWeight}
              dir="ltr"
              style={{ color: accent, fontSize: 15 }}
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
      </View>
    </AnimatedPressable>
  );
}

function MetaRow({
  label,
  value,
  isRTL,
  muted,
}: {
  label: string;
  value: string;
  isRTL: boolean;
  muted?: boolean;
}) {
  const { colors, theme } = useTheme();
  const { locale } = useLocale();

  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.spacing.md,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm + 2,
      }}
    >
      <AppText
        variant="caption"
        color="muted"
        style={{
          textTransform: locale === 'ar' ? 'none' : 'uppercase',
          letterSpacing: locale === 'ar' ? 0 : 0.5,
          fontSize: 10,
          flexShrink: 0,
          textAlign: isRTL ? 'right' : 'left',
        }}
      >
        {label}
      </AppText>
      <AppText
        weight="semibold"
        numberOfLines={2}
        style={{
          flex: 1,
          minWidth: 0,
          color: muted ? colors.textMuted : colors.textPrimary,
          textAlign: isRTL ? 'left' : 'right',
        }}
      >
        {value}
      </AppText>
    </View>
  );
}
