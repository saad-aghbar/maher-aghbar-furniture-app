import { redirect } from 'next/navigation';
import { localeCompatHref } from '@/lib/compat-href';

type Search = Record<string, string | string[] | undefined>;

export default function ReportOrderAliasRedirect({
  params,
  searchParams,
}: {
  params: { locale: string; id: string };
  searchParams?: Search;
}) {
  redirect(localeCompatHref(params.locale, `/admin/reports/orders/${params.id}`, searchParams));
}
