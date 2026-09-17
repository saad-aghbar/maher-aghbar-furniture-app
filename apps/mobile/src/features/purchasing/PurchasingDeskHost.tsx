import type { Href } from 'expo-router';
import { SplitPane, SplitPanePlaceholder } from '@/adaptive/SplitPane';
import { useDeskSelection } from '@/adaptive/useDeskSelection';
import { useLocale } from '@/i18n';
import { PurchaseDetailScreen } from './PurchaseDetailScreen';
import { PurchasingHubScreen } from './PurchasingHubScreen';

export function PurchasingDeskHost() {
  const { t } = useLocale();
  const { split, selected, selectOrPush } = useDeskSelection();

  return (
    <SplitPane
      testID="purchasing-desk-split"
      split={split}
      primary={
        <PurchasingHubScreen
          selectedOrderId={selected}
          onSelectOrder={(id) =>
            selectOrPush(id, `/(app)/(admin)/purchasing/${id}` as Href)
          }
        />
      }
      detail={selected ? <PurchaseDetailScreen orderId={selected} embedded /> : null}
      detailPlaceholder={
        <SplitPanePlaceholder
          icon="cart-outline"
          title={t('mobile.adaptive.choosePurchaseTitle')}
          body={t('mobile.adaptive.choosePurchaseBody')}
        />
      }
    />
  );
}
