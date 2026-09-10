import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { AppTextInput } from '@/components/forms/AppTextInput';
import { SearchBarShell } from '@/components/forms/SearchBarShell';
import { HoldingLocationPickList } from '@/features/purchasing/components/HoldingLocationPickList';
import { PURCHASING_CHROME_CONTROL_H } from '@/features/purchasing/components/PurchasingFilterTriggers';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { resolveAppFontStyle, useTheme } from '@/theme';
import {
  locationPickerLabel,
  pickDefaultLocationId,
  sortBinsForPicker,
  type BinLike,
} from '../pickDefaultLocation';

export type WarehouseBinOption = BinLike & {
  warehouseId: string;
  qrCode?: string | null;
};

export function locationsForWarehouse(
  warehouse?: {
    id?: string;
    code?: string;
    locations?: Array<{
      id: string;
      code: string;
      name?: string | null;
      isDefault?: boolean;
      isActive?: boolean;
      qrCode?: string | null;
      warehouseId?: string;
    }> | null;
  } | null,
): WarehouseBinOption[] {
  return sortBinsForPicker(
    (warehouse?.locations ?? [])
      .filter((loc) => loc.isActive !== false)
      .map((loc) => ({
        id: loc.id,
        warehouseId: warehouse?.id ?? loc.warehouseId ?? '',
        code: loc.code,
        name: loc.name,
        isDefault: loc.isDefault,
        isActive: loc.isActive,
        qrCode: loc.qrCode,
      })),
  );
}

export function toHoldingRows(locations: WarehouseBinOption[]) {
  return locations.map((loc) => ({
    id: loc.id,
    name: locationPickerLabel(loc) || loc.id,
    warehouseId: loc.warehouseId,
  }));
}

/** Warehouse on its own line, bin code+name as an LTR caption so RTL does not split "Main floor". */
export function WarehouseBinPlace({
  warehouseName,
  binLabel,
  titleWeight,
}: {
  warehouseName?: string | null;
  binLabel?: string | null;
  titleWeight?: 'regular' | 'medium' | 'semibold';
}) {
  const { isRTL, locale } = useLocale();
  const weight = titleWeight ?? (locale === 'ar' ? 'regular' : 'medium');
  const warehouse = warehouseName?.trim() || '';
  const bin = binLabel?.trim() || '';
  if (!warehouse && !bin) return null;
  return (
    <View style={{ gap: 2 }}>
      {warehouse ? (
        <AppText
          variant="body"
          weight={weight}
          style={{ textAlign: isRTL ? 'right' : 'left' }}
        >
          {warehouse}
        </AppText>
      ) : null}
      {bin ? (
        <AppText
          variant="caption"
          color="muted"
          dir="ltr"
          style={{ textAlign: isRTL ? 'right' : 'left' }}
        >
          {bin}
        </AppText>
      ) : null}
    </View>
  );
}

export function WarehouseBinTrigger({
  label,
  subtitle,
  placeholder,
  accessibilityLabel,
  onPress,
  onScanPress,
}: {
  label: string | null;
  subtitle?: string;
  placeholder?: string;
  accessibilityLabel?: string;
  onPress: () => void;
  onScanPress?: () => void;
}) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const active = Boolean(label);

  return (
    <View
      style={{
        minHeight: PURCHASING_CHROME_CONTROL_H,
        borderRadius: theme.radius.xl,
        backgroundColor: active ? colors.brandSoft : colors.surfaceSecondary,
        borderWidth: 1.5,
        borderColor: active ? colors.brand : colors.borderStrong,
        overflow: 'hidden',
        ...orderBoardShadow(colorScheme),
      }}
    >
      {active ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 6,
            bottom: 6,
            width: 3,
            borderRadius: 2,
            backgroundColor: colors.brand,
            opacity: 0.85,
            ...(isRTL ? { right: 0 } : { left: 0 }),
          }}
        />
      ) : null}
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
        }}
      >
        <AnimatedPressable
          variant="button"
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel ?? t('mobile.purchasing.pickWarehouse')}
          accessibilityState={{ selected: active }}
          onPress={() => {
            void haptics.selection();
            onPress();
          }}
          style={{
            flex: 1,
            minHeight: PURCHASING_CHROME_CONTROL_H,
            paddingHorizontal: theme.spacing.md,
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: theme.spacing.sm,
            ...(isRTL
              ? { paddingRight: active ? theme.spacing.md + 4 : theme.spacing.md }
              : { paddingLeft: active ? theme.spacing.md + 4 : theme.spacing.md }),
          }}
        >
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: active ? colors.brand : colors.border,
            }}
          >
            <Ionicons
              name="cube-outline"
              size={15}
              color={active ? colors.brand : colors.textSecondary}
            />
          </View>
          <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
            <AppText
              variant="caption"
              weight={titleWeight}
              numberOfLines={2}
              dir={active ? 'ltr' : 'auto'}
              style={{
                fontSize: 13,
                lineHeight: 16,
                color: active ? colors.brand : colors.textPrimary,
                textAlign: isRTL ? 'right' : 'left',
              }}
            >
              {label ?? placeholder ?? t('mobile.inventory.binWarehouse')}
            </AppText>
            {subtitle ? (
              <AppText
                variant="caption"
                color="muted"
                numberOfLines={1}
                dir="ltr"
                style={{ textAlign: isRTL ? 'right' : 'left' }}
              >
                {subtitle}
              </AppText>
            ) : null}
          </View>
          <Ionicons
            name={isRTL ? 'chevron-back' : 'chevron-forward'}
            size={16}
            color={active ? colors.brand : colors.textMuted}
          />
        </AnimatedPressable>
        {onScanPress ? (
          <AnimatedPressable
            variant="button"
            accessibilityRole="button"
            accessibilityLabel={t('mobile.inventory.scanBin')}
            onPress={() => {
              void haptics.selection();
              onScanPress();
            }}
            style={{
              width: 48,
              minHeight: PURCHASING_CHROME_CONTROL_H,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="qr-code-outline" size={18} color={colors.brand} />
          </AnimatedPressable>
        ) : null}
      </View>
    </View>
  );
}

