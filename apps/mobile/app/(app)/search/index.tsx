import { Redirect, type Href } from 'expo-router';

/**
 * Former Search Everywhere route — search now lives inline on admin Home.
 * Keep a redirect so deep links do not 404.
 */
export default function SearchRoute() {
  return <Redirect href={'/(app)/(admin)/(tabs)' as Href} />;
}
