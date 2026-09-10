import { useEffect, useMemo, useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Warehouse } from '@/api/modules/inventory';
import { AppText } from '@/components/AppText';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { AppTextInput } from '@/components/forms/AppTextInput';
import { SearchBarShell } from '@/components/forms/SearchBarShell';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { useLocale } from '@/i18n';
import { resolveAppFontStyle, useTheme } from '@/theme';
import { humanizeWarehouseLabel } from '../selectPurchase';
import { HoldingLocationPickList } from './HoldingLocationPickList';
import { PurchasingWarehousePickList } from './PurchasingWarehousePickList';
import {
  locationsForWarehouse,
  WarehouseBinStrip,
} from '@/features/inventory/components/WarehouseBinBoard';
import { pickDefaultLocationId, locationPickerLabel, pickerViewportHeights } from '@/features/inventory/pickDefaultLocation';

type Props = {
  open: boolean;
  onClose: () => void;
  mode: 'warehouse' | 'location';
  warehouses: Warehouse[];
  selectedWarehouseId: string;
  selectedLocationId?: string;
  onSelectWarehouse: (id: string) => void;
  onSelectLocation?: (id: string, warehouseId: string) => void;
  overlay?: boolean;
  searchPlaceholder?: string;
};

export function DestinationPickSheet({
  open,
  onClose,
  mode,
  warehouses,
  selectedWarehouseId,
  selectedLocationId,
  onSelectWarehouse,
  onSelectLocation,
  overlay = false,
  searchPlaceholder,
}: Props) {
  const { t, locale, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const { height } = useWindowDimensions();
  const pickerHeights = pickerViewportHeights(height);
  const sheetHeight = pickerHeights.sheet;
  const holding = mode === 'location';
  const [query, setQuery] = useState('');
  const [pickedWarehouseId, setPickedWarehouseId] = useState(selectedWarehouseId);
  const needle = query.trim().toLowerCase();
  useEffect(() => {
    if (!open) setQuery('');
    else setPickedWarehouseId(selectedWarehouseId);
  }, [open, selectedWarehouseId]);
  const locations = useMemo(
    () =>
      warehouses.flatMap((wh) =>
        (wh.locations ?? []).map((loc) => ({
          id: loc.id,
          name: locationPickerLabel(loc) || loc.name || loc.code || loc.id,
          warehouseId: wh.id,
        })),
      ).filter((loc) => {
        if (!needle) return true;
        return loc.name.toLowerCase().includes(needle);
      }),
    [needle, warehouses],
  );
  const warehouseRows = useMemo(
    () =>
      warehouses
        .map((wh) => {
          const typeLabel = humanizeWarehouseLabel(wh.type, t);
          const subtitle = [wh.code, typeLabel].filter(Boolean).join(' · ') || undefined;
          const name =
            locale === 'ar'
              ? wh.nameAr || wh.nameEn || wh.code
              : wh.nameEn || wh.nameAr || wh.code;
          return {
            id: wh.id,
            name,
            subtitle,
            search: [name, wh.code, typeLabel, subtitle].filter(Boolean).join(' '),
          };
        })
        .filter((row) => {
          if (!needle) return true;
          return row.search.toLowerCase().includes(needle);
        })
        .map(({ search: _search, ...row }) => row),
    [locale, needle, t, warehouses],
  );

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      overlay={overlay}
      title={
        holding
          ? t('mobile.purchasing.pickHoldingLocation')
          : t('mobile.purchasing.pickWarehouse')
      }
      fitContent
      expandable
      maxHeight={sheetHeight}
    >
      <View
        style={{
          borderRadius: theme.radius.xl,
          borderWidth: 1,
          borderColor: colors.borderStrong,
          backgroundColor: colors.surfaceSecondary,
          padding: theme.spacing.md,
          gap: theme.spacing.sm,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: theme.spacing.sm,
          }}
        >
          <Ionicons
            name={holding ? 'location-outline' : 'cube-outline'}
            size={16}
            color={colors.brand}
          />
          <AppText
            variant="caption"
            style={{
              flex: 1,
              textTransform: locale === 'ar' ? 'none' : 'uppercase',
              letterSpacing: locale === 'ar' ? 0 : 0.6,
              fontSize: 11,
              color: colors.brand,
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {holding ? t('mobile.purchasing.holdingPlace') : t('mobile.purchasing.warehouse')}
          </AppText>
        </View>
        {warehouseRows.length > 4 || locations.length > 4 || query ? (
          <SearchBarShell>
            <AppTextInput
              value={query}
              onChangeText={setQuery}
              placeholder={
                searchPlaceholder ??
                (holding
                  ? t('mobile.inventory.searchPlaceholder', {
                      group: t('mobile.purchasing.holdingPlace'),
                    })
                  : t('mobile.inventory.searchWarehouses'))
              }
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              clearButtonMode="while-editing"
              style={{
                flex: 1,
                minWidth: 0,
                paddingVertical: theme.spacing.sm,
                fontSize: 16,
                color: colors.textPrimary,
                textAlign: isRTL ? 'right' : 'left',
                ...resolveAppFontStyle(locale, { variant: 'body' }),
              }}
            />
          </SearchBarShell>
        ) : null}
        {holding ? (
          <HoldingLocationPickList
            locations={locations}
            selectedId={selectedLocationId ?? ''}
            listHeight={pickerHeights.warehouse}
            onSelect={(loc) => {
              onSelectLocation?.(loc.id, loc.warehouseId);
              onClose();
            }}
          />
        ) : (
          <>
            <PurchasingWarehousePickList
              warehouses={warehouseRows}
              selectedId={pickedWarehouseId}
              listHeight={pickerHeights.warehouse}
              onSelect={(id) => {
                onSelectWarehouse(id);
                setPickedWarehouseId(id);
                const bins = locationsForWarehouse(warehouses.find((wh) => wh.id === id));
                if (bins.length === 0) {
                  onClose();
                  return;
                }
                const def = pickDefaultLocationId(bins, selectedLocationId);
                if (def) onSelectLocation?.(def, id);
              }}
            />
            {pickedWarehouseId ? (
              <WarehouseBinStrip
                locations={locationsForWarehouse(
                  warehouses.find((wh) => wh.id === pickedWarehouseId),
                )}
                selectedId={selectedLocationId ?? ''}
                listHeight={pickerHeights.bin}
                onSelect={(id) => {
                  onSelectLocation?.(id, pickedWarehouseId);
                  onClose();
                }}
              />
            ) : null}
          </>
        )}
      </View>
      <SecondaryButton
        label={t('mobile.purchasing.cancel')}
        onPress={onClose}
        style={{ borderRadius: theme.radius.full, minHeight: theme.sizes.touch.min, marginTop: theme.spacing.sm }}
      />
    </BottomSheet>
  );
}
