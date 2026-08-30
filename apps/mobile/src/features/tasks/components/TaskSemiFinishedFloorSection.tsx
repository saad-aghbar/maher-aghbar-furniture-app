import { forwardRef, useCallback, useState } from 'react';
import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import { TaskIncomingWorkFloorSection } from './TaskIncomingWorkFloorSection';
import {
  TaskSemiOutputFloorSection,
  type TaskSemiOutputFloorHandle,
} from './TaskSemiOutputFloorSection';

type Props = {
  taskId: string;
  productionOrderId: string | null;
  expectedPieceCount: number;
  producesSemiFinished: boolean;
  onIncomingChange?: (info: { required: boolean; allReceived: boolean }) => void;
  onReceived?: () => void;
};

/**
 * Single SEMI-FINISHED card: Incoming (receive) + Your Output (produce).
 * Hidden entirely when this task neither consumes nor produces SEMI.
 */
export const TaskSemiFinishedFloorSection = forwardRef<TaskSemiOutputFloorHandle, Props>(
  function TaskSemiFinishedFloorSection(
    {
      taskId,
      productionOrderId,
      expectedPieceCount,
      producesSemiFinished,
      onIncomingChange,
      onReceived,
    },
    ref,
  ) {
    const { t, locale, isRTL } = useLocale();
    const { colors, theme, colorScheme } = useTheme();
    const [incomingRequired, setIncomingRequired] = useState(false);
    const [incomingLoaded, setIncomingLoaded] = useState(false);

    const handleAvailability = useCallback(
      (info: { required: boolean; allReceived: boolean; lines?: unknown[] }) => {
        setIncomingRequired(info.required);
        setIncomingLoaded(true);
        onIncomingChange?.(info);
      },
      [onIncomingChange],
    );

    const showCard = producesSemiFinished || incomingRequired || !incomingLoaded;

    if (!showCard) return null;

    return (
      <View
        style={{
          borderRadius: theme.radius.xl,
          borderWidth: 1,
          borderColor: colors.borderStrong,
          backgroundColor: colors.surface,
          overflow: 'hidden',
          ...orderBoardShadow(colorScheme),
          // Hide chrome until we know incoming isn't needed and we don't produce
          opacity: !producesSemiFinished && !incomingRequired && !incomingLoaded ? 0 : 1,
          height: !producesSemiFinished && !incomingRequired && !incomingLoaded ? 0 : undefined,
        }}
      >
        <View
          style={{
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.sm + 2,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            backgroundColor: colors.surfaceSecondary,
            gap: 2,
          }}
        >
          <AppText
            variant="caption"
            weight="semibold"
            style={{
              color: colors.brand,
              letterSpacing: locale === 'ar' ? 0 : 0.6,
              textTransform: locale === 'ar' ? 'none' : 'uppercase',
              fontSize: 11,
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {t('mobile.tasks.semiFinishedTitle')}
          </AppText>
          <AppText
            variant="caption"
            color="muted"
            style={{ textAlign: isRTL ? 'right' : 'left', fontSize: 11 }}
          >
            {t('mobile.tasks.semiFinishedCaption')}
          </AppText>
        </View>

        <View style={{ padding: theme.spacing.md, gap: theme.spacing.lg }}>
          <TaskIncomingWorkFloorSection
            taskId={taskId}
            embedded
            showNoneWhenEmpty
            onReceived={onReceived}
            onAvailabilityChange={handleAvailability}
          />
          {producesSemiFinished ? (
            <TaskSemiOutputFloorSection
              ref={ref}
              taskId={taskId}
              productionOrderId={productionOrderId}
              expectedPieceCount={expectedPieceCount}
              embedded
            />
          ) : null}
        </View>
      </View>
    );
  },
);
