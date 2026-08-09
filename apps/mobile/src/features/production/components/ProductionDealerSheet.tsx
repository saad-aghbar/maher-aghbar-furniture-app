import { useMemo } from 'react';
import { localizedName } from '@maher/i18n';
import type { CustomerListItem } from '@/api/modules/customers';
import { useLocale } from '@/i18n';
import {
  DealerPickerSheet,
  type DealerPickerOption,
} from '@/features/dealers/components/DealerPickerSheet';

type Props = {
  open: boolean;
  onClose: () => void;
  dealers: CustomerListItem[];
  loading?: boolean;
  selectedId: string | null;
  onSelect: (dealer: { id: string; name: string } | null) => void;
};

function toOptions(dealers: CustomerListItem[], locale: string): DealerPickerOption[] {
  return dealers.map((c) => {
    const name = localizedName(locale, c, c.code || c.name || '—');
    const searchText = [name, c.code, c.nameEn, c.nameAr, c.nameHe, c.name]
      .filter(Boolean)
      .join(' ');
    return { id: c.id, name, code: c.code, searchText };
  });
}

/**
 * Floor dealer picker for production — shared DealerPickerSheet.
 */
export function ProductionDealerSheet({
  open,
  onClose,
  dealers,
  loading,
  selectedId,
  onSelect,
}: Props) {
  const { t, locale } = useLocale();
  const options = useMemo(() => toOptions(dealers, locale), [dealers, locale]);

  return (
    <DealerPickerSheet
      open={open}
      onClose={onClose}
      title={t('mobile.production.filterDealerTitle')}
      searchPlaceholder={t('mobile.production.filterDealerSearch')}
      emptyLabel={t('mobile.production.filterDealerEmpty')}
      allLabel={t('mobile.production.filterDealerAll')}
      dealers={options}
      selectedId={selectedId}
      loading={loading}
      mode="immediate"
      onSelect={onSelect}
    />
  );
}
