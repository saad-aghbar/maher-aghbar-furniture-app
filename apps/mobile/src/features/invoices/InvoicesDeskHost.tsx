import type { Href } from 'expo-router';
import { SplitPane, SplitPanePlaceholder } from '@/adaptive/SplitPane';
import { useDeskSelection } from '@/adaptive/useDeskSelection';
import { useLocale } from '@/i18n';
import { InvoiceDetailScreen } from './InvoiceDetailScreen';
import { InvoicesListScreen } from './InvoicesListScreen';

export function InvoicesDeskHost() {
  const { t } = useLocale();
  const { split, selected, selectOrPush } = useDeskSelection();
  const compactHref = (id: string) => `/(app)/(admin)/invoices/${id}` as Href;

  return (
    <SplitPane
      testID="invoices-desk-split"
      split={split}
      primary={
        <InvoicesListScreen
          detailHref={compactHref}
          adminControls
          selectedInvoiceId={selected}
          onSelectInvoice={(id) => selectOrPush(id, compactHref(id))}
        />
      }
      detail={
        selected ? (
          <InvoiceDetailScreen
            invoiceId={selected}
            backFallback={'/(app)/(admin)/invoices' as Href}
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
