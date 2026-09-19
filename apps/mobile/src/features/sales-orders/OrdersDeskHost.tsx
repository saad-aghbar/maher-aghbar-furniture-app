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

type Variant = 'admin' | 'dealer';

/**
 * Orders tab host. COMPACT/MEDIUM push. EXPANDED/WIDE keep the list mounted
 * and show OrderDetailScreen for `?selected=<id>`.
 */
export function OrdersDeskHost({ variant = 'admin' }: { variant?: Variant }) {
  const { t } = useLocale();
  const router = useRouter();
  const params = useLocalSearchParams<{ selected?: string | string[] }>();
  const { windowClass } = useMaherLayout();
  const split = isAtLeast(windowClass, 'expanded');
  const selected = firstParam(params.selected);

  const compactHref = (id: string): Href =>
    variant === 'dealer'
      ? (`/(app)/(customer)/orders/${id}` as Href)
      : (`/(app)/(admin)/orders/${id}` as Href);

  const onSelectOrder = (id: string) => {
    if (split) {
      router.setParams({ selected: id });
      return;
    }
    router.push(compactHref(id));
  };

  return (
    <SplitPane
      testID={variant === 'dealer' ? 'dealer-orders-desk-split' : 'orders-desk-split'}
      split={split}
      primary={
        <OrdersListScreen
          variant={variant}
          selectedOrderId={selected}
          onSelectOrder={onSelectOrder}
        />
      }
      detail={
        selected ? (
          <OrderDetailScreen orderId={selected} variant={variant} embedded />
        ) : null
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
