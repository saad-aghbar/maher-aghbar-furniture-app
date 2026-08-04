import { redirect } from 'next/navigation';

export default function RawMaterialsPage({ params }: { params: { locale: string } }) {
  redirect(`/${params.locale}/purchasing`);
}
