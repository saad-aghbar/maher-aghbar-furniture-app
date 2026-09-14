import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Warehouse } from '@/api/modules/inventory';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { QtyStepperField } from '@/components/forms/QtyStepperField';
import { PURCHASING_CHROME_CONTROL_H } from '@/features/purchasing/components/PurchasingFilterTriggers';
import { humanizeWarehouseLabel } from '@/features/purchasing/selectPurchase';
import type { ReturnRecoveryLine } from '@/features/returns/api';
import {
  locationsForWarehouse,
  WarehouseBinBoard,
} from '@/features/inventory/components/WarehouseBinBoard';
import { warehouseDisplayName as warehouseDeskName } from '@/features/inventory/warehouseDesk';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';

export type RecoveryPartDraft = {
  key: string;
  itemId?: string;
  sku?: string;
  label: string;
  quantity: string;
  unit: string;
  imageUrl?: string | null;
};

export type RecoveryDestGroup = {
  key: string;
  warehouseId?: string;
  locationId?: string;
  parts: RecoveryPartDraft[];
};

export function newRecoveryKey(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function emptyDestGroup(): RecoveryDestGroup {
  return {
    key: newRecoveryKey('d'),
    warehouseId: undefined,
    locationId: undefined,
    parts: [],
  };
}

export function warehouseDisplayName(warehouse: Warehouse, locale: string) {
  return warehouseDeskName(warehouse, locale);
}

export function RecoveryPlusTrigger({
  label,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  const { isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  return (
    <AnimatedPressable
      variant="button"
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={() => {
        void haptics.selection();
        onPress();
      }}
      style={{
        minHeight: PURCHASING_CHROME_CONTROL_H,
        borderRadius: theme.radius.xl,
        backgroundColor: colors.surfaceSecondary,
        borderWidth: 1.5,
        borderColor: colors.borderStrong,
        overflow: 'hidden',
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        paddingHorizontal: theme.spacing.md,
        gap: theme.spacing.sm,
        ...orderBoardShadow(colorScheme),
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
          borderColor: colors.border,
        }}
      >
        <Ionicons name="add" size={16} color={colors.brand} />
      </View>
      <AppText
        variant="caption"
        weight={titleWeight}
        numberOfLines={1}
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: 13,
          lineHeight: 16,
          color: colors.brand,
          textAlign: isRTL ? 'right' : 'left',
        }}
      >
        {label}
      </AppText>
    </AnimatedPressable>
  );
}

function RecoveryPartCard({
  part,
  onChangeQty,
  onRemove,
}: {
  part: RecoveryPartDraft;
  onChangeQty: (qty: string) => void;
  onRemove: () => void;
}) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const nameWeight = locale === 'ar' ? 'medium' : 'semibold';

  return (
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
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          width: 3,
          backgroundColor: colors.brand,
          opacity: 0.55,
          ...(isRTL ? { right: 0 } : { left: 0 }),
        }}
      />
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: theme.spacing.md,
          padding: theme.spacing.md,
          ...(isRTL
            ? { paddingRight: theme.spacing.md + 4 }
            : { paddingLeft: theme.spacing.md + 4 }),
        }}
      >
        <InventorySkuThumb uri={part.imageUrl} size={56} />
        <View style={{ flex: 1, minWidth: 0, gap: theme.spacing.sm }}>
          <AppText
            weight={nameWeight}
            numberOfLines={2}
            style={{ textAlign: isRTL ? 'right' : 'left' }}
          >
            {part.label}
          </AppText>
          {part.sku ? (
            <AppText variant="caption" color="muted" dir="ltr" numberOfLines={1}>
              {part.sku}
              {part.unit ? ` · ${part.unit}` : ''}
            </AppText>
          ) : null}
          <QtyStepperField
            accessibilityLabel={t('mobile.returns.quantity')}
            value={part.quantity}
            min={0.001}
            onChangeText={onChangeQty}
            unit={part.unit}
          />
        </View>
        <AnimatedPressable
          variant="button"
          accessibilityRole="button"
          accessibilityLabel={t('mobile.returns.recoveryRemovePart')}
          onPress={() => {
            void haptics.selection();
            onRemove();
          }}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surfaceSecondary,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Ionicons name="trash-outline" size={18} color={colors.brand} />
        </AnimatedPressable>
      </View>
    </View>
  );
}

