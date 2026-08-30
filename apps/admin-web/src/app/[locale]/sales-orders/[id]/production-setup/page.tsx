'use client';

import { OrderProductionSetupView } from '@/components/sales-orders/order-production-setup-view';

export default function SalesOrderProductionSetupPage({
  params,
}: {
  params: { id: string };
}) {
  return <OrderProductionSetupView salesOrderId={params.id} />;
}
