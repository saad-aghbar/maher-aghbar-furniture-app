import { useEffect, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { useQuery } from '@tanstack/react-query';
import { useWindowDimensions, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { AppTextInput } from '@/components/forms/AppTextInput';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { ReturnSheetFooter } from './ReturnSheetFooter';
import { returnCtaStyle } from './returnFloorCta';
import { listWarehouses, type Warehouse } from '@/api/modules/inventory';
import { uploadFile } from '@/api/modules/uploads';
import { WarehousePickList } from '@/features/inventory/components/WarehousePickList';
import {
  locationsForWarehouse,
  WarehouseBinStrip,
} from '@/features/inventory/components/WarehouseBinBoard';
import { pickDefaultLocationId, pickerViewportHeights } from '@/features/inventory/pickDefaultLocation';
import { useScanWarehouseBin } from '@/features/inventory/useScanWarehouseBin';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import type { ReturnPiece } from '../api';

const CONDITIONS = ['GOOD', 'DAMAGED', 'INCOMPLETE'] as const;

type Props = {
  open: boolean;
  loading?: boolean;
  pieces: ReturnPiece[];
  onClose: () => void;
  onConfirm: (body: {
    pieceIds?: string[];
    receivedCondition?: string;
    warehouseId?: string;
    receivedLocationId?: string;
    receivedNotes?: string;
    photoKeys?: string[];
  }) => void;
};

export function ReturnReceiveSheet({ open, loading, pieces, onClose, onConfirm }: Props) {
  const { t, locale, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const { height } = useWindowDimensions();
  const pickerHeights = pickerViewportHeights(height);
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const awaiting = pieces.filter((piece) => piece.state === 'AWAITING_RECEIPT');
  const [selected, setSelected] = useState<string[]>([]);
  const [condition, setCondition] = useState<(typeof CONDITIONS)[number]>('GOOD');
  const [warehouseId, setWarehouseId] = useState<string | undefined>();
  const [locationId, setLocationId] = useState('');
  const scanWarehouseBin = useScanWarehouseBin();
  const [notes, setNotes] = useState('');
  const [photoKeys, setPhotoKeys] = useState<string[]>([]);
  const warehousesQuery = useQuery({
    queryKey: ['return-receive-warehouses'],
    queryFn: listWarehouses,
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;
    setSelected(awaiting.map((piece) => piece.id));
    setNotes('');
    setPhotoKeys([]);
  }, [open, awaiting.length]);

  const warehouses = warehousesQuery.data ?? [];

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      sheetHeight={pickerHeights.sheet}
      expandable
      title={t('mobile.returns.receivePieces')}
    >
      <View style={{ paddingHorizontal: theme.spacing.lg, gap: theme.spacing.md, flex: 1 }}>
        {awaiting.map((piece) => {
          const on = selected.includes(piece.id);
          return (
            <AnimatedPressable
              key={piece.id}
              variant="button"
              accessibilityLabel={piece.code}
              onPress={() => {
                void haptics.selection();
                setSelected((current) =>
                  on ? current.filter((id) => id !== piece.id) : [...current, piece.id],
                );
              }}
              style={{
                minHeight: 48,
                borderRadius: theme.radius.lg,
                borderWidth: 1,
                borderColor: on ? colors.brand : colors.border,
                backgroundColor: on ? colors.brandSoft : colors.surfaceSecondary,
                paddingHorizontal: theme.spacing.md,
                justifyContent: 'center',
                ...orderBoardShadow(colorScheme),
              }}
            >
              <AppText weight={titleWeight} dir="ltr">
                {piece.code}
              </AppText>
              <AppText variant="caption" color="muted">
                {piece.productDesc}
              </AppText>
            </AnimatedPressable>
          );
        })}

        <AppText variant="caption" color="muted" style={{ textAlign: isRTL ? 'right' : 'left' }}>
          {t('mobile.returns.receiveCondition')}
        </AppText>
        <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: theme.spacing.sm }}>
          {CONDITIONS.map((item) => (
            <AnimatedPressable
              key={item}
              variant="button"
              accessibilityLabel={item}
              onPress={() => {
                void haptics.selection();
                setCondition(item);
              }}
              style={{
                flex: 1,
                minHeight: 44,
                borderRadius: theme.radius.lg,
                borderWidth: 1,
                borderColor: condition === item ? colors.brand : colors.border,
                backgroundColor: condition === item ? colors.brandSoft : colors.surfaceSecondary,
                justifyContent: 'center',
                paddingHorizontal: theme.spacing.sm,
              }}
            >
              <AppText variant="caption" weight={titleWeight} style={{ textAlign: 'center' }}>
                {item}
              </AppText>
            </AnimatedPressable>
          ))}
        </View>

        <WarehousePickList
          warehouses={warehouses}
          selectedId={warehouseId ?? ''}
          onSelect={(id) => {
            setWarehouseId(id);
            setLocationId(
              pickDefaultLocationId(locationsForWarehouse(warehouses.find((wh) => wh.id === id))),
            );
          }}
          label={t('mobile.returns.receiveWarehouse')}
          listHeight={pickerHeights.warehouse}
          resetToken={open ? 'receive-wh' : 'closed'}
        />
        {locationsForWarehouse(warehouses.find((wh) => wh.id === warehouseId)).length > 0 ? (
          <WarehouseBinStrip
            locations={locationsForWarehouse(warehouses.find((wh) => wh.id === warehouseId))}
            selectedId={pickDefaultLocationId(
              locationsForWarehouse(warehouses.find((wh) => wh.id === warehouseId)),
              locationId,
            )}
            onSelect={setLocationId}
            listHeight={pickerHeights.bin}
            onScanPress={() => {
              void (async () => {
                const bin = await scanWarehouseBin();
                if (!bin) return;
                const whId = bin.warehouse?.id ?? bin.warehouseId;
                if (whId) setWarehouseId(whId);
                setLocationId(bin.id);
              })();
            }}
          />
        ) : null}

        <AppTextInput
          value={notes}
          onChangeText={setNotes}
          placeholder={t('mobile.returns.notesPlaceholder')}
        />

        <SecondaryButton
          label={`${t('mobile.returns.receivePhotos')}${photoKeys.length ? ` · ${photoKeys.length}` : ''}`}
          onPress={async () => {
            const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!perm.granted) return;
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              quality: 0.8,
              allowsMultipleSelection: true,
              selectionLimit: 6,
            });
            if (result.canceled || !result.assets?.length) return;
            const keys: string[] = [];
            for (const asset of result.assets) {
              const uploaded = await uploadFile({
                uri: asset.uri,
                fileName: asset.fileName ?? `return-receive-${Date.now()}.jpg`,
                mimeType: asset.mimeType ?? 'image/jpeg',
                category: 'RETURN_PHOTO',
              });
              if (uploaded.document.storageKey) keys.push(uploaded.document.storageKey);
            }
            setPhotoKeys((current) => [...current, ...keys]);
          }}
          style={returnCtaStyle(theme)}
        />

        <ReturnSheetFooter
          confirmLabel={t('mobile.returns.receive')}
          loading={loading}
          disabled={!selected.length}
          onConfirm={() => {
            if (!selected.length) return;
            onConfirm({
              pieceIds: selected,
              receivedCondition: condition,
              warehouseId,
              receivedLocationId:
                pickDefaultLocationId(
                  locationsForWarehouse(warehouses.find((wh) => wh.id === warehouseId)),
                  locationId,
                ) || undefined,
              receivedNotes: notes.trim() || undefined,
              photoKeys: photoKeys.length ? photoKeys : undefined,
            });
          }}
          onCancel={onClose}
        />
      </View>
    </BottomSheet>
  );
}
