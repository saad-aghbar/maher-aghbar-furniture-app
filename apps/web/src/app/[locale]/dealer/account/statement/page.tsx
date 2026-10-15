import { redirect } from 'next/navigation';
import { localeCompatHref } from '@/lib/compat-href';

type Search = Record<string, string | string[] | undefined>;

export default function DealerAccountStatementRedirect({
  params,
  searchParams,
}: {
  params: { locale: string };
  searchParams?: Search;
}) {
  redirect(localeCompatHref(params.locale, '/dealer/statement', searchParams));
}
