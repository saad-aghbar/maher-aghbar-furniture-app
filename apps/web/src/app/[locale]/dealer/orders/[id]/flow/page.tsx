import { redirect } from 'next/navigation';
import { localeCompatHref } from '@/lib/compat-href';

type Search = Record<string, string | string[] | undefined>;

export default function DealerOrderFlowRedirect({
  params,
  searchParams,
}: {
  params: { locale: string; id: string };
  searchParams?: Search;
}) {
  redirect(localeCompatHref(params.locale, `/dealer/orders/${params.id}`, searchParams, { tab: 'progress' }));
}
