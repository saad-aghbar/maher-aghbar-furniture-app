import { Pressable, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { TextField } from '@/components/forms/TextField';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { haptics } from '@/motion';
import { useTheme } from '@/theme';
import type {
  ItemUnderInspection,
  ManufacturingSpec,
  QualityChecklistItem,
} from '../api';

type Props = {
  itemUnderInspection: ItemUnderInspection | null;
  manufacturingSpec: ManufacturingSpec | null;
  checklist: QualityChecklistItem[];
  checked: Record<string, boolean>;
  onToggle: (checklistCode: string, next: boolean) => void;
  notes: string;
  onNotesChange: (value: string) => void;
  onPass: () => void;
  onReportProblem: () => void;
  busy?: boolean;
  disabled?: boolean;
};

/**
 * Inspection floor panel — WHAT INSPECTING, optional manufacturing spec,
 * checklist toggles, notes. Photo band stays on the task (Piece 8).
 */
export function InspectionFloorPanel({
  itemUnderInspection,
  manufacturingSpec,
  checklist,
  checked,
  onToggle,
  notes,
  onNotesChange,
  onPass,
  onReportProblem,
  busy,
  disabled,
}: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  const inspectingLabel = itemUnderInspection
    ? locale.startsWith('ar')
      ? itemUnderInspection.stageNameEn
      : itemUnderInspection.stageNameEn
    : t('mobile.quality.finishedGoods');

  const inspectingMeta = [
    itemUnderInspection?.workerName
      ? t('mobile.quality.madeBy', { name: itemUnderInspection.workerName })
      : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={{ gap: theme.spacing.md }}>
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
          style={{
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.sm + 2,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            backgroundColor: colors.surfaceSecondary,
          }}
        >
          <AppText
            variant="caption"
            weight="semibold"
            style={{
              color: colors.brand,
              letterSpacing: locale === 'ar' ? 0 : 0.6,
              textTransform: locale === 'ar' ? 'none' : 'uppercase',
              fontSize: 11,
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {t('mobile.quality.whatInspecting')}
          </AppText>
        </View>
        <View style={{ padding: theme.spacing.md, gap: theme.spacing.xs }}>
          <AppText
            variant="title"
            weight={titleWeight}
            style={{ textAlign: isRTL ? 'right' : 'left', fontSize: 18 }}
          >
            {inspectingLabel}
          </AppText>
          {inspectingMeta ? (
            <AppText
              variant="caption"
              color="muted"
              style={{ textAlign: isRTL ? 'right' : 'left' }}
            >
              {inspectingMeta}
            </AppText>
          ) : null}
        </View>
      </View>

      {manufacturingSpec ? (
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
            style={{
              paddingHorizontal: theme.spacing.md,
              paddingVertical: theme.spacing.sm + 2,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
              backgroundColor: colors.surfaceSecondary,
            }}
          >
            <AppText
              variant="caption"
              weight="semibold"
              style={{
                color: colors.brand,
                letterSpacing: locale === 'ar' ? 0 : 0.6,
                textTransform: locale === 'ar' ? 'none' : 'uppercase',
                fontSize: 11,
                textAlign: isRTL ? 'right' : 'left',
              }}
            >
              {t('mobile.quality.manufacturingSpec')}
            </AppText>
          </View>
          <View style={{ padding: theme.spacing.md, gap: theme.spacing.xs }}>
            {manufacturingSpec.manufacturingName ? (
              <AppText variant="body" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                {manufacturingSpec.manufacturingName}
              </AppText>
            ) : null}
            {manufacturingSpec.requestedFabricLabel ? (
              <AppText
                variant="bodySecondary"
                style={{ textAlign: isRTL ? 'right' : 'left' }}
              >
                {manufacturingSpec.requestedFabricLabel}
              </AppText>
            ) : null}
            {manufacturingSpec.factoryNotes ? (
              <AppText
                variant="bodySecondary"
                color="secondary"
                style={{ textAlign: isRTL ? 'right' : 'left' }}
              >
                {manufacturingSpec.factoryNotes}
              </AppText>
            ) : null}
          </View>
        </View>
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
          style={{
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.sm + 2,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            backgroundColor: colors.surfaceSecondary,
          }}
        >
          <AppText
            variant="caption"
            weight="semibold"
            style={{
              color: colors.brand,
              letterSpacing: locale === 'ar' ? 0 : 0.6,
              textTransform: locale === 'ar' ? 'none' : 'uppercase',
              fontSize: 11,
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {t('mobile.quality.checklist')}
          </AppText>
        </View>
        <View style={{ padding: theme.spacing.md, gap: theme.spacing.sm }}>
          {checklist.length === 0 ? (
            <AppText variant="body" color="muted" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {t('mobile.quality.checklistEmpty')}
            </AppText>
          ) : (
            checklist.map((item) => {
              const on = Boolean(checked[item.checklistCode]);
              return (
                <Pressable
                  key={item.id || item.checklistCode}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  disabled={disabled || busy}
                  onPress={() => {
                    void haptics.selection();
                    onToggle(item.checklistCode, !on);
                  }}
                  style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    alignItems: 'center',
                    gap: theme.spacing.sm,
                    paddingVertical: theme.spacing.sm,
                    paddingHorizontal: theme.spacing.sm,
                    borderRadius: theme.radius.lg,
                    borderWidth: 1,
                    borderColor: on ? colors.success : colors.border,
                    backgroundColor: on ? colors.successSoft : colors.surfaceSecondary,
                    minHeight: theme.sizes.touch.min,
                  }}
                >
                  <View
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 6,
                      borderWidth: 2,
                      borderColor: on ? colors.success : colors.borderStrong,
                      backgroundColor: on ? colors.success : colors.surface,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {on ? (
                      <AppText variant="caption" weight="semibold" style={{ color: colors.onBrand, fontSize: 12 }}>
                        ✓
                      </AppText>
                    ) : null}
                  </View>
                  <AppText
                    variant="label"
                    weight={on ? 'semibold' : 'medium'}
                    style={{ flex: 1, textAlign: isRTL ? 'right' : 'left' }}
                  >
                    {item.label}
                  </AppText>
                </Pressable>
              );
            })
          )}
        </View>
      </View>

      <TextField
        label={t('mobile.quality.notes')}
        value={notes}
        onChangeText={onNotesChange}
        multiline
        numberOfLines={3}
        placeholder={t('mobile.quality.notesPlaceholder')}
        editable={!disabled && !busy}
      />

      <Pressable
        accessibilityRole="button"
        disabled={disabled || busy}
        onPress={() => {
          void haptics.confirmMedium();
          onPass();
        }}
        style={{
          minHeight: theme.sizes.touch.min + 8,
          borderRadius: theme.radius.xl,
          backgroundColor: colors.success,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled || busy ? 0.55 : 1,
          ...orderBoardShadow(colorScheme),
        }}
      >
        <AppText variant="label" weight="semibold" style={{ color: colors.onBrand, fontSize: 16 }}>
          {t('mobile.quality.passInspection')}
        </AppText>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        disabled={disabled || busy}
        onPress={() => {
          void haptics.selection();
          onReportProblem();
        }}
        style={{
          minHeight: theme.sizes.touch.min,
          borderRadius: theme.radius.xl,
          borderWidth: 1,
          borderColor: colors.error,
          backgroundColor: colors.errorSoft,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled || busy ? 0.55 : 1,
        }}
      >
        <AppText variant="label" weight="semibold" style={{ color: colors.error }}>
          {t('mobile.quality.reportProblem')}
        </AppText>
      </Pressable>
    </View>
  );
}
