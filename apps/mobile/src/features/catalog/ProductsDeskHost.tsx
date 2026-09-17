import type { Href } from 'expo-router';
import { can } from '@maher/permissions';
import { SplitPane, SplitPanePlaceholder } from '@/adaptive/SplitPane';
import { useDeskSelection } from '@/adaptive/useDeskSelection';
import { useAuth } from '@/auth/AuthProvider';
import { useLocale } from '@/i18n';
import { AdminProductDetailScreen } from './AdminProductDetailScreen';
import { CatalogScreen } from './CatalogScreen';
import { ProductDetailScreen } from './ProductDetailScreen';

export function ProductsDeskHost() {
  const { t } = useLocale();
  const { user } = useAuth();
  const { split, selected, selectOrPush } = useDeskSelection();
  const canManage = can(user, 'catalog.manage');
  const compactHref = (id: string) => `/(app)/(admin)/products/${id}` as Href;

  return (
    <SplitPane
      testID="products-desk-split"
      split={split}
      primary={
        <CatalogScreen
          variant="admin"
          titleKey="mobile.adminHome.navProducts"
          productDetailHref={compactHref}
          showBack
          backFallback={'/(app)/(admin)/(tabs)' as Href}
          showCreateProduct
          selectedProductId={selected}
          onSelectProduct={(id) => selectOrPush(id, compactHref(id))}
        />
      }
      detail={
        selected ? (
          canManage ? (
            <AdminProductDetailScreen productId={selected} embedded />
          ) : (
            <ProductDetailScreen productId={selected} variant="admin" embedded />
          )
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
