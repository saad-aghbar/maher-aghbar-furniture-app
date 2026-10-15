import { redirect } from 'next/navigation';
import { localeCompatHref } from '@/lib/compat-href';

type Search = Record<string, string | string[] | undefined>;

export default function DealerNewOrderRedirect({
  params,
  searchParams,
}: {
  params: { locale: string };
  searchParams?: Search;
}) {
  redirect(localeCompatHref(params.locale, '/dealer/orders/new', searchParams));
}
