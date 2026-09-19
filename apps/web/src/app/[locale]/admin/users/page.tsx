import { redirect } from 'next/navigation';

/** Users CRUD lives on the unified Users hub (`/employees`). */
export default function UsersRedirectPage({ params }: { params: { locale: string } }) {
  redirect(`/${params.locale}/employees`);
}
