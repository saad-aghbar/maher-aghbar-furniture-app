import type { Href } from 'expo-router';
import { SplitPane, SplitPanePlaceholder } from '@/adaptive/SplitPane';
import { useDeskSelection } from '@/adaptive/useDeskSelection';
import { useLocale } from '@/i18n';
import { InvoiceDetailScreen } from './InvoiceDetailScreen';
import { InvoicesListScreen } from './InvoicesListScreen';

type Props = {
  compactHref?: (id: string) => Href;
  listBackFallback?: Href;
  detailBackFallback?: Href;
  adminControls?: boolean;
};

export function InvoicesDeskHost({
  compactHref = (id) => `/(app)/(admin)/invoices/${id}` as Href,
  listBackFallback,
  detailBackFallback = '/(app)/(admin)/invoices' as Href,
  adminControls = true,
}: Props = {}) {
  const { t } = useLocale();
  const { split, selected, selectOrPush } = useDeskSelection();

  return (
    <SplitPane
      testID="invoices-desk-split"
      split={split}
      primary={
        <InvoicesListScreen
          detailHref={compactHref}
          adminControls={adminControls}
          selectedInvoiceId={selected}
          onSelectInvoice={(id) => selectOrPush(id, compactHref(id))}
          {...(listBackFallback ? { backFallback: listBackFallback } : {})}
        />
      }
      detail={
        selected ? (
          <InvoiceDetailScreen
            invoiceId={selected}
            backFallback={detailBackFallback}
            embedded
          />
        ) : null
      }
      detailPlaceholder={
        <SplitPanePlaceholder
          icon="receipt-outline"
          title={t('mobile.adaptive.chooseInvoiceTitle')}
          body={t('mobile.adaptive.chooseInvoiceBody')}
        />
      }
    />
  );
}
