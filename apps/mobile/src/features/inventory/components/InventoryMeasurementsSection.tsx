import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { useToast } from '@/components/feedback/Toast';
import { QtyStepperField } from '@/components/forms/QtyStepperField';
import { TextField } from '@/components/forms/TextField';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import {
  MeasurementFloorRow,
  displayMeasurementUnit,
} from '@/features/catalog/components/MeasurementFloorRow';
import { MeasurementValuePanel } from '@/features/catalog/components/MeasurementValueSheet';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import type { InventoryCustomMeasurement } from '../api';

function strNum(v: string): number | null {
  const n = Number(String(v).trim().replace(',', '.'));
  return String(v).trim() !== '' && Number.isFinite(n) ? n : null;
}

function emptyDraft() {
  return { nameEn: '', nameAr: '', value: '', unit: 'cm' };
}

type Draft = ReturnType<typeof emptyDraft>;

export function useInventoryMeasurementEditor(
  measurements: InventoryCustomMeasurement[],
  onChange: (rows: InventoryCustomMeasurement[]) => void,
  hostOpen = true,
) {
  const { t } = useLocale();
  const { showToast } = useToast();
  const [measureSheet, setMeasureSheet] = useState(false);
  const [measureValueSheet, setMeasureValueSheet] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);

  const label = (key: string, fallback: string) => {
    const value = t(key);
    return value === key ? fallback : value;
  };

  const close = () => {
    setMeasureValueSheet(false);
    setEditingIndex(null);
    setMeasureSheet(false);
  };

  useEffect(() => {
    if (!hostOpen) close();
  }, [hostOpen]);

  const openAdd = () => {
    void haptics.selection();
    setDraft(emptyDraft());
    setEditingIndex(null);
    setMeasureValueSheet(false);
    setMeasureSheet(true);
  };

  const openEdit = (index: number, row: InventoryCustomMeasurement) => {
    void haptics.selection();
    setDraft({
      nameEn: row.nameEn,
      nameAr: row.nameAr,
      value: row.value != null ? String(row.value) : '',
      unit: displayMeasurementUnit(row.unit),
    });
    setEditingIndex(index);
    setMeasureValueSheet(false);
    setMeasureSheet(true);
  };

  const save = () => {
    if (!draft.nameEn.trim() || !draft.nameAr.trim()) {
      void haptics.error();
      showToast({
        variant: 'error',
        message: label(
          'catalog.measurementNamesRequired',
          'English and Arabic names are required.',
        ),
      });
      return;
    }
    const next: InventoryCustomMeasurement = {
      ...(editingIndex != null ? measurements[editingIndex] : {}),
      nameEn: draft.nameEn.trim(),
      nameAr: draft.nameAr.trim(),
      value: strNum(draft.value),
      unit: draft.unit.trim() || 'cm',
    };
    onChange(
      editingIndex != null
        ? measurements.map((row, i) => (i === editingIndex ? next : row))
        : [...measurements, next],
    );
    void haptics.confirmLight();
    close();
  };

  return {
    openAdd,
    openEdit,
    close,
    removeAt: (index: number) => {
      onChange(measurements.filter((_, i) => i !== index));
    },
    sheetOpen: measureSheet,
    measureValueSheet,
    setMeasureValueSheet,
    editingIndex,
    draft,
    setDraft,
    save,
  };
}

type ListProps = {
  measurements: InventoryCustomMeasurement[];
  onAdd: () => void;
  onEdit: (index: number, row: InventoryCustomMeasurement) => void;
  onRemove: (index: number) => void;
};

/** List only — the editor sheet must be a sibling of the host BottomSheet. */
export function InventoryMeasurementsList({
  measurements,
  onAdd,
  onEdit,
  onRemove,
}: ListProps) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  const label = (key: string, fallback: string) => {
    const value = t(key);
    return value === key ? fallback : value;
  };

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <AppText variant="label" weight={titleWeight}>
          {label('mobile.inventory.measurements', 'Measurements')}
        </AppText>
        <AnimatedPressable
          variant="button"
          accessibilityRole="button"
          accessibilityLabel={label('catalog.addMeasurement', 'Add measurement')}
          onPress={onAdd}
          style={{
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.sm,
            borderRadius: theme.radius.full,
            borderWidth: 1,
            borderColor: colors.brand,
            backgroundColor: colors.brandSoft,
          }}
        >
          <AppText variant="caption" weight="semibold" color="brand">
            + {label('catalog.addMeasurement', 'Add')}
          </AppText>
        </AnimatedPressable>
      </View>

      {measurements.length === 0 ? (
        <AppText
          variant="caption"
          color="muted"
          style={{ textAlign: isRTL ? 'right' : 'left' }}
        >
          {label(
            'mobile.inventory.noMeasurements',
            'No measurements yet. Add custom sizes for this material.',
          )}
        </AppText>
      ) : (
        <View style={{ gap: theme.spacing.sm }}>
          {measurements.map((m, i) => {
            const name =
              locale === 'ar' ? m.nameAr || m.nameEn : m.nameEn || m.nameAr;
            const valueLabel =
              m.value != null
                ? `${m.value} ${displayMeasurementUnit(m.unit)}`
                : '—';
            return (
              <MeasurementFloorRow
                key={`${m.id ?? m.nameEn}-${i}`}
                index={i}
                name={name || '—'}
                valueLabel={valueLabel}
                onEdit={() => onEdit(i, m)}
                onRemove={() => onRemove(i)}
              />
            );
          })}
        </View>
      )}
    </View>
  );
}

