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
  type DefectCategory,
  type EligibleReworkStage,
} from '../api';

const CATEGORIES: DefectCategory[] = [
  'CARPENTRY',
  'ASSEMBLY',
  'UPHOLSTERY',
  'PAINT_FINISH',
  'DIMENSIONS',
  'FABRIC',
  'HARDWARE',
  'DAMAGE',
  'WRONG_SPEC',
  'MISSING_COMPONENT',
  'OTHER',
];

const SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

type Props = {
  open: boolean;
  onClose: () => void;
  productionOrderId: string;
  taskId: string;
  quantity: number;
  busy?: boolean;
  onConfirm: (args: {
    defectCategory: DefectCategory;
    defectDescription: string;
    affectedQty: number;
    severity: string;
    reentryStageInstanceId?: string;
    voiceDocumentId?: string;
    photoDocumentIds?: string[];
  }) => void;
};

export function QcFailSheet({
  open,
  onClose,
  productionOrderId,
  taskId,
  quantity,
  busy,
  onConfirm,
}: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const { showToast } = useToast();
  const { height: windowH } = useWindowDimensions();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const sheetHeight = Math.round(windowH * 0.86);

  const [category, setCategory] = useState<DefectCategory>('OTHER');
  const [description, setDescription] = useState('');
  const [affectedText, setAffectedText] = useState(String(Math.max(1, quantity)));
  const [severity, setSeverity] = useState<(typeof SEVERITIES)[number]>('HIGH');
  const [recommended, setRecommended] = useState<EligibleReworkStage | null>(null);
  const [eligible, setEligible] = useState<EligibleReworkStage[]>([]);
  const [stageId, setStageId] = useState<string | null>(null);
  const [loadingStages, setLoadingStages] = useState(false);
  const [uri, setUri] = useState<string | null>(null);
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [hostYield, setHostYield] = useState(false);

  useEffect(() => {
    if (!open) {
      setDescription('');
      setUri(null);
      setPhotoUris([]);
      setHostYield(false);
      setAffectedText(String(Math.max(1, quantity)));
    }
  }, [open, quantity]);

  useEffect(() => {
    if (!open || !productionOrderId) return;
    let cancelled = false;
    setLoadingStages(true);
    void getReworkStages(productionOrderId, category)
      .then((res) => {
        if (cancelled) return;
        setRecommended(res.recommended);
        setEligible(res.eligible ?? []);
        setStageId(res.recommended?.stageInstanceId ?? res.eligible?.[0]?.stageInstanceId ?? null);
      })
      .catch(() => {
        if (cancelled) return;
        setRecommended(null);
        setEligible([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingStages(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, productionOrderId, category]);

  const valid = Boolean(description.trim());
  const submitting = Boolean(busy || uploading);

  async function submit() {
    const desc = description.trim();
    if (!desc) {
      void haptics.error();
      showToast({ variant: 'error', message: t('mobile.quality.failDescriptionRequired') });
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
    const qty = Math.max(1, Math.floor(Number(affectedText) || 1));
    void haptics.confirmMedium();
    onConfirm({
      defectCategory: category,
      defectDescription: desc,
      affectedQty: qty,
      severity,
      reentryStageInstanceId: stageId ?? undefined,
      voiceDocumentId,
      photoDocumentIds,
    });
  }

  const stageName = (s: EligibleReworkStage) =>
    locale.startsWith('ar') && s.nameAr ? s.nameAr : s.nameEn;

  return (
    <BottomSheet
      open={open && !hostYield}
      onClose={onClose}
      title={t('mobile.quality.failInspection')}
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
          <AppText
            variant="bodySecondary"
            color="secondary"
            style={{ textAlign: isRTL ? 'right' : 'left' }}
          >
            {t('mobile.quality.failHint')}
          </AppText>

          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              flexWrap: 'wrap',
              gap: theme.spacing.sm,
            }}
          >
            {CATEGORIES.map((cat) => {
              const active = category === cat;
              return (
                <AnimatedPressable
                  key={cat}
                  variant="button"
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => {
                    void haptics.selection();
                    setCategory(cat);
                  }}
                  style={{
                    paddingHorizontal: theme.spacing.md,
                    paddingVertical: theme.spacing.sm,
                    minHeight: 40,
                    borderRadius: theme.radius.lg,
                    backgroundColor: active ? colors.brandSoft : colors.surfaceSecondary,
                    borderWidth: 1.5,
                    borderColor: active ? colors.brand : colors.border,
                    overflow: 'hidden',
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
                    variant="caption"
                    weight={active ? titleWeight : 'medium'}
                    style={{ color: active ? colors.brand : colors.textPrimary }}
                  >
                    {t(`mobile.quality.category.${cat}`)}
                  </AppText>
                </AnimatedPressable>
              );
            })}
          </View>

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
          <TextField
            label={t('mobile.quality.affectedQty')}
            value={affectedText}
            onChangeText={setAffectedText}
            keyboardType="number-pad"
          />

          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              flexWrap: 'wrap',
              gap: theme.spacing.sm,
            }}
          >
            {SEVERITIES.map((sev) => {
              const active = severity === sev;
              return (
                <AnimatedPressable
                  key={sev}
                  variant="button"
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => {
                    void haptics.selection();
                    setSeverity(sev);
                  }}
                  style={{
                    paddingHorizontal: theme.spacing.md,
                    paddingVertical: theme.spacing.sm,
                    minHeight: 40,
                    borderRadius: theme.radius.lg,
                    backgroundColor: active ? colors.warningSoft : colors.surfaceSecondary,
                    borderWidth: 1.5,
                    borderColor: active ? colors.warning : colors.border,
                  }}
                >
                  <AppText
                    variant="caption"
                    weight={active ? titleWeight : 'medium'}
                    style={{ color: active ? colors.warning : colors.textPrimary }}
                  >
                    {t(`mobile.quality.severityLevel.${sev}`)}
                  </AppText>
                </AnimatedPressable>
              );
            })}
          </View>

          <DealerBoard title={t('mobile.quality.recommendedStage')} titleWeight={titleWeight}>
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
                const active = stageId === stage.stageInstanceId;
                const isRec = recommended?.stageInstanceId === stage.stageInstanceId;
                return (
                  <ListItemEnter key={stage.stageInstanceId} index={index}>
                    <AnimatedPressable
                      variant="button"
                      accessibilityRole="radio"
                      accessibilityState={{ selected: active }}
                      onPress={() => {
                        void haptics.selection();
                        setStageId(stage.stageInstanceId);
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
                        {stageName(stage)}
                      </AppText>
                      {isRec ? (
                        <AppText
                          variant="caption"
                          style={{ color: colors.brand, textAlign: isRTL ? 'right' : 'left' }}
                        >
                          {t('mobile.quality.recommended')}
                        </AppText>
                      ) : null}
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
