import { useMemo } from 'react';
import { useLocale } from '@/i18n';
import {
  DealerPickerSheet,
  type DealerPickerOption,
} from '@/features/dealers/components/DealerPickerSheet';
import type { ReturnsDealerOption } from '../returnFilters';

type Props = {
  open: boolean;
  onClose: () => void;
  dealers: ReturnsDealerOption[];
  selectedId: string | null;
  onConfirm: (dealer: { id: string; name: string } | null) => void;
};

/**
 * Searchable dealer picker for returns — shared floor sheet + confirm.
 */
export function ReturnsDealerSheet({
  open,
  onClose,
  dealers,
  selectedId,
  onConfirm,
}: Props) {
  const { t } = useLocale();

  const options = useMemo<DealerPickerOption[]>(
    () =>
      dealers.map((d) => ({
        id: d.id,
        name: d.name,
        code: d.code,
        searchText: d.searchText,
      })),
    [dealers],
  );

  return (
    <DealerPickerSheet
      open={open}
      onClose={onClose}
      title={t('catalog.filterDealer')}
      searchPlaceholder={t('mobile.orders.filterDealerSearch')}
      emptyLabel={t('mobile.orders.filterDealerEmpty')}
      allLabel={t('catalog.allDealers')}
      dealers={options}
      selectedId={selectedId}
      mode="confirm"
      onSelect={onConfirm}
    />
  );
}
