import { redirect } from 'next/navigation';
import { localeCompatHref } from '@/lib/compat-href';

type Search = Record<string, string | string[] | undefined>;

export default function InventoryWarehousesRedirect({
  params,
  searchParams,
}: {
  params: { locale: string };
  searchParams?: Search;
}) {
  redirect(localeCompatHref(params.locale, '/admin/warehouses', searchParams));
}
