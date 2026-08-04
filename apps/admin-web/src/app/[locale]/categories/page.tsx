import { redirect } from 'next/navigation';

/** Standalone categories page — use Products hub. */
export default function CategoriesRedirectPage({ params }: { params: { locale: string } }) {
  redirect(`/${params.locale}/products`);
}
