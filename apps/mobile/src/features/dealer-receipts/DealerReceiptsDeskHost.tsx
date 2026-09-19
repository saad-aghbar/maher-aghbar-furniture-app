import type { Href } from 'expo-router';
import { SplitPane, SplitPanePlaceholder } from '@/adaptive/SplitPane';
import { useDeskSelection } from '@/adaptive/useDeskSelection';
import { useLocale } from '@/i18n';
import { DealerReceiptDetailScreen } from './DealerReceiptDetailScreen';
import { DealerReceiptsListScreen } from './DealerReceiptsListScreen';

export function DealerReceiptsDeskHost() {
  const { t } = useLocale();
  const { split, selected, selectOrPush } = useDeskSelection();
  const compactHref = (id: string) => `/(app)/(customer)/deliveries/${id}` as Href;

  return (
    <SplitPane
      testID="dealer-receipts-desk-split"
      split={split}
      primary={
        <DealerReceiptsListScreen
          detailHref={compactHref}
          backFallback={'/(app)/(customer)/(tabs)' as Href}
          selectedOrderId={selected}
          onSelectOrder={(id) => selectOrPush(id, compactHref(id))}
        />
      }
      detail={
        selected ? (
          <DealerReceiptDetailScreen salesOrderId={selected} embedded />
        ) : null
      }
      detailPlaceholder={
        <SplitPanePlaceholder
          icon="cube-outline"
          title={t('mobile.adaptive.chooseOrderTitle')}
          body={t('mobile.adaptive.chooseOrderBody')}
        />
      }
    />
  );
}