export function RecoveryDestinationBoard({
  group,
  warehouses,
  recover,
  canRemove,
  onOpenWarehouse,
  onSelectLocation,
  onAddParts,
  onRemoveDest,
  onChangePartQty,
  onRemovePart,
}: {
  group: RecoveryDestGroup;
  warehouses: Warehouse[];
  recover: boolean;
  canRemove: boolean;
  onOpenWarehouse: () => void;
  onSelectLocation: (id: string) => void;
  onAddParts: () => void;
  onRemoveDest: () => void;
  onChangePartQty: (partKey: string, qty: string) => void;
  onRemovePart: (partKey: string) => void;
}) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const warehouse = warehouses.find((row) => row.id === group.warehouseId);
  const warehouseLabel = warehouse ? warehouseDisplayName(warehouse, locale) : null;
  const locations = locationsForWarehouse(warehouse);

  return (
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
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          width: 3,
          backgroundColor: colors.brand,
          opacity: 0.55,
          ...(isRTL ? { right: 0 } : { left: 0 }),
        }}
      />
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.sm,
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.md,
          ...(isRTL
            ? { paddingRight: theme.spacing.lg + 4 }
            : { paddingLeft: theme.spacing.lg + 4 }),
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
          backgroundColor: colors.surfaceSecondary,
        }}
      >
        <AppText
          variant="caption"
          weight={titleWeight}
          style={{
            flex: 1,
            color: colors.brand,
            textTransform: locale === 'ar' ? 'none' : 'uppercase',
            letterSpacing: locale === 'ar' ? 0 : 0.6,
            fontSize: 11,
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {recover
            ? t('mobile.returns.recoveryWarehouse')
            : t('mobile.returns.recoveryWasteCaption')}
        </AppText>
        {canRemove ? (
          <AnimatedPressable
            variant="button"
            accessibilityRole="button"
            accessibilityLabel={t('mobile.returns.recoveryRemoveDestination')}
            onPress={() => {
              void haptics.selection();
              onRemoveDest();
            }}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="close" size={18} color={colors.brand} />
          </AnimatedPressable>
        ) : null}
      </View>

      <View
        style={{
          gap: theme.spacing.md,
          padding: theme.spacing.md,
          ...(isRTL
            ? { paddingRight: theme.spacing.md + 4 }
            : { paddingLeft: theme.spacing.md + 4 }),
        }}
      >
        {recover ? (
          <WarehouseBinBoard
            warehouseLabel={warehouseLabel}
            warehouseSubtitle={
              warehouse
                ? [warehouse.code, humanizeWarehouseLabel(warehouse.type, t)]
                    .filter(Boolean)
                    .join(' · ') || undefined
                : undefined
            }
            warehousePlaceholder={t('mobile.returns.recoveryWarehouse')}
            locations={locations}
            selectedLocationId={group.locationId ?? ''}
            onOpenWarehouse={onOpenWarehouse}
            onSelectLocation={onSelectLocation}
            locationLabel={t('mobile.returns.recoveryLocation')}
            searchPlaceholder={t('mobile.returns.recoverySearchBin')}
          />
        ) : null}

        {group.parts.map((part) => (
          <RecoveryPartCard
            key={part.key}
            part={part}
            onChangeQty={(qty) => onChangePartQty(part.key, qty)}
            onRemove={() => onRemovePart(part.key)}
          />
        ))}

        <RecoveryPlusTrigger
          label={t('mobile.returns.recoveryAddParts')}
          accessibilityLabel={t('mobile.returns.recoveryPickItem')}
          onPress={onAddParts}
        />
      </View>
    </View>
  );
}

