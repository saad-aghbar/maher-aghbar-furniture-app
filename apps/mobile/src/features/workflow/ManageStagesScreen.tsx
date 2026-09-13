import { useMemo, useRef, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { localizedName } from '@maher/i18n';
import { can, canAny } from '@maher/permissions';
import {
  isLockedAnchorStageCode,
  isProtectedStageCode,
  isRecoveryStageCode,
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
import { ErrorState } from '@/components/feedback/ErrorState';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { useToast } from '@/components/feedback/Toast';
import { AppTextInput } from '@/components/forms/AppTextInput';
import { SearchBarShell } from '@/components/forms/SearchBarShell';
import { TextField } from '@/components/forms/TextField';
import { ScrollableScreen } from '@/components/layout/ScrollableScreen';
import { useNetwork } from '@/components/network/NetworkProvider';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { ConfirmationSheet } from '@/components/sheets/ConfirmationSheet';
import { DealerEmptyPanel } from '@/features/dealers/components/DealerEmptyPanel';
import {
  DealerFormFooter,
  DealerFormSection,
} from '@/features/dealers/components/dealerSheetForm';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { LocaleNameField } from '@/features/catalog/components/BilingualNameField';
import { useLocale } from '@/i18n';
import { resolveTrilingualIfChanged, resolveTrilingualName } from '@/i18n/resolveTrilingualName';
import { AnimatedPressable, haptics } from '@/motion';
import { resolveAppFontStyle, useTheme } from '@/theme';
import {
  StageQuietDelete,
  StageScheduleModePicker,
  StageSlotStepper,
  StageToggleRow,
} from './components/StageEditorFields';
import { StageLibraryCard, StageLibrarySection } from './components/StageLibraryCard';
import { WorkflowPageHeader } from './components/WorkflowPageHeader';
import { useStageLibraryQuery } from './query';

const LIST_BACK = '/(app)/(admin)/production/workflow' as Href;

type EditorMode = 'create' | 'edit';

type Draft = {
  name: string;
  originalName: string;
  nameEn: string;
  nameAr: string;
  nameHe: string;
  hours: string;
  requiresInspection: boolean;
  requiresPhotos: boolean;
  schedulingResourceMode: 'WORKER_CONSTRAINED' | 'RESOURCE_CONSTRAINED';
  resourceSlots: string;
};

const emptyDraft = (): Draft => ({
  name: '',
  originalName: '',
  nameEn: '',
  nameAr: '',
  nameHe: '',
  hours: '',
  requiresInspection: false,
  requiresPhotos: false,
  schedulingResourceMode: 'WORKER_CONSTRAINED',
  resourceSlots: '1',
});

function draftFromRow(row: StageDefinition, locale: string): Draft {
  const shown = localizedName(locale, row, '');
  return {
    name: shown,
    originalName: shown,
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
  const { t, locale, isRTL } = useLocale();
  const { theme, colors, colorScheme } = useTheme();
  const { showOfflineBanner } = useNetwork();
  const { showToast } = useToast();
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
  const recovery = activeRows.find((row) => isRecoveryStageCode(row.code)) ?? null;
  const production = activeRows.filter(
    (row) => !isLockedAnchorStageCode(row.code) && !isRecoveryStageCode(row.code),
  );

  if (!allowed) return null;

  const lockedEditor = editor?.row ? isProtectedStageCode(editor.row.code) : false;

  function openCreate() {
    setDraft(emptyDraft());
    setEditor({ mode: 'create' });
  }

  function openEdit(row: StageDefinition) {
    setDraft(draftFromRow(row, locale));
    setEditor({ mode: 'edit', row });
  }

  async function saveEditor() {
    if (!canManage || saving) return;
    if (!lockedEditor && !draft.name.trim()) {
      showToast({
        variant: 'error',
        message: t('catalog.namesRequired'),
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
        const names = await resolveTrilingualName(draft.name, locale);
        await createStageDefinition({
          nameEn: names.nameEn,
          nameAr: names.nameAr,
          nameHe: names.nameHe || undefined,
          ...settings,
        });
      } else if (editor?.row) {
        const names = lockedEditor
          ? null
          : await resolveTrilingualIfChanged({
              typed: draft.name,
              locale,
              original: draft.originalName,
              existing: {
                nameEn: draft.nameEn,
                nameAr: draft.nameAr,
                nameHe: draft.nameHe,
              },
            });
        await updateStageDefinition(
          editor.row.id,
          lockedEditor
            ? {
                ...settings,
                estimatedHours: Number.isFinite(hours) ? hours! : null,
              }
            : {
                nameEn: names!.nameEn,
                nameAr: names!.nameAr,
                nameHe: names!.nameHe || null,
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
      <ScrollableScreen
        scrollProps={{
          refreshControl: (
            <RefreshControl
              refreshing={libraryQuery.isRefetching && !libraryQuery.isLoading}
              onRefresh={() => void libraryQuery.refetch()}
              tintColor={colors.brand}
            />
          ),
        }}
      >
        {showOfflineBanner ? <OfflineBanner /> : null}

        <WorkflowPageHeader
          fallback={LIST_BACK}
          title={t('mobile.production.workflow.manageStages')}
          subtitle={t('mobile.production.workflow.manageStagesSubtitle')}
        />

        {canManage ? (
          <AnimatedPressable
            variant="button"
            accessibilityRole="button"
            accessibilityLabel={t('mobile.production.workflow.createStage')}
            onPress={() => {
              void haptics.selection();
              openCreate();
            }}
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: theme.spacing.sm,
              minHeight: theme.sizes.touch.min,
              borderRadius: theme.radius.full,
              backgroundColor: colors.brand,
            }}
          >
            <Ionicons name="add" size={18} color={colors.onBrand} />
            <AppText color="onBrand" weight={titleWeight}>
              {t('mobile.production.workflow.createStage')}
            </AppText>
          </AnimatedPressable>
        ) : null}

        <View
          style={{
            borderRadius: theme.radius.xl,
            borderWidth: 1,
            borderColor: colors.borderStrong,
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
              width: 3,
              backgroundColor: colors.brand,
              opacity: 0.55,
              ...(isRTL ? { right: 0 } : { left: 0 }),
            }}
          />
          <View
            style={{
              padding: theme.spacing.md,
              ...(isRTL
                ? { paddingRight: theme.spacing.md + 4 }
                : { paddingLeft: theme.spacing.md + 4 }),
            }}
          >
            <SearchBarShell>
              <AppTextInput
                value={query}
                onChangeText={setQuery}
                placeholder={t('mobile.production.workflow.searchStages')}
                placeholderTextColor={colors.textMuted}
                style={[
                  styles.searchInput,
                  {
                    color: colors.textPrimary,
                    textAlign: isRTL ? 'right' : 'left',
                    writingDirection: isRTL ? 'rtl' : 'ltr',
                  },
                  resolveAppFontStyle(locale, { variant: 'body' }),
                ]}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                clearButtonMode="while-editing"
              />
            </SearchBarShell>
          </View>
        </View>

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
          <DealerEmptyPanel
            icon="layers-outline"
            text={t('mobile.production.workflow.noStagesMatch')}
          />
        ) : (
          <View style={{ gap: theme.spacing.xl }}>
            {opening ? (
              <View style={{ gap: theme.spacing.md }}>
                <StageLibrarySection
                  title={t('mobile.production.workflow.openingSection')}
                  hint={t('mobile.production.workflow.openingHint')}
                  count={1}
                />
                <StageLibraryCard
                  row={opening}
                  locked
                  caption={t('mobile.production.workflow.alwaysFirst')}
                  index={0}
                  onPress={() => openEdit(opening)}
                />
              </View>
            ) : null}

            {recovery ? (
              <View style={{ gap: theme.spacing.md }}>
                <StageLibrarySection
                  title={t('mobile.production.workflow.recoverySection')}
                  hint={t('mobile.production.workflow.recoveryHint')}
                  count={1}
                />
                <StageLibraryCard
                  row={recovery}
                  locked
                  caption={t('mobile.production.workflow.alwaysAvailable')}
                  index={0}
                  onPress={() => openEdit(recovery)}
                />
              </View>
            ) : null}

            <View style={{ gap: theme.spacing.md }}>
              <StageLibrarySection
                title={t('mobile.production.workflow.productionSection')}
                hint={t('mobile.production.workflow.productionHint')}
                count={production.length}
              />
              {production.length === 0 ? (
                <DealerEmptyPanel
                  icon="construct-outline"
                  text={t('mobile.production.workflow.noStagesMatch')}
                />
              ) : (
                production.map((row, index) => (
                  <StageLibraryCard
                    key={row.id}
                    row={row}
                    index={index + 1}
                    onPress={() => openEdit(row)}
                  />
                ))
              )}
            </View>

            {finishing.some(Boolean) ? (
              <View style={{ gap: theme.spacing.md }}>
                <StageLibrarySection
                  title={t('mobile.production.workflow.finishingSection')}
                  hint={t('mobile.production.workflow.finishingHint')}
                  count={finishing.filter(Boolean).length}
                />
                {finishing.map((row, index) =>
                  row ? (
                    <StageLibraryCard
                      key={row.id}
                      row={row}
                      locked
                      index={index + 1 + production.length}
                      onPress={() => openEdit(row)}
                    />
                  ) : null,
                )}
              </View>
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
            paddingBottom: theme.spacing.md,
          }}
        >
          {lockedEditor ? (
            <AppText variant="caption" color="muted">
              {t('mobile.production.workflow.cannotRenameLockedStage')}
            </AppText>
          ) : null}

          <DealerFormSection icon="language-outline" label={t('mobile.production.workflow.namesSection')} titleWeight={titleWeight}>
            <LocaleNameField
              value={draft.name}
              onChange={(v) => setDraft((d) => ({ ...d, name: v }))}
              label={t('mobile.production.workflow.stageName')}
              editable={!lockedEditor}
              autoCapitalize="words"
            />
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

          {canManage && editor?.mode === 'edit' && editor.row && !lockedEditor ? (
            <StageQuietDelete
              label={t('mobile.production.workflow.deleteStage')}
              disabled={saving || deleting}
              onPress={() => setDeleteTarget(editor.row!)}
            />
          ) : null}
        </ScrollView>
        {canManage ? (
          <DealerFormFooter
            confirmLabel={
              editor?.mode === 'create'
                ? t('mobile.production.workflow.createStage')
                : t('common.save')
            }
            onConfirm={() => void saveEditor()}
            onCancel={() => {
              if (saving) return;
              setEditor(null);
            }}
            loading={saving}
            disabled={
              saving ||
              (!lockedEditor && !draft.name.trim())
            }
          />
        ) : null}
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

const styles = StyleSheet.create({
  searchInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 16,
    paddingVertical: 0,
  },
});
