import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import type { InventoryItem } from '../api';
import {
  formatInventoryMaterialType,
  selectInventoryItemCard,
} from '../selectInventory';
import { InventorySkuThumb } from './InventorySkuThumb';
import { InventoryBoardCard } from './InventoryBoardCard';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';

export type InlineScanSelectMode =
  | 'confirm'
  | 'blocked-type'
  | 'blocked-inactive'
  | 'not-found'
  | 'found-bin'
  | 'found-kit'
  | 'found-lot'
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
  const { colors, theme } = useTheme();
  const card = item ? selectInventoryItemCard(item, locale) : null;
  const materialTypeLabel = formatInventoryMaterialType(card?.materialType, t);
  const canUse = mode === 'confirm' && Boolean(onUseMaterial) && Boolean(card);
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const accent =
    canUse
      ? colors.brand
      : mode === 'not-found' || mode === 'error'
        ? colors.error
        : colors.warning;

  const title =
    mode === 'confirm'
      ? t('mobile.inventory.materialScanned')
      : mode === 'blocked-inactive'
        ? t('mobile.inventory.inactiveCannotSelect')
        : mode === 'blocked-type'
          ? t('mobile.inventory.cannotUseHere')
          : mode === 'order-fabric'
            ? t('mobile.inventory.fabricScanNotStockTitle')
            : mode === 'found-bin'
              ? t('mobile.inventory.scanIsBinTitle')
              : mode === 'found-kit'
                ? t('mobile.inventory.scanIsKitTitle')
                : mode === 'found-lot'
                  ? t('mobile.inventory.scanIsLotTitle')
                  : mode === 'not-found'
                    ? t('mobile.inventory.itemNotFound')
                    : t('mobile.inventory.couldntIdentifyItem');

  return (
    <View accessibilityLiveRegion="polite">
      <InventoryBoardCard accent={accent} title={title} titleWeight={titleWeight}>
        {card ? (
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              gap: theme.spacing.md,
              alignItems: 'center',
            }}
          >
            <InventorySkuThumb uri={card.imageUrl} size={72} />
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="body" weight={titleWeight}>
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
        ) : (
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              gap: theme.spacing.sm,
              alignItems: 'center',
            }}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.surfaceSecondary,
                borderWidth: 1,
                borderColor: accent,
              }}
            >
              <Ionicons
                name={
                  mode === 'error'
                    ? 'cloud-offline-outline'
                    : mode === 'order-fabric'
                      ? 'color-palette-outline'
                      : mode === 'found-bin'
                        ? 'file-tray-full-outline'
                        : mode === 'found-kit' || mode === 'found-lot'
                          ? 'cube-outline'
                          : 'alert-circle-outline'
                }
                size={22}
                color={accent}
              />
            </View>
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
          <View
            style={{
              borderRadius: theme.radius.lg,
              backgroundColor: colors.surfaceSecondary,
              borderWidth: 1,
              borderColor: colors.border,
              padding: theme.spacing.sm,
              gap: 2,
            }}
          >
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

        {mode === 'found-bin' ? (
          <AppText variant="caption" color="muted">
            {t('mobile.inventory.scanIsBinBody')}
          </AppText>
        ) : null}

        {mode === 'found-kit' ? (
          <AppText variant="caption" color="muted">
            {t('mobile.inventory.scanIsKitBody')}
          </AppText>
        ) : null}

        {mode === 'found-lot' ? (
          <AppText variant="caption" color="muted">
            {t('mobile.inventory.scanIsLotBody')}
          </AppText>
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
              titleWeight={titleWeight}
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
              titleWeight={titleWeight}
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
            titleWeight={titleWeight}
            onPress={() => {
              void haptics.selection();
              onScanAgain();
            }}
          />
          <ActionPill
            label={t('mobile.inventory.cancel')}
            titleWeight={titleWeight}
            onPress={() => {
              void haptics.selection();
              onCancel();
            }}
          />
        </View>
      </InventoryBoardCard>
    </View>
  );
}

function ActionPill({
  label,
  onPress,
  brand,
  titleWeight,
}: {
  label: string;
  onPress: () => void;
  brand?: boolean;
  titleWeight: 'medium' | 'semibold';
}) {
  const { colors, theme, colorScheme } = useTheme();
  return (
    <AnimatedPressable
      variant="button"
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        minHeight: theme.sizes.touch.min,
        borderRadius: theme.radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: theme.spacing.md,
        backgroundColor: brand ? colors.brand : colors.surface,
        borderWidth: brand ? 0 : 1,
        borderColor: colors.borderStrong,
        ...(brand ? null : orderBoardShadow(colorScheme)),
      }}
    >
      <AppText
        variant="label"
        weight={titleWeight}
        style={brand ? { color: colors.onBrand } : undefined}
        color={brand ? undefined : 'brand'}
      >
        {label}
      </AppText>
    </AnimatedPressable>
  );
}
