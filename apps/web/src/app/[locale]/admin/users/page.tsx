import { redirect } from 'next/navigation';
import { localeCompatHref } from '@/lib/compat-href';

type Search = Record<string, string | string[] | undefined>;

/** Users CRUD lives on the unified Users hub (`/employees`). */
export default function UsersRedirectPage({
  params,
  searchParams,
}: {
  params: { locale: string };
  searchParams?: Search;
}) {
  redirect(localeCompatHref(params.locale, '/admin/employees', searchParams));
}
