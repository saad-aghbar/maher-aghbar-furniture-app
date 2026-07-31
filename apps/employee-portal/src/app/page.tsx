import { defaultLocale } from '@maher/i18n';
import { redirect } from 'next/navigation';

export default function RootPage() {
  redirect(`/${defaultLocale}/tasks`);
}
