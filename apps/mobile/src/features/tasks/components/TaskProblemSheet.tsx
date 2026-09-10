import { ScrollView, useWindowDimensions, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { DealerBoard } from '@/features/dealers/components/DealerBoard';
import { DealerFormFooter } from '@/features/dealers/components/dealerSheetForm';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import { reportProblemSheetHeight } from '../report-problem-sheet';
import type { TaskProblem } from '../selectTask';
import { VoicePlaybackButton } from './VoiceNoteControls';
import { ProblemPhotoGallery } from './ProblemPhotoGallery';

export function TaskProblemSheet({
  problem,
  onClose,
}: {
  problem: TaskProblem | null;
  onClose: () => void;
}) {
  const { t, isRTL, locale, formatDateTime } = useLocale();
  const { colors, theme } = useTheme();
  const { height: windowH } = useWindowDimensions();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const sheetHeight = reportProblemSheetHeight(windowH);
  const categoryKey = problem ? `mobile.tasks.blocker.${problem.category}` : '';
  const categoryLabel = problem ? t(categoryKey as never) : '';

  return (
    <BottomSheet
      open={Boolean(problem)}
      onClose={onClose}
      title={t('mobile.tasks.problemDetailTitle')}
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
          {problem ? (
            <>
              <DealerBoard
                title={
                  categoryLabel === categoryKey ? problem.category : categoryLabel
                }
                titleWeight={titleWeight}
                accentColor={problem.answered ? colors.brand : colors.error}
                trailing={
                  <StatusBadge
                    status={problem.answered ? 'RESOLVED' : 'OPEN'}
                    label={
                      problem.answered
                        ? t('mobile.tasks.problemsStatusAnswered')
                        : t('mobile.tasks.problemsStatusOpen')
                    }
                    variant={problem.answered ? 'success' : 'error'}
                    dot
                  />
                }
              >
                {problem.createdAt ? (
                  <AppText variant="caption" color="muted" dir="ltr">
                    {formatDateTime(problem.createdAt)}
                  </AppText>
                ) : null}
                <AppText
                  variant="body"
                  style={{ textAlign: isRTL ? 'right' : 'left' }}
                >
                  {problem.reason}
                </AppText>
                {problem.voiceDocumentId ? (
                  <View style={{ gap: theme.spacing.xs }}>
                    <AppText variant="caption" color="secondary">
                      {t('mobile.tasks.workerVoiceNote')}
                    </AppText>
                    <VoicePlaybackButton documentId={problem.voiceDocumentId} />
                  </View>
                ) : null}
                <ProblemPhotoGallery
                  documentIds={problem.photoDocumentIds}
                  title={t('mobile.tasks.workerProblemPhotos')}
                />
              </DealerBoard>

              {problem.answered ? (
                <View
                  style={{
                    borderRadius: theme.radius.lg,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.surfaceSecondary,
                    padding: theme.spacing.md,
                    gap: theme.spacing.sm,
                    ...(isRTL
                      ? { paddingRight: theme.spacing.md + 4 }
                      : { paddingLeft: theme.spacing.md + 4 }),
                  }}
                >
                  <AppText variant="caption" weight={titleWeight} color="brand">
                    {t('mobile.tasks.answerFromSupervisor')}
                  </AppText>
                  {problem.resolution ? (
                    <AppText
                      variant="body"
                      style={{ textAlign: isRTL ? 'right' : 'left' }}
                    >
                      {problem.resolution}
                    </AppText>
                  ) : null}
                  {problem.resolutionVoiceDocumentId ? (
                    <View style={{ gap: theme.spacing.xs }}>
                      <AppText variant="caption" color="secondary">
                        {t('mobile.tasks.answerVoiceNote')}
                      </AppText>
                      <VoicePlaybackButton
                        documentId={problem.resolutionVoiceDocumentId}
                      />
                    </View>
                  ) : null}
                  <ProblemPhotoGallery
                    documentIds={problem.resolutionPhotoDocumentIds}
                    title={t('mobile.tasks.answerPhotos')}
                  />
                </View>
              ) : (
                <AppText
                  variant="body"
                  color="muted"
                  style={{ textAlign: isRTL ? 'right' : 'left' }}
                >
                  {t('mobile.tasks.problemAwaitingAnswer')}
                </AppText>
              )}
            </>
          ) : null}
        </ScrollView>
        <DealerFormFooter
          confirmLabel={t('mobile.tasks.back')}
          onConfirm={onClose}
          onCancel={onClose}
        />
      </View>
    </BottomSheet>
  );
}
