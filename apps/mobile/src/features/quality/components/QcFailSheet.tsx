import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { TextField } from '@/components/forms/TextField';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { haptics } from '@/motion';
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
  quantity: number;
  busy?: boolean;
  onConfirm: (args: {
    defectCategory: DefectCategory;
    defectDescription: string;
    affectedQty: number;
    severity: string;
    reentryStageInstanceId?: string;
  }) => void;
};

/**
 * QC fail sheet — category, description, affected qty, severity,
 * recommended rework stage from API, confirm.
 */
export function QcFailSheet({
  open,
  onClose,
  productionOrderId,
  quantity,
  busy,
  onConfirm,
}: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  const [category, setCategory] = useState<DefectCategory>('OTHER');
  const [description, setDescription] = useState('');
  const [affectedText, setAffectedText] = useState(String(Math.max(1, quantity)));
  const [severity, setSeverity] = useState<(typeof SEVERITIES)[number]>('HIGH');
  const [recommended, setRecommended] = useState<EligibleReworkStage | null>(null);
  const [eligible, setEligible] = useState<EligibleReworkStage[]>([]);
  const [stageId, setStageId] = useState<string | null>(null);
  const [loadingStages, setLoadingStages] = useState(false);

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

  function submit() {
    const desc = description.trim();
    if (!desc) {
      void haptics.error();
      return;
    }
    const qty = Math.max(1, Math.floor(Number(affectedText) || 1));
    void haptics.confirmMedium();
    onConfirm({
      defectCategory: category,
      defectDescription: desc,
      affectedQty: qty,
      severity,
      reentryStageInstanceId: stageId ?? undefined,
    });
  }

  const stageName = (s: EligibleReworkStage) =>
    locale.startsWith('ar') && s.nameAr ? s.nameAr : s.nameEn;

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('mobile.quality.reportProblem')}
      sheetHeight={560}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: theme.spacing.xl }}
      >
        <AppText variant="bodySecondary" color="secondary" style={{ textAlign: isRTL ? 'right' : 'left' }}>
          {t('mobile.quality.failHint')}
        </AppText>

        <AppText
          variant="caption"
          weight="semibold"
          style={{
            color: colors.brand,
            textTransform: locale === 'ar' ? 'none' : 'uppercase',
            fontSize: 11,
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {t('mobile.quality.defectCategory')}
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
              <Pressable
                key={cat}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => {
                  void haptics.selection();
                  setCategory(cat);
                }}
                style={{
                  paddingHorizontal: theme.spacing.md,
                  paddingVertical: theme.spacing.sm,
                  borderRadius: theme.radius.md,
                  backgroundColor: active ? colors.brand : colors.surfaceSecondary,
                  borderWidth: 1,
                  borderColor: active ? colors.brand : colors.border,
                  ...(active ? orderBoardShadow(colorScheme) : null),
                }}
              >
                <AppText
                  variant="caption"
                  weight={active ? 'semibold' : 'medium'}
                  style={{ color: active ? colors.onBrand : colors.textPrimary }}
                >
                  {t(`mobile.quality.category.${cat}`)}
                </AppText>
              </Pressable>
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

        <TextField
          label={t('mobile.quality.affectedQty')}
          value={affectedText}
          onChangeText={setAffectedText}
          keyboardType="number-pad"
        />

        <AppText
          variant="caption"
          weight="semibold"
          style={{
            color: colors.brand,
            textTransform: locale === 'ar' ? 'none' : 'uppercase',
            fontSize: 11,
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {t('mobile.quality.severity')}
        </AppText>
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
              <Pressable
                key={sev}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => {
                  void haptics.selection();
                  setSeverity(sev);
                }}
                style={{
                  paddingHorizontal: theme.spacing.md,
                  paddingVertical: theme.spacing.sm,
                  borderRadius: theme.radius.md,
                  backgroundColor: active ? colors.warning : colors.surfaceSecondary,
                  borderWidth: 1,
                  borderColor: active ? colors.warning : colors.border,
                }}
              >
                <AppText
                  variant="caption"
                  weight={active ? 'semibold' : 'medium'}
                  style={{ color: active ? colors.onBrand : colors.textPrimary }}
                >
                  {t(`mobile.quality.severityLevel.${sev}`)}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        <View
          style={{
            borderRadius: theme.radius.xl,
            borderWidth: 1,
            borderColor: colors.borderStrong,
            backgroundColor: colors.surfaceSecondary,
            padding: theme.spacing.md,
            gap: theme.spacing.sm,
          }}
        >
          <AppText
            variant="caption"
            weight="semibold"
            style={{
              color: colors.brand,
              textTransform: locale === 'ar' ? 'none' : 'uppercase',
              fontSize: 11,
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {t('mobile.quality.recommendedStage')}
          </AppText>
          {loadingStages ? (
            <AppText variant="caption" color="muted">
              {t('mobile.quality.loadingStages')}
            </AppText>
          ) : eligible.length === 0 ? (
            <AppText variant="bodySecondary" color="muted">
              {t('mobile.quality.noReworkStages')}
            </AppText>
          ) : (
            eligible.map((s) => {
              const active = stageId === s.stageInstanceId;
              const isRec = recommended?.stageInstanceId === s.stageInstanceId;
              return (
                <Pressable
                  key={s.stageInstanceId}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => {
                    void haptics.selection();
                    setStageId(s.stageInstanceId);
                  }}
                  style={{
                    padding: theme.spacing.md,
                    borderRadius: theme.radius.lg,
                    borderWidth: 1,
                    borderColor: active ? colors.brand : colors.border,
                    backgroundColor: active ? colors.brandSoft : colors.surface,
                    gap: 2,
                  }}
                >
                  <AppText
                    variant="label"
                    weight={titleWeight}
                    style={{ textAlign: isRTL ? 'right' : 'left' }}
                  >
                    {stageName(s)}
                  </AppText>
                  {isRec ? (
                    <AppText
                      variant="caption"
                      style={{ color: colors.brand, textAlign: isRTL ? 'right' : 'left' }}
                    >
                      {t('mobile.quality.recommended')}
                    </AppText>
                  ) : null}
                </Pressable>
              );
            })
          )}
        </View>

        <PrimaryButton
          label={t('mobile.quality.confirmProblem')}
          onPress={submit}
          loading={busy}
          style={{ minHeight: theme.sizes.touch.min }}
        />
        <SecondaryButton label={t('mobile.tasks.cancel')} onPress={onClose} />
      </ScrollView>
    </BottomSheet>
  );
}
