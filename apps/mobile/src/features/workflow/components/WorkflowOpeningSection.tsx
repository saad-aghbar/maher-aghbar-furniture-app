import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { WorkflowNode } from '@/api/modules/workflow';
import { AppText } from '@/components/AppText';
import { SurfaceCard } from '@/components/surfaces/SurfaceCard';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import { stageNodeLabel } from '../stageNodeLabel';
import { OPENING_STAGE_CODE } from '../workflowTerminal';

type Props = {
  nodes: WorkflowNode[];
  selectedId?: string | null;
  onStagePress?: (node: WorkflowNode) => void;
};

export function WorkflowOpeningSection({ nodes, selectedId, onStagePress }: Props) {
  const { t, locale, isRTL } = useLocale();
  const { theme, colors } = useTheme();
  const node =
    nodes.find((n) => n.stageDefinition?.code === OPENING_STAGE_CODE) ?? nodes[0] ?? null;
  const focused = node?.id === selectedId;

  return (
    <SurfaceCard>
      <View style={{ gap: theme.spacing.md }}>
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'flex-start',
            gap: theme.spacing.sm,
          }}
        >
          <Ionicons name="lock-closed" size={16} color={colors.brand} />
          <View style={{ flex: 1, gap: 4 }}>
            <AppText variant="body" weight="semibold">
              {t('mobile.production.workflow.openingTitle')}
            </AppText>
            <AppText variant="caption" color="muted">
              {t('mobile.production.workflow.openingHint')}
            </AppText>
          </View>
        </View>

        <AnimatedPressable
          variant="card"
          disabled={!node || !onStagePress}
          onPress={() => {
            if (!node || !onStagePress) return;
            void haptics.selection();
            onStagePress(node);
          }}
          style={{
            borderRadius: theme.radius.lg,
            borderWidth: focused ? 1.5 : 1,
            borderColor: focused ? colors.brand : colors.borderStrong,
            borderStyle: node ? 'solid' : 'dashed',
            backgroundColor: colors.surface,
            padding: theme.spacing.md,
            gap: theme.spacing.xs,
            opacity: node ? 1 : 0.85,
          }}
        >
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Ionicons name="lock-closed" size={12} color={colors.textSecondary} />
            <AppText variant="caption" color="secondary" weight="medium">
              {t('mobile.production.workflow.openingLocked')}
            </AppText>
          </View>
          <AppText variant="label" weight="semibold">
            {node
              ? stageNodeLabel(locale, node.stageDefinition)
              : t('mobile.production.workflow.materialPrepFallback')}
          </AppText>
          {!node ? (
            <AppText variant="caption" color="muted">
              {t('mobile.production.workflow.openingMissing')}
            </AppText>
          ) : null}
        </AnimatedPressable>
      </View>
    </SurfaceCard>
  );
}
