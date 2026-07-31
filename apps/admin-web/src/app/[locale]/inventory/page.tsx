'use client';

import { ListPage } from '@/components/list-page';
import { useTranslations } from 'next-intl';

interface Row {
  id: string;
  sku: string;
  nameAr: string;
  nameEn: string;
  unit: string;
  balances?: Array<{ availableQty: string | number; warehouse?: { code: string } }>;
}

export default function InventoryPage() {
  const t = useTranslations('navigation');
  const ti = useTranslations('inventory');

  return (
    <ListPage<Row>
      title={t('inventory')}
      queryKey={['inventory-items']}
      fetchPath="/api/v1/inventory/items"
      emptyTitle={ti('empty')}
      columns={[
        { key: 'sku', header: ti('sku'), render: (r) => r.sku },
        { key: 'name', header: 'Name', render: (r) => r.nameAr || r.nameEn },
        { key: 'unit', header: 'Unit', render: (r) => r.unit },
        {
          key: 'qty',
          header: ti('available'),
          render: (r) =>
            String(
              (r.balances ?? []).reduce((s, b) => s + Number(b.availableQty), 0),
            ),
        },
      ]}
    />
  );
}
