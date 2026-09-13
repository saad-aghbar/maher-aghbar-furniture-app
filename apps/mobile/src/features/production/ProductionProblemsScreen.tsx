import { useState } from 'react';
import { RefreshControl, ScrollView, useWindowDimensions, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter, type Href } from 'expo-router';
import { queryKeys } from '@/api/queryKeys';
import {
  resolveTaskBlocker,
  type ProductionProblemStatus,
} from '@/api/modules/production';
import { uploadFile } from '@/api/modules/uploads';
import { AppText } from '@/components/AppText';
import { ErrorState } from '@/components/feedback/ErrorState';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { TextField } from '@/components/forms/TextField';
import { AppScreen } from '@/components/layout/AppScreen';
import { ScreenBackLead } from '@/components/layout/ScreenBackLead';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { DealerEmptyPanel } from '@/features/dealers/components/DealerEmptyPanel';
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
import { useNetwork } from '@/components/network/NetworkProvider';
import { useLocale } from '@/i18n';
import { ListItemEnter, haptics } from '@/motion';
import { useTheme } from '@/theme';
import { ProductionListSkeleton } from './components/ProductionSkeleton';
import { ProductionProblemTicket } from './components/ProductionProblemTicket';
import { ProductionProblemsTouchBar } from './components/ProductionProblemsTouchBar';
import { useProductionProblemsQuery } from './query';

const BACK: Href = '/(app)/(admin)/(tabs)/production';

function emptyCopy(
  status: ProductionProblemStatus,
  t: (key: string) => string,
): string {
  if (status === 'open') return t('mobile.tasks.problemsEmptyOpen');
  if (status === 'answered') return t('mobile.tasks.problemsEmptyAnswered');
  return t('mobile.tasks.problemsEmptyAll');
}

export function ProductionProblemsScreen() {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const { height: windowH } = useWindowDimensions();
  const { showOfflineBanner } = useNetwork();
  const router = useRouter();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const leadSize = theme.sizes.touch.min;
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
  const query = useProductionProblemsQuery(status);
  const openQuery = useProductionProblemsQuery('open');
  const rows = query.data?.data ?? [];
  const openCount = openQuery.data?.data.length ?? 0;
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
            refreshing={Boolean(query.isRefetching || openQuery.isRefetching)}
            onRefresh={() => {
              void query.refetch();
              void openQuery.refetch();
            }}
            tintColor={colors.brand}
          />
        }
      >
        {showOfflineBanner ? <OfflineBanner /> : null}

        <View style={{ gap: theme.spacing.xs }}>
          <View style={{ minHeight: leadSize, justifyContent: 'center' }}>
            <View
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                ...(isRTL ? { right: 0 } : { left: 0 }),
                zIndex: 1,
                justifyContent: 'center',
              }}
            >
              <ScreenBackLead fallback={BACK} />
            </View>
            <AppText
              variant="largeTitle"
              weight={titleWeight}
              align="center"
              numberOfLines={2}
              style={{
                paddingHorizontal: leadSize + theme.spacing.sm,
                fontSize: 26,
                lineHeight: 32,
              }}
            >
              {t('mobile.tasks.problemsTitle')}
            </AppText>
          </View>
          <AppText variant="caption" color="muted" align="center">
            {t('mobile.tasks.problemsEyebrow')}
          </AppText>
        </View>

        <ProductionProblemsTouchBar
          value={status}
          onChange={setStatus}
          openCount={openQuery.data ? openCount : undefined}
        />

        {query.isError && !query.data ? (
          <ErrorState
            title={t('production.problemsLoadError')}
            description={t('mobile.tasks.errorBody')}
            retryLabel={t('mobile.tasks.retry')}
            onRetry={() => void query.refetch()}
          />
        ) : query.isPending && !query.data ? (
          <ProductionListSkeleton />
        ) : rows.length === 0 ? (
          <DealerEmptyPanel icon="warning-outline" text={emptyCopy(status, t)} />
        ) : (
          rows.map((row, index) => (
            <ListItemEnter key={row.id} index={index}>
              <ProductionProblemTicket
                row={row}
                onOpenOrder={
                  row.order?.id
                    ? () => {
                        router.push(`/(app)/(admin)/production/${row.order!.id}` as Href);
                      }
                    : undefined
                }
                onAnswer={
                  row.resolution
                    ? undefined
                    : () => {
                        setAnswerId(row.id);
                        setAnswerTaskId(row.taskId);
                        setResolution('');
                        setAnswerUri(null);
                        setAnswerPhotoUris([]);
                      }
                }
              />
            </ListItemEnter>
          ))
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
