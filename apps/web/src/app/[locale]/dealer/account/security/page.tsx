'use client';

import { redirect } from 'next/navigation';

/** Security lives on the profile page (Security tab). */
export default function DealerSecurityAlias({ params }: { params: { locale: string } }) {
  redirect(`/${params.locale}/dealer/profile`);
}
