import { Ionicons } from '@expo/vector-icons';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { UnitPickerPanel } from '@/features/catalog/components/MeasurementValueSheet';
import { useLocale } from '@/i18n';

type Props = {
  open: boolean;
  unit: string;
  onClose: () => void;
  onSelect: (unit: string) => void;
};

export function InventoryUnitPickerSheet({ open, unit, onClose, onSelect }: Props) {
  const { t } = useLocale();
  const title = t('mobile.inventory.pickUnit');
  const sheetTitle = title === 'mobile.inventory.pickUnit' ? 'Unit' : title;

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={sheetTitle}
      fitContent
      maxHeight={520}
      overlay
    >
      <UnitPickerPanel
        active={open}
        unit={unit}
        onSelect={(next) => {
          onSelect(next);
          onClose();
        }}
      />
    </BottomSheet>
  );
}
