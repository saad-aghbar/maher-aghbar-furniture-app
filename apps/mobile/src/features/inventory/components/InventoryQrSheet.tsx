import { View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import type { InventoryItem } from '../api';
import {
  formatInventoryMaterialType,
  selectInventoryItemCard,
  type InventoryItemCardModel,
} from '../selectInventory';
import { InventorySkuThumb } from './InventorySkuThumb';
import { InventorySheetFooter } from './InventorySheetFooter';

export type InventoryQrItem = {
  id: string;
  sku: string;
  name: string;
  scanCode: string | null;
  category: string;
  unit: string;
  imageUrl: string | null;
  itemClass?: string | null;
  materialType?: string | null;
};

export function qrItemFromCard(card: InventoryItemCardModel): InventoryQrItem {
  return {
    id: card.id,
    sku: card.sku,
    name: card.name,
    scanCode: card.scanCode,
    category: card.category,
    unit: card.unit,
    imageUrl: card.imageUrl,
    itemClass: card.itemClass,
    materialType: card.materialType,
  };
}

export function qrItemFromApi(item: InventoryItem, locale: string): InventoryQrItem {
  return qrItemFromCard(selectInventoryItemCard(item, locale));
}

type Props = {
  open: boolean;
  item: InventoryQrItem | null;
  onClose: () => void;
  /** After the QR Modal unmounts — present PDF picker / share from here. */
  onClosed?: () => void;
  onPrint?: () => void;
};

/**
 * Standalone QR for the printed label payload (`item.scanCode` only).
 * Sized to content — not a tall fixed sheet with empty stretch.
 */
export function InventoryQrSheet({ open, item, onClose, onClosed, onPrint }: Props) {
  const { t, isRTL } = useLocale();
  const { theme, colors } = useTheme();
  const payload = item?.scanCode?.trim() || '';
  const materialTypeLabel = formatInventoryMaterialType(item?.materialType, t);
  const meta = [item?.sku, materialTypeLabel, item?.unit].filter(Boolean).join(' · ');
  const qrSize = 168;

  return (
    <BottomSheet
      open={open && Boolean(item)}
      onClose={onClose}
      onClosed={onClosed}
      title={t('mobile.inventory.qrCode')}
      fitContent
      maxHeight={520}
    >
      {item ? (
        <View style={{ gap: theme.spacing.md, paddingBottom: theme.spacing.xs }}>
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: theme.spacing.sm,
            }}
          >
            <InventorySkuThumb uri={item.imageUrl} size={48} />
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="body" weight="semibold" numberOfLines={2}>
                {item.name}
              </AppText>
              <AppText variant="caption" color="muted" dir="ltr" numberOfLines={1}>
                {meta}
              </AppText>
            </View>
          </View>

          {payload ? (
            <View style={{ alignItems: 'center', gap: theme.spacing.sm }}>
              <View
                style={{
                  padding: theme.spacing.md,
                  borderRadius: theme.radius.lg,
                  backgroundColor: '#FFFFFF',
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <QRCode
                  value={payload}
                  size={qrSize}
                  backgroundColor="#FFFFFF"
                  color="#1A1A1A"
                />
              </View>
              <View
                style={{
                  paddingHorizontal: theme.spacing.md,
                  paddingVertical: theme.spacing.xs,
                  borderRadius: theme.radius.full,
                  backgroundColor: colors.surfaceSecondary,
                }}
              >
                <AppText variant="caption" weight="medium" dir="ltr" color="secondary">
                  {payload}
                </AppText>
              </View>
            </View>
          ) : (
            <AppText variant="caption" color="muted" align="center">
              {t('mobile.inventory.itemNotFound')}
            </AppText>
          )}

          <InventorySheetFooter
            primaryLabel={onPrint ? t('mobile.inventory.printLabel') : undefined}
            onPrimary={onPrint}
            onSecondary={onClose}
            secondaryLabel={t('mobile.inventory.cancel')}
          />
        </View>
      ) : null}
    </BottomSheet>
  );
}
