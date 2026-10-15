import { redirect } from 'next/navigation';
import { localeCompatHref } from '@/lib/compat-href';

type Search = Record<string, string | string[] | undefined>;

export default function PurchasingSupplierOrdersRedirect({
  params,
  searchParams,
}: {
  params: { locale: string; id: string };
  searchParams?: Search;
}) {
  redirect(localeCompatHref(params.locale, `/admin/suppliers/${params.id}`, searchParams, { tab: 'orders' }));
}
