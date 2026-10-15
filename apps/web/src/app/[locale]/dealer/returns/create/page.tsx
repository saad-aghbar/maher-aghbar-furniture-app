import { redirect } from 'next/navigation';
import { localeCompatHref } from '@/lib/compat-href';

type Search = Record<string, string | string[] | undefined>;

export default function DealerReturnCreateRedirect({
  params,
  searchParams,
}: {
  params: { locale: string };
  searchParams?: Search;
}) {
  redirect(localeCompatHref(params.locale, '/dealer/returns', searchParams, { create: '1' }));
}
