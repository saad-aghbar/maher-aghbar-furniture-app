import { useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { localizedName } from '@maher/i18n';
import { isApiError } from '@/api/errors';
import { toastMessageForError } from '@/api/queryClient';
import type { WorkflowVersion } from '@/api/modules/workflow';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { useToast } from '@/components/feedback/Toast';
import { TextField } from '@/components/forms/TextField';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import {
  commitAddWorkflowStage,
  useApplyWorkflowVersionCache,
} from '../commitWorkflowGraph';
import { useStageLibraryQuery } from '../query';
import {
  resolveLeadsIntoForSave,
  resolveSinkId,
  validLeadsIntoCandidates,
  validRunsAfterCandidates,
  wouldCreateCycle,
} from '../rewireWorkflowEdges';
import { nameFieldOrder, slugFromEnglishName, type TrilingualNames } from '../trilingualNames';
import { WorkflowCompactPickRow, WorkflowFloorBoard } from './WorkflowFloorList';

type Props = {
  open: boolean;
  onClose: () => void;
  workflowId: string;
  version: WorkflowVersion;
  onDirty?: () => void;
};

type Mode = 'pick' | 'create';

function toggleId(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

function sheetErrorMessage(
  err: unknown,
  t: (key: string) => string,
): string {
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
  return t('mobile.production.workflow.addStageError');
}

export function AddStageSheet({ open, onClose, workflowId, version, onDirty }: Props) {
  const { t, locale, isRTL } = useLocale();
  const { theme, colors } = useTheme();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  const { height: windowH } = useWindowDimensions();
  const libraryQuery = useStageLibraryQuery(open);
  const applyCache = useApplyWorkflowVersionCache(workflowId, version.id);
  const savingRef = useRef(false);

  const [mode, setMode] = useState<Mode>('pick');
  const [stageId, setStageId] = useState('');
  const [required, setRequired] = useState(true);
  const [runsAfterIds, setRunsAfterIds] = useState<string[]>([]);
  const [leadsIntoIds, setLeadsIntoIds] = useState<string[]>([]);
  const [names, setNames] = useState<TrilingualNames>({
    nameEn: '',
    nameAr: '',
    nameHe: '',
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const fieldOrder = nameFieldOrder(locale);
  const nameLabels: Record<keyof TrilingualNames, string> = {
    nameEn: t('mobile.production.workflow.nameEn'),
    nameAr: t('mobile.production.workflow.nameAr'),
    nameHe: t('mobile.production.workflow.nameHe'),
  };

  const usedCodes = useMemo(
    () => new Set(version.nodes.map((n) => n.stageDefinition.code)),
    [version.nodes],
  );

  const availableStages = useMemo(
    () => (libraryQuery.data ?? []).filter((s) => s.isActive && !usedCodes.has(s.code)),
    [libraryQuery.data, usedCodes],
  );

  const sortedNodes = useMemo(
    () => [...version.nodes].sort((a, b) => a.sortOrder - b.sortOrder),
    [version.nodes],
  );

  const nodeSort = useMemo(
    () => sortedNodes.map((n) => ({ id: n.id, sortOrder: n.sortOrder })),
    [sortedNodes],
  );

  const sinkId = useMemo(
    () => resolveSinkId(nodeSort, version.edges),
    [nodeSort, version.edges],
  );

  const validRunIds = useMemo(
    () =>
      new Set(
        validRunsAfterCandidates(
          nodeSort,
          version.edges,
          '__new__',
          runsAfterIds,
          leadsIntoIds,
        ),
      ),
    [nodeSort, version.edges, runsAfterIds, leadsIntoIds],
  );

  const validLeadIds = useMemo(
    () =>
      new Set(
        validLeadsIntoCandidates(
          nodeSort,
          version.edges,
          '__new__',
          runsAfterIds,
          leadsIntoIds,
        ),
      ),
    [nodeSort, version.edges, runsAfterIds, leadsIntoIds],
  );

  const runsAfterOptions = useMemo(
    () => sortedNodes.filter((n) => validRunIds.has(n.id)),
    [sortedNodes, validRunIds],
  );
  const leadsIntoOptions = useMemo(
    () => sortedNodes.filter((n) => validLeadIds.has(n.id)),
    [sortedNodes, validLeadIds],
  );

  const selectedStage = availableStages.find((s) => s.id === stageId);

  const canSave =
    mode === 'pick'
      ? Boolean(selectedStage)
      : Boolean(names.nameEn.trim() && names.nameAr.trim() && names.nameHe.trim());

  const resolvedLeadsInto = useMemo(
    () =>
      resolveLeadsIntoForSave({
        nodes: nodeSort,
        edges: version.edges,
        targetId: '__new__',
        runsAfterIds,
        leadsIntoIds,
      }),
    [nodeSort, version.edges, runsAfterIds, leadsIntoIds],
  );

  const sinkNode = sinkId ? sortedNodes.find((n) => n.id === sinkId) : undefined;
  const sinkName = sinkNode
    ? localizedName(locale, sinkNode.stageDefinition, sinkNode.stageDefinition.code)
    : '';

  const becomingNewLast =
    Boolean(sinkId) &&
    runsAfterIds.includes(sinkId!) &&
    leadsIntoIds.length === 0 &&
    resolvedLeadsInto.length === 0;

  const willLeadIntoSink =
    leadsIntoIds.length === 1 && sinkId != null && leadsIntoIds[0] === sinkId;

  useEffect(() => {
    if (!open) return;
    savingRef.current = false;
    setSaving(false);
    setFormError(null);
    setMode('pick');
    setStageId('');
    setRequired(true);
    setNames({ nameEn: '', nameAr: '', nameHe: '' });
    const sink = resolveSinkId(
      sortedNodes.map((n) => ({ id: n.id, sortOrder: n.sortOrder })),
      version.edges,
    );
    // Append after the current last stage (start→finish). Mid-insert = change picks.
    setRunsAfterIds(sink ? [sink] : []);
    setLeadsIntoIds([]);
    // Seed only when the sheet opens — not when version refetches mid-edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // If Runs after includes the sink, this becomes the new end — clear Leads into.
  useEffect(() => {
    if (!sinkId || !runsAfterIds.includes(sinkId)) return;
    setLeadsIntoIds((ids) => (ids.length === 0 ? ids : []));
  }, [sinkId, runsAfterIds]);

  // Drop illegal picks when the other side changes.
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

  function reset() {
    savingRef.current = false;
    setMode('pick');
    setStageId('');
    setRequired(true);
    const sink = resolveSinkId(nodeSort, version.edges);
    setRunsAfterIds(sink ? [sink] : []);
    setLeadsIntoIds([]);
    setNames({ nameEn: '', nameAr: '', nameHe: '' });
    setSaving(false);
    setFormError(null);
  }

  async function onSave() {
    if (savingRef.current || saving) return;
    if (!canSave) {
      setFormError(t('mobile.production.workflow.pickStageFirst'));
      scrollRef.current?.scrollToEnd({ animated: true });
      void haptics.error();
      return;
    }
    if (wouldCreateCycle(version.edges, '__new__', runsAfterIds, resolvedLeadsInto)) {
      setFormError(t('mobile.production.workflow.invalidCycle'));
      scrollRef.current?.scrollToEnd({ animated: true });
      void haptics.error();
      return;
    }

    savingRef.current = true;
    setSaving(true);
    setFormError(null);
    Keyboard.dismiss();

    const versionSnapshot = version;
    const runsAfterSnapshot = [...runsAfterIds];
    const leadsIntoSnapshot = [...leadsIntoIds];
    const requiredSnapshot = required;
    const modeSnapshot = mode;
    const namesSnapshot = { ...names };
    const selectedSnapshot = selectedStage;

    try {
      const healed = await commitAddWorkflowStage({
        workflowId,
        version: versionSnapshot,
        stageDefinitionId: selectedSnapshot?.id ?? '',
        nodeKey: selectedSnapshot?.code ?? '',
        required: requiredSnapshot,
        runsAfterIds: runsAfterSnapshot,
        leadsIntoIds: leadsIntoSnapshot,
        createStage:
          modeSnapshot === 'create'
            ? {
                code: slugFromEnglishName(namesSnapshot.nameEn, 'STAGE'),
                nameEn: namesSnapshot.nameEn.trim(),
                nameAr: namesSnapshot.nameAr.trim(),
                nameHe: namesSnapshot.nameHe.trim(),
              }
            : undefined,
      });

      await applyCache(healed);
      onDirty?.();
      Keyboard.dismiss();
      onClose();
      void haptics.confirmLight();
      setTimeout(() => {
        showToast({
          variant: 'success',
          message: t('mobile.production.workflow.stageAdded'),
        });
      }, 220);
    } catch (err) {
      void haptics.error();
      setFormError(sheetErrorMessage(err, t));
      scrollRef.current?.scrollToEnd({ animated: true });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

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

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      onClosed={reset}
      title={t('mobile.production.workflow.addStage')}
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
        <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: theme.spacing.sm }}>
          <Segment
            active={mode === 'pick'}
            label={t('mobile.production.workflow.chooseExistingStage')}
            onPress={() => setMode('pick')}
          />
          <Segment
            active={mode === 'create'}
            label={t('mobile.production.workflow.createStage')}
            onPress={() => setMode('create')}
          />
        </View>

        {mode === 'pick' ? (
          libraryQuery.isLoading ? (
            <AppText color="muted">{t('mobile.production.loadingMore')}</AppText>
          ) : availableStages.length === 0 ? (
            <AppText color="muted">{t('mobile.production.workflow.emptyStages')}</AppText>
          ) : (
            <WorkflowFloorBoard
              title={t('mobile.production.workflow.stageName')}
              count={availableStages.length}
            >
              {availableStages.map((stage) => (
                <WorkflowCompactPickRow
                  key={stage.id}
                  label={localizedName(locale, stage, stage.code)}
                  active={stageId === stage.id}
                  onPress={() => {
                    void haptics.selection();
                    setStageId(stage.id);
                  }}
                />
              ))}
            </WorkflowFloorBoard>
          )
        ) : (
          <View style={{ gap: theme.spacing.md }}>
            {fieldOrder.map((key) => (
              <TextField
                key={key}
                label={nameLabels[key]}
                value={names[key]}
                onChangeText={(v) => setNames((n) => ({ ...n, [key]: v }))}
                autoCapitalize={key === 'nameEn' ? 'words' : 'none'}
              />
            ))}
          </View>
        )}

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

        {sortedNodes.length > 0 ? (
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
                {runsAfterOptions.map((node) => (
                  <WorkflowCompactPickRow
                    key={`p-${node.id}`}
                    label={localizedName(
                      locale,
                      node.stageDefinition,
                      node.stageDefinition.code,
                    )}
                    active={runsAfterIds.includes(node.id)}
                    onPress={() => {
                      void haptics.selection();
                      setRunsAfterIds((ids) => toggleId(ids, node.id));
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
                {leadsIntoOptions.map((node) => (
                  <WorkflowCompactPickRow
                    key={`s-${node.id}`}
                    label={localizedName(
                      locale,
                      node.stageDefinition,
                      node.stageDefinition.code,
                    )}
                    active={leadsIntoIds.includes(node.id)}
                    onPress={() => {
                      void haptics.selection();
                      setLeadsIntoIds((ids) => toggleId(ids, node.id));
                    }}
                  />
                ))}
              </WorkflowFloorBoard>
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
          </View>
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

        {!canSave && mode === 'pick' ? (
          <AppText variant="caption" color="muted">
            {t('mobile.production.workflow.pickStageFirst')}
          </AppText>
        ) : null}

        <PrimaryButton
          label={t('mobile.production.workflow.addStage')}
          loading={saving}
          disabled={saving}
          onPress={() => void onSave()}
          style={{ borderRadius: theme.radius.xl }}
        />
      </ScrollView>
    </BottomSheet>
  );
}
