import { redirect } from 'next/navigation';

/** Documents — attachments live on orders, tasks, and customers. */
export default function DocumentsRedirectPage({ params }: { params: { locale: string } }) {
  redirect(`/${params.locale}/orders`);
}
