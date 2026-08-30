import type { ReactNode } from 'react';
import { View } from 'react-native';
import type { WorkflowNode } from '@/api/modules/workflow';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import { groupParallelLanes } from '../workflowTerminal';
import type { EdgeLike } from '../rewireWorkflowEdges';
import { WorkflowCompactPickRow } from './WorkflowFloorList';

type PickNode = Pick<WorkflowNode, 'id' | 'sortOrder' | 'stageDefinition'>;

type Props = {
  title: string;
  /** Shown in the board header (e.g. selected count). */
  count?: number;
  nodes: PickNode[];
  edges: EdgeLike[];
  selectedIds: string[];
  lockedIds?: ReadonlySet<string>;
  onToggle: (id: string) => void;
  labelFor: (node: PickNode) => string;
};

/**
 * After / Parallel picker with Together barrels for stages that share predecessors.
 * Selection stays per-row (one or many inside a barrel).
 */
export function PlacementTogetherPickList({
  title,
  count,
  nodes,
  edges,
  selectedIds,
  lockedIds,
  onToggle,
  labelFor,
}: Props) {
  const { t, isRTL } = useLocale();
  const { theme, colors } = useTheme();
  const lanes = groupParallelLanes(nodes, edges);

  const toggleGroup = (ids: string[]) => {
    const allOn = ids.every((id) => selectedIds.includes(id));
    void haptics.selection();
    for (const id of ids) {
      const on = selectedIds.includes(id);
      if (allOn && on) onToggle(id);
      else if (!allOn && !on) onToggle(id);
    }
  };

  return (
    <View
      style={{
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: colors.borderStrong,
        backgroundColor: colors.surface,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm + 2,
          backgroundColor: colors.surfaceSecondary,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <AppText
          variant="caption"
          weight="semibold"
          style={{
            color: colors.brand,
            textTransform: 'uppercase',
            letterSpacing: 0.7,
            fontSize: 11,
          }}
        >
          {title}
        </AppText>
        {count != null ? (
          <AppText variant="caption" color="muted" dir="ltr">
            {String(count)}
          </AppText>
        ) : null}
      </View>

      <View style={{ padding: theme.spacing.sm, gap: theme.spacing.sm }}>
        {lanes.map((lane) => {
          const ids = lane.nodes.map((n) => n.id);
          if (lane.kind === 'together') {
            const allOn = ids.every((id) => selectedIds.includes(id));
            return (
              <View
                key={`barrel-${ids.join('-')}`}
                style={{
                  gap: theme.spacing.sm,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: theme.radius.lg,
                  padding: theme.spacing.sm,
                }}
              >
                <AnimatedPressable
                  variant="button"
                  onPress={() => toggleGroup(ids)}
                  style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <AppText variant="caption" color="muted" weight="medium">
                    {t('mobile.production.workflow.together')}
                  </AppText>
                  <AppText variant="caption" style={{ color: colors.brand }}>
                    {allOn
                      ? t('mobile.production.workflow.togetherClearAll')
                      : t('mobile.production.workflow.togetherSelectAll')}
                  </AppText>
                </AnimatedPressable>
                {lane.nodes.map((node) => (
                  <WorkflowCompactPickRow
                    key={node.id}
                    label={labelFor(node)}
                    active={selectedIds.includes(node.id)}
                    locked={lockedIds?.has(node.id)}
                    onPress={() => {
                      void haptics.selection();
                      onToggle(node.id);
                    }}
                  />
                ))}
              </View>
            );
          }

          return (
            <View key={`solo-${ids.join('-')}`} style={{ gap: theme.spacing.sm }}>
              {lane.nodes.map((node) => (
                <WorkflowCompactPickRow
                  key={node.id}
                  label={labelFor(node)}
                  active={selectedIds.includes(node.id)}
                  locked={lockedIds?.has(node.id)}
                  onPress={() => {
                    void haptics.selection();
                    onToggle(node.id);
                  }}
                />
              ))}
            </View>
          );
        })}
      </View>
    </View>
  );
}

/** Optional hint under Start/After/Parallel segments. */
export function PlacementModeHint({ children }: { children: ReactNode }) {
  const { theme, colors } = useTheme();
  return (
    <AppText variant="caption" color="muted" style={{ marginTop: theme.spacing.xs }}>
      {children}
    </AppText>
  );
}
