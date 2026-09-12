import { Pressable, View } from 'react-native';
import { useState } from 'react';
import { AppText } from '@/components/AppText';
import { QtyStepperField } from '@/components/forms/QtyStepperField';
import { TextField } from '@/components/forms/TextField';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import { NamedPickerSheet, type NamedPickRow } from './components/NamedPickerSheet';

export type DealerFabricRow = {
  key: string;
  type: string;
  color: string;
  role: string;
  code: string;
  quantity: string;
  notes: string;
  fabricId?: string;
  colorId?: string;
};

export function emptyDealerFabricRow(): DealerFabricRow {
  return {
    key: `fab-${Math.random().toString(36).slice(2, 10)}`,
    type: '',
    color: '',
    role: '',
    code: '',
    quantity: '',
    notes: '',
  };
}

export function dealerFabricsPayload(rows: DealerFabricRow[]) {
  return rows
    .map((row) => ({
      key: row.key,
      type: row.type.trim() || null,
      color: row.color.trim() || null,
      role: row.role.trim() || null,
      code: row.code.trim() || null,
      quantity: row.quantity.trim() ? Number(row.quantity) : null,
      unit: 'm',
      notes: row.notes.trim() || null,
    }))
    .filter((row) => row.type || row.color || row.code || row.role);
}

type Props = {
  value: DealerFabricRow[];
  onChange: (next: DealerFabricRow[]) => void;
  fabricOptions?: NamedPickRow[];
  colorOptions?: NamedPickRow[];
};

export function FabricSelectionsEditor({
  value,
  onChange,
  fabricOptions = [],
  colorOptions = [],
}: Props) {
  const { t, isRTL } = useLocale();
  const { theme, colors } = useTheme();
  const [fabricPick, setFabricPick] = useState<number | null>(null);
  const [colorPick, setColorPick] = useState<number | null>(null);

  function patch(index: number, partial: Partial<DealerFabricRow>) {
    onChange(value.map((row, i) => (i === index ? { ...row, ...partial } : row)));
  }

  return (
    <View style={{ gap: theme.spacing.md }}>
      {value.map((row, index) => (
        <View
          key={row.key}
          style={{
            gap: theme.spacing.sm,
            padding: theme.spacing.md,
            borderRadius: theme.radius.lg,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surfaceSecondary,
          }}
        >
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <AppText variant="caption" weight="semibold" color="muted">
              {t('mobile.newOrder.fabricN', { n: index + 1 })}
            </AppText>
            {value.length > 1 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('mobile.newOrder.removeFabric')}
                onPress={() => onChange(value.filter((_, i) => i !== index))}
                hitSlop={8}
              >
                <AppText variant="caption" color="error">
                  {t('mobile.newOrder.removeFabric')}
                </AppText>
              </Pressable>
            ) : null}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('mobile.newOrder.fabricName')}
            testID={`fabric-type-${row.key}`}
            onPress={() => setFabricPick(index)}
            style={{
              minHeight: theme.sizes.touch.min,
              borderRadius: theme.radius.lg,
              borderWidth: 1,
              borderColor: colors.border,
              paddingHorizontal: theme.spacing.md,
              justifyContent: 'center',
              backgroundColor: colors.surface,
            }}
          >
            <AppText variant="caption" color="muted">
              {t('mobile.newOrder.fabricName')}
            </AppText>
            <AppText>{row.type || t('mobile.newOrder.fabricNamePlaceholder')}</AppText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('mobile.newOrder.fabricColor')}
            testID={`fabric-color-${row.key}`}
            onPress={() => setColorPick(index)}
            style={{
              minHeight: theme.sizes.touch.min,
              borderRadius: theme.radius.lg,
              borderWidth: 1,
              borderColor: colors.border,
              paddingHorizontal: theme.spacing.md,
              justifyContent: 'center',
              backgroundColor: colors.surface,
            }}
          >
            <AppText variant="caption" color="muted">
              {t('mobile.newOrder.fabricColor')}
            </AppText>
            <AppText>{row.color || t('mobile.newOrder.fabricColorPlaceholder')}</AppText>
          </Pressable>
          <TextField
            label={t('mobile.newOrder.fabricCode')}
            value={row.code}
            onChangeText={(code) => patch(index, { code })}
            placeholder={t('mobile.newOrder.fabricCodePlaceholder')}
          />
          <TextField
            label={t('mobile.newOrder.fabricRole')}
            value={row.role}
            onChangeText={(role) => patch(index, { role })}
            placeholder={t('mobile.newOrder.fabricRolePlaceholder')}
          />
          <QtyStepperField
            label={t('mobile.newOrder.fabricQty')}
            value={row.quantity}
            onChangeText={(quantity) => patch(index, { quantity })}
            min={0}
            step={0.5}
            unit="m"
            placeholder={t('mobile.newOrder.fabricQtyPlaceholder')}
          />
        </View>
      ))}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('mobile.newOrder.addFabric')}
        onPress={() => onChange([...value, emptyDealerFabricRow()])}
        style={{
          alignSelf: isRTL ? 'flex-end' : 'flex-start',
          paddingVertical: theme.spacing.sm,
        }}
      >
        <AppText variant="label" weight="semibold">
          {t('mobile.newOrder.addFabric')}
        </AppText>
      </Pressable>
      <NamedPickerSheet
        open={fabricPick != null}
        onClose={() => setFabricPick(null)}
        title={t('mobile.newOrder.fabricName')}
        rows={fabricOptions}
        selectedId={fabricPick != null ? value[fabricPick]?.fabricId ?? null : null}
        onSelect={(id) => {
          if (fabricPick == null) return;
          const picked = fabricOptions.find((row) => row.id === id);
          patch(fabricPick, {
            fabricId: id ?? undefined,
            type: picked?.name ?? '',
            code: picked?.caption ?? value[fabricPick]?.code ?? '',
          });
        }}
      />
      <NamedPickerSheet
        open={colorPick != null}
        onClose={() => setColorPick(null)}
        title={t('mobile.newOrder.fabricColor')}
        rows={colorOptions}
        selectedId={colorPick != null ? value[colorPick]?.colorId ?? null : null}
        onSelect={(id) => {
          if (colorPick == null) return;
          const picked = colorOptions.find((row) => row.id === id);
          patch(colorPick, {
            colorId: id ?? undefined,
            color: picked?.name ?? '',
          });
        }}
      />
    </View>
  );
}
