import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { SplitPane, SplitPanePlaceholder } from '@/adaptive/SplitPane';
import { firstSearchParam, useDeskSelection } from '@/adaptive/useDeskSelection';
import { useLocale } from '@/i18n';
import { OrderProductionPlanEditorScreen } from '@/features/sales-orders/OrderProductionPlanEditorScreen';
import { OrderProductionPlanScreen } from '@/features/sales-orders/OrderProductionPlanScreen';
import { ProductionDetailScreen } from './ProductionDetailScreen';
import { ProductionOverviewScreen } from './ProductionOverviewScreen';
import {
  parseProductionDeskSelection,
  productionDeskSelectedId,
  productionHubOrderHref,
} from './productionHubOrderHref';

/**
 * Admin Production tab. COMPACT/MEDIUM push. EXPANDED/WIDE embed the
 * sales-order line chooser or factory order in the side pane.
 */
export function ProductionDeskHost() {
  const { t } = useLocale();
  const router = useRouter();
  const params = useLocalSearchParams<{ lineId?: string | string[] }>();
  const { split, selected, selectOrPush } = useDeskSelection();
  const parsed = parseProductionDeskSelection(selected);
  const lineId = firstSearchParam(params.lineId);

  const onSelectHref = (href: string) => {
    const id = productionDeskSelectedId(href);
    if (id) {
      if (split) {
        router.setParams({ selected: id, lineId: '' });
        return;
      }
      selectOrPush(id, href as Href);
      return;
    }
    router.push(href as Href);
  };

  const detail =
    parsed?.kind === 'salesOrder' ? (
      <OrderProductionPlanScreen salesOrderId={parsed.id} lineId={lineId} embedded />
    ) : parsed?.kind === 'plan' ? (
      <OrderProductionPlanEditorScreen productionOrderId={parsed.id} />
    ) : parsed?.kind === 'factory' ? (
      <ProductionDetailScreen orderId={parsed.id} embedded />
    ) : null;

  return (
    <SplitPane
      testID="production-desk-split"
      split={split}
      primary={
        <ProductionOverviewScreen
          selectedOrderId={selected}
          onSelectHref={onSelectHref}
        />
      }
      detail={detail}
      detailPlaceholder={
        <SplitPanePlaceholder
          icon="construct-outline"
          title={t('mobile.adaptive.chooseProductionTitle')}
          body={t('mobile.adaptive.chooseProductionBody')}
        />
      }
    />
  );
}

export { productionHubOrderHref };
