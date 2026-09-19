import type { Href } from 'expo-router';
import { SplitPane, SplitPanePlaceholder } from '@/adaptive/SplitPane';
import { useDeskSelection } from '@/adaptive/useDeskSelection';
import { useLocale } from '@/i18n';
import { DealerQuotationDetailScreen } from './DealerQuotationDetailScreen';
import { DealerQuotationsListScreen } from './DealerQuotationsListScreen';

export function DealerQuotationsDeskHost() {
  const { t } = useLocale();
  const { split, selected, selectOrPush } = useDeskSelection();
  const compactHref = (id: string) => `/(app)/(customer)/quotations/${id}` as Href;
  const backFallback = '/(app)/(customer)/quotations' as Href;

  return (
    <SplitPane
      testID="dealer-quotations-desk-split"
      split={split}
      primary={
        <DealerQuotationsListScreen
          detailHref={compactHref}
          backFallback={'/(app)/(customer)/(tabs)/orders' as Href}
          selectedQuotationId={selected}
          onSelectQuotation={(id) => selectOrPush(id, compactHref(id))}
        />
      }
      detail={
        selected ? (
          <DealerQuotationDetailScreen
            quotationId={selected}
            backFallback={backFallback}
            embedded
          />
        ) : null
      }
      detailPlaceholder={
        <SplitPanePlaceholder
          icon="document-text-outline"
          title={t('mobile.adaptive.chooseQuotationTitle')}
          body={t('mobile.adaptive.chooseQuotationBody')}
        />
      }
    />
  );
}
