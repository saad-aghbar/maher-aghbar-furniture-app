import { redirect } from 'next/navigation';

/** Departments — org structure under Settings. */
export default function DepartmentsRedirectPage({ params }: { params: { locale: string } }) {
  redirect(`/${params.locale}/settings`);
}
