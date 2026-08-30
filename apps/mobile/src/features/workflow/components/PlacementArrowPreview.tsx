import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import type { WorkflowNode } from '@/api/modules/workflow';
import type { EdgeLike } from '../rewireWorkflowEdges';
import { stageNodeLabel } from '../stageNodeLabel';
import { buildPlacementPreviewPath } from '../buildPlacementPreviewPath';

type Props = {
  nodes: WorkflowNode[];
  edges: EdgeLike[];
  youLabel: string;
  runsAfterIds: string[];
  leadsIntoIds?: string[];
  parallelSiblingIds?: string[];
  lockedIds?: ReadonlySet<string>;
  /** Show Material Prep beside You as parallel roots. */
  startBesidePrep?: boolean;
  /** Edit: node being moved (replaced by You in the full preview). */
  targetId?: string | null;
};

function Chip({
  label,
  locked,
  highlight,
}: {
  label: string;
  locked?: boolean;
  highlight?: boolean;
}) {
  const { theme, colors } = useTheme();
  return (
    <View
      style={{
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: highlight ? colors.brand : colors.border,
        backgroundColor: colors.surface,
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: theme.spacing.xs,
        opacity: locked ? 0.85 : 1,
      }}
    >
      <AppText variant="caption" weight={highlight ? 'semibold' : 'regular'}>
        {locked ? `🔒 ${label}` : label}
      </AppText>
    </View>
  );
}

function Arrow() {
  const { isRTL } = useLocale();
  return (
    <AppText variant="caption" color="muted" style={{ marginHorizontal: 4 }}>
      {isRTL ? '←' : '→'}
    </AppText>
  );
}

/**
 * Full-workflow arrow preview: every stage, You highlighted at the placement.
 */
export function PlacementArrowPreview({
  nodes,
  edges,
  youLabel,
  runsAfterIds,
  leadsIntoIds = [],
  parallelSiblingIds = [],
  lockedIds,
  startBesidePrep = false,
  targetId = null,
}: Props) {
  const { t, locale } = useLocale();
  const { theme, colors } = useTheme();

  const path = buildPlacementPreviewPath({
    nodes,
    edges,
    runsAfterIds,
    leadsIntoIds,
    parallelSiblingIds,
    startBesidePrep,
    lockedIds,
    targetId,
  });

  const labelFor = (chip: { nodeId?: string; kind: string }) => {
    if (chip.kind === 'you') return youLabel;
    if (!chip.nodeId) return '';
    const n = nodes.find((x) => x.id === chip.nodeId);
    return n ? stageNodeLabel(locale, n.stageDefinition) : '';
  };

  return (
    <View
      style={{
        gap: theme.spacing.sm,
        padding: theme.spacing.md,
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
      }}
    >
      <AppText variant="caption" color="secondary" weight="semibold">
        {t('mobile.production.workflow.placementPreview')}
      </AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4 }}>
        {path.segments.map((seg, segIndex) => (
          <View key={seg.id} style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }}>
            {segIndex > 0 ? <Arrow /> : null}
            {seg.together ? (
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: 4,
                  borderWidth: 1,
                  borderColor: colors.brand,
                  borderRadius: theme.radius.lg,
                  padding: theme.spacing.xs,
                }}
              >
                <AppText variant="caption" color="muted">
                  {t('mobile.production.workflow.together')}
                </AppText>
                {seg.chips.map((chip) => (
                  <Chip
                    key={chip.id}
                    label={labelFor(chip)}
                    locked={chip.locked}
                    highlight={chip.highlight}
                  />
                ))}
              </View>
            ) : (
              seg.chips.map((chip) => (
                <Chip
                  key={chip.id}
                  label={labelFor(chip)}
                  locked={chip.locked}
                  highlight={chip.highlight}
                />
              ))
            )}
          </View>
        ))}
      </View>
    </View>
  );
}
