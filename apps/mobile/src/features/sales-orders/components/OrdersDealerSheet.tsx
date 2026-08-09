import { useMemo } from 'react';
import { useLocale } from '@/i18n';
import {
  DealerPickerSheet,
  type DealerPickerOption,
} from '@/features/dealers/components/DealerPickerSheet';
import type { OrdersFilterDealerOption } from './OrdersFilterSheet';

type Props = {
  open: boolean;
  onClose: () => void;
  dealers: OrdersFilterDealerOption[];
  selectedId: string | null;
  onSelect: (dealer: { id: string; name: string } | null) => void;
};

/**
 * Floor dealer picker for Orders — shared DealerPickerSheet.
 */
export function OrdersDealerSheet({
  open,
  onClose,
  dealers,
  selectedId,
  onSelect,
}: Props) {
  const { t } = useLocale();

  const options = useMemo<DealerPickerOption[]>(
    () =>
      dealers.map((d) => ({
        id: d.id,
        name: d.name,
        searchText: d.searchText,
      })),
    [dealers],
  );

  return (
    <DealerPickerSheet
      open={open}
      onClose={onClose}
      title={t('mobile.orders.dealerRailEyebrow')}
      searchPlaceholder={t('mobile.orders.filterDealerSearch')}
      emptyLabel={t('mobile.orders.filterDealerEmpty')}
      allLabel={t('mobile.orders.dealerRailAll')}
      dealers={options}
      selectedId={selectedId}
      mode="immediate"
      onSelect={onSelect}
    />
  );
}
