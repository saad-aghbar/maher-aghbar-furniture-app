import { redirect } from 'next/navigation';

/** Colors CRUD removed from nav — manage under Products / catalog settings. */
export default function ColorsRedirectPage({ params }: { params: { locale: string } }) {
  redirect(`/${params.locale}/products`);
}
