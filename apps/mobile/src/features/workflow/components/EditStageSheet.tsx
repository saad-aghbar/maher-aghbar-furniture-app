import { useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { localizedName } from '@maher/i18n';
import { isApiError } from '@/api/errors';
import { toastMessageForError } from '@/api/queryClient';
import type { WorkflowNode, WorkflowVersion } from '@/api/modules/workflow';
import { AppText } from '@/components/AppText';
import { DestructiveButton } from '@/components/buttons/DestructiveButton';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { useToast } from '@/components/feedback/Toast';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import {
  commitEditWorkflowStage,
  commitRemoveWorkflowStage,
  useApplyWorkflowVersionCache,
} from '../commitWorkflowGraph';
import {
  predecessorsOf,
  resolveLeadsIntoForSave,
  resolveSinkId,
  successorsOf,
  validLeadsIntoCandidates,
  validRunsAfterCandidates,
  wouldCreateCycle,
} from '../rewireWorkflowEdges';
import { WorkflowCompactPickRow, WorkflowFloorBoard } from './WorkflowFloorList';

type Props = {
  open: boolean;
  onClose: () => void;
  workflowId: string;
  version: WorkflowVersion;
  node: WorkflowNode | null;
  onDirty?: () => void;
};

function toggleId(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

function sheetErrorMessage(err: unknown, t: (key: string) => string): string {
  const code =
    err && typeof err === 'object' && 'code' in err
      ? String((err as { code: string }).code)
      : '';
  if (code === 'WORKFLOW_CYCLE') return t('mobile.production.workflow.invalidCycle');
  if (code === 'VALIDATION_ERROR' || code === 'INTERNAL_ERROR') {
    return t('mobile.production.workflow.saveConnectionsError');
  }
  if (isApiError(err)) {
    if (err.code === 'VALIDATION_ERROR' || /validation failed/i.test(err.message)) {
      return t('mobile.production.workflow.saveConnectionsError');
    }
    if (/unexpected error/i.test(err.message)) {
      return t('mobile.production.workflow.saveConnectionsError');
    }
    return toastMessageForError(err);
  }
  return t('mobile.production.workflow.loadError');
}

export function EditStageSheet({
  open,
  onClose,
  workflowId,
  version,
  node,
  onDirty,
}: Props) {
  const { t, locale, isRTL } = useLocale();
  const { theme, colors } = useTheme();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  const { height: windowH } = useWindowDimensions();
  const applyCache = useApplyWorkflowVersionCache(workflowId, version.id);
  const busyRef = useRef(false);
  const scrollRef = useRef<ScrollView>(null);

  const [required, setRequired] = useState(true);
  const [runsAfterIds, setRunsAfterIds] = useState<string[]>([]);
  const [leadsIntoIds, setLeadsIntoIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const otherNodes = useMemo(
    () =>
      [...version.nodes]
        .filter((n) => n.id !== node?.id)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [version.nodes, node?.id],
  );

  const nodeSort = useMemo(
    () => version.nodes.map((n) => ({ id: n.id, sortOrder: n.sortOrder })),
    [version.nodes],
  );

  const targetId = node?.id ?? '__edit__';

  const validRunIds = useMemo(
    () =>
      new Set(
        validRunsAfterCandidates(
          nodeSort,
          version.edges,
          targetId,
          runsAfterIds,
          leadsIntoIds,
          true,
        ),
      ),
    [nodeSort, version.edges, targetId, runsAfterIds, leadsIntoIds],
  );

  const validLeadIds = useMemo(
    () =>
      new Set(
        validLeadsIntoCandidates(
          nodeSort,
          version.edges,
          targetId,
          runsAfterIds,
          leadsIntoIds,
          true,
        ),
      ),
    [nodeSort, version.edges, targetId, runsAfterIds, leadsIntoIds],
  );

  const runsAfterOptions = useMemo(
    () => otherNodes.filter((n) => validRunIds.has(n.id)),
    [otherNodes, validRunIds],
  );
  const leadsIntoOptions = useMemo(
    () => otherNodes.filter((n) => validLeadIds.has(n.id)),
    [otherNodes, validLeadIds],
  );

  const resolvedLeadsInto = useMemo(() => {
    if (!node) return leadsIntoIds;
    return resolveLeadsIntoForSave({
      nodes: nodeSort,
      edges: version.edges,
      targetId: node.id,
      runsAfterIds,
      leadsIntoIds,
    });
  }, [node, nodeSort, version.edges, runsAfterIds, leadsIntoIds]);

  const sinkId = useMemo(
    () => resolveSinkId(nodeSort, version.edges),
    [nodeSort, version.edges],
  );

  const sinkNode = sinkId ? version.nodes.find((n) => n.id === sinkId) : undefined;
  const sinkName = sinkNode
    ? localizedName(locale, sinkNode.stageDefinition, sinkNode.stageDefinition.code)
    : '';

  const becomingNewLast =
    Boolean(node) &&
    leadsIntoIds.length === 0 &&
    Boolean(sinkId) &&
    node!.id !== sinkId &&
    runsAfterIds.includes(sinkId!) &&
    resolvedLeadsInto.length === 0;

  const willLeadIntoSink =
    Boolean(node) &&
    leadsIntoIds.length === 1 &&
    sinkId != null &&
    leadsIntoIds[0] === sinkId;

  // Seed only when opening / switching node — never when version refetches mid-edit.
  useEffect(() => {
    if (!open || !node) return;
    busyRef.current = false;
    setSaving(false);
    setRemoving(false);
    setFormError(null);
    setRequired(node.isRequiredByDefault);
    setRunsAfterIds(predecessorsOf(version.edges, node.id));
    const succs = successorsOf(version.edges, node.id);
    const sink = resolveSinkId(
      version.nodes.map((n) => ({ id: n.id, sortOrder: n.sortOrder })),
      version.edges,
    );
    // Dead-end non-sink: pre-select the sink so Delivery is visible.
    if (succs.length === 0 && sink && node.id !== sink) {
      setLeadsIntoIds([sink]);
    } else {
      setLeadsIntoIds(succs);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, node?.id]);

  useEffect(() => {
    if (!sinkId || !node || node.id === sinkId) return;
    if (!runsAfterIds.includes(sinkId)) return;
    setLeadsIntoIds((ids) => (ids.length === 0 ? ids : []));
  }, [sinkId, runsAfterIds, node]);

  useEffect(() => {
    setRunsAfterIds((ids) => {
      const next = ids.filter((id) => validRunIds.has(id));
      return next.length === ids.length ? ids : next;
    });
  }, [validRunIds]);

  useEffect(() => {
    setLeadsIntoIds((ids) => {
      const next = ids.filter((id) => validLeadIds.has(id));
      return next.length === ids.length ? ids : next;
    });
  }, [validLeadIds]);

  function Segment({
    active,
    label,
    onPress,
  }: {
    active: boolean;
    label: string;
    onPress: () => void;
  }) {
    return (
      <AnimatedPressable
        variant="button"
        onPress={() => {
          void haptics.selection();
          onPress();
        }}
        style={{
          flex: 1,
          borderRadius: theme.radius.xl,
          paddingVertical: theme.spacing.sm,
          paddingHorizontal: theme.spacing.sm,
          alignItems: 'center',
          backgroundColor: active ? colors.brand : colors.surface,
          borderWidth: 1,
          borderColor: active ? colors.brand : colors.border,
        }}
      >
        <AppText
          variant="caption"
          weight="semibold"
          style={{ color: active ? colors.onBrand : colors.textPrimary, textAlign: 'center' }}
        >
          {label}
        </AppText>
      </AnimatedPressable>
    );
  }

  async function onSave() {
    if (!node || busyRef.current || saving || removing) return;
    if (wouldCreateCycle(version.edges, node.id, runsAfterIds, resolvedLeadsInto, true)) {
      setFormError(t('mobile.production.workflow.invalidCycle'));
      scrollRef.current?.scrollToEnd({ animated: true });
      void haptics.error();
      return;
    }

    busyRef.current = true;
    setSaving(true);
    setFormError(null);
    Keyboard.dismiss();

    const versionSnapshot = version;
    const nodeId = node.id;
    const runsAfterSnapshot = [...runsAfterIds];
    const leadsIntoSnapshot = [...leadsIntoIds];
    const requiredSnapshot = required;

    try {
      const healed = await commitEditWorkflowStage({
        workflowId,
        version: versionSnapshot,
        nodeId,
        required: requiredSnapshot,
        runsAfterIds: runsAfterSnapshot,
        leadsIntoIds: leadsIntoSnapshot,
      });
      await applyCache(healed);
      onDirty?.();
      onClose();
      void haptics.confirmLight();
      setTimeout(() => {
        showToast({
          variant: 'success',
          message: t('mobile.production.workflow.stageUpdated'),
        });
      }, 220);
    } catch (err) {
      void haptics.error();
      setFormError(sheetErrorMessage(err, t));
      scrollRef.current?.scrollToEnd({ animated: true });
    } finally {
      busyRef.current = false;
      setSaving(false);
    }
  }

  async function onRemove() {
    if (!node || busyRef.current || saving || removing) return;
    busyRef.current = true;
    setRemoving(true);
    try {
      const healed = await commitRemoveWorkflowStage({
        workflowId,
        version,
        nodeId: node.id,
      });
      await applyCache(healed);
      onDirty?.();
      onClose();
      void haptics.confirmLight();
      setTimeout(() => {
        showToast({
          variant: 'success',
          message: t('mobile.production.workflow.stageRemoved'),
        });
      }, 220);
    } catch (err) {
      void haptics.error();
      setFormError(sheetErrorMessage(err, t));
      scrollRef.current?.scrollToEnd({ animated: true });
    } finally {
      busyRef.current = false;
      setRemoving(false);
    }
  }

  const title = node
    ? localizedName(locale, node.stageDefinition, node.stageDefinition.code)
    : t('mobile.production.workflow.editStage');

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('mobile.production.workflow.editStage')}
      fitContent
      maxHeight={Math.round(windowH * 0.9)}
    >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{
          gap: theme.spacing.lg,
          paddingBottom: insets.bottom + theme.spacing['3xl'],
        }}
        keyboardShouldPersistTaps="handled"
      >
        <AppText variant="body" weight="semibold">
          {title}
        </AppText>

        <View style={{ gap: theme.spacing.sm }}>
          <AppText variant="caption" color="secondary">
            {t('mobile.production.workflow.required')} / {t('mobile.production.workflow.optional')}
          </AppText>
          <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: theme.spacing.sm }}>
            <Segment
              active={required}
              label={t('mobile.production.workflow.required')}
              onPress={() => setRequired(true)}
            />
            <Segment
              active={!required}
              label={t('mobile.production.workflow.optional')}
              onPress={() => setRequired(false)}
            />
          </View>
        </View>

        <View style={{ gap: theme.spacing.md }}>
          <AppText variant="caption" color="muted">
            {t('mobile.production.workflow.connectionHint')}
          </AppText>

          <View style={{ gap: theme.spacing.sm }}>
            <AppText variant="caption" color="muted">
              {t('mobile.production.workflow.runsAfterEmptyHint')}
            </AppText>
            <WorkflowFloorBoard
              title={t('mobile.production.workflow.runsAfter')}
              count={runsAfterOptions.length}
            >
              {runsAfterOptions.map((item) => (
                <WorkflowCompactPickRow
                  key={`p-${item.id}`}
                  label={localizedName(
                    locale,
                    item.stageDefinition,
                    item.stageDefinition.code,
                  )}
                  active={runsAfterIds.includes(item.id)}
                  onPress={() => {
                    void haptics.selection();
                    setRunsAfterIds((ids) => toggleId(ids, item.id));
                  }}
                />
              ))}
            </WorkflowFloorBoard>
          </View>

          <View style={{ gap: theme.spacing.sm }}>
            <AppText variant="caption" color="muted">
              {t('mobile.production.workflow.leadsIntoEmptyHint')}
            </AppText>
            <WorkflowFloorBoard
              title={t('mobile.production.workflow.leadsInto')}
              count={leadsIntoOptions.length}
            >
              {leadsIntoOptions.map((item) => (
                <WorkflowCompactPickRow
                  key={`s-${item.id}`}
                  label={localizedName(
                    locale,
                    item.stageDefinition,
                    item.stageDefinition.code,
                  )}
                  active={leadsIntoIds.includes(item.id)}
                  onPress={() => {
                    void haptics.selection();
                    setLeadsIntoIds((ids) => toggleId(ids, item.id));
                  }}
                />
              ))}
            </WorkflowFloorBoard>
          </View>
        </View>

        {becomingNewLast ? (
          <AppText variant="caption" color="muted">
            {t('mobile.production.workflow.willBecomeLast')}
          </AppText>
        ) : willLeadIntoSink && sinkName ? (
          <AppText variant="caption" color="muted">
            {t('mobile.production.workflow.willLeadInto', { stage: sinkName })}
          </AppText>
        ) : null}

        {formError ? (
          <View
            style={{
              borderRadius: theme.radius.xl,
              borderWidth: 1,
              borderColor: colors.error,
              backgroundColor: colors.surface,
              padding: theme.spacing.md,
            }}
          >
            <AppText variant="caption" style={{ color: colors.error }}>
              {formError}
            </AppText>
          </View>
        ) : null}

        <PrimaryButton
          label={t('mobile.production.workflow.saveStage')}
          loading={saving}
          disabled={saving || removing || !node}
          onPress={() => void onSave()}
          style={{ borderRadius: theme.radius.xl }}
        />

        <DestructiveButton
          label={t('mobile.production.workflow.removeStage')}
          loading={removing}
          disabled={saving || removing || !node}
          onPress={() => void onRemove()}
          style={{ borderRadius: theme.radius.xl }}
        />
      </ScrollView>
    </BottomSheet>
  );
}
