import { redirect } from 'next/navigation';
import { localeCompatHref } from '@/lib/compat-href';

type Search = Record<string, string | string[] | undefined>;

/** Category and landmark groups open the inventory desk with that group selected. */
export default function InventoryGroupRedirect({
  params,
  searchParams,
}: {
  params: { locale: string; group: string };
  searchParams?: Search;
}) {
  redirect(localeCompatHref(params.locale, '/admin/inventory', searchParams, { group: params.group }));
}
