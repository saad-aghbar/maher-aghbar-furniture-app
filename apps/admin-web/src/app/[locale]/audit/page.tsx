import { redirect } from 'next/navigation';

/** Audit log — available under Settings for admins. */
export default function AuditRedirectPage({ params }: { params: { locale: string } }) {
  redirect(`/${params.locale}/settings`);
}
