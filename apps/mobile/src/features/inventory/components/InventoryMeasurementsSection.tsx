import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { useToast } from '@/components/feedback/Toast';
import { QtyStepperField } from '@/components/forms/QtyStepperField';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { LocaleNameField } from '@/features/catalog/components/BilingualNameField';
import {
  MeasurementFloorRow,
  displayMeasurementUnit,
} from '@/features/catalog/components/MeasurementFloorRow';
import { MeasurementValuePanel } from '@/features/catalog/components/MeasurementValueSheet';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { localizedName } from '@maher/i18n';
import { useLocale } from '@/i18n';
import { resolveTrilingualIfChanged } from '@/i18n/resolveTrilingualName';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import type { InventoryCustomMeasurement } from '../api';

function strNum(v: string): number | null {
  const n = Number(String(v).trim().replace(',', '.'));
  return String(v).trim() !== '' && Number.isFinite(n) ? n : null;
}

function emptyDraft() {
  return {
    name: '',
    originalName: '',
    nameEn: '',
    nameAr: '',
    nameHe: '',
    value: '',
    unit: 'cm',
  };
}

type Draft = ReturnType<typeof emptyDraft>;

export function useInventoryMeasurementEditor(
  measurements: InventoryCustomMeasurement[],
  onChange: (rows: InventoryCustomMeasurement[]) => void,
  hostOpen = true,
) {
  const { t, locale } = useLocale();
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [measureSheet, setMeasureSheet] = useState(false);
  const [measureValueSheet, setMeasureValueSheet] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);

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
      name: localizedName(locale, row, ''),
      originalName: localizedName(locale, row, ''),
      nameEn: row.nameEn,
      nameAr: row.nameAr,
      nameHe: row.nameHe ?? '',
      value: row.value != null ? String(row.value) : '',
      unit: displayMeasurementUnit(row.unit),
    });
    setEditingIndex(index);
    setMeasureValueSheet(false);
    setMeasureSheet(true);
  };

  const save = async () => {
    if (!draft.name.trim()) {
      void haptics.error();
      showToast({
        variant: 'error',
        message: t('catalog.namesRequired'),
      });
      return;
    }
    setSaving(true);
    try {
      const names = await resolveTrilingualIfChanged({
        typed: draft.name,
        locale,
        original: draft.originalName,
        existing: {
          nameEn: draft.nameEn,
          nameAr: draft.nameAr,
          nameHe: draft.nameHe,
        },
      });
      const next: InventoryCustomMeasurement = {
        ...(editingIndex != null ? measurements[editingIndex] : {}),
        nameEn: names.nameEn,
        nameAr: names.nameAr,
        nameHe: names.nameHe || null,
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
    } finally {
      setSaving(false);
    }
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
    saving,
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
          {t('mobile.inventory.measurements')}
        </AppText>
        <AnimatedPressable
          variant="button"
          accessibilityRole="button"
          accessibilityLabel={t('catalog.addMeasurement')}
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
            + {t('catalog.addMeasurement')}
          </AppText>
        </AnimatedPressable>
      </View>

      {measurements.length === 0 ? (
        <AppText
          variant="caption"
          color="muted"
          style={{ textAlign: isRTL ? 'right' : 'left' }}
        >
          {t('mobile.inventory.noMeasurements')}
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
  save: () => void | Promise<void>;
  saving?: boolean;
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
  saving = false,
}: SheetProps) {
  const { t, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={
        measureValueSheet
          ? t('catalog.pickMeasurementValue')
          : editingIndex != null
            ? t('common.edit')
            : t('catalog.addMeasurement')
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
          <LocaleNameField
            value={draft.name}
            onChange={(v) => setDraft((m) => ({ ...m, name: v }))}
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
                accessibilityLabel={t('catalog.pickMeasurementValue')}
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
                  {t('catalog.pickValue')}
                </AppText>
              </AnimatedPressable>
            </View>
          </View>
          <PrimaryButton
            label={
              editingIndex != null
                ? t('common.save')
                : t('catalog.addMeasurement')
            }
            onPress={() => void save()}
            loading={saving}
            disabled={saving}
            style={{ borderRadius: theme.radius.xl }}
          />
        </View>
      )}
    </BottomSheet>
  );
}
