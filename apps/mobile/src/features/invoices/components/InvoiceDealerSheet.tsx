import { useMemo } from 'react';
import { useLocale } from '@/i18n';
import {
  DealerPickerSheet,
  type DealerPickerOption,
} from '@/features/dealers/components/DealerPickerSheet';
import type { InvoiceDealerOption } from '../invoiceFilters';

type Props = {
  open: boolean;
  onClose: () => void;
  dealers: InvoiceDealerOption[];
  selectedId: string | null;
  onConfirm: (dealer: { id: string; name: string } | null) => void;
};

/**
 * Searchable dealer picker for invoices — shared floor sheet + confirm.
 */
export function InvoiceDealerSheet({
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
      title={t('accounting.dealersTitle')}
      searchPlaceholder={t('accounting.searchDealers')}
      emptyLabel={t('accounting.noDealersMatch')}
      allLabel={t('accounting.allCustomers')}
      dealers={options}
      selectedId={selectedId}
      mode="confirm"
      confirmLabel={t('accounting.confirmDealer')}
      onSelect={onConfirm}
    />
  );
}
