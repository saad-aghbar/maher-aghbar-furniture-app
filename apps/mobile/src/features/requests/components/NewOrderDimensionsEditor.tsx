import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { TextField } from '@/components/forms/TextField';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { useLocale } from '@/i18n';
import { haptics } from '@/motion';
import { useTheme } from '@/theme';
import type { NewOrderCustomMeasurement, NewOrderDimensionFields } from '../newOrderMeasurements';

type Props = {
  value: NewOrderDimensionFields;
  onChange: (next: NewOrderDimensionFields) => void;
};

export function NewOrderDimensionsEditor({ value, onChange }: Props) {
  const { t, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newValue, setNewValue] = useState('');

  const setField = (key: 'width' | 'height' | 'depth' | 'seat', next: string) => {
    onChange({ ...value, [key]: next });
  };

  const addCustom = () => {
    const label = newLabel.trim();
    const val = newValue.trim();
    if (!label || !val) return;
    const row: NewOrderCustomMeasurement = {
      id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      label,
      value: val,
    };
    void haptics.confirmMedium();
    onChange({ ...value, custom: [...value.custom, row] });
    setNewLabel('');
    setNewValue('');
    setSheetOpen(false);
  };

  const removeCustom = (id: string) => {
    void haptics.selection();
    onChange({ ...value, custom: value.custom.filter((m) => m.id !== id) });
  };

  return (
    <View style={{ gap: theme.spacing.md }}>
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.sm,
        }}
      >
        <AppText variant="label" weight="semibold">
          {t('mobile.newOrder.dimensionsSection')}
        </AppText>
        <Pressable
          onPress={() => {
            void haptics.selection();
            setSheetOpen(true);
          }}
          accessibilityRole="button"
          accessibilityLabel={t('mobile.newOrder.addMeasurement')}
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
            + {t('mobile.newOrder.addMeasurement')}
          </AppText>
        </Pressable>
      </View>

      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          gap: theme.spacing.sm,
        }}
      >
        <View style={{ flex: 1 }}>
          <TextField
            label={t('mobile.newOrder.dimWidth')}
            value={value.width}
            onChangeText={(v) => setField('width', v)}
            keyboardType="decimal-pad"
            placeholder="—"
          />
        </View>
        <View style={{ flex: 1 }}>
          <TextField
            label={t('mobile.newOrder.dimHeight')}
            value={value.height}
            onChangeText={(v) => setField('height', v)}
            keyboardType="decimal-pad"
            placeholder="—"
          />
        </View>
      </View>

      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          gap: theme.spacing.sm,
        }}
      >
        <View style={{ flex: 1 }}>
          <TextField
            label={t('mobile.newOrder.dimDepth')}
            value={value.depth}
            onChangeText={(v) => setField('depth', v)}
            keyboardType="decimal-pad"
            placeholder="—"
          />
        </View>
        <View style={{ flex: 1 }}>
          <TextField
            label={t('mobile.newOrder.dimSeat')}
            value={value.seat}
            onChangeText={(v) => setField('seat', v)}
            keyboardType="decimal-pad"
            placeholder="—"
          />
        </View>
      </View>

      <View style={{ gap: theme.spacing.sm }}>
        <AppText variant="caption" color="muted">
          {t('mobile.newOrder.customMeasurements')}
        </AppText>
        {value.custom.length === 0 ? (
          <AppText
            variant="caption"
            color="muted"
            style={{ textAlign: isRTL ? 'right' : 'left' }}
          >
            {t('mobile.newOrder.noCustomMeasurements')}
          </AppText>
        ) : (
          value.custom.map((m, i) => (
            <View
              key={m.id}
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                gap: theme.spacing.sm,
                paddingVertical: theme.spacing.sm,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: colors.border,
              }}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <AppText
                  variant="body"
                  weight="medium"
                  style={{ textAlign: isRTL ? 'right' : 'left' }}
                >
                  {m.label}
                </AppText>
                <AppText
                  variant="caption"
                  color="muted"
                  dir="ltr"
                  style={{ textAlign: isRTL ? 'right' : 'left' }}
                >
                  {m.value} cm
                </AppText>
              </View>
              <Pressable
                onPress={() => removeCustom(m.id)}
                accessibilityRole="button"
                accessibilityLabel={t('common.delete')}
                hitSlop={8}
                style={{
                  minWidth: theme.sizes.touch.min,
                  minHeight: theme.sizes.touch.min,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="trash-outline" size={18} color={colors.error} />
              </Pressable>
            </View>
          ))
        )}
      </View>

      <BottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={t('mobile.newOrder.addMeasurement')}
        fitContent
        maxHeight={420}
      >
        <View style={{ gap: theme.spacing.md }}>
          <TextField
            label={t('mobile.newOrder.measurementLabel')}
            value={newLabel}
            onChangeText={setNewLabel}
            placeholder={t('mobile.newOrder.measurementLabelPlaceholder')}
          />
          <TextField
            label={t('mobile.newOrder.measurementValue')}
            value={newValue}
            onChangeText={setNewValue}
            keyboardType="decimal-pad"
            placeholder={t('mobile.newOrder.measurementValuePlaceholder')}
          />
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              gap: theme.spacing.sm,
            }}
          >
            <SecondaryButton
              label={t('mobile.newOrder.back')}
              onPress={() => setSheetOpen(false)}
              style={{ flex: 1 }}
            />
            <PrimaryButton
              label={t('mobile.newOrder.addMeasurement')}
              onPress={addCustom}
              disabled={!newLabel.trim() || !newValue.trim()}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </BottomSheet>
    </View>
  );
}
