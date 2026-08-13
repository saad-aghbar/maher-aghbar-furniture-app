import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { haptics } from '@/motion';
import { resolveAppFontStyle, useTheme } from '@/theme';
import { AppTextInput } from '@/components/forms/AppTextInput';

/** Built-in measurement types — custom types (e.g. pcs) are free-text. */
export const MEASUREMENT_UNIT_PRESETS = ['cm', 'm', 'mm', 'in', 'pcs'] as const;

export type MeasurementUnitPreset = (typeof MEASUREMENT_UNIT_PRESETS)[number];

function labelOrFallback(
  t: (key: string) => string,
  key: string,
  fallback: string,
) {
  const value = t(key);
  return value === key ? fallback : value;
}

function useUnitDraft(active: boolean, unit: string, fallback = 'cm') {
  const [draftUnit, setDraftUnit] = useState(unit || fallback);
  const [customUnit, setCustomUnit] = useState('');
  const [customUnitMode, setCustomUnitMode] = useState(false);

  useEffect(() => {
    if (!active) return;
    const preset = MEASUREMENT_UNIT_PRESETS.includes(unit as MeasurementUnitPreset);
    setDraftUnit(unit || fallback);
    setCustomUnitMode(!preset && Boolean(unit?.trim()));
    setCustomUnit(!preset ? unit : '');
  }, [active, unit, fallback]);

  const resolvedUnit = (
    customUnitMode ? customUnit.trim() : draftUnit.trim()
  ).slice(0, 24);

  const selectPreset = (next: string) => {
    void haptics.selection();
    setCustomUnitMode(false);
    setCustomUnit('');
    setDraftUnit(next);
  };

  return {
    draftUnit,
    customUnit,
    customUnitMode,
    resolvedUnit,
    selectPreset,
    setCustomUnit,
    setCustomUnitMode,
  };
}

/** Chips + optional custom unit field. Shared by measurements and inventory unit. */
export function UnitPresetChips({
  draftUnit,
  customUnit,
  customUnitMode,
  onSelectPreset,
  onCustomUnitChange,
  onEnterCustom,
}: {
  draftUnit: string;
  customUnit: string;
  customUnitMode: boolean;
  onSelectPreset: (unit: string) => void;
  onCustomUnitChange: (unit: string) => void;
  onEnterCustom: () => void;
}) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const label = (key: string, fallback: string) => labelOrFallback(t, key, fallback);

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          flexWrap: 'wrap',
          gap: theme.spacing.xs,
        }}
      >
        {MEASUREMENT_UNIT_PRESETS.map((u) => {
          const focused = !customUnitMode && draftUnit === u;
          return (
            <Pressable
              key={u}
              accessibilityRole="button"
              accessibilityState={{ selected: focused }}
              onPress={() => onSelectPreset(u)}
              style={{
                minWidth: 56,
                paddingHorizontal: theme.spacing.md,
                paddingVertical: theme.spacing.sm,
                borderRadius: theme.radius.lg,
                borderWidth: 1,
                borderColor: focused ? colors.brand : colors.borderStrong,
                backgroundColor: focused ? colors.brand : colors.surface,
                alignItems: 'center',
              }}
            >
              <AppText
                variant="caption"
                weight="semibold"
                dir="ltr"
                style={{ color: focused ? colors.onBrand : colors.textPrimary }}
              >
                {u}
              </AppText>
            </Pressable>
          );
        })}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: customUnitMode }}
          onPress={() => {
            void haptics.selection();
            onEnterCustom();
          }}
          style={{
            minWidth: 56,
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.sm,
            borderRadius: theme.radius.lg,
            borderWidth: 1,
            borderColor: customUnitMode ? colors.brand : colors.borderStrong,
            backgroundColor: customUnitMode ? colors.brandSoft : colors.surface,
            alignItems: 'center',
            flexDirection: isRTL ? 'row-reverse' : 'row',
            gap: 4,
          }}
        >
          <Ionicons
            name="add"
            size={14}
            color={customUnitMode ? colors.brand : colors.textPrimary}
          />
          <AppText
            variant="caption"
            weight="semibold"
            style={{ color: customUnitMode ? colors.brand : colors.textPrimary }}
          >
            {label('catalog.customUnit', 'Custom')}
          </AppText>
        </Pressable>
      </View>

      {customUnitMode ? (
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            minHeight: theme.sizes.touch.min,
            paddingHorizontal: theme.spacing.md,
            borderRadius: theme.radius.xl,
            borderWidth: 1,
            borderColor: colors.borderStrong,
            backgroundColor: colors.surface,
            gap: theme.spacing.sm,
          }}
        >
          <Ionicons name="create-outline" size={16} color={colors.brand} />
          <AppTextInput
            value={customUnit}
            onChangeText={onCustomUnitChange}
            placeholder={label('catalog.customUnitPlaceholder', 'e.g. pcs')}
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={24}
            style={{
              flex: 1,
              paddingVertical: theme.spacing.sm,
              fontSize: 16,
              color: colors.textPrimary,
              textAlign: isRTL ? 'right' : 'left',
              ...resolveAppFontStyle(locale, { variant: 'body' }),
            }}
          />
        </View>
      ) : null}
    </View>
  );
}

