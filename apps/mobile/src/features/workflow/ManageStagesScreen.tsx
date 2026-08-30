import { useMemo, useRef, useState } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import { type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { localizedName } from '@maher/i18n';
import { can, canAny } from '@maher/permissions';
import {
  isLockedAnchorStageCode,
  OPENING_STAGE_CODE,
  TERMINAL_STAGE_CODES,
} from '@maher/types';
import { isApiError } from '@/api/errors';
import { toastMessageForError } from '@/api/queryClient';
import {
  createStageDefinition,
  deleteStageDefinition,
  updateStageDefinition,
  type StageDefinition,
} from '@/api/modules/workflow';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { useToast } from '@/components/feedback/Toast';
import { TextField } from '@/components/forms/TextField';
import { ScrollableScreen } from '@/components/layout/ScrollableScreen';
import { useNetwork } from '@/components/network/NetworkProvider';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { ConfirmationSheet } from '@/components/sheets/ConfirmationSheet';
import { DealerFormSection } from '@/features/dealers/components/dealerSheetForm';
import { useLocale } from '@/i18n';
import { haptics } from '@/motion';
import { useTheme } from '@/theme';
import {
  StageQuietDelete,
  StageScheduleModePicker,
  StageSlotStepper,
  StageToggleRow,
} from './components/StageEditorFields';
import { StageLibraryCard, StageLibrarySection } from './components/StageLibraryCard';
import { WorkflowPageHeader } from './components/WorkflowPageHeader';
import { useStageLibraryQuery } from './query';
import { nameFieldOrder, type TrilingualNames } from './trilingualNames';

const LIST_BACK = '/(app)/(admin)/production/workflow' as Href;

type EditorMode = 'create' | 'edit';

type Draft = TrilingualNames & {
  hours: string;
  requiresInspection: boolean;
  requiresPhotos: boolean;
  schedulingResourceMode: 'WORKER_CONSTRAINED' | 'RESOURCE_CONSTRAINED';
  resourceSlots: string;
};

const emptyDraft = (): Draft => ({
  nameEn: '',
  nameAr: '',
  nameHe: '',
  hours: '',
  requiresInspection: false,
  requiresPhotos: false,
  schedulingResourceMode: 'WORKER_CONSTRAINED',
  resourceSlots: '1',
});

function draftFromRow(row: StageDefinition): Draft {
  return {
    nameEn: row.nameEn,
    nameAr: row.nameAr,
    nameHe: row.nameHe ?? '',
    hours: row.estimatedHours != null ? String(row.estimatedHours) : '',
    requiresInspection: Boolean(row.requiresInspection),
    requiresPhotos: Boolean(row.requiresPhotos),
    schedulingResourceMode: row.schedulingResourceMode ?? 'WORKER_CONSTRAINED',
    resourceSlots: String(row.resourceSlots ?? 1),
  };
}

export function ManageStagesScreen() {
  const { user } = useAuth();
  const { t, locale } = useLocale();
  const { theme, colors } = useTheme();
  const { showOfflineBanner } = useNetwork();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  const { height: windowH } = useWindowDimensions();
  const allowed = canAny(user, ['production.workflow.read', 'production-order.update']);
  const canManage = can(user, 'production.workflow.manage');
  const libraryQuery = useStageLibraryQuery(allowed);

  const [query, setQuery] = useState('');
  const [editor, setEditor] = useState<{ mode: EditorMode; row?: StageDefinition } | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [deleteTarget, setDeleteTarget] = useState<StageDefinition | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const editorScrollRef = useRef<ScrollView>(null);

  const fieldOrder = nameFieldOrder(locale);
  const nameLabels: Record<keyof TrilingualNames, string> = {
    nameEn: t('mobile.production.workflow.nameEn'),
    nameAr: t('mobile.production.workflow.nameAr'),
    nameHe: t('mobile.production.workflow.nameHe'),
  };
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  const activeRows = useMemo(() => {
    const rows = (libraryQuery.data ?? []).filter((row) => row.isActive);
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const name = localizedName(locale, row, row.code).toLowerCase();
      return name.includes(q) || row.code.toLowerCase().includes(q);
    });
  }, [libraryQuery.data, locale, query]);

  const opening = activeRows.find((row) => row.code === OPENING_STAGE_CODE) ?? null;
  const finishing = TERMINAL_STAGE_CODES.map(
    (code) => activeRows.find((row) => row.code === code) ?? null,
  );
  const production = activeRows.filter((row) => !isLockedAnchorStageCode(row.code));

  if (!allowed) return null;

  const lockedEditor = editor?.row ? isLockedAnchorStageCode(editor.row.code) : false;

  function openCreate() {
    setDraft(emptyDraft());
    setEditor({ mode: 'create' });
  }

  function openEdit(row: StageDefinition) {
    setDraft(draftFromRow(row));
    setEditor({ mode: 'edit', row });
  }

  async function saveEditor() {
    if (!canManage || saving) return;
    if (!lockedEditor && (!draft.nameEn.trim() || !draft.nameAr.trim())) {
      showToast({
        variant: 'error',
        message: t('mobile.production.workflow.namesRequired'),
      });
      return;
    }
    const hours = draft.hours.trim() ? Number(draft.hours) : undefined;
    setSaving(true);
    try {
      const settings = {
        estimatedHours: Number.isFinite(hours) ? hours : undefined,
        requiresInspection: draft.requiresInspection,
        requiresPhotos: draft.requiresPhotos,
        schedulingResourceMode: draft.schedulingResourceMode,
        resourceSlots:
          draft.schedulingResourceMode === 'RESOURCE_CONSTRAINED'
            ? Number(draft.resourceSlots) || 1
            : 1,
      };
      if (editor?.mode === 'create') {
        await createStageDefinition({
          nameEn: draft.nameEn.trim(),
          nameAr: draft.nameAr.trim(),
          nameHe: draft.nameHe.trim() || undefined,
          ...settings,
        });
      } else if (editor?.row) {
        await updateStageDefinition(
          editor.row.id,
          lockedEditor
            ? {
                ...settings,
                estimatedHours: Number.isFinite(hours) ? hours! : null,
              }
            : {
                nameEn: draft.nameEn.trim(),
                nameAr: draft.nameAr.trim(),
                nameHe: draft.nameHe.trim() || null,
                ...settings,
                estimatedHours: Number.isFinite(hours) ? hours! : null,
              },
        );
      }
      await libraryQuery.refetch();
      setEditor(null);
      void haptics.confirmLight();
      showToast({
        variant: 'success',
        message: t('mobile.production.workflow.stageUpdated'),
      });
    } catch (err) {
      void haptics.error();
      showToast({
        variant: 'error',
        message: isApiError(err) ? toastMessageForError(err) : t('mobile.production.workflow.loadError'),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <ScrollableScreen>
        {showOfflineBanner ? <OfflineBanner /> : null}

        <WorkflowPageHeader
          fallback={LIST_BACK}
          title={t('mobile.production.workflow.manageStages')}
          subtitle={t('mobile.production.workflow.manageStagesSubtitle')}
        />

        <TextField
          value={query}
          onChangeText={setQuery}
          placeholder={t('mobile.production.workflow.searchStages')}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />

        {canManage ? (
          <PrimaryButton
            label={t('mobile.production.workflow.createStage')}
            onPress={openCreate}
            leading={<Ionicons name="add" size={18} color={colors.onBrand} />}
            style={{ borderRadius: theme.radius.xl }}
          />
        ) : null}

        {libraryQuery.isLoading ? (
          <AppText color="secondary">{t('mobile.production.loadingMore')}</AppText>
        ) : libraryQuery.isError ? (
          <ErrorState
            title={t('mobile.production.workflow.loadError')}
            description={t('mobile.production.workflow.retry')}
            retryLabel={t('mobile.production.workflow.retry')}
            onRetry={() => void libraryQuery.refetch()}
          />
        ) : activeRows.length === 0 ? (
          <EmptyState title={t('mobile.production.workflow.noStagesMatch')} />
        ) : (
          <View style={{ gap: theme.spacing['2xl'] }}>
            {opening ? (
              <StageLibrarySection
                title={t('mobile.production.workflow.openingSection')}
                hint={t('mobile.production.workflow.openingHint')}
              >
                <StageLibraryCard
                  row={opening}
                  locked
                  caption={t('mobile.production.workflow.alwaysFirst')}
                  index={0}
                  onPress={() => openEdit(opening)}
                />
              </StageLibrarySection>
            ) : null}

            <StageLibrarySection title={t('mobile.production.workflow.productionSection')}>
              {production.length === 0 ? (
                <AppText variant="caption" color="muted">
                  {t('mobile.production.workflow.noStagesMatch')}
                </AppText>
              ) : (
                production.map((row, index) => (
                  <StageLibraryCard
                    key={row.id}
                    row={row}
                    index={index}
                    onPress={() => openEdit(row)}
                  />
                ))
              )}
            </StageLibrarySection>

            {finishing.some(Boolean) ? (
              <StageLibrarySection title={t('mobile.production.workflow.finishingSection')}>
                {finishing.map((row, index) =>
                  row ? (
                    <StageLibraryCard
                      key={row.id}
                      row={row}
                      locked
                      index={index}
                      onPress={() => openEdit(row)}
                    />
                  ) : null,
                )}
              </StageLibrarySection>
            ) : null}
          </View>
        )}
      </ScrollableScreen>

      <BottomSheet
        open={Boolean(editor)}
        onClose={() => {
          if (saving) return;
          setEditor(null);
        }}
        title={
          editor?.mode === 'create'
            ? t('mobile.production.workflow.createStage')
            : lockedEditor
              ? localizedName(locale, editor?.row ?? { nameEn: '', nameAr: '' }, '')
              : t('mobile.production.workflow.editStage')
        }
        fitContent
        maxHeight={Math.round(windowH * 0.92)}
      >
        <ScrollView
          ref={editorScrollRef}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            gap: theme.spacing.md,
            paddingBottom: insets.bottom + theme.spacing['3xl'],
          }}
        >
          {lockedEditor ? (
            <AppText variant="caption" color="muted">
              {t('mobile.production.workflow.cannotRenameLockedStage')}
            </AppText>
          ) : null}

          <DealerFormSection icon="language-outline" label={t('mobile.production.workflow.namesSection')} titleWeight={titleWeight}>
            <AppText variant="caption" color="secondary">
              {t('mobile.production.workflow.namesHint')}
            </AppText>
            {fieldOrder.map((key) => (
              <TextField
                key={key}
                label={
                  key === 'nameHe'
                    ? `${nameLabels[key]} (${t('mobile.production.workflow.hebrewOptional')})`
                    : nameLabels[key]
                }
                value={draft[key]}
                editable={!lockedEditor}
                onChangeText={(v) => setDraft((d) => ({ ...d, [key]: v }))}
                autoCapitalize={key === 'nameEn' ? 'words' : 'none'}
              />
            ))}
          </DealerFormSection>

          <DealerFormSection
            icon="time-outline"
            label={t('mobile.production.workflow.timeSection')}
            titleWeight={titleWeight}
          >
            <TextField
              label={t('mobile.production.workflow.typicalHours')}
              value={draft.hours}
              keyboardType="decimal-pad"
              placeholder="4"
              onChangeText={(v) => setDraft((d) => ({ ...d, hours: v }))}
            />
            <AppText variant="caption" color="muted">
              {t('mobile.production.workflow.durationHoursHint')}
            </AppText>
          </DealerFormSection>

          <DealerFormSection
            icon="checkmark-circle-outline"
            label={t('mobile.production.workflow.checksSection')}
            titleWeight={titleWeight}
          >
            <StageToggleRow
              icon="shield-checkmark-outline"
              label={t('mobile.production.workflow.requiresInspection')}
              hint={t('mobile.production.workflow.requiresInspectionHint')}
              value={draft.requiresInspection}
              onChange={(v) => setDraft((d) => ({ ...d, requiresInspection: v }))}
            />
            <StageToggleRow
              icon="camera-outline"
              label={t('mobile.production.workflow.requiresPhotos')}
              hint={t('mobile.production.workflow.requiresPhotosHint')}
              value={draft.requiresPhotos}
              onChange={(v) => setDraft((d) => ({ ...d, requiresPhotos: v }))}
            />
          </DealerFormSection>

          <DealerFormSection
            icon="calendar-outline"
            label={t('mobile.production.workflow.schedulingSection')}
            titleWeight={titleWeight}
          >
            <AppText variant="caption" color="secondary">
              {t('mobile.production.workflow.howScheduled')}
            </AppText>
            <StageScheduleModePicker
              value={draft.schedulingResourceMode}
              onChange={(mode) => {
                setDraft((d) => ({ ...d, schedulingResourceMode: mode }));
                if (mode === 'RESOURCE_CONSTRAINED') {
                  requestAnimationFrame(() =>
                    editorScrollRef.current?.scrollToEnd({ animated: true }),
                  );
                }
              }}
            />
            {draft.schedulingResourceMode === 'RESOURCE_CONSTRAINED' ? (
              <StageSlotStepper
                value={draft.resourceSlots}
                onChange={(v) => setDraft((d) => ({ ...d, resourceSlots: v }))}
              />
            ) : (
              <AppText variant="caption" color="muted">
                {t('mobile.production.workflow.scheduleByWorkersNote')}
              </AppText>
            )}
          </DealerFormSection>

          {canManage ? (
            <View style={{ gap: theme.spacing.xs, paddingTop: theme.spacing.sm }}>
              <PrimaryButton
                label={
                  editor?.mode === 'create'
                    ? t('mobile.production.workflow.createStage')
                    : t('common.save')
                }
                loading={saving}
                disabled={
                  saving ||
                  (!lockedEditor && (!draft.nameEn.trim() || !draft.nameAr.trim()))
                }
                onPress={() => void saveEditor()}
                style={{ borderRadius: theme.radius.full }}
              />
              {editor?.mode === 'edit' && editor.row && !lockedEditor ? (
                <StageQuietDelete
                  label={t('mobile.production.workflow.deleteStage')}
                  disabled={saving || deleting}
                  onPress={() => setDeleteTarget(editor.row!)}
                />
              ) : null}
            </View>
          ) : null}
        </ScrollView>
      </BottomSheet>

      <ConfirmationSheet
        open={Boolean(deleteTarget)}
        onClose={() => {
          if (deleting) return;
          setDeleteTarget(null);
        }}
        title={t('mobile.production.workflow.deleteStage')}
        message={t('mobile.production.workflow.deleteStageConfirm', {
          name: deleteTarget ? localizedName(locale, deleteTarget, deleteTarget.code) : '',
        })}
        confirmLabel={t('mobile.production.workflow.deleteStage')}
        destructive
        onConfirm={() => {
          if (!deleteTarget || deleting) return;
          const id = deleteTarget.id;
          setDeleting(true);
          void (async () => {
            try {
              await deleteStageDefinition(id);
              await libraryQuery.refetch();
              setDeleteTarget(null);
              setEditor(null);
              void haptics.confirmLight();
              showToast({
                variant: 'success',
                message: t('mobile.production.workflow.stageDeleted'),
              });
            } catch (err) {
              void haptics.error();
              showToast({
                variant: 'error',
                message: isApiError(err)
                  ? toastMessageForError(err)
                  : t('mobile.production.workflow.loadError'),
              });
            } finally {
              setDeleting(false);
            }
          })();
        }}
      />
    </>
  );
}