export function RecoverySavedLineCard({
  line,
  warehouses,
  readOnly,
  posting,
  onPost,
  onEdit,
  onDelete,
}: {
  line: ReturnRecoveryLine;
  warehouses: Warehouse[];
  readOnly: boolean;
  posting: boolean;
  onPost: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const posted = Boolean(line.postedAt);
  const warehouse = warehouses.find((row) => row.id === line.destinationWarehouseId);
  const location = warehouse?.locations?.find((row) => row.id === line.destinationLocationId);
  const place = [warehouse ? warehouseDisplayName(warehouse, locale) : null, location?.name || location?.code]
    .filter(Boolean)
    .join(' · ');
  const caption =
    line.outcome === 'RECOVER_TO_INVENTORY'
      ? place
        ? t('mobile.returns.recoveryPutInto', { place })
        : t('mobile.returns.recoveryWarehouse')
      : t('mobile.returns.recoveryWasteCaption');
  const accent = posted
    ? colors.success
    : line.outcome === 'DAMAGED'
      ? colors.error
      : line.outcome === 'DISPOSE'
        ? colors.warning
        : colors.brand;

  return (
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
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          width: 3,
          backgroundColor: accent,
          opacity: posted || accent !== colors.brand ? 0.9 : 0.55,
          ...(isRTL ? { right: 0 } : { left: 0 }),
        }}
      />
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.sm,
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.md,
          ...(isRTL
            ? { paddingRight: theme.spacing.lg + 4 }
            : { paddingLeft: theme.spacing.lg + 4 }),
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
          backgroundColor: colors.surfaceSecondary,
        }}
      >
        <StatusBadge
          status={line.outcome}
          label={t(`mobile.returns.recoveryOutcome.${line.outcome}`)}
          dot
        />
        <AppText
          variant="caption"
          color="muted"
          numberOfLines={2}
          style={{ flex: 1, textAlign: isRTL ? 'left' : 'right' }}
        >
          {posted ? t('mobile.returns.recoveryPosted') : caption}
        </AppText>
      </View>

      <View
        style={{
          gap: theme.spacing.sm,
          padding: theme.spacing.md,
          ...(isRTL
            ? { paddingRight: theme.spacing.md + 4 }
            : { paddingLeft: theme.spacing.md + 4 }),
        }}
      >
        <AppText weight={titleWeight} style={{ textAlign: isRTL ? 'right' : 'left' }}>
          {line.label}
        </AppText>
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'baseline',
            gap: 6,
            alignSelf: isRTL ? 'flex-end' : 'flex-start',
            paddingHorizontal: theme.spacing.sm,
            paddingVertical: 5,
            borderRadius: theme.radius.md,
            backgroundColor: colors.surfaceSecondary,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <AppText variant="caption" color="muted" weight={locale === 'ar' ? 'regular' : 'medium'}>
            {t('mobile.returns.quantity')}
          </AppText>
          <AppText
            variant="caption"
            weight={titleWeight}
            dir="ltr"
          >
            {String(line.quantity)} {line.unit}
          </AppText>
        </View>
        {posted || readOnly ? null : (
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: theme.spacing.sm,
            }}
          >
            <RecoveryActionChip
              label={t('mobile.returns.recoveryPost')}
              tone="solid"
              onPress={onPost}
              disabled={posting}
            />
            <RecoveryActionChip
              label={t('common.edit')}
              tone="ghost"
              onPress={onEdit}
            />
            <RecoveryActionChip
              label={t('common.delete')}
              tone="ghost"
              onPress={onDelete}
            />
          </View>
        )}
      </View>
    </View>
  );
}

function RecoveryActionChip({
  label,
  tone,
  onPress,
  disabled,
}: {
  label: string;
  tone: 'solid' | 'ghost';
  onPress: () => void;
  disabled?: boolean;
}) {
  const { colors, theme } = useTheme();
  const { locale } = useLocale();
  const ghost = tone === 'ghost';

  return (
    <AnimatedPressable
      variant="button"
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={() => {
        void haptics.selection();
        onPress();
      }}
      style={{
        minHeight: 40,
        paddingHorizontal: theme.spacing.md,
        borderRadius: theme.radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.55 : 1,
        backgroundColor: ghost ? colors.surfaceSecondary : colors.brand,
        borderWidth: 1,
        borderColor: ghost ? colors.border : colors.brand,
      }}
    >
      <AppText
        variant="caption"
        weight={locale === 'ar' ? 'medium' : 'semibold'}
        style={{ color: ghost ? colors.textPrimary : colors.onBrand }}
      >
        {label}
      </AppText>
    </AnimatedPressable>
  );
}
