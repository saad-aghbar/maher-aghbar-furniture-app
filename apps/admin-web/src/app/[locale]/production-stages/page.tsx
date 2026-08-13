import { redirect } from 'next/navigation';

export default function ProductionStagesRedirectPage({ params }: { params: { locale: string } }) {
  redirect(`/${params.locale}/production/workflow/stages`);
}
