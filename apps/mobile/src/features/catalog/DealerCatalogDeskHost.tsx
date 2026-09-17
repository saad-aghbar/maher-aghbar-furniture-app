import type { Href } from 'expo-router';
import { SplitPane, SplitPanePlaceholder } from '@/adaptive/SplitPane';
import { useDeskSelection } from '@/adaptive/useDeskSelection';
import { useLocale } from '@/i18n';
import { CatalogScreen } from './CatalogScreen';
import { ProductDetailScreen } from './ProductDetailScreen';

/**
 * Dealer catalog. Optional grid|PDP split on EXPANDED+; COMPACT still pushes.
 * No admin chrome.
 */
export function DealerCatalogDeskHost() {
  const { t } = useLocale();
  const { split, selected, selectOrPush } = useDeskSelection();
  const compactHref = (id: string) => `/(app)/(customer)/catalog/${id}` as Href;

  return (
    <SplitPane
      testID="dealer-catalog-desk-split"
      split={split}
      primary={
        <CatalogScreen
          variant="dealer"
          selectedProductId={selected}
          onSelectProduct={(id) => selectOrPush(id, compactHref(id))}
        />
      }
      detail={
        selected ? (
          <ProductDetailScreen productId={selected} variant="dealer" embedded />
        ) : null
      }
      detailPlaceholder={
        <SplitPanePlaceholder
          icon="cube-outline"
          title={t('mobile.adaptive.chooseProductTitle')}
          body={t('mobile.adaptive.chooseProductBody')}
        />
      }
    />
  );
}
