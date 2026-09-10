import { useEffect, useState } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import { uploadFile } from '@/api/modules/uploads';
import { AppText } from '@/components/AppText';
import { useToast } from '@/components/feedback/Toast';
import { TextField } from '@/components/forms/TextField';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { DealerBoard } from '@/features/dealers/components/DealerBoard';
import { DealerFormFooter } from '@/features/dealers/components/dealerSheetForm';
import { ProblemPhotoBar, uploadProblemPhotos } from '@/features/tasks/components/ProblemPhotoBar';
import { VoiceRecorderBar } from '@/features/tasks/components/VoiceNoteControls';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics, ListItemEnter } from '@/motion';
import { useTheme } from '@/theme';
import {
  getReworkStages,
  type EligibleReworkStage,
  type QualityChecklistItem,
} from '../api';

type Props = {
  open: boolean;
  onClose: () => void;
  productionOrderId: string;
  taskId: string;
  piece: QualityChecklistItem | null;
  busy?: boolean;
  onConfirm: (args: {
    defectDescription: string;
    reentryStageInstanceIds: string[];
    voiceDocumentId?: string;
    photoDocumentIds?: string[];
  }) => void;
};

export function InspectionPieceFailSheet({
  open,
  onClose,
  productionOrderId,
  taskId,
  piece,
  busy,
  onConfirm,
}: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const { showToast } = useToast();
  const { height: windowH } = useWindowDimensions();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const sheetHeight = Math.round(windowH * 0.86);

  const [description, setDescription] = useState('');
  const [uri, setUri] = useState<string | null>(null);
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [stageIds, setStageIds] = useState<string[]>([]);
  const [eligible, setEligible] = useState<EligibleReworkStage[]>([]);
  const [loadingStages, setLoadingStages] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [hostYield, setHostYield] = useState(false);

  useEffect(() => {
    if (!open) {
      setDescription('');
      setUri(null);
      setPhotoUris([]);
      setStageIds([]);
      setHostYield(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !productionOrderId) return;
    let cancelled = false;
    setLoadingStages(true);
    void getReworkStages(productionOrderId)
      .then((res) => {
        if (cancelled) return;
        const list = res.eligible ?? [];
        setEligible(list);
        const recommended = res.recommended?.stageInstanceId;
        setStageIds(recommended ? [recommended] : []);
      })
      .catch(() => {
        if (!cancelled) setEligible([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingStages(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, productionOrderId]);

  const valid = Boolean(description.trim()) && stageIds.length > 0;
  const submitting = Boolean(busy || uploading);

  async function submit() {
    const text = description.trim();
    if (!text) {
      showToast({ variant: 'error', message: t('mobile.quality.failDescriptionRequired') });
      return;
    }
    if (!stageIds.length) {
      showToast({ variant: 'error', message: t('mobile.quality.failStageRequired') });
      return;
    }
    let voiceDocumentId: string | undefined;
    let photoDocumentIds: string[] | undefined;
    setUploading(true);
    try {
      if (uri) {
        const uploaded = await uploadFile({
          uri,
          fileName: `inspection-fail-${taskId}.m4a`,
          mimeType: 'audio/m4a',
          category: `QC_VOICE:${taskId}`,
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
    } catch {
      showToast({ variant: 'error', message: t('mobile.tasks.uploadFailed') });
      setUploading(false);
      return;
    }
    setUploading(false);
    onConfirm({
      defectDescription: text,
      reentryStageInstanceIds: stageIds,
      voiceDocumentId,
      photoDocumentIds,
    });
  }

  return (
    <BottomSheet
      open={open && !hostYield}
      onClose={onClose}
      title={piece ? t('mobile.quality.failPieceTitle', { piece: piece.label }) : t('mobile.quality.failPiece')}
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
          <TextField
            label={t('mobile.quality.problemDescription')}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
            placeholder={t('mobile.quality.problemDescriptionPlaceholder')}
          />
          <VoiceRecorderBar uri={uri} onUri={setUri} />
          <ProblemPhotoBar
            uris={photoUris}
            onUris={setPhotoUris}
            onHostYieldChange={setHostYield}
          />
          <DealerBoard title={t('mobile.quality.reentryStages')} titleWeight={titleWeight}>
            {loadingStages ? (
              <AppText variant="caption" color="muted">
                {t('mobile.quality.loadingStages')}
              </AppText>
            ) : eligible.length === 0 ? (
              <AppText variant="caption" color="muted">
                {t('mobile.quality.noReworkStages')}
              </AppText>
            ) : (
              eligible.map((stage, index) => {
                const active = stageIds.includes(stage.stageInstanceId);
                const label =
                  locale.startsWith('ar') && stage.nameAr ? stage.nameAr : stage.nameEn;
                return (
                  <ListItemEnter key={stage.stageInstanceId} index={index}>
                    <AnimatedPressable
                      variant="button"
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: active }}
                      accessibilityLabel={label}
                      onPress={() => {
                        void haptics.selection();
                        setStageIds((prev) =>
                          prev.includes(stage.stageInstanceId)
                            ? prev.filter((id) => id !== stage.stageInstanceId)
                            : [...prev, stage.stageInstanceId],
                        );
                      }}
                      style={{
                        minHeight: 44,
                        borderRadius: theme.radius.lg,
                        borderWidth: 1.5,
                        borderColor: active ? colors.brand : colors.border,
                        backgroundColor: active ? colors.brandSoft : colors.surfaceSecondary,
                        paddingHorizontal: theme.spacing.md,
                        paddingVertical: theme.spacing.sm,
                        overflow: 'hidden',
                        alignItems: isRTL ? 'flex-end' : 'flex-start',
                        justifyContent: 'center',
                        marginBottom: theme.spacing.sm,
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
                        style={{
                          color: active ? colors.brand : colors.textPrimary,
                          textAlign: isRTL ? 'right' : 'left',
                        }}
                      >
                        {label}
                      </AppText>
                    </AnimatedPressable>
                  </ListItemEnter>
                );
              })
            )}
          </DealerBoard>
        </ScrollView>
        <DealerFormFooter
          confirmLabel={t('mobile.quality.confirmProblem')}
          onConfirm={() => void submit()}
          onCancel={onClose}
          loading={submitting}
          disabled={!valid || submitting}
        />
      </View>
    </BottomSheet>
  );
}
