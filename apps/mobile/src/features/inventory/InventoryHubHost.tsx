import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { isAtLeast } from '@/adaptive/breakpoints';
import { SplitPane, SplitPanePlaceholder } from '@/adaptive/SplitPane';
import { useMaherLayout } from '@/adaptive/useMaherLayout';
import { useLocale } from '@/i18n';
import { InventoryItemDetailScreen } from './InventoryItemDetailScreen';
import { InventorySignatureHome } from './components/InventorySignatureHome';
import type { InventoryCategoryGroup } from './api';
import type { InventoryLifecycle } from './preferWarehouseForReceive';
import type { FinishedBoardScope } from './selectFinishedOrders';

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

type Props = {
  initialGroup?: InventoryCategoryGroup;
  initialLifecycle?: InventoryLifecycle;
  initialScope?: FinishedBoardScope;
  initialLowStock?: boolean;
  initialHandoff?: boolean;
  initialTab?: string;
};

/**
 * Admin Inventory tab host. COMPACT/MEDIUM push `/inventory/items/[id]`.
 * EXPANDED/WIDE keep the hub mounted and embed the same prop-driven item
 * screen for `?selected=<id>`.
 */
export function InventoryHubHost(props: Props) {
  const { t } = useLocale();
  const router = useRouter();
  const params = useLocalSearchParams<{ selected?: string | string[] }>();
  const { windowClass } = useMaherLayout();
  const split = isAtLeast(windowClass, 'expanded');
  const selected = firstParam(params.selected);

  const onSelectItem = (id: string) => {
    if (split) {
      router.setParams({ selected: id });
      return;
    }
    router.push(`/(app)/(admin)/inventory/items/${id}` as Href);
  };

  return (
    <SplitPane
      testID="inventory-hub-split"
      split={split}
      primary={
        <InventorySignatureHome
          {...props}
          selectedItemId={selected}
          onSelectItem={onSelectItem}
        />
      }
      detail={selected ? <InventoryItemDetailScreen itemId={selected} embedded /> : null}
      detailPlaceholder={
        <SplitPanePlaceholder
          icon="layers-outline"
          title={t('mobile.adaptive.chooseItemTitle')}
          body={t('mobile.adaptive.chooseItemBody')}
        />
      }
    />
  );
}
