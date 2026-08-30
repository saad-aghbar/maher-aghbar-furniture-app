import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import type { InventoryItem } from '../api';
import {
  formatInventoryMaterialType,
  selectInventoryItemCard,
} from '../selectInventory';
import { InventorySkuThumb } from './InventorySkuThumb';
import { InventorySheetFooter } from './InventorySheetFooter';

export type ScannedItemConfirmMode =
  | 'confirm'
  | 'blocked-type'
  | 'blocked-inactive'
  | 'not-found'
  | 'error';

type Props = {
  open: boolean;
  item: InventoryItem | null;
  mode: ScannedItemConfirmMode;
  onClose: () => void;
  onClosed?: () => void;
  onScanAgain: () => void;
  onUseMaterial?: () => void;
};

/**
 * MODE B confirmation bubble after SELECT scan.
 * Selecting material never mutates stock.
 */
export function ScannedInventoryItemConfirm({
  open,
  item,
  mode,
  onClose,
  onClosed,
  onScanAgain,
  onUseMaterial,
}: Props) {
  const { t, locale } = useLocale();
  const { colors, theme } = useTheme();
  const card = item ? selectInventoryItemCard(item, locale) : null;
  const materialTypeLabel = formatInventoryMaterialType(card?.materialType, t);
  const canUse = mode === 'confirm' && Boolean(onUseMaterial) && Boolean(card);
  const needsItem = mode === 'confirm' || mode === 'blocked-type' || mode === 'blocked-inactive';
  const sheetOpen = open && (needsItem ? Boolean(card) : true);

  const title =
    mode === 'confirm'
      ? t('mobile.inventory.materialScanned')
      : mode === 'blocked-inactive'
        ? t('mobile.inventory.inactiveCannotSelect')
        : mode === 'blocked-type'
          ? t('mobile.inventory.cannotUseHere')
          : mode === 'not-found'
            ? t('mobile.inventory.itemNotFound')
            : t('mobile.inventory.couldntIdentifyItem');

  return (
    <BottomSheet
      open={sheetOpen}
      onClose={onClose}
      onClosed={onClosed}
      title={title}
      fitContent
      maxHeight={480}
      overlay
    >
      <View style={{ gap: theme.spacing.md }}>
        {card ? (
          <View style={{ alignItems: 'center', gap: theme.spacing.sm }}>
            <AppText variant="caption" color="muted" style={{ textAlign: 'center' }}>
              {t('mobile.inventory.materialScanned')}
            </AppText>
            <InventorySkuThumb uri={card.imageUrl} size={96} />
            <AppText
              variant="body"
              weight="semibold"
              style={{ textAlign: 'center' }}
              accessibilityLabel={t('mobile.inventory.a11yUseMaterial', {
                name: card.name,
                sku: card.sku,
              })}
            >
              {card.name}
            </AppText>
            <AppText variant="caption" color="muted" dir="ltr" style={{ textAlign: 'center' }}>
              {card.sku}
              {materialTypeLabel ? ` · ${materialTypeLabel}` : ''}
              {card.unit ? ` · ${card.unit}` : ''}
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
        ) : (
          <View style={{ alignItems: 'center', gap: theme.spacing.sm, paddingVertical: theme.spacing.sm }}>
            <Ionicons
              name={mode === 'error' ? 'cloud-offline-outline' : 'alert-circle-outline'}
              size={36}
              color={colors.warning}
            />
            <AppText variant="body" weight="semibold" style={{ textAlign: 'center' }}>
              {title}
            </AppText>
          </View>
        )}

        {mode === 'confirm' ? (
          <AppText variant="body" weight="medium" style={{ textAlign: 'center' }}>
            {t('mobile.inventory.useThisMaterial')}
          </AppText>
        ) : null}

        {mode === 'blocked-inactive' || mode === 'blocked-type' ? (
          <AppText variant="caption" color="muted" style={{ textAlign: 'center' }}>
            {mode === 'blocked-inactive'
              ? t('mobile.inventory.inactiveCannotSelect')
              : t('mobile.inventory.cannotUseHere')}
          </AppText>
        ) : null}

        {mode === 'not-found' ? (
          <AppText variant="caption" color="muted" style={{ textAlign: 'center' }}>
            {t('mobile.inventory.labelUnknownBody')}
          </AppText>
        ) : null}

        {mode === 'error' ? (
          <AppText variant="caption" color="muted" style={{ textAlign: 'center' }}>
            {t('mobile.inventory.couldntIdentifyHint')}
          </AppText>
        ) : null}

        <InventorySheetFooter
          primaryLabel={
            canUse
              ? t('mobile.inventory.useMaterial')
              : mode === 'error'
                ? t('mobile.inventory.tryAgain')
                : t('mobile.inventory.scanAgain')
          }
          onPrimary={canUse ? onUseMaterial! : onScanAgain}
          secondaryLabel={
            canUse ? t('mobile.inventory.scanAgain') : t('mobile.inventory.cancel')
          }
          onSecondary={canUse ? onScanAgain : onClose}
        />
      </View>
    </BottomSheet>
  );
}
