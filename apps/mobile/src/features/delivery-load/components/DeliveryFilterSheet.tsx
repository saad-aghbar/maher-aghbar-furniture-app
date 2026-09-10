import { useEffect, useState } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';

export type DeliveryFilterDraft = {
  dealerId: string;
  warehouseId: string;
  status: string;
};

export type DeliveryFilterOption = { id: string; label: string };

type Props = {
  open: boolean;
  onClose: () => void;
  draft: DeliveryFilterDraft;
  onChange: (draft: DeliveryFilterDraft) => void;
  onApply: () => void;
  onReset: () => void;
  dealers: DeliveryFilterOption[];
  warehouses: DeliveryFilterOption[];
  statuses: DeliveryFilterOption[];
};

function ChipRow({
  options,
  selectedId,
  onSelect,
}: {
  options: DeliveryFilterOption[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const { isRTL } = useLocale();
  const { colors, theme } = useTheme();
  return (
    <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
      {options.map((opt) => {
        const on = selectedId === opt.id;
        return (
          <AnimatedPressable
            key={opt.id}
            variant="button"
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => {
              void haptics.selection();
              onSelect(opt.id);
            }}
            style={{
              minHeight: 40,
              paddingHorizontal: theme.spacing.md,
              borderRadius: theme.radius.lg,
              borderWidth: 1,
              borderColor: on ? colors.brand : colors.border,
              backgroundColor: on ? colors.brandSoft : colors.surfaceSecondary,
              justifyContent: 'center',
            }}
          >
            <AppText variant="caption" weight={on ? 'semibold' : 'medium'}>
              {opt.label}
            </AppText>
          </AnimatedPressable>
        );
      })}
    </View>
  );
}

export function countDeliveryFilters(draft: DeliveryFilterDraft): number {
  return [draft.dealerId, draft.warehouseId, draft.status].filter(Boolean).length;
}

export function DeliveryFilterSheet({
  open,
  onClose,
  draft,
  onChange,
  onApply,
  onReset,
  dealers,
  warehouses,
  statuses,
}: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const { height } = useWindowDimensions();
  const sheetHeight = Math.min(Math.round(height * 0.78), 640);
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const [local, setLocal] = useState(draft);

  useEffect(() => {
    if (open) setLocal(draft);
  }, [open, draft]);

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('mobile.deliveryLoad.filterTitle')}
      overlay
      expandable
      sheetHeight={sheetHeight}
    >
      <View style={{ flex: 1, minHeight: 0, gap: theme.spacing.md }}>
        <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
          <View style={{ gap: theme.spacing.lg, paddingBottom: theme.spacing.md }}>
            <View style={{ gap: theme.spacing.sm }}>
              <AppText variant="caption" weight={titleWeight} color="brand" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                {t('mobile.deliveryLoad.filterDealer')}
              </AppText>
              <ChipRow
                options={[{ id: '', label: t('mobile.deliveryLoad.filterAny') }, ...dealers]}
                selectedId={local.dealerId}
                onSelect={(dealerId) => {
                  const next = { ...local, dealerId };
                  setLocal(next);
                  onChange(next);
                }}
              />
            </View>
            <View style={{ gap: theme.spacing.sm }}>
              <AppText variant="caption" weight={titleWeight} color="brand" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                {t('mobile.deliveryLoad.filterWarehouse')}
              </AppText>
              <ChipRow
                options={[{ id: '', label: t('mobile.deliveryLoad.filterAny') }, ...warehouses]}
                selectedId={local.warehouseId}
                onSelect={(warehouseId) => {
                  const next = { ...local, warehouseId };
                  setLocal(next);
                  onChange(next);
                }}
              />
            </View>
            <View style={{ gap: theme.spacing.sm }}>
              <AppText variant="caption" weight={titleWeight} color="brand" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                {t('mobile.deliveryLoad.filterStatus')}
              </AppText>
              <ChipRow
                options={[{ id: '', label: t('mobile.deliveryLoad.filterAny') }, ...statuses]}
                selectedId={local.status}
                onSelect={(status) => {
                  const next = { ...local, status };
                  setLocal(next);
                  onChange(next);
                }}
              />
            </View>
          </View>
        </ScrollView>
        <PrimaryButton
          label={t('mobile.orders.apply')}
          onPress={() => {
            void haptics.confirmLight();
            onApply();
          }}
        />
        <SecondaryButton label={t('mobile.orders.reset')} onPress={onReset} />
      </View>
    </BottomSheet>
  );
}
