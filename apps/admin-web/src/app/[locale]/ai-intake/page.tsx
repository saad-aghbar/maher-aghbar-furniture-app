import { redirect } from 'next/navigation';

/** Standalone AI intake UI is retired — reading lives on the dealer request. */
export default function AiIntakeRedirectPage({ params }: { params: { locale: string } }) {
  redirect(`/${params.locale}/requests`);
}
