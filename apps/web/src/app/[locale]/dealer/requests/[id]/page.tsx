import { redirect } from 'next/navigation';
import { localeCompatHref } from '@/lib/compat-href';

type Search = Record<string, string | string[] | undefined>;

export default function DealerRequestAliasRedirect({
  params,
  searchParams,
}: {
  params: { locale: string; id: string };
  searchParams?: Search;
}) {
  redirect(localeCompatHref(params.locale, `/dealer/orders/requests/${params.id}`, searchParams));
}
