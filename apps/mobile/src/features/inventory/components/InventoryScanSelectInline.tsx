import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { useLocale } from '@/i18n';
import { haptics } from '@/motion';
import { useTheme } from '@/theme';
import type { InventoryItem } from '../api';
import {
  formatInventoryMaterialType,
  selectInventoryItemCard,
} from '../selectInventory';
import { InventorySkuThumb } from './InventorySkuThumb';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';

export type InlineScanSelectMode =
  | 'confirm'
  | 'blocked-type'
  | 'blocked-inactive'
  | 'not-found'
  | 'order-fabric'
  | 'error';

type Props = {
  mode: InlineScanSelectMode;
  item: InventoryItem | null;
  onScanAgain: () => void;
  onCancel: () => void;
  onUseMaterial?: () => void;
  /** Bundle identity when `mode` is `order-fabric`. */
  fabric?: { code: string; label: string | null; orderNumber: string | null } | null;
  onOpenFabric?: () => void;
};

/**
 * SELECT confirmation rendered INSIDE the operation sheet (no RN Modal).
 * Selecting material never mutates stock.
 */
export function InventoryScanSelectInline({
  mode,
  item,
  onScanAgain,
  onCancel,
  onUseMaterial,
  fabric,
  onOpenFabric,
}: Props) {
  const { t, locale, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const card = item ? selectInventoryItemCard(item, locale) : null;
  const materialTypeLabel = formatInventoryMaterialType(card?.materialType, t);
  const canUse = mode === 'confirm' && Boolean(onUseMaterial) && Boolean(card);

  const title =
    mode === 'confirm'
      ? t('mobile.inventory.materialScanned')
      : mode === 'blocked-inactive'
        ? t('mobile.inventory.inactiveCannotSelect')
        : mode === 'blocked-type'
          ? t('mobile.inventory.cannotUseHere')
          : mode === 'order-fabric'
            ? t('mobile.inventory.fabricScanNotStockTitle')
            : mode === 'not-found'
              ? t('mobile.inventory.itemNotFound')
              : t('mobile.inventory.couldntIdentifyItem');

  return (
    <View
      accessibilityLiveRegion="polite"
      style={{
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: canUse ? colors.brand : colors.warning ?? colors.error,
        backgroundColor: colors.surface,
        padding: theme.spacing.md,
        gap: theme.spacing.md,
        ...orderBoardShadow(colorScheme),
      }}
    >
      {card ? (
        <View style={{ gap: theme.spacing.sm }}>
          <AppText variant="caption" color="muted">
            {t('mobile.inventory.materialScanned')}
          </AppText>
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              gap: theme.spacing.md,
              alignItems: 'center',
            }}
          >
            <InventorySkuThumb uri={card.imageUrl} size={72} />
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="body" weight="semibold">
                {card.name}
              </AppText>
              <AppText variant="caption" color="muted" dir="ltr">
                {[card.sku, materialTypeLabel, card.unit].filter(Boolean).join(' · ')}
              </AppText>
              <StatusBadge
                status={card.isActive ? 'ACTIVE' : 'CANCELLED'}
                label={
                  card.isActive
                    ? t('mobile.inventory.inStock')
                    : t('mobile.inventory.inactiveMaterial')
                }
                dot
              />
            </View>
          </View>
        </View>
      ) : (
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            gap: theme.spacing.sm,
            alignItems: 'center',
          }}
        >
          <Ionicons
            name={
              mode === 'error'
                ? 'cloud-offline-outline'
                : mode === 'order-fabric'
                  ? 'color-palette-outline'
                  : 'alert-circle-outline'
            }
            size={28}
            color={colors.warning}
          />
          <AppText variant="body" weight="semibold" style={{ flex: 1 }}>
            {title}
          </AppText>
        </View>
      )}

      {mode === 'confirm' ? (
        <AppText variant="body" weight="medium">
          {t('mobile.inventory.useThisMaterial')}
        </AppText>
      ) : null}

      {mode === 'blocked-inactive' || mode === 'blocked-type' ? (
        <AppText variant="caption" color="muted">
          {mode === 'blocked-inactive'
            ? t('mobile.inventory.inactiveCannotSelect')
            : t('mobile.inventory.cannotUseHere')}
        </AppText>
      ) : null}

      {mode === 'order-fabric' ? (
        <View style={{ gap: 2 }}>
          <AppText variant="caption" color="muted">
            {t('mobile.inventory.fabricScanNotStockBody', {
              order: fabric?.orderNumber ?? '—',
            })}
          </AppText>
          {fabric?.label ? (
            <AppText variant="caption" weight="medium">
              {fabric.label}
            </AppText>
          ) : null}
          {fabric?.code ? (
            <AppText variant="caption" color="muted" dir="ltr">
              {fabric.code}
            </AppText>
          ) : null}
        </View>
      ) : null}

      {mode === 'not-found' ? (
        <AppText variant="caption" color="muted">
          {t('mobile.inventory.labelUnknownBody')}
        </AppText>
      ) : null}

      {mode === 'error' ? (
        <AppText variant="caption" color="muted">
          {t('mobile.inventory.couldntIdentifyHint')}
        </AppText>
      ) : null}

      <View style={{ gap: theme.spacing.sm }}>
        {canUse ? (
          <ActionPill
            label={t('mobile.inventory.useMaterial')}
            brand
            onPress={() => {
              void haptics.confirmLight();
              onUseMaterial?.();
            }}
          />
        ) : null}
        {mode === 'order-fabric' && onOpenFabric ? (
          <ActionPill
            label={t('mobile.inventory.fabricScanOpenBundle')}
            brand
            onPress={() => {
              void haptics.selection();
              onOpenFabric();
            }}
          />
        ) : null}
        <ActionPill
          label={
            mode === 'error'
              ? t('mobile.inventory.tryAgain')
              : t('mobile.inventory.scanAgain')
          }
          brand={!canUse}
          onPress={() => {
            void haptics.selection();
            onScanAgain();
          }}
        />
        <ActionPill
          label={t('mobile.inventory.cancel')}
          onPress={() => {
            void haptics.selection();
            onCancel();
          }}
        />
      </View>
    </View>
  );
}

function ActionPill({
  label,
  onPress,
  brand,
}: {
  label: string;
  onPress: () => void;
  brand?: boolean;
}) {
  const { colors, theme, colorScheme } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        minHeight: 44,
        borderRadius: theme.radius.xl,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: theme.spacing.md,
        backgroundColor: brand ? colors.brand : colors.surface,
        borderWidth: brand ? 0 : 1,
        borderColor: colors.borderStrong,
      }}
    >
      <AppText
        variant="label"
        weight="semibold"
        style={brand ? { color: colors.onBrand } : undefined}
        color={brand ? undefined : 'brand'}
      >
        {label}
      </AppText>
    </Pressable>
  );
}
