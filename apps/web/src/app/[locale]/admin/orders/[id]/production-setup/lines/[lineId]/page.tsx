import { redirect } from 'next/navigation';
import { localeCompatHref } from '@/lib/compat-href';

type Search = Record<string, string | string[] | undefined>;

export default function LegacySetupLineRedirect({
  params,
  searchParams,
}: {
  params: { locale: string; id: string; lineId: string };
  searchParams?: Search;
}) {
  redirect(
    localeCompatHref(params.locale, `/admin/sales-orders/${params.id}/production-plan`, searchParams, {
      lineId: params.lineId,
    }),
  );
}
