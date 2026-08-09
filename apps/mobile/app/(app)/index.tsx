import { Redirect } from 'expo-router';
import type { Href } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { resolveMobileHomeHref } from '@/permissions';

/** Safety Redirect into the correct surface tabs. */
export default function AppIndexRedirect() {
  const { user } = useAuth();
  if (!user) return <Redirect href={'/(auth)/login' as Href} />;
  return <Redirect href={resolveMobileHomeHref(user) as Href} />;
}
