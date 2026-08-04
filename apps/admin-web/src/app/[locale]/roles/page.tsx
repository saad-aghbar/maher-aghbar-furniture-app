import { redirect } from 'next/navigation';

/** Roles & permissions — managed under Settings. */
export default function RolesRedirectPage({ params }: { params: { locale: string } }) {
  redirect(`/${params.locale}/settings`);
}
