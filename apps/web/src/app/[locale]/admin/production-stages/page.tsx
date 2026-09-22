import { redirect } from 'next/navigation';

export default function ProductionStagesRedirectPage({ params }: { params: { locale: string } }) {
  redirect(`/${params.locale}/admin/production/workflow/stages`);
}