type UnitPanelProps = {
  active: boolean;
  unit: string;
  onBack?: () => void;
  onSelect: (unit: string) => void;
};

/** Unit only — pick a preset or create a custom unit. */
export function UnitPickerPanel({ active, unit, onBack, onSelect }: UnitPanelProps) {
  const { t, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const label = (key: string, fallback: string) => labelOrFallback(t, key, fallback);
  const draft = useUnitDraft(active, unit, 'pcs');
  const unitOk = draft.resolvedUnit.length > 0;

  const apply = () => {
    if (!unitOk) return;
    void haptics.confirmLight();
    onSelect(draft.resolvedUnit);
  };

  return (
    <View style={{ gap: theme.spacing.md }}>
      {onBack ? (
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: theme.spacing.sm,
          }}
        >
          <AppText
            variant="caption"
            color="muted"
            style={{ flex: 1, textAlign: isRTL ? 'right' : 'left' }}
          >
            {label(
              'mobile.inventory.pickUnitHint',
              'Pick a unit, or create a custom one.',
            )}
          </AppText>
          <SecondaryButton
            label={t('common.back')}
            onPress={() => {
              void haptics.selection();
              onBack();
            }}
            style={{
              borderRadius: theme.radius.xl,
              minHeight: 36,
              paddingHorizontal: theme.spacing.md,
            }}
          />
        </View>
      ) : (
        <AppText
          variant="caption"
          color="muted"
          style={{ textAlign: isRTL ? 'right' : 'left' }}
        >
          {label(
            'mobile.inventory.pickUnitHint',
            'Pick a unit, or create a custom one.',
          )}
        </AppText>
      )}

      <View
        style={{
          borderRadius: theme.radius.xl,
          borderWidth: 1,
          borderColor: colors.borderStrong,
          backgroundColor: colors.surfaceSecondary,
          padding: theme.spacing.md,
          gap: theme.spacing.sm,
          overflow: 'hidden',
          ...orderBoardShadow(colorScheme),
        }}
      >
        <AppText
          variant="caption"
          style={{
            textTransform: 'uppercase',
            letterSpacing: 0.7,
            fontSize: 11,
            color: colors.brand,
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {label('mobile.inventory.unit', 'Unit')}
        </AppText>
        <UnitPresetChips
          draftUnit={draft.draftUnit}
          customUnit={draft.customUnit}
          customUnitMode={draft.customUnitMode}
          onSelectPreset={draft.selectPreset}
          onCustomUnitChange={draft.setCustomUnit}
          onEnterCustom={() => draft.setCustomUnitMode(true)}
        />
      </View>

      <PrimaryButton
        label={t('common.save')}
        disabled={!unitOk}
        onPress={apply}
        haptic="medium"
        trailing={
          unitOk ? <Ionicons name="checkmark" size={18} color={colors.onBrand} /> : null
        }
        style={{ borderRadius: theme.radius.xl }}
      />
    </View>
  );
}

type PanelProps = {
  active: boolean;
  selected: string;
  unit: string;
  onBack?: () => void;
  onSelect: (value: string, unit: string) => void;
};

/**
 * Choose a measurement type (cm / m / pcs / custom) and enter the value.
 * No long scroll list — type + value only.
 */
export function MeasurementValuePanel({
  active,
  selected,
  unit,
  onBack,
  onSelect,
}: PanelProps) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const label = (key: string, fallback: string) => labelOrFallback(t, key, fallback);
  const draft = useUnitDraft(active, unit, 'cm');
  const [draftValue, setDraftValue] = useState(selected);

  useEffect(() => {
    if (!active) return;
    setDraftValue(selected);
  }, [active, selected]);

  const valueOk = (() => {
    const n = Number(String(draftValue).trim().replace(',', '.'));
    return String(draftValue).trim() !== '' && Number.isFinite(n) && n >= 0;
  })();

  const unitOk = draft.resolvedUnit.length > 0;
  const canApply = valueOk && unitOk;

  const apply = () => {
    if (!canApply) return;
    void haptics.confirmLight();
    const n = Number(String(draftValue).trim().replace(',', '.'));
    const formatted = Number.isInteger(n) ? String(n) : String(n);
    onSelect(formatted, draft.resolvedUnit);
  };

  return (
    <View style={{ gap: theme.spacing.md }}>
      {onBack ? (
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: theme.spacing.sm,
          }}
        >
          <AppText
            variant="caption"
            color="muted"
            style={{ flex: 1, textAlign: isRTL ? 'right' : 'left' }}
          >
            {label(
              'catalog.pickMeasurementValueHint',
              'Pick a measurement type, or create one like pcs — then enter the amount.',
            )}
          </AppText>
          <SecondaryButton
            label={t('common.back')}
            onPress={() => {
              void haptics.selection();
              onBack();
            }}
            style={{
              borderRadius: theme.radius.xl,
              minHeight: 36,
              paddingHorizontal: theme.spacing.md,
            }}
          />
        </View>
      ) : null}

      <View
        style={{
          borderRadius: theme.radius.xl,
          borderWidth: 1,
          borderColor: colors.borderStrong,
          backgroundColor: colors.surfaceSecondary,
          padding: theme.spacing.md,
          gap: theme.spacing.sm,
          overflow: 'hidden',
          ...orderBoardShadow(colorScheme),
        }}
      >
        <AppText
          variant="caption"
          style={{
            textTransform: 'uppercase',
            letterSpacing: 0.7,
            fontSize: 11,
            color: colors.brand,
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {label('catalog.measurementType', 'Measurement type')}
        </AppText>
        <UnitPresetChips
          draftUnit={draft.draftUnit}
          customUnit={draft.customUnit}
          customUnitMode={draft.customUnitMode}
          onSelectPreset={draft.selectPreset}
          onCustomUnitChange={draft.setCustomUnit}
          onEnterCustom={() => draft.setCustomUnitMode(true)}
        />
      </View>

      <View
        style={{
          borderRadius: theme.radius.xl,
          borderWidth: 1,
          borderColor: colors.borderStrong,
          backgroundColor: colors.surfaceSecondary,
          padding: theme.spacing.md,
          gap: theme.spacing.sm,
          overflow: 'hidden',
          ...orderBoardShadow(colorScheme),
        }}
      >
        <AppText
          variant="caption"
          style={{
            textTransform: 'uppercase',
            letterSpacing: 0.7,
            fontSize: 11,
            color: colors.brand,
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {label('catalog.measurementAmount', 'Amount')}
        </AppText>
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            minHeight: theme.sizes.touch.min,
            paddingHorizontal: theme.spacing.md,
            borderRadius: theme.radius.xl,
            borderWidth: 1,
            borderColor: colors.borderStrong,
            backgroundColor: colors.surface,
            gap: theme.spacing.sm,
          }}
        >
          <AppTextInput
            value={draftValue}
            onChangeText={setDraftValue}
            placeholder={label('catalog.customMeasurementPlaceholder', 'e.g. 12')}
            placeholderTextColor={colors.textMuted}
            keyboardType="decimal-pad"
            style={{
              flex: 1,
              paddingVertical: theme.spacing.sm,
              fontSize: 16,
              color: colors.textPrimary,
              textAlign: isRTL ? 'right' : 'left',
              ...resolveAppFontStyle(locale, { variant: 'body' }),
            }}
          />
          <View
            style={{
              paddingHorizontal: theme.spacing.sm,
              paddingVertical: 4,
              borderRadius: theme.radius.md,
              backgroundColor: colors.brandSoft,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <AppText
              variant="caption"
              weight="semibold"
              dir="ltr"
              style={{ color: colors.brand }}
            >
              {draft.resolvedUnit || '—'}
            </AppText>
          </View>
        </View>
      </View>

      <PrimaryButton
        label={label('catalog.applyMeasurementValue', 'Apply')}
        disabled={!canApply}
        onPress={apply}
        haptic="medium"
        trailing={
          canApply ? <Ionicons name="checkmark" size={18} color={colors.onBrand} /> : null
        }
        style={{ borderRadius: theme.radius.xl }}
      />
    </View>
  );
}
