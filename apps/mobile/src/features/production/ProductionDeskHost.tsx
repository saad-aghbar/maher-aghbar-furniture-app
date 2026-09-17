import { useRouter, type Href } from 'expo-router';
import { SplitPane, SplitPanePlaceholder } from '@/adaptive/SplitPane';
import { useDeskSelection } from '@/adaptive/useDeskSelection';
import { useLocale } from '@/i18n';
import { ProductionDetailScreen } from './ProductionDetailScreen';
import { ProductionOverviewScreen } from './ProductionOverviewScreen';
import { productionHubOrderHref } from './productionHubOrderHref';

function factoryOrderId(href: string): string | null {
  const match = href.match(/\/production\/([^/?]+)(?:\?|$)/);
  if (!match?.[1]) return null;
  if (href.includes('/plan') || href.includes('/workflow') || href.includes('/setup')) {
    return null;
  }
  return match[1];
}

/**
 * Admin Production tab. COMPACT/MEDIUM push. EXPANDED/WIDE embed the factory
 * order when the hub destination is the production detail (not the plan).
 */
export function ProductionDeskHost() {
  const { t } = useLocale();
  const router = useRouter();
  const { split, selected, selectOrPush } = useDeskSelection();

  const onSelectHref = (href: string) => {
    const id = factoryOrderId(href);
    if (id) {
      selectOrPush(id, href as Href);
      return;
    }
    router.push(href as Href);
  };

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
      detail={
        selected ? (
          <ProductionDetailScreen orderId={selected} embedded />
        ) : null
      }
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