export function WarehouseBinStrip({
  locations,
  selectedId,
  onSelect,
  label,
  searchPlaceholder,
  listHeight = 180,
  emptyText,
  onScanPress,
}: {
  locations: WarehouseBinOption[];
  selectedId: string;
  onSelect: (id: string) => void;
  label?: string;
  searchPlaceholder?: string;
  listHeight?: number;
  emptyText?: string;
  onScanPress?: () => void;
}) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const [binQuery, setBinQuery] = useState('');
  const locationRows = useMemo(() => {
    const needle = binQuery.trim().toLowerCase();
    const filtered = needle
      ? locations.filter((loc) =>
          `${loc.name ?? ''} ${loc.code ?? ''} ${loc.qrCode ?? ''}`.toLowerCase().includes(needle),
        )
      : locations;
    return toHoldingRows(filtered);
  }, [binQuery, locations]);

  if (locations.length === 0) {
    return emptyText ? (
      <AppText
        variant="caption"
        color="muted"
        style={{ textAlign: isRTL ? 'right' : 'left' }}
      >
        {emptyText}
      </AppText>
    ) : null;
  }

  return (
    <View
      style={{
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surfaceSecondary,
        padding: theme.spacing.md,
        gap: theme.spacing.sm,
      }}
    >
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
        }}
      >
        <AppText
          variant="caption"
          weight={titleWeight}
          style={{
            flex: 1,
            color: colors.brand,
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {label ?? t('mobile.inventory.binShelf')}
        </AppText>
        {onScanPress ? (
          <AnimatedPressable
            variant="button"
            accessibilityRole="button"
            accessibilityLabel={t('mobile.inventory.scanBin')}
            onPress={() => {
              void haptics.selection();
              onScanPress();
            }}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Ionicons name="qr-code-outline" size={16} color={colors.brand} />
          </AnimatedPressable>
        ) : null}
      </View>
      {locations.length > 4 || binQuery ? (
        <SearchBarShell>
          <AppTextInput
            value={binQuery}
            onChangeText={setBinQuery}
            placeholder={searchPlaceholder ?? t('mobile.inventory.searchBins')}
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
      <HoldingLocationPickList
        locations={locationRows}
        selectedId={selectedId}
        listHeight={listHeight}
        onSelect={(loc) => onSelect(loc.id)}
      />
    </View>
  );
}

export function WarehouseBinBoard({
  warehouseLabel,
  warehouseSubtitle,
  warehousePlaceholder,
  locations,
  selectedLocationId,
  onOpenWarehouse,
  onSelectLocation,
  onScanPress,
  locationLabel,
  searchPlaceholder,
  emptyText,
  listHeight,
}: {
  warehouseLabel: string | null;
  warehouseSubtitle?: string;
  warehousePlaceholder?: string;
  locations: WarehouseBinOption[];
  selectedLocationId: string;
  onOpenWarehouse: () => void;
  onSelectLocation: (id: string) => void;
  onScanPress?: () => void;
  locationLabel?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  listHeight?: number;
}) {
  return (
    <View style={{ gap: 12 }}>
      <WarehouseBinTrigger
        label={warehouseLabel}
        subtitle={warehouseSubtitle}
        placeholder={warehousePlaceholder}
        onPress={onOpenWarehouse}
        onScanPress={onScanPress}
      />
      {locations.length > 0 ? (
        <WarehouseBinStrip
          locations={locations}
          selectedId={selectedLocationId}
          onSelect={onSelectLocation}
          label={locationLabel}
          searchPlaceholder={searchPlaceholder}
          emptyText={emptyText}
          listHeight={listHeight}
        />
      ) : null}
    </View>
  );
}

export { pickDefaultLocationId };
