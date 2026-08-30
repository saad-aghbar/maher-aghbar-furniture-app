import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { WorkflowNode } from '@/api/modules/workflow';
import { AppText } from '@/components/AppText';
import { SurfaceCard } from '@/components/surfaces/SurfaceCard';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import { stageNodeLabel } from '../stageNodeLabel';
import { TERMINAL_STAGE_CODES, type TerminalStageCode } from '../workflowTerminal';

type Props = {
  nodes: WorkflowNode[];
  selectedId?: string | null;
  onStagePress?: (node: WorkflowNode) => void;
};

const STAGE_LABEL_KEYS: Record<TerminalStageCode, string> = {
  INSPECTION: 'lifecycle.timelineInspection',
  PACKAGING: 'lifecycle.timelinePackaging',
  DELIVERY: 'lifecycle.timelineShipped',
};

const DESC_KEYS: Record<TerminalStageCode, string> = {
  INSPECTION: 'lifecycle.terminalInspectionDesc',
  PACKAGING: 'lifecycle.terminalPackagingDesc',
  DELIVERY: 'lifecycle.terminalDeliveryDesc',
};

const BADGE_KEYS: Partial<Record<TerminalStageCode, string>> = {
  INSPECTION: 'lifecycle.qualityBadge',
  DELIVERY: 'lifecycle.logisticsBadge',
};

export function WorkflowTerminalSection({ nodes, selectedId, onStagePress }: Props) {
  const { t, locale, isRTL } = useLocale();
  const { theme, colors } = useTheme();
  const byCode = new Map(
    nodes
      .filter((n) => n.stageDefinition?.code)
      .map((n) => [n.stageDefinition!.code, n] as const),
  );

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
              {t('lifecycle.requiredFinishingStages')}
            </AppText>
            <AppText variant="caption" color="muted">
              {t('lifecycle.endsWithTerminalChain')}
            </AppText>
          </View>
        </View>

        {TERMINAL_STAGE_CODES.map((code, index) => {
          const node = byCode.get(code);
          const focused = node?.id === selectedId;
          const badgeKey = BADGE_KEYS[code];

          return (
            <View key={code} style={{ gap: theme.spacing.xs }}>
              {index > 0 ? (
                <View style={{ alignItems: 'center', paddingVertical: 2 }}>
                  <Ionicons name="arrow-down" size={14} color={colors.brand} />
                </View>
              ) : null}
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
                    justifyContent: 'space-between',
                    gap: 6,
                  }}
                >
                  <View
                    style={{
                      flexDirection: isRTL ? 'row-reverse' : 'row',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <View
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 11,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: colors.brandSoft,
                      }}
                    >
                      <AppText variant="caption" weight="semibold" color="brand">
                        {String(index + 1)}
                      </AppText>
                    </View>
                    <Ionicons name="lock-closed" size={12} color={colors.textSecondary} />
                    <AppText variant="caption" color="secondary" weight="medium">
                      {t('production.workflow.terminalLocked')}
                    </AppText>
                  </View>
                  {badgeKey ? (
                    <View
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        borderRadius: theme.radius.md,
                        backgroundColor: colors.surfaceSecondary,
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                    >
                      <AppText variant="caption" color="secondary" weight="medium">
                        {t(badgeKey)}
                      </AppText>
                    </View>
                  ) : null}
                </View>
                <AppText variant="label" weight="semibold">
                  {node ? stageNodeLabel(locale, node.stageDefinition) : t(STAGE_LABEL_KEYS[code])}
                </AppText>
                <AppText variant="caption" color="muted">
                  {t(DESC_KEYS[code])}
                </AppText>
                {!node ? (
                  <AppText variant="caption" color="muted">
                    {t('mobile.production.workflow.terminalMissing')}
                  </AppText>
                ) : null}
              </AnimatedPressable>
            </View>
          );
        })}
      </View>
    </SurfaceCard>
  );
}
