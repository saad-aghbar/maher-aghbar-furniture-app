import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { isAtLeast } from '@/adaptive/breakpoints';
import { SplitPane, SplitPanePlaceholder } from '@/adaptive/SplitPane';
import { useMaherLayout } from '@/adaptive/useMaherLayout';
import { useLocale } from '@/i18n';
import { OrderDetailScreen } from '@/features/sales-orders/OrderDetailScreen';
import { ProductionDetailScreen } from '@/features/production/ProductionDetailScreen';
import { InventoryItemDetailScreen } from './InventoryItemDetailScreen';
import { InventoryFinishedOrderScreen } from './InventoryFinishedOrderScreen';
import { InventorySemiOrderScreen } from './InventorySemiOrderScreen';
import { InventorySignatureHome } from './components/InventorySignatureHome';
import type { InventoryCategoryGroup } from './api';
import type { InventoryLifecycle } from './preferWarehouseForReceive';
import type { FinishedBoardScope } from './selectFinishedOrders';

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

type InventoryDeskSelection =
  | { kind: 'item'; id: string }
  | { kind: 'finished'; id: string }
  | { kind: 'semi'; id: string }
  | { kind: 'salesOrder'; id: string }
  | { kind: 'production'; id: string };

export function parseInventoryDeskSelection(
  selected?: string,
): InventoryDeskSelection | null {
  if (!selected) return null;
  if (selected.startsWith('fg:')) return { kind: 'finished', id: selected.slice(3) };
  if (selected.startsWith('semi:')) return { kind: 'semi', id: selected.slice(5) };
  if (selected.startsWith('so:')) return { kind: 'salesOrder', id: selected.slice(3) };
  if (selected.startsWith('po:')) return { kind: 'production', id: selected.slice(3) };
  return { kind: 'item', id: selected };
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
 * Admin Inventory tab host. COMPACT/MEDIUM push. EXPANDED/WIDE keep the hub
 * mounted and embed item, finished-order, semi-order, or factory detail.
 */
export function InventoryHubHost(props: Props) {
  const { t } = useLocale();
  const router = useRouter();
  const params = useLocalSearchParams<{ selected?: string | string[] }>();
  const { windowClass } = useMaherLayout();
  const split = isAtLeast(windowClass, 'expanded');
  const selected = firstParam(params.selected);
  const parsed = parseInventoryDeskSelection(selected);

  const selectOrPush = (token: string, href: Href) => {
    if (split) {
      router.setParams({ selected: token });
      return;
    }
    router.push(href);
  };

  const detail =
    parsed?.kind === 'finished' ? (
      <InventoryFinishedOrderScreen salesOrderId={parsed.id} embedded />
    ) : parsed?.kind === 'semi' ? (
      <InventorySemiOrderScreen orderId={parsed.id} embedded />
    ) : parsed?.kind === 'salesOrder' ? (
      <OrderDetailScreen orderId={parsed.id} variant="admin" embedded />
    ) : parsed?.kind === 'production' ? (
      <ProductionDetailScreen orderId={parsed.id} embedded />
    ) : parsed?.kind === 'item' ? (
      <InventoryItemDetailScreen itemId={parsed.id} embedded />
    ) : null;

  return (
    <SplitPane
      testID="inventory-hub-split"
      split={split}
      primary={
        <InventorySignatureHome
          {...props}
          selectedItemId={selected}
          onSelectItem={(id) =>
            selectOrPush(id, `/(app)/(admin)/inventory/items/${id}` as Href)
          }
          onSelectFinishedOrder={(id) =>
            selectOrPush(`fg:${id}`, `/(app)/(admin)/inventory/finished/${id}` as Href)
          }
          onSelectSemiOrder={(id) =>
            selectOrPush(`semi:${id}`, `/(app)/(admin)/inventory/semi/${id}` as Href)
          }
          onSelectSalesOrder={(id) =>
            selectOrPush(`so:${id}`, `/(app)/(admin)/orders/${id}` as Href)
          }
          onSelectProductionOrder={(id) =>
            selectOrPush(`po:${id}`, `/(app)/(admin)/production/${id}` as Href)
          }
        />
      }
      detail={detail}
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
