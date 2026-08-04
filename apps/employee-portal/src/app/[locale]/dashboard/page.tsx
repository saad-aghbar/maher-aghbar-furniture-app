import { redirect } from 'next/navigation';

export default function EmployeeDashboardRedirect({ params }: { params: { locale: string } }) {
  redirect(`/${params.locale}/tasks`);
}
