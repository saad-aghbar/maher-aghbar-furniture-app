import type { Href } from 'expo-router';
import { SplitPane, SplitPanePlaceholder } from '@/adaptive/SplitPane';
import { useDeskSelection } from '@/adaptive/useDeskSelection';
import { useLocale } from '@/i18n';
import { OrderDetailScreen } from '@/features/sales-orders/OrderDetailScreen';
import { ProductionDetailScreen } from '@/features/production/ProductionDetailScreen';
import { PurchaseDetailScreen } from './PurchaseDetailScreen';
import { PurchasingHubScreen } from './PurchasingHubScreen';

function parsePurchasingSelection(selected?: string):
  | { kind: 'po'; id: string }
  | { kind: 'salesOrder'; id: string }
  | { kind: 'production'; id: string }
  | null {
  if (!selected) return null;
  if (selected.startsWith('so:')) return { kind: 'salesOrder', id: selected.slice(3) };
  if (selected.startsWith('prod:')) return { kind: 'production', id: selected.slice(5) };
  return { kind: 'po', id: selected };
}

export function PurchasingDeskHost() {
  const { t } = useLocale();
  const { split, selected, selectOrPush } = useDeskSelection();
  const parsed = parsePurchasingSelection(selected);

  const detail =
    parsed?.kind === 'salesOrder' ? (
      <OrderDetailScreen orderId={parsed.id} variant="admin" embedded />
    ) : parsed?.kind === 'production' ? (
      <ProductionDetailScreen orderId={parsed.id} embedded />
    ) : parsed?.kind === 'po' ? (
      <PurchaseDetailScreen orderId={parsed.id} embedded />
    ) : null;

  return (
    <SplitPane
      testID="purchasing-desk-split"
      split={split}
      primary={
        <PurchasingHubScreen
          selectedOrderId={parsed?.kind === 'po' ? parsed.id : undefined}
          onSelectOrder={(id) =>
            selectOrPush(id, `/(app)/(admin)/purchasing/${id}` as Href)
          }
          onSelectSalesOrder={(id) =>
            selectOrPush(`so:${id}`, `/(app)/(admin)/orders/${id}` as Href)
          }
          onSelectProductionOrder={(id) =>
            selectOrPush(`prod:${id}`, `/(app)/(admin)/production/${id}` as Href)
          }
        />
      }
      detail={detail}
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
