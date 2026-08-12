import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { TextField } from '@/components/forms/TextField';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import type { NewOrderCustomMeasurement, NewOrderDimensionFields } from '../newOrderMeasurements';

const FLOOR_LIST_VISIBLE_ROWS = 3;
const MEASUREMENT_ROW_ESTIMATE = 72;

type Props = {
  value: NewOrderDimensionFields;
  onChange: (next: NewOrderDimensionFields) => void;
};

export function NewOrderDimensionsEditor({ value, onChange }: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
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
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: theme.spacing.sm,
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.sm + 2,
            backgroundColor: colors.surfaceSecondary,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.border,
          }}
        >
          <AppText
            variant="caption"
            weight={titleWeight}
            style={{
              textTransform: locale === 'ar' ? 'none' : 'uppercase',
              letterSpacing: locale === 'ar' ? 0 : 0.7,
              fontSize: 11,
              color: colors.brand,
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {t('mobile.newOrder.customMeasurements')}
          </AppText>
          <AppText variant="caption" color="muted" dir="ltr">
            {String(value.custom.length)}
          </AppText>
        </View>

        <View style={{ padding: theme.spacing.sm, gap: theme.spacing.sm }}>
          {value.custom.length === 0 ? (
            <View
              style={{
                borderRadius: theme.radius.xl,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surfaceSecondary,
                paddingVertical: theme.spacing.xl,
                paddingHorizontal: theme.spacing.lg,
                alignItems: 'center',
                gap: theme.spacing.sm,
              }}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Ionicons name="resize-outline" size={20} color={colors.textMuted} />
              </View>
              <AppText variant="caption" color="muted" style={{ textAlign: 'center' }}>
                {t('mobile.newOrder.noCustomMeasurements')}
              </AppText>
            </View>
          ) : (
            <CappedNestedScroll
              itemCount={value.custom.length}
              rowEstimate={MEASUREMENT_ROW_ESTIMATE}
              gap={theme.spacing.sm}
            >
              {value.custom.map((m) => (
                <CustomMeasurementFloorRow
                  key={m.id}
                  name={m.label}
                  valueLabel={`${m.value} cm`}
                  titleWeight={titleWeight}
                  onRemove={() => removeCustom(m.id)}
                />
              ))}
            </CappedNestedScroll>
          )}
        </View>
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

function CustomMeasurementFloorRow({
  name,
  valueLabel,
  titleWeight,
  onRemove,
}: {
  name: string;
  valueLabel: string;
  titleWeight: 'medium' | 'semibold';
  onRemove: () => void;
}) {
  const { colors, theme, colorScheme } = useTheme();
  const { isRTL, t } = useLocale();

  return (
    <View
      style={{
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: colors.borderStrong,
        backgroundColor: colors.surfaceSecondary,
        overflow: 'hidden',
        ...orderBoardShadow(colorScheme),
      }}
    >
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          ...(isRTL ? { right: 0 } : { left: 0 }),
          width: 3,
          backgroundColor: colors.brand,
          opacity: 0.75,
        }}
      />
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: theme.spacing.md,
          paddingVertical: theme.spacing.md,
          paddingHorizontal: theme.spacing.md,
          ...(isRTL
            ? { paddingRight: theme.spacing.md + 4 }
            : { paddingLeft: theme.spacing.md + 4 }),
        }}
      >
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.brandSoft,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Ionicons name="resize-outline" size={18} color={colors.brand} />
        </View>

        <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
          <AppText
            variant="label"
            weight={titleWeight}
            numberOfLines={1}
            style={{ textAlign: isRTL ? 'right' : 'left' }}
          >
            {name}
          </AppText>
        </View>

        <View
          style={{
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.sm,
            borderRadius: theme.radius.lg,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.borderStrong,
          }}
        >
          <AppText
            variant="label"
            weight={titleWeight}
            dir="ltr"
            style={{ color: colors.brand }}
          >
            {valueLabel}
          </AppText>
        </View>

        <AnimatedPressable
          variant="button"
          accessibilityRole="button"
          accessibilityLabel={t('common.delete')}
          onPress={onRemove}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.errorSoft,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Ionicons name="trash-outline" size={16} color={colors.error} />
        </AnimatedPressable>
      </View>
    </View>
  );
}

/**
 * Nested ScrollViews ignore maxHeight inside a parent ScrollView on iOS.
 * Few items stay natural height; longer lists pin a fixed box and scroll in-place.
 */
function CappedNestedScroll({
  itemCount,
  rowEstimate,
  gap,
  visibleRows = FLOOR_LIST_VISIBLE_ROWS,
  children,
}: {
  itemCount: number;
  rowEstimate: number;
  gap: number;
  visibleRows?: number;
  children: ReactNode;
}) {
  const scrollable = itemCount > visibleRows;
  const capHeight = visibleRows * rowEstimate + Math.max(0, visibleRows - 1) * gap;

  if (!scrollable) {
    return <View style={{ gap }}>{children}</View>;
  }

  return (
    <View style={{ height: capHeight, overflow: 'hidden' }}>
      <ScrollView
        nestedScrollEnabled
        showsVerticalScrollIndicator
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1 }}
        contentContainerStyle={{ gap, paddingBottom: 2 }}
      >
        {children}
      </ScrollView>
    </View>
  );
}