type SheetProps = {
  open: boolean;
  onClose: () => void;
  measureValueSheet: boolean;
  setMeasureValueSheet: (open: boolean) => void;
  editingIndex: number | null;
  draft: Draft;
  setDraft: (update: Draft | ((prev: Draft) => Draft)) => void;
  save: () => void;
};

/** Overlay sibling of Add/Edit item — never nest this inside the host sheet. */
export function InventoryMeasurementEditorSheet({
  open,
  onClose,
  measureValueSheet,
  setMeasureValueSheet,
  editingIndex,
  draft,
  setDraft,
  save,
}: SheetProps) {
  const { t, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();

  const label = (key: string, fallback: string) => {
    const value = t(key);
    return value === key ? fallback : value;
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={
        measureValueSheet
          ? label('catalog.pickMeasurementValue', 'Choose value')
          : editingIndex != null
            ? t('common.edit')
            : label('catalog.addMeasurement', 'Add measurement')
      }
      fitContent
      maxHeight={560}
      overlay
    >
      {measureValueSheet ? (
        <MeasurementValuePanel
          active={measureValueSheet}
          selected={draft.value}
          unit={draft.unit}
          onBack={() => setMeasureValueSheet(false)}
          onSelect={(value, unit) => {
            setDraft((s) => ({ ...s, value, unit }));
            setMeasureValueSheet(false);
          }}
        />
      ) : (
        <View style={{ gap: theme.spacing.md }}>
          <TextField
            label={t('catalog.measurementNameEn')}
            value={draft.nameEn}
            onChangeText={(v) => setDraft((m) => ({ ...m, nameEn: v }))}
          />
          <TextField
            label={t('catalog.measurementNameAr')}
            value={draft.nameAr}
            onChangeText={(v) => setDraft((m) => ({ ...m, nameAr: v }))}
          />
          <View style={{ gap: theme.spacing.sm }}>
            <QtyStepperField
              label={t('catalog.measurementValue')}
              value={draft.value}
              onChangeText={(v) => setDraft((m) => ({ ...m, value: v }))}
              min={0}
              placeholder="0"
            />
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'stretch',
                gap: theme.spacing.sm,
              }}
            >
              <View
                style={{
                  minWidth: 48,
                  paddingHorizontal: theme.spacing.md,
                  borderRadius: theme.radius.xl,
                  borderWidth: 1,
                  borderColor: colors.borderStrong,
                  backgroundColor: colors.brandSoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <AppText
                  variant="caption"
                  weight="semibold"
                  style={{ color: colors.brand }}
                  dir="ltr"
                >
                  {draft.unit}
                </AppText>
              </View>
              <AnimatedPressable
                variant="button"
                accessibilityRole="button"
                accessibilityLabel={label('catalog.pickMeasurementValue', 'Choose value')}
                onPress={() => {
                  void haptics.selection();
                  setMeasureValueSheet(true);
                }}
                style={{
                  flex: 1,
                  minHeight: theme.sizes.touch.min,
                  paddingHorizontal: theme.spacing.md,
                  borderRadius: theme.radius.xl,
                  borderWidth: 1,
                  borderColor: colors.borderStrong,
                  backgroundColor: colors.surface,
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  gap: 8,
                  overflow: 'hidden',
                  ...orderBoardShadow(colorScheme),
                }}
              >
                <Ionicons name="options-outline" size={18} color={colors.brand} />
                <AppText variant="caption" weight="semibold" style={{ color: colors.brand }}>
                  {label('catalog.pickValue', 'Pick')}
                </AppText>
              </AnimatedPressable>
            </View>
          </View>
          <PrimaryButton
            label={
              editingIndex != null
                ? t('common.save')
                : label('catalog.addMeasurement', 'Add measurement')
            }
            onPress={save}
            style={{ borderRadius: theme.radius.xl }}
          />
        </View>
      )}
    </BottomSheet>
  );
}
