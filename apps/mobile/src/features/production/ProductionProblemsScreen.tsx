import { useState } from 'react';
import { RefreshControl, ScrollView, useWindowDimensions, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/api/queryKeys';
import {
  fetchProductionProblems,
  resolveTaskBlocker,
  type ProductionProblemStatus,
} from '@/api/modules/production';
import { uploadFile } from '@/api/modules/uploads';
import { AppText } from '@/components/AppText';
import { BackButton } from '@/components/BackButton';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { EmptyState } from '@/components/feedback/EmptyState';
import { TextField } from '@/components/forms/TextField';
import { AppScreen } from '@/components/layout/AppScreen';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { DealerBoard } from '@/features/dealers/components/DealerBoard';
import { DealerFormFooter } from '@/features/dealers/components/dealerSheetForm';
import { VoicePlaybackButton, VoiceRecorderBar } from '@/features/tasks/components/VoiceNoteControls';
import {
  ProblemPhotoBar,
  uploadProblemPhotos,
} from '@/features/tasks/components/ProblemPhotoBar';
import { ProblemPhotoGallery } from '@/features/tasks/components/ProblemPhotoGallery';
import {
  reportProblemSheetHeight,
  voiceUploadToastMessage,
} from '@/features/tasks/report-problem-sheet';
import { useToast } from '@/components/feedback/Toast';
import { useLocale } from '@/i18n';
import { AnimatedPressable, ListItemEnter, haptics } from '@/motion';
import { useSmartBack } from '@/navigation/useSmartBack';
import { useTheme } from '@/theme';
import type { Href } from 'expo-router';

export function ProductionProblemsScreen() {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const { height: windowH } = useWindowDimensions();
  const onBack = useSmartBack('/(app)/(admin)/(tabs)/production' as Href);
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const qc = useQueryClient();
  const { showToast } = useToast();
  const [status, setStatus] = useState<ProductionProblemStatus>('open');
  const [answerId, setAnswerId] = useState<string | null>(null);
  const [answerTaskId, setAnswerTaskId] = useState<string | null>(null);
  const [resolution, setResolution] = useState('');
  const [answerUri, setAnswerUri] = useState<string | null>(null);
  const [answerPhotoUris, setAnswerPhotoUris] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [answerHostYield, setAnswerHostYield] = useState(false);
  const query = useQuery({
    queryKey: queryKeys.production.problems(status),
    queryFn: () => fetchProductionProblems(status),
  });
  const rows = query.data?.data ?? [];
  const answering = rows.find((r) => r.id === answerId) ?? null;
  const sheetHeight = reportProblemSheetHeight(windowH);

  async function submitAnswer() {
    if (!answerId || !answerTaskId) return;
    setSaving(true);
    try {
      let resolutionVoiceDocumentId: string | undefined;
      let resolutionPhotoDocumentIds: string[] | undefined;
      if (answerUri) {
        const uploaded = await uploadFile({
          uri: answerUri,
          fileName: `answer-${answerId}.m4a`,
          mimeType: 'audio/m4a',
          category: `BLOCKER_VOICE:${answerTaskId}`,
          taskId: answerTaskId,
        });
        resolutionVoiceDocumentId = uploaded.document.id;
      }
      if (answerPhotoUris.length) {
        resolutionPhotoDocumentIds = await uploadProblemPhotos({
          uris: answerPhotoUris,
          taskId: answerTaskId,
          uploadFile,
        });
      }
      await resolveTaskBlocker(answerTaskId, answerId, {
        resolution,
        resolutionVoiceDocumentId,
        resolutionPhotoDocumentIds,
      });
      void haptics.confirmMedium();
      setAnswerId(null);
      setAnswerPhotoUris([]);
      void qc.invalidateQueries({ queryKey: queryKeys.production.all });
      void qc.invalidateQueries({ queryKey: queryKeys.tasks.all });
    } catch (error) {
      void haptics.error();
      showToast({
        variant: 'error',
        message: voiceUploadToastMessage(error, t('mobile.tasks.uploadFailed')),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppScreen edges={{ top: true, bottom: true }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: theme.spacing['3xl'], gap: theme.spacing.md }}
        refreshControl={
          <RefreshControl
            refreshing={Boolean(query.isRefetching)}
            onRefresh={() => void query.refetch()}
            tintColor={colors.brand}
          />
        }
      >
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: theme.spacing.sm,
          }}
        >
          <BackButton onPress={onBack} />
          <View style={{ flex: 1, alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
            <AppText variant="caption" weight="semibold" style={{ color: colors.brand }}>
              {t('mobile.tasks.problemsEyebrow')}
            </AppText>
            <AppText variant="largeTitle" weight={titleWeight}>
              {t('mobile.tasks.problemsTitle')}
            </AppText>
          </View>
        </View>

        <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: theme.spacing.sm }}>
          {(['open', 'answered', 'all'] as const).map((opt) => {
            const active = status === opt;
            return (
              <AnimatedPressable
                key={opt}
                variant="button"
                onPress={() => {
                  void haptics.selection();
                  setStatus(opt);
                }}
                style={{
                  flex: 1,
                  minHeight: 40,
                  borderRadius: theme.radius.lg,
                  borderWidth: 1,
                  borderColor: active ? colors.brand : colors.border,
                  backgroundColor: active ? colors.brandSoft : colors.surface,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <AppText variant="caption" weight={titleWeight}>
                  {opt === 'open'
                    ? t('mobile.tasks.problemsStatusOpen')
                    : opt === 'answered'
                      ? t('mobile.tasks.problemsStatusAnswered')
                      : t('mobile.tasks.problemsStatusAll')}
                </AppText>
              </AnimatedPressable>
            );
          })}
        </View>

        {rows.length === 0 ? (
          <EmptyState title={t('mobile.tasks.problemsTitle')} description={t('mobile.tasks.emptyBody')} />
        ) : (
          rows.map((row, index) => {
            const answered = Boolean(row.resolution);
            const rail =
              row.category === 'MATERIAL_MISSING' ||
              row.category === 'MATERIAL_DEFECT' ||
              row.category === 'SAFETY'
                ? colors.error
                : answered
                  ? colors.brand
                  : colors.warning;
            return (
              <ListItemEnter key={row.id} index={index}>
                <DealerBoard
                  title={row.order?.number ?? row.task.name}
                  titleWeight={titleWeight}
                  accentColor={rail}
                  trailing={
                    <StatusBadge
                      status={answered ? 'RESOLVED' : 'OPEN'}
                      label={
                        answered
                          ? t('mobile.tasks.problemsStatusAnswered')
                          : t('mobile.tasks.problemsStatusOpen')
                      }
                      variant={answered ? 'success' : 'error'}
                      dot
                    />
                  }
                >
                  <AppText variant="caption" color="secondary">
                    {t(`mobile.tasks.blocker.${row.category}` as never)}
                  </AppText>
                  <AppText variant="body">{row.reason}</AppText>
                  <VoicePlaybackButton documentId={row.voiceDocumentId} />
                  <ProblemPhotoGallery
                    documentIds={row.photoDocumentIds}
                    title={t('mobile.tasks.workerProblemPhotos')}
                  />
                  <AppText variant="caption" color="muted" style={{ writingDirection: 'ltr' }}>
                    {row.elapsedMinutes}m · {row.worker?.name ?? ''}
                  </AppText>
                  {answered ? (
                    <View style={{ gap: 4 }}>
                      <AppText variant="caption" color="secondary">
                        {row.resolution}
                      </AppText>
                      <VoicePlaybackButton documentId={row.resolutionVoiceDocumentId} />
                      <ProblemPhotoGallery
                        documentIds={row.resolutionPhotoDocumentIds}
                        title={t('mobile.tasks.answerPhotos')}
                      />
                    </View>
                  ) : (
                    <PrimaryButton
                      label={t('mobile.tasks.answerProblem')}
                      onPress={() => {
                        void haptics.selection();
                        setAnswerId(row.id);
                        setAnswerTaskId(row.taskId);
                        setResolution('');
                        setAnswerUri(null);
                        setAnswerPhotoUris([]);
                      }}
                    />
                  )}
                </DealerBoard>
              </ListItemEnter>
            );
          })
        )}
      </ScrollView>

      <BottomSheet
        open={Boolean(answering) && !answerHostYield}
        onClose={() => {
          setAnswerId(null);
          setAnswerPhotoUris([]);
          setAnswerUri(null);
          setAnswerHostYield(false);
        }}
        title={t('mobile.tasks.answerProblem')}
        overlay
        expandable
        sheetHeight={sheetHeight}
      >
        <View style={{ flex: 1, minHeight: 0 }}>
          <ScrollView
            style={{ flex: 1, minHeight: 0 }}
            contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: theme.spacing.sm }}
            keyboardShouldPersistTaps="handled"
          >
            <AppText variant="body">{answering?.reason}</AppText>
            {answering?.voiceDocumentId ? (
              <VoicePlaybackButton documentId={answering.voiceDocumentId} />
            ) : null}
            <ProblemPhotoGallery
              documentIds={answering?.photoDocumentIds}
              title={t('mobile.tasks.workerProblemPhotos')}
            />
            <TextField
              label={t('mobile.tasks.answerProblem')}
              value={resolution}
              onChangeText={setResolution}
              multiline
            />
            <VoiceRecorderBar uri={answerUri} onUri={setAnswerUri} />
            <ProblemPhotoBar
              uris={answerPhotoUris}
              onUris={setAnswerPhotoUris}
              onHostYieldChange={setAnswerHostYield}
            />
          </ScrollView>
          <DealerFormFooter
            confirmLabel={t('mobile.tasks.answerProblem')}
            onConfirm={() => void submitAnswer()}
            onCancel={() => {
              setAnswerId(null);
              setAnswerHostYield(false);
            }}
            loading={saving}
          />
        </View>
      </BottomSheet>
    </AppScreen>
  );
}
