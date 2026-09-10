import { ScrollView, useWindowDimensions, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { DealerEmptyPanel } from '@/features/dealers/components/DealerEmptyPanel';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import type { WarehouseBinContents } from '../api';
import { InventorySkuThumb } from './InventorySkuThumb';
import { InventorySheetFooter } from './InventorySheetFooter';
import { locationPickerLabel } from '../pickDefaultLocation';
import { WarehouseBinPlace } from './WarehouseBinBoard';

type Props = {
  open: boolean;
  bin: WarehouseBinContents | null;
  onClose: () => void;
  onScanAgain: () => void;
  onViewItem?: (inventoryItemId: string) => void;
};

function formatQty(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(2).replace(/\.?0+$/, '');
}

export function BinContentsSheet({ open, bin, onClose, onScanAgain, onViewItem }: Props) {
  const { t, locale, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const { height } = useWindowDimensions();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const warehouseName =
    locale === 'ar'
      ? bin?.warehouse?.nameAr || bin?.warehouse?.nameEn || bin?.warehouse?.code
      : bin?.warehouse?.nameEn || bin?.warehouse?.nameAr || bin?.warehouse?.code;
  const binLabel = bin
    ? locationPickerLabel({ id: bin.id, code: bin.code, name: bin.name })
    : '';

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('mobile.inventory.binContents')}
      sheetHeight={Math.min(Math.round(height * 0.72), 640)}
    >
      <View style={{ flex: 1, gap: theme.spacing.md }}>
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
              padding: theme.spacing.md,
              ...(isRTL
                ? { paddingRight: theme.spacing.md + 4 }
                : { paddingLeft: theme.spacing.md + 4 }),
              gap: theme.spacing.xs,
            }}
          >
            {warehouseName || binLabel ? (
              <WarehouseBinPlace warehouseName={warehouseName} binLabel={binLabel} titleWeight={titleWeight} />
            ) : (
              <AppText weight={titleWeight} style={{ textAlign: isRTL ? 'right' : 'left' }}>
                {t('mobile.inventory.binShelf')}
              </AppText>
            )}
            {bin?.code ? (
              <AppText variant="caption" color="muted" dir="ltr">
                {bin.scanCode || bin.qrCode || bin.code}
              </AppText>
            ) : null}
          </View>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ gap: theme.spacing.sm, paddingBottom: theme.spacing.md }}
        >
          {(bin?.contents ?? []).length === 0 ? (
            <DealerEmptyPanel nested compact icon="cube-outline" text={t('mobile.inventory.binEmpty')} />
          ) : (
            (bin?.contents ?? []).map((row) => {
              const name =
                locale === 'ar' ? row.nameAr || row.nameEn : row.nameEn || row.nameAr || row.sku;
              const inner = (
                <View
                  style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    alignItems: 'center',
                    gap: theme.spacing.md,
                    padding: theme.spacing.md,
                  }}
                >
                  <InventorySkuThumb uri={row.imageUrl} size={48} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <AppText
                      weight={titleWeight}
                      numberOfLines={2}
                      style={{ textAlign: isRTL ? 'right' : 'left' }}
                    >
                      {name}
                    </AppText>
                    <AppText variant="caption" color="muted" dir="ltr" numberOfLines={1}>
                      {row.sku}
                      {row.unit ? ` · ${formatQty(row.availableQty)} ${row.unit}` : ''}
                    </AppText>
                  </View>
                </View>
              );
              return onViewItem ? (
                <AnimatedPressable
                  key={row.inventoryItemId}
                  variant="card"
                  accessibilityRole="button"
                  onPress={() => {
                    void haptics.selection();
                    onViewItem(row.inventoryItemId);
                  }}
                  style={{
                    borderRadius: theme.radius.xl,
                    borderWidth: 1,
                    borderColor: colors.borderStrong,
                    backgroundColor: colors.surface,
                    overflow: 'hidden',
                    ...orderBoardShadow(colorScheme),
                  }}
                >
                  {inner}
                </AnimatedPressable>
              ) : (
                <View
                  key={row.inventoryItemId}
                  style={{
                    borderRadius: theme.radius.xl,
                    borderWidth: 1,
                    borderColor: colors.borderStrong,
                    backgroundColor: colors.surface,
                    overflow: 'hidden',
                    ...orderBoardShadow(colorScheme),
                  }}
                >
                  {inner}
                </View>
              );
            })
          )}
        </ScrollView>

        <InventorySheetFooter
          primaryLabel={t('mobile.inventory.scanAgain')}
          onPrimary={onScanAgain}
          secondaryLabel={t('mobile.inventory.done')}
          onSecondary={onClose}
        />
      </View>
    </BottomSheet>
  );
}
