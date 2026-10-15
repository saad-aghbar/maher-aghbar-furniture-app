import { redirect } from 'next/navigation';
import { localeCompatHref } from '@/lib/compat-href';

type Search = Record<string, string | string[] | undefined>;

/** Production flow is the workflow tab on the same order. */
export default function ProductionFlowRedirect({
  params,
  searchParams,
}: {
  params: { locale: string; id: string };
  searchParams?: Search;
}) {
  redirect(localeCompatHref(params.locale, `/admin/production/${params.id}`, searchParams, { tab: 'workflow' }));
}
