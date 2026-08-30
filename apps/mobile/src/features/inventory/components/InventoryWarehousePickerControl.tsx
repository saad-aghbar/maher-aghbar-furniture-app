import { useState } from 'react';
import { Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { ActionSheet } from '@/components/sheets/ActionSheet';
import { useLocale } from '@/i18n';
import { haptics } from '@/motion';
import { useTheme } from '@/theme';

export type InventoryWarehouseOption = {
  id: string;
  code: string;
  nameEn: string;
  nameAr: string;
};

function warehouseDisplayName(w: InventoryWarehouseOption, locale: string): string {
  if (locale === 'ar') return w.nameAr || w.nameEn || w.code;
  return w.nameEn || w.nameAr || w.code;
}

/**
 * Compact warehouse control — opens ActionSheet instead of a chip strip.
 * Hidden when there is only one warehouse (no choice to make).
 */
export function InventoryWarehousePickerControl({
  warehouseId,
  warehouses,
  onWarehouseChange,
}: {
  warehouseId: string | null;
  warehouses: InventoryWarehouseOption[];
  onWarehouseChange: (id: string | null) => void;
}) {
  const { t, locale, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const [open, setOpen] = useState(false);

  if (warehouses.length <= 1) return null;

  const selected = warehouses.find((w) => w.id === warehouseId);
  const label = selected
    ? warehouseDisplayName(selected, locale)
    : t('mobile.inventory.fgAllWarehouses');

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() => {
          void haptics.selection();
          setOpen(true);
        }}
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          alignSelf: 'stretch',
          gap: 8,
          minHeight: 40,
          paddingHorizontal: theme.spacing.md,
          borderRadius: theme.radius.lg,
          borderWidth: 1,
          borderColor: colors.borderStrong,
          backgroundColor: colors.surfaceSecondary,
        }}
      >
        <Ionicons name="business-outline" size={16} color={colors.brand} />
        <AppText
          variant="caption"
          weight="semibold"
          numberOfLines={1}
          style={{
            flex: 1,
            color: colors.textPrimary,
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {label}
        </AppText>
        <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
      </Pressable>

      <ActionSheet
        open={open}
        onClose={() => setOpen(false)}
        title={t('mobile.inventory.fgWarehousePickerTitle')}
        actions={[
          {
            label: t('mobile.inventory.fgAllWarehouses'),
            icon: 'layers-outline',
            onPress: () => onWarehouseChange(null),
          },
          ...warehouses.map((w) => ({
            label: warehouseDisplayName(w, locale),
            icon: 'business-outline' as const,
            onPress: () => onWarehouseChange(w.id),
          })),
        ]}
      />
    </>
  );
}
