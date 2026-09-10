import { useEffect, useState } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import { uploadFile } from '@/api/modules/uploads';
import { AppText } from '@/components/AppText';
import { useToast } from '@/components/feedback/Toast';
import { TextField } from '@/components/forms/TextField';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { DealerBoard } from '@/features/dealers/components/DealerBoard';
import { DealerFormFooter } from '@/features/dealers/components/dealerSheetForm';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics, ListItemEnter } from '@/motion';
import { useTheme } from '@/theme';
import type { TaskBlockerCategory } from '../api';
import {
  PROBLEM_CATEGORY_LIST_MAX_HEIGHT,
  REPORT_PROBLEM_CATEGORIES,
  reportProblemSheetHeight,
  trimmedProblemReason,
  voiceUploadToastMessage,
} from '../report-problem-sheet';
import { VoiceRecorderBar } from './VoiceNoteControls';
import { ProblemPhotoBar, uploadProblemPhotos } from './ProblemPhotoBar';

type Props = {
  open: boolean;
  taskId: string;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (body: {
    category: TaskBlockerCategory;
    reason: string;
    voiceDocumentId?: string;
    photoDocumentIds?: string[];
  }) => void;
};

export function ReportProblemSheet({ open, taskId, submitting, onClose, onSubmit }: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const { showToast } = useToast();
  const { height: windowH } = useWindowDimensions();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const sheetHeight = reportProblemSheetHeight(windowH);
  const [category, setCategory] = useState<TaskBlockerCategory>('OTHER');
  const [reason, setReason] = useState('');
  const [uri, setUri] = useState<string | null>(null);
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [hostYield, setHostYield] = useState(false);

  useEffect(() => {
    if (!open) {
      setReason('');
      setUri(null);
      setPhotoUris([]);
      setCategory('OTHER');
      setHostYield(false);
    }
  }, [open]);

  async function submit() {
    const text = trimmedProblemReason(reason);
    if (!text) {
      showToast({ variant: 'error', message: t('mobile.tasks.problemReasonRequired') });
      return;
    }
    let voiceDocumentId: string | undefined;
    let photoDocumentIds: string[] | undefined;
    setUploading(true);
    try {
      if (uri) {
        const uploaded = await uploadFile({
          uri,
          fileName: `blocker-${taskId}.m4a`,
          mimeType: 'audio/m4a',
          category: `BLOCKER_VOICE:${taskId}`,
          taskId,
        });
        voiceDocumentId = uploaded.document.id;
      }
      if (photoUris.length) {
        photoDocumentIds = await uploadProblemPhotos({
          uris: photoUris,
          taskId,
          uploadFile,
        });
      }
    } catch (error) {
      showToast({
        variant: 'error',
        message: voiceUploadToastMessage(error, t('mobile.tasks.uploadFailed')),
      });
      setUploading(false);
      return;
    }
    setUploading(false);
    onSubmit({ category, reason: text, voiceDocumentId, photoDocumentIds });
  }

  return (
    <BottomSheet
      open={open && !hostYield}
      onClose={onClose}
      title={t('mobile.tasks.reportProblem')}
      overlay
      expandable
      sheetHeight={sheetHeight}
    >
      <View style={{ flex: 1, minHeight: 0 }}>
        <ScrollView
          style={{ flex: 1, minHeight: 0 }}
          contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: theme.spacing.sm }}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
        >
          <DealerBoard title={t('mobile.tasks.problemKindTitle')} titleWeight={titleWeight}>
            <ScrollView
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
              style={{ maxHeight: PROBLEM_CATEGORY_LIST_MAX_HEIGHT }}
              contentContainerStyle={{ gap: theme.spacing.sm }}
            >
              {REPORT_PROBLEM_CATEGORIES.map((cat, index) => {
                const active = category === cat;
                const label = t(`mobile.tasks.blocker.${cat}`);
                return (
                  <ListItemEnter key={cat} index={index}>
                    <AnimatedPressable
                      variant="button"
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={label}
                      onPress={() => {
                        void haptics.selection();
                        setCategory(cat);
                      }}
                      style={{
                        minHeight: 40,
                        borderRadius: theme.radius.lg,
                        borderWidth: 1.5,
                        borderColor: active ? colors.brand : colors.border,
                        backgroundColor: active ? colors.brandSoft : colors.surfaceSecondary,
                        paddingHorizontal: theme.spacing.md,
                        paddingVertical: theme.spacing.sm,
                        overflow: 'hidden',
                        alignItems: isRTL ? 'flex-end' : 'flex-start',
                        justifyContent: 'center',
                      }}
                    >
                      {active ? (
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
                      ) : null}
                      <AppText
                        variant="label"
                        weight={active ? titleWeight : 'medium'}
                        numberOfLines={1}
                        style={{
                          color: active ? colors.brand : colors.textPrimary,
                          textAlign: isRTL ? 'right' : 'left',
                          paddingLeft: active && !isRTL ? 4 : 0,
                          paddingRight: active && isRTL ? 4 : 0,
                        }}
                      >
                        {label}
                      </AppText>
                    </AnimatedPressable>
                  </ListItemEnter>
                );
              })}
            </ScrollView>
          </DealerBoard>
          <TextField
            label={t('mobile.tasks.problemDetails')}
            value={reason}
            onChangeText={setReason}
            placeholder={t('mobile.tasks.problemPlaceholder')}
            multiline
          />
          <VoiceRecorderBar uri={uri} onUri={setUri} />
          <ProblemPhotoBar
            uris={photoUris}
            onUris={setPhotoUris}
            onHostYieldChange={setHostYield}
          />
        </ScrollView>
        <DealerFormFooter
          confirmLabel={t('mobile.tasks.submitProblem')}
          onConfirm={() => void submit()}
          onCancel={onClose}
          loading={Boolean(submitting || uploading)}
        />
      </View>
    </BottomSheet>
  );
}
