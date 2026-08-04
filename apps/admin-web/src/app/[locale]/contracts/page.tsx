import { redirect } from 'next/navigation';

/** Contracts — created from accepted quotes; see Orders. */
export default function ContractsRedirectPage({ params }: { params: { locale: string } }) {
  redirect(`/${params.locale}/orders`);
}
