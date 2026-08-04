import { redirect } from 'next/navigation';

/** Quality inspections — managed from Production pipeline. */
export default function QualityRedirectPage({ params }: { params: { locale: string } }) {
  redirect(`/${params.locale}/production`);
}
