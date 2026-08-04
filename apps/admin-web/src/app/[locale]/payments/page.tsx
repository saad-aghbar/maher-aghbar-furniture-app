import { redirect } from 'next/navigation';

/** Payments list — record and view payments from Invoices. */
export default function PaymentsRedirectPage({ params }: { params: { locale: string } }) {
  redirect(`/${params.locale}/invoices`);
}
