import { Redirect } from 'expo-router';
import { useAuth } from '../src/providers/auth-provider';
import { getUserSurface, surfaceHomeHref } from '../src/lib/surface';

export default function Index() {
  const { user, bootstrapping } = useAuth();

  if (bootstrapping) return null;
  if (!user) return <Redirect href="/(auth)/login" />;
  return <Redirect href={surfaceHomeHref(getUserSurface(user))} />;
}
