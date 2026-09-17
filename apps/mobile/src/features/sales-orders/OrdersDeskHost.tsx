import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { isAtLeast } from '@/adaptive/breakpoints';
import { SplitPane, SplitPanePlaceholder } from '@/adaptive/SplitPane';
import { useMaherLayout } from '@/adaptive/useMaherLayout';
import { useLocale } from '@/i18n';
import { OrderDetailScreen } from './OrderDetailScreen';
import { OrdersListScreen } from './OrdersListScreen';

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

/**
 * Admin Orders tab host. COMPACT/MEDIUM push into `/orders/[id]` exactly as
 * today. EXPANDED/WIDE keep the list mounted and show the same prop-driven
 * `OrderDetailScreen` for `?selected=<id>` (no stack push).
 */
export function OrdersDeskHost() {
  const { t } = useLocale();
  const router = useRouter();
  const params = useLocalSearchParams<{ selected?: string | string[] }>();
  const { windowClass } = useMaherLayout();
  const split = isAtLeast(windowClass, 'expanded');
  const selected = firstParam(params.selected);

  const onSelectOrder = (id: string) => {
    if (split) {
      router.setParams({ selected: id });
      return;
    }
    router.push(`/(app)/(admin)/orders/${id}` as Href);
  };

  return (
    <SplitPane
      testID="orders-desk-split"
      split={split}
      primary={
        <OrdersListScreen
          variant="admin"
          selectedOrderId={selected}
          onSelectOrder={onSelectOrder}
        />
      }
      detail={
        selected ? <OrderDetailScreen orderId={selected} variant="admin" embedded /> : null
      }
      detailPlaceholder={
        <SplitPanePlaceholder
          title={t('mobile.adaptive.chooseOrderTitle')}
          body={t('mobile.adaptive.chooseOrderBody')}
        />
      }
    />
  );
}
