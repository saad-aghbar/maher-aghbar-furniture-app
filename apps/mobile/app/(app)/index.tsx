import { Redirect, usePathname } from 'expo-router';
import type { Href } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { shouldRedirectAppIndex } from '@/navigation/appIndexPath';
import { resolveMobileHomeHref } from '@/permissions';

/** Safety Redirect into the correct surface tabs — never steal /search. */
export default function AppIndexRedirect() {
  const { user } = useAuth();
  const pathname = usePathname();
  if (!user) return <Redirect href={'/(auth)/login' as Href} />;
  if (!shouldRedirectAppIndex(pathname)) return null;
  return <Redirect href={resolveMobileHomeHref(user) as Href} />;
}
