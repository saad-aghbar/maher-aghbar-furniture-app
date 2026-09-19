import { redirect } from 'next/navigation';

/** Units of measure — consolidated under Products. */
export default function UnitsRedirectPage({ params }: { params: { locale: string } }) {
  redirect(`/${params.locale}/products`);
}
